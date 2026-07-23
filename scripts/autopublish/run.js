#!/usr/bin/env node
// Orchestrateur du pipeline autopublish — un seul run (hebdomadaire, voir
// .github/workflows/autopublish.yml) génère, relit, vérifie le gating,
// planifie et insère dans WordPress toute la file candidate de la semaine :
// hubs/sous-hubs manquants en Phase 0, articles du silo en cours en Phase 2.
// Ne fait jamais rien en Phase 1 (pause indexation, décision humaine via
// /p6-indexation) — voir skills/wordpress-publication.md section 6 et le
// plan `indexed-hugging-flurry` pour le détail de chaque étape.
const config = require('./config');
const stateLib = require('./lib/state');
const trackingXlsx = require('./lib/tracking-xlsx');
const maillage = require('./lib/maillage');
const factuel = require('./lib/factuel');
const competitorResearch = require('./lib/competitor-research');
const persona = require('./lib/persona');
const promptBuilder = require('./lib/prompt-builder');
const claudeClient = require('./lib/claude-client');
const reviewModule = require('./lib/review');
const gating = require('./lib/gating');
const similarity = require('./lib/similarity');
const scheduler = require('./lib/scheduler');
const images = require('./lib/images');
const wp = require('./lib/wp-client');
const report = require('./lib/report');

const DRY_RUN = process.argv.includes('--dry-run');

// Scoping de test uniquement (jamais utilisé en run réel hebdomadaire) :
// --test-silos="Silo A,Silo B" limite la Phase 0 à ces silos,
// --max-sous-hubs=N plafonne le nombre total de sous-hubs traités tous
// silos confondus. Absents par défaut => comportement de production inchangé.
const testSilosArg = process.argv.find(a => a.startsWith('--test-silos='));
const TEST_SILOS = testSilosArg ? testSilosArg.slice('--test-silos='.length).split(',').map(s => s.trim()) : null;
const maxSousHubArg = process.argv.find(a => a.startsWith('--max-sous-hubs='));
const MAX_SOUS_HUBS = maxSousHubArg ? Number(maxSousHubArg.slice('--max-sous-hubs='.length)) : null;

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function lastSegment(url) {
  const parts = url.split('/').filter(Boolean);
  return parts[parts.length - 1];
}

function slugifyFr(s) {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function addUsage(acc, usage) {
  if (!usage) return acc;
  acc.input_tokens += usage.input_tokens || 0;
  acc.output_tokens += usage.output_tokens || 0;
  acc.cache_read_input_tokens += usage.cache_read_input_tokens || 0;
  acc.cache_creation_input_tokens += usage.cache_creation_input_tokens || 0;
  return acc;
}

/* ---------- Résolution des identifiants WP (catégories, auteur, tags) ---------- */
// Mise en cache mémoire (par run) : évite de refaire un aller-retour WP pour
// le même auteur/catégorie/tag à chaque pièce d'un même silo — un run peut
// traiter des dizaines de pièces du même silo, inutile de re-résoudre le même
// id à chaque fois. Sans effet sur la correction, juste moins d'appels réseau
// donc moins de risque d'échec transitoire.
const authorIdCache = new Map();
const categoryIdCache = new Map();
const tagIdCache = new Map();
let usersCache = null;

async function resolveAuthorId(silo) {
  // En dry-run, ne dépend plus de WordPress du tout (ni lecture ni écriture)
  // — voir resolveCategoryId/resolveTagIds ci-dessous pour la même raison :
  // un vrai dry-run doit pouvoir valider génération+relecture+gating+
  // planification sans que l'hébergement WP (actuellement bloqué, voir
  // STATE.md) ne soit joignable ou fonctionnel. La validation "le compte
  // auteur existe vraiment" reste couverte par test-e2e.js, pas par ce mode.
  if (DRY_RUN) return null;
  if (authorIdCache.has(silo)) return authorIdCache.get(silo);
  const key = persona.getPersonaKeyForSilo(silo);
  const slug = config.WP_AUTHOR_SLUG_BY_PERSONA[key];
  if (!usersCache) usersCache = await wp.getAllUsers();
  const user = usersCache.find(u => u.slug === slug);
  if (!user) {
    throw new Error(
      `run: compte WordPress introuvable pour la persona ${key} (slug attendu "${slug}") — à créer dans wp-admin avant de publier sur le silo "${silo}".`
    );
  }
  authorIdCache.set(silo, user.id);
  return user.id;
}

async function resolveCategoryId(silo, sousCocon) {
  if (DRY_RUN) return null;
  const cacheKey = JSON.stringify([silo, sousCocon || '']);
  if (categoryIdCache.has(cacheKey)) return categoryIdCache.get(cacheKey);

  const siloCacheKey = JSON.stringify([silo, '']);
  let siloId = categoryIdCache.get(siloCacheKey);
  if (siloId === undefined) {
    const siloTerm = await wp.findOrCreateTerm('categories', slugifyFr(silo), { name: silo, slug: slugifyFr(silo) });
    siloId = siloTerm.id;
    categoryIdCache.set(siloCacheKey, siloId);
  }
  if (!sousCocon) return siloId;

  const sousTerm = await wp.findOrCreateTerm('categories', slugifyFr(sousCocon), {
    name: sousCocon,
    slug: slugifyFr(sousCocon),
    parent: siloId,
  });
  categoryIdCache.set(cacheKey, sousTerm.id);
  return sousTerm.id;
}

async function resolveTagIds(tagNames) {
  if (DRY_RUN) return [];
  const ids = [];
  for (const name of tagNames || []) {
    if (tagIdCache.has(name)) {
      ids.push(tagIdCache.get(name));
      continue;
    }
    const term = await wp.findOrCreateTerm('tags', slugifyFr(name), { name, slug: slugifyFr(name) });
    tagIdCache.set(name, term.id);
    ids.push(term.id);
  }
  return ids;
}

/* ---------- Champs ACF texte (ACF Free : pas de Repeater — voir wp-client) ---------- */

function acfFields(content) {
  return {
    tldr: content.excerpt,
    sources: (content.sources || []).map(s => `${s.label} | ${s.url}`).join('\n'),
    faq: (content.faq || []).map(f => `${f.question} | ${f.answer}`).join('\n'),
  };
}

/* ---------- Image à la une ---------- */

async function resolveFeaturedMedia(entityQuery, silo, altText) {
  if (DRY_RUN) return null;
  try {
    const found = await images.findImage(entityQuery, { silo });
    if (!found) return config.DEFAULT_IMAGE_MEDIA_ID_BY_SILO[silo] ?? null;
    const { buffer } = await images.downloadImage(found.url);
    const webpBuffer = await images.toWebp(buffer);
    const media = await wp.uploadMedia(
      webpBuffer,
      images.buildImageFilename(entityQuery, 'une'),
      'image/webp',
      altText || entityQuery
    );
    return media.id;
  } catch (e) {
    console.warn(`[images] échec sourcing pour "${entityQuery}" (${silo}) : ${e.message} — repli image par défaut.`);
    return config.DEFAULT_IMAGE_MEDIA_ID_BY_SILO[silo] ?? null;
  }
}

// Résout les images d'appui déclarées par le modèle (`inline_images[]`,
// jetons [[IMAGE:n]] dans content_gutenberg) : sourcing dédupliqué (même
// ledger que l'image à la une, voir images.js), conversion WebP systématique,
// nom de fichier explicite (description + pièce), alt renseigné à l'upload.
// En dry-run, aucune écriture WP possible : on prévisualise avec l'URL brute
// du fournisseur stock-photo plutôt que de sauter l'aperçu.
async function resolveInlineImages(contentGutenberg, inlineImages, pieceSlug, silo) {
  let result = contentGutenberg;
  for (const spec of inlineImages || []) {
    const token = `[[IMAGE:${spec.index}]]`;
    if (!result.includes(token)) continue;
    try {
      const found = await images.findImage(spec.query, { silo });
      if (!found) {
        result = result.replace(token, '');
        continue;
      }
      let src, mediaId;
      if (DRY_RUN) {
        src = found.url;
        mediaId = 0;
      } else {
        const { buffer } = await images.downloadImage(found.url);
        const webpBuffer = await images.toWebp(buffer);
        const filename = images.buildImageFilename(spec.alt || spec.query, pieceSlug);
        const media = await wp.uploadMedia(webpBuffer, filename, 'image/webp', spec.alt);
        src = media.source_url;
        mediaId = media.id;
      }
      const block = `<!-- wp:image {"id":${mediaId},"sizeSlug":"large","linkDestination":"none"} -->\n`
        + `<figure class="wp-block-image size-large"><img src="${src}" alt="${escapeHtmlAttr(spec.alt || '')}" class="wp-image-${mediaId}"/></figure>\n`
        + `<!-- /wp:image -->`;
      result = result.replace(token, block);
    } catch (e) {
      console.warn(`[images] échec image d'appui "${spec.query}" (${silo}, ${pieceSlug}) : ${e.message} — jeton retiré.`);
      result = result.replace(token, '');
    }
  }
  return result;
}

function escapeHtmlAttr(s) {
  return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

/* ---------- Génération + relecture (commun hub/sous-hub/article) ---------- */

async function generateAndReview({ contentType, silo, item, maillageEntry, childLinks, facts, competitorAngles, slug, runDate, usageAcc }) {
  const genReq = promptBuilder.buildGenerationRequest({ contentType, silo, item, maillageEntry, childLinks, facts, competitorAngles });
  const modelCfg = config.MODEL_BY_CONTENT_TYPE[contentType];
  const genResult = await claudeClient.callClaude({
    model: modelCfg.model,
    thinking: modelCfg.thinking,
    effort: modelCfg.effort,
    system: genReq.system,
    messages: genReq.messages,
    schema: genReq.schema,
    maxTokens: reviewModule.MAX_TOKENS_BY_CONTENT_TYPE?.[contentType] || 16000,
  });
  addUsage(usageAcc, genResult.usage);

  const reviewResult = await reviewModule.reviewContent({
    contentType,
    silo,
    slug,
    generatedContent: genResult.parsed,
    maillageEntry,
    facts,
    competitorAngles,
    runDate,
    model: config.REVIEW_MODEL.model,
    thinking: config.REVIEW_MODEL.thinking,
    effort: config.REVIEW_MODEL.effort,
  });
  addUsage(usageAcc, reviewResult.usage);

  // Usage propre à cette pièce (génération + relecture), distinct du cumul
  // de tout le run (usageAcc) — pour le détail par page demandé par
  // l'utilisateur le 2026-07-22 (voir report.js).
  const itemUsage = addUsage(
    { input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 },
    genResult.usage
  );
  addUsage(itemUsage, reviewResult.usage);

  return { content: reviewResult.content, usage: itemUsage };
}

/* ---------- Phase 0 : hubs & sous-hubs ---------- */

// Vérifie si une page WP existe déjà pour ce slug. En cas d'échec réseau
// (après épuisement des retries de wp-client), on ne peut pas savoir si la
// page existe ou non — dans le doute, on NE l'ajoute PAS à la file candidate
// ce run (plus sûr qu'une fausse création en double si la page existe déjà
// mais que la vérification a juste échoué techniquement). Elle sera
// re-vérifiée au prochain run.
async function wpPageExistsSafe(slug, warnLabel) {
  try {
    return !!(await wp.findBySlug('pages', slug));
  } catch (e) {
    console.warn(`[phase0] vérification d'existence impossible pour "${warnLabel}" (${slug}) : ${e.message} — ignoré ce run.`);
    return true; // traité comme "existe" => exclu de la file candidate par prudence
  }
}

async function buildPhase0Candidates() {
  const hubs = [];
  for (const hubUrl of maillage.getAllHubUrls()) {
    const slug = lastSegment(hubUrl);
    if (await wpPageExistsSafe(slug, hubUrl)) continue;
    const anyEntry = maillage.getEntriesByHub(hubUrl)[0];
    if (!anyEntry) continue;
    hubs.push({ contentType: 'hub', url: hubUrl, slug, silo: anyEntry.silo });
  }

  const sousHubUrls = [...new Set(maillage.loadMaillage().map(e => e.sous_hub))];
  const sousHubs = [];
  for (const sousHubUrl of sousHubUrls) {
    const slug = lastSegment(sousHubUrl);
    if (await wpPageExistsSafe(slug, sousHubUrl)) continue;
    const entries = maillage.getEntriesBySousHub(sousHubUrl);
    const anyEntry = entries[0];
    if (!anyEntry) continue;
    sousHubs.push({
      contentType: 'sous-hub',
      url: sousHubUrl,
      slug,
      silo: anyEntry.silo,
      title: anyEntry.ancres?.entite_seule || slug,
      hubUrl: anyEntry.hub,
      hubSlug: lastSegment(anyEntry.hub),
      childArticleEntries: entries,
    });
  }

  const capacity = config.PHASE_CAPACITY_PER_DAY[0];
  const weekCap = capacity * 7; // une semaine de file en un run hebdomadaire

  let filteredHubs = hubs;
  let filteredSousHubs = sousHubs;
  if (TEST_SILOS) {
    filteredHubs = hubs.filter(h => TEST_SILOS.includes(h.silo));
    filteredSousHubs = sousHubs.filter(sh => TEST_SILOS.includes(sh.silo));
  }
  if (MAX_SOUS_HUBS != null) filteredSousHubs = filteredSousHubs.slice(0, MAX_SOUS_HUBS);

  return { hubs: filteredHubs.slice(0, weekCap), sousHubs: filteredSousHubs.slice(0, weekCap) };
}

function wpPageDateGmt(page) {
  return page && page.date_gmt ? new Date(`${page.date_gmt}Z`) : null;
}

// Résout la date du hub parent d'un sous-hub : soit dans hubDateBySlug (hub
// programmé PLUS TÔT dans CE même run), soit en interrogeant WP (hub déjà
// existant d'un run précédent). Toute panne réseau ici est traitée comme
// "parent non publié" (échec de gating naturel, jamais un crash) — l'entrée
// sera simplement retentée au run suivant.
// `hubIdBySlug` n'est peuplé par la boucle d'insertion des hubs (plus haut)
// que pour un hub publié DANS CE MÊME run — un hub publié un run précédent
// (cas normal : hub et sous-hub ne sont pas toujours traités le même jour)
// laissait `hubIdBySlug` vide pour lui, et donc `parent` non résolu à
// l'insertion du sous-hub (voir plus bas, `hubIdBySlug.get(sousHub.hubSlug)`)
// — bug réel constaté le 2026-07-22 (sous-hub publié avec `parent: 0`,
// hiérarchie WP cassée, cards de la page hub vides). Corrigé en peuplant
// aussi `hubIdBySlug` ici, dès qu'on interroge WP pour un hub pré-existant.
async function resolveHubParentDate(hubSlug, hubDateBySlug, hubIdBySlug) {
  if (hubDateBySlug.has(hubSlug)) return hubDateBySlug.get(hubSlug);
  try {
    const page = await wp.findBySlug('pages', hubSlug);
    if (page && !hubIdBySlug.has(hubSlug)) hubIdBySlug.set(hubSlug, page.id);
    const date = wpPageDateGmt(page);
    return date ? date.toISOString() : null;
  } catch (e) {
    console.warn(`[phase0] impossible de vérifier la date du hub "${hubSlug}" : ${e.message} — sous-hub reporté au run suivant.`);
    return null;
  }
}

async function runPhase0(state, runDate, usageAcc) {
  const { hubs, sousHubs } = await buildPhase0Candidates();
  const capacity = config.PHASE_CAPACITY_PER_DAY[0];
  if (!state.phase_start_date) state.phase_start_date = runDate;

  const items = [];
  const hubDateBySlug = new Map();
  const hubIdBySlug = new Map();

  /* --- Hubs : génération + relecture + gating, un échec n'affecte que ce hub --- */
  const hubGatingPassed = [];
  for (const hub of hubs) {
    try {
      const childLinks = maillage.getEntriesByHub(hub.url).reduce((acc, e) => {
        if (!acc.some(c => c.url === e.sous_hub)) acc.push({ url: e.sous_hub, title: e.ancres?.entite_seule || e.sous_hub });
        return acc;
      }, []);
      const facts = factuel.searchFacts(hub.silo);
      const competitorAngles = await competitorResearch.searchCompetitorAngles(hub.silo);

      const { content, usage } = await generateAndReview({
        contentType: 'hub', silo: hub.silo, item: null, maillageEntry: null,
        childLinks, facts, competitorAngles, slug: hub.slug, runDate, usageAcc,
      });

      const gatingResult = gating.runGating({
        contentType: 'hub', silo: hub.silo, sousCocon: null, content,
        clusterRow: null, trackingRows: null, maillageEntry: null,
        childLinksCount: childLinks.length, parentPublished: true, factsProvided: facts,
      });

      if (gatingResult.passed) hubGatingPassed.push({ ...hub, content, usage });
      else items.push({ slug: hub.slug, contentType: 'hub', status: 'draft', reasons: gatingResult.failures.map(f => f.message), usage });
    } catch (e) {
      console.error(`[phase0] échec génération/gating hub "${hub.slug}" : ${e.message}`);
      items.push({ slug: hub.slug, contentType: 'hub', status: 'erreur', reasons: [e.message] });
    }
  }

  const hubScheduled = scheduler.computeSchedule({
    phase: 0, phaseStartDate: state.phase_start_date, queue: hubGatingPassed,
    capacityOverride: capacity, startIndex: state.items_scheduled_in_phase,
  });
  state.items_scheduled_in_phase += hubScheduled.length;

  /* --- Hubs : insertion WP, un échec n'affecte que ce hub --- */
  for (const hub of hubScheduled) {
    try {
      const authorId = await resolveAuthorId(hub.silo);
      const categoryId = await resolveCategoryId(hub.silo, null);
      const featuredMedia = await resolveFeaturedMedia(hub.silo, hub.silo, hub.content.title);
      const resolvedContent = await resolveInlineImages(hub.content.content_gutenberg, hub.content.inline_images, hub.slug, hub.silo);
      const payload = {
        title: hub.content.title,
        slug: hub.slug,
        status: 'future',
        date_gmt: hub.post_date.replace(/Z$/, ''),
        content: resolvedContent,
        excerpt: hub.content.excerpt,
        categories: [categoryId],
        author: authorId,
        featured_media: featuredMedia || undefined,
        acf: acfFields(hub.content),
      };
      if (!DRY_RUN) {
        const created = await wp.createPage(payload);
        hubIdBySlug.set(hub.slug, created.id);
        similarity.addToIndex(hub.silo, hub.silo, hub.slug, hub.content.content_gutenberg);
      }
      hubDateBySlug.set(hub.slug, hub.post_date);
      items.push({ slug: hub.slug, contentType: 'hub', status: 'publie', postDate: hub.post_date, usage: hub.usage });
    } catch (e) {
      console.error(`[phase0] échec insertion WP hub "${hub.slug}" : ${e.message}`);
      items.push({ slug: hub.slug, contentType: 'hub', status: 'erreur', reasons: [e.message] });
    }
  }

  /* --- Sous-hubs : génération + relecture + gating --- */
  const sousHubGatingPassed = [];
  for (const sousHub of sousHubs) {
    try {
      const parentDate = await resolveHubParentDate(sousHub.hubSlug, hubDateBySlug, hubIdBySlug);
      const parentPublished = !!parentDate;

      const childLinks = sousHub.childArticleEntries.map(e => ({ url: e.url, title: e.ancres?.naturelle_longue || e.mot_cle_principal }));
      const facts = factuel.searchFacts(sousHub.title);
      const competitorAngles = await competitorResearch.searchCompetitorAngles(sousHub.title);

      const { content, usage } = await generateAndReview({
        contentType: 'sous-hub', silo: sousHub.silo, item: null, maillageEntry: null,
        childLinks, facts, competitorAngles, slug: sousHub.slug, runDate, usageAcc,
      });

      const gatingResult = gating.runGating({
        contentType: 'sous-hub', silo: sousHub.silo, sousCocon: sousHub.title, content,
        clusterRow: null, trackingRows: null, maillageEntry: null,
        childLinksCount: childLinks.length, parentPublished, factsProvided: facts,
      });

      if (gatingResult.passed) sousHubGatingPassed.push({ ...sousHub, content, parentDate, usage });
      else items.push({ slug: sousHub.slug, contentType: 'sous-hub', status: 'draft', reasons: gatingResult.failures.map(f => f.message), usage });
    } catch (e) {
      console.error(`[phase0] échec génération/gating sous-hub "${sousHub.slug}" : ${e.message}`);
      items.push({ slug: sousHub.slug, contentType: 'sous-hub', status: 'erreur', reasons: [e.message] });
    }
  }

  const sousHubScheduled = scheduler.computeSchedule({
    phase: 0, phaseStartDate: state.phase_start_date, queue: sousHubGatingPassed,
    capacityOverride: capacity, startIndex: state.items_scheduled_in_phase,
  });
  state.items_scheduled_in_phase += sousHubScheduled.length;

  /* --- Sous-hubs : insertion WP --- */
  for (const sousHub of sousHubScheduled) {
    try {
      const authorId = await resolveAuthorId(sousHub.silo);
      const categoryId = await resolveCategoryId(sousHub.silo, sousHub.title);
      const featuredMedia = await resolveFeaturedMedia(sousHub.title, sousHub.silo, sousHub.content.title);
      const resolvedContent = await resolveInlineImages(sousHub.content.content_gutenberg, sousHub.content.inline_images, sousHub.slug, sousHub.silo);
      const parentId = hubIdBySlug.get(sousHub.hubSlug);
      // En dry-run, le hub n'est jamais réellement créé (voir plus haut,
      // wp.createPage sauté si DRY_RUN) : aucun id ne peut donc exister pour
      // lui même s'il est publié dans ce même run simulé, ce n'est pas une
      // vraie anomalie à signaler.
      if (!parentId && !DRY_RUN) {
        console.warn(`[phase0] parent introuvable pour le sous-hub "${sousHub.slug}" (hub "${sousHub.hubSlug}"), publié quand même sans hiérarchie WP. À corriger manuellement.`);
      }
      const payload = {
        title: sousHub.content.title,
        slug: sousHub.slug,
        status: 'future',
        date_gmt: sousHub.post_date.replace(/Z$/, ''),
        content: resolvedContent,
        excerpt: sousHub.content.excerpt,
        categories: [categoryId],
        author: authorId,
        parent: parentId || undefined,
        featured_media: featuredMedia || undefined,
        acf: acfFields(sousHub.content),
      };
      if (!DRY_RUN) {
        await wp.createPage(payload);
        similarity.addToIndex(sousHub.silo, sousHub.title, sousHub.slug, sousHub.content.content_gutenberg);
      }
      items.push({ slug: sousHub.slug, contentType: 'sous-hub', status: 'publie', postDate: sousHub.post_date, usage: sousHub.usage });
    } catch (e) {
      console.error(`[phase0] échec insertion WP sous-hub "${sousHub.slug}" : ${e.message}`);
      items.push({ slug: sousHub.slug, contentType: 'sous-hub', status: 'erreur', reasons: [e.message] });
    }
  }

  return items;
}

/* ---------- Phase 2 : articles ---------- */

function pickArticleQueueForSilo(silo, rows, remainingBudget) {
  const candidates = rows.filter(r => r.silo === silo && ['à faire', 'en rédaction'].includes(r.statut));
  if (!candidates.length || remainingBudget <= 0) return [];

  const byIntent = {};
  for (const row of candidates) (byIntent[row.intention] ||= []).push(row);
  for (const list of Object.values(byIntent)) {
    list.sort((a, b) => (Number(b.volume_estime) || 0) - (Number(a.volume_estime) || 0));
  }

  const quotas = {};
  for (const [intent, share] of Object.entries(config.INTENT_QUOTA)) {
    quotas[intent] = Math.max(1, Math.round(remainingBudget * share));
  }

  const selected = [];
  const cursors = {};
  let progressed = true;
  while (selected.length < remainingBudget && progressed) {
    progressed = false;
    for (const intent of Object.keys(config.INTENT_QUOTA)) {
      if (selected.length >= remainingBudget) break;
      const takenSoFar = selected.filter(r => r.intention === intent).length;
      if (takenSoFar >= quotas[intent]) continue;
      const list = byIntent[intent] || [];
      const cursor = cursors[intent] || 0;
      if (cursor < list.length) {
        selected.push(list[cursor]);
        cursors[intent] = cursor + 1;
        progressed = true;
      }
    }
  }

  if (selected.length < remainingBudget) {
    const remaining = candidates
      .filter(r => !selected.includes(r))
      .sort((a, b) => (Number(b.volume_estime) || 0) - (Number(a.volume_estime) || 0));
    for (const row of remaining) {
      if (selected.length >= remainingBudget) break;
      selected.push(row);
    }
  }

  return selected;
}

async function runPhase2(state, runDate, trackingRows, usageAcc) {
  const items = [];
  let silo = state.silo_en_cours;
  const remainingBudget = Math.max(0, config.WEEKLY_BUDGET_PHASE2 - state.budget_consomme);
  if (remainingBudget <= 0) return items;

  const siloHasWork = s => trackingRows.some(r => r.silo === s && ['à faire', 'en rédaction'].includes(r.statut));

  if (!silo || !siloHasWork(silo)) {
    const nextSilo = config.SILO_ORDER_PHASE2.find(s => siloHasWork(s));
    if (!nextSilo) return items; // plus rien à faire dans aucun silo
    if (nextSilo !== silo) {
      silo = nextSilo;
      state.silo_en_cours = silo;
      state.silo_start_date = runDate;
      state.items_scheduled_for_silo = 0;
    }
  }
  if (!state.silo_start_date) state.silo_start_date = runDate;

  const candidateRows = pickArticleQueueForSilo(silo, trackingRows, remainingBudget);
  const capacity = config.PHASE_CAPACITY_PER_DAY[2];
  const gatingPassed = [];

  for (const row of candidateRows) {
    const maillageEntry = maillage.getEntryByKeyword(row.mot_cle_principal);
    const slug = maillageEntry ? lastSegment(maillageEntry.url) : slugifyFr(row.mot_cle_principal);
    try {
      const facts = factuel.searchFacts(`${row.mot_cle_principal} ${row.variantes || ''}`);
      const competitorAngles = await competitorResearch.searchCompetitorAngles(row.mot_cle_principal);

      const parentSlug = maillageEntry ? lastSegment(maillageEntry.sous_hub) : null;
      let parentDate = null;
      if (parentSlug) {
        try {
          const parentPage = await wp.findBySlug('pages', parentSlug);
          const d = wpPageDateGmt(parentPage);
          parentDate = d ? d.toISOString() : null;
        } catch (e) {
          console.warn(`[phase2] impossible de vérifier le sous-hub parent "${parentSlug}" pour "${slug}" : ${e.message} — reporté au run suivant.`);
        }
      }

      const { content, usage } = await generateAndReview({
        contentType: 'article', silo, item: row, maillageEntry, childLinks: [],
        facts, competitorAngles, slug, runDate, usageAcc,
      });

      const gatingResult = gating.runGating({
        contentType: 'article', silo, sousCocon: row.sous_cocon, content,
        clusterRow: row, trackingRows, maillageEntry, childLinksCount: 0,
        parentPublished: !!parentDate, factsProvided: facts,
      });

      if (gatingResult.passed) {
        gatingPassed.push({ row, slug, maillageEntry, content, parentDate, usage });
      } else {
        items.push({ slug, contentType: 'article', status: 'draft', reasons: gatingResult.failures.map(f => f.message), usage });
      }
    } catch (e) {
      console.error(`[phase2] échec génération/gating article "${slug}" : ${e.message}`);
      items.push({ slug, contentType: 'article', status: 'erreur', reasons: [e.message] });
    }
  }

  const scheduled = scheduler.computeSchedule({
    phase: 2, phaseStartDate: state.silo_start_date, queue: gatingPassed,
    capacityOverride: capacity, startIndex: state.items_scheduled_for_silo,
  });

  for (const art of scheduled) {
    try {
      const authorId = await resolveAuthorId(silo);
      const categoryId = await resolveCategoryId(silo, art.row.sous_cocon);
      const tagIds = await resolveTagIds(art.content.tags);
      const featuredMedia = await resolveFeaturedMedia(art.row.mot_cle_principal, silo, art.content.title);
      const resolvedContent = await resolveInlineImages(art.content.content_gutenberg, art.content.inline_images, art.slug, silo);
      const payload = {
        title: art.content.title,
        slug: art.slug,
        status: 'future',
        date_gmt: art.post_date.replace(/Z$/, ''),
        content: resolvedContent,
        excerpt: art.content.excerpt,
        categories: [categoryId],
        tags: tagIds,
        author: authorId,
        featured_media: featuredMedia || undefined,
        acf: acfFields(art.content),
      };

      if (!DRY_RUN) {
        await wp.createPost(payload);
        similarity.addToIndex(silo, art.row.sous_cocon, art.slug, art.content.content_gutenberg);
        trackingXlsx.updateRow(trackingRows, art.row.mot_cle_principal, {
          statut: 'programmé',
          url_cible: art.maillageEntry ? art.maillageEntry.url : `/${art.slug}`,
          date_publication: art.post_date.slice(0, 10),
        });
      }
      items.push({ slug: art.slug, contentType: 'article', status: 'publie', postDate: art.post_date, usage: art.usage });
    } catch (e) {
      console.error(`[phase2] échec insertion WP article "${art.slug}" : ${e.message}`);
      items.push({ slug: art.slug, contentType: 'article', status: 'erreur', reasons: [e.message] });
    }
  }

  state.items_scheduled_for_silo += scheduled.length;
  state.budget_consomme += scheduled.length;

  return items;
}

/* ---------- Orchestration principale ---------- */

async function main() {
  const runDate = todayIso();
  const usageAcc = { input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 };
  let items = [];
  let fatalError = null;
  // État de repli pour le rapport si state.js lui-même échoue à charger
  // (fichier corrompu) — on ne DEVINE jamais un état par défaut pour piloter
  // la suite (ça pourrait relancer la Phase 0 alors qu'on est en Phase 2),
  // mais le rapport doit quand même pouvoir s'écrire avec ce qu'on sait.
  let state = { phase: '?', silo_en_cours: null };

  try {
    state = stateLib.loadState();
    stateLib.resetWeeklyBudgetIfNeeded(state);

    if (state.phase === 1) {
      console.log('Phase 1 (pause indexation) : aucune génération/publication. Vérifier /p6-indexation avant de repasser en phase 2.');
      return;
    }

    if (state.phase === 0) {
      items = await runPhase0(state, runDate, usageAcc);
    } else if (state.phase === 2) {
      const trackingRows = trackingXlsx.readRows();
      items = await runPhase2(state, runDate, trackingRows, usageAcc);
      if (!DRY_RUN && items.some(i => i.status === 'publie')) {
        trackingXlsx.writeRows(trackingRows);
      }
    } else {
      console.log(`Phase inconnue (${state.phase}) — arrêt sans action.`);
      return;
    }
  } catch (e) {
    // Chaque pièce individuelle est déjà isolée par try/catch dans
    // runPhase0/runPhase2 — arriver ici signifie une panne STRUCTURELLE (état
    // ou xlsx corrompu, WordPress totalement injoignable pendant la
    // construction de la file candidate, etc.), pas un item isolable. On ne
    // perd pas pour autant le travail déjà accompli : rapport et état sont
    // quand même écrits ci-dessous, avec cette erreur consignée clairement
    // plutôt qu'un simple crash silencieux.
    console.error('[run] échec fatal du run :', e);
    fatalError = e;
    items.push({ slug: '(run entier)', contentType: 'run', status: 'erreur', reasons: [e.message] });
  }

  state.derniere_execution = new Date().toISOString();
  if (!DRY_RUN && state.phase !== '?') {
    try {
      stateLib.saveState(state);
    } catch (e) {
      console.error('[run] échec de sauvegarde de l\'état (non bloquant, le rapport sera quand même écrit) :', e);
    }
  }

  let reportPath = null;
  try {
    reportPath = report.writeRunReport({
      runDate, dryRun: DRY_RUN, phase: state.phase, silo: state.silo_en_cours, items, totalUsage: usageAcc,
    });
  } catch (e) {
    console.error('[run] échec d\'écriture du rapport :', e);
  }

  console.log(`Run ${DRY_RUN ? '(dry-run) ' : ''}terminé. Rapport : ${reportPath ?? '(non écrit — voir erreur ci-dessus)'}`);
  console.log(
    `Traités : ${items.length} — programmés : ${items.filter(i => i.status === 'publie').length}` +
    ` — bloqués (gating) : ${items.filter(i => i.status === 'draft').length}` +
    ` — erreurs techniques : ${items.filter(i => i.status === 'erreur').length}`
  );

  // Le rapport/état sont sauvegardés ci-dessus AVANT de faire échouer le
  // process — une panne structurelle doit rester visible dans les logs GitHub
  // Actions (sortie non-zéro), mais ne doit jamais faire perdre le rapport.
  if (fatalError) process.exit(1);
}

main().catch(e => {
  console.error('[run] échec imprévu en dehors du filet de sécurité :', e);
  process.exit(1);
});
