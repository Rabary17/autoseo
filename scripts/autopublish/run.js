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
const tavilyFacts = require('./lib/tavily-facts');
const persona = require('./lib/persona');
const promptBuilder = require('./lib/prompt-builder');
const mistralClient = require('./lib/mistral-client');
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
// --max-articles=N plafonne le nombre d'articles traités en Phase 2 pour ce
// run (même principe que --max-sous-hubs pour la Phase 0) — utile pour
// tester "un seul sous-cocon entier" sans déborder sur le suivant.
const maxArticlesArg = process.argv.find(a => a.startsWith('--max-articles='));
const MAX_ARTICLES = maxArticlesArg ? Number(maxArticlesArg.slice('--max-articles='.length)) : null;

// En dessous de ce nombre de faits locaux (data/factuel/*.json), le cluster
// est considéré trop pauvre pour tenir 1500+ mots sans inventer de chiffre —
// complété par une recherche Tavily en direct (demande explicite de
// l'utilisateur, 2026-07-29, voir lib/tavily-facts.js).
const MIN_LOCAL_FACTS_FOR_ARTICLE = 5;

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

// Sauvegarde incrémentale de l'état (2026-07-27, demande explicite de
// l'utilisateur après un run interrompu par épuisement de crédit) : jusque-là,
// `state.json` n'était écrit qu'une seule fois, tout à la fin de `main()` —
// insuffisant pour protéger les COMPTEURS (items_scheduled_*/budget_consomme)
// en cas de kill brutal du process en cours de boucle, même après le
// correctif "insertion WP immédiate" (le contenu déjà publié était protégé,
// mais pas la position dans la file pour la reprise). Appelée après chaque
// pièce insérée avec succès, jamais en dry-run.
function persistStateProgress(state) {
  if (DRY_RUN) return;
  state.derniere_execution = new Date().toISOString();
  try {
    stateLib.saveState(state);
  } catch (e) {
    console.error(`[run] échec de sauvegarde incrémentale de l'état (non bloquant) : ${e.message}`);
  }
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

// Slugs d'articles RÉELLEMENT publiés dans WordPress (tous statuts) — voir
// getLinkableChildArticles ci-dessous. Constaté le 2026-07-28 (audit d'un
// export WXR complet) : les sous-hubs liaient systématiquement leurs articles
// enfants en URL réelle (/slug/) sans jamais vérifier qu'ils existaient déjà
// — 308 liens morts sur ~85 pages, faute d'articles publiés (P5 pas encore
// lancé). La règle "jamais de lien actif vers une cible non publiée" avait
// été appliquée une fois à la main le 2026-07-25 mais jamais intégrée au
// pipeline lui-même : chaque nouveau sous-hub généré depuis reproduisait le
// même défaut. Un seul chargement réseau par run, mais complété localement au
// fil des insertions (voir markArticleSlugAsExisting) : en Phase 2, les
// articles d'un même sous-cocon se citent entre eux (liens_lateraux) et sont
// tous traités dans le même run — sans ce complément, le 1er article publié
// dans le run restait invisible pour le 4e du même lot (constaté en test réel
// le 2026-07-29 : les 4 articles de "GPL, GNV & hydrogène" se sont tous
// retrouvés avec une liste de liens latéraux vide).
let existingArticleSlugsCache = null;
async function getExistingArticleSlugs() {
  if (existingArticleSlugsCache) return existingArticleSlugsCache;
  const all = [];
  for (let page = 1; ; page += 1) {
    const batch = await wp.request(`/posts?per_page=100&page=${page}&status=any&_fields=slug`).catch(() => []);
    if (!batch.length) break;
    all.push(...batch);
    if (batch.length < 100) break;
  }
  existingArticleSlugsCache = new Set(all.map((p) => p.slug));
  return existingArticleSlugsCache;
}

// Appelé juste après l'insertion WP réussie d'un article (jamais avant, pour
// ne jamais rendre linkable une cible qui a échoué au gating) — met à jour le
// cache en mémoire sans nouvel appel réseau, pour que les articles suivants
// du même run puissent déjà le citer.
function markArticleSlugAsExisting(slug) {
  existingArticleSlugsCache?.add(slug);
}

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

function acfFields(content, keywords) {
  return {
    tldr: content.excerpt,
    sources: (content.sources || []).map(s => s.label).join('\n'),
    faq: (content.faq || []).map(f => `${f.question} | ${f.answer}`).join('\n'),
    // Distincts du H1 (`title`)/de l'extrait (`excerpt`) — voir gating.js
    // checkSeoFields et le mu-plugin (champs ACF meta_title/meta_description,
    // 2026-07-28) : jusqu'ici générés puis jamais persistés ni consommés par
    // le frontend, qui dérivait <title>/description du H1/excerpt.
    meta_title: content.meta_title,
    meta_description: content.meta_description,
    // Balise <meta name="keywords"> (2026-07-30, demande explicite) — dérivée
    // directement du mot-clé principal + ses variantes (tracking-mots-cles.xlsx),
    // jamais laissée au modèle (pas de valeur ajoutée à la faire générer, et un
    // risque d'invention en moins). Absent pour les hubs/sous-hubs (pas de `row`).
    ...(keywords ? { keywords } : {}),
  };
}

// Mot-clé principal + variantes, plafonné pour rester une vraie liste de mots-clés
// (certains clusters ont 15+ variantes en base — inutile et too-long en <meta>).
const MAX_KEYWORD_VARIANTS = 8;
function buildKeywords(row) {
  const variants = (row.variantes || '').split(';').map(v => v.trim()).filter(Boolean).slice(0, MAX_KEYWORD_VARIANTS);
  return [row.mot_cle_principal, ...variants].filter(Boolean).join(', ');
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
      result = replaceImageToken(result, token, block);
    } catch (e) {
      console.warn(`[images] échec image d'appui "${spec.query}" (${silo}, ${pieceSlug}) : ${e.message} — jeton retiré.`);
      result = replaceImageToken(result, token, '');
    }
  }
  return result;
}

// Constaté le 2026-07-28 (audit WXR, 46/137 pages) : le modèle place presque
// toujours le jeton [[IMAGE:n]] comme SEUL contenu d'un paragraphe Gutenberg
// (`<!-- wp:paragraph --><p>[[IMAGE:n]]</p><!-- /wp:paragraph -->`) plutôt
// que nu — un remplacement naïf du jeton laissait alors le bloc wp:image
// imbriqué dans le wp:paragraph englobant (markup Gutenberg invalide, casse
// la ré-édition dans wp-admin même si le HTML brut reste affichable). On
// remplace tout le paragraphe englobant quand il ne contient QUE le jeton,
// pour que wp:image redevienne un bloc de premier niveau ; sinon (jeton nu
// ou entouré d'autre texte) on retombe sur un remplacement simple du jeton.
function replaceImageToken(html, token, replacement) {
  const escapedToken = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const wrappedRe = new RegExp(
    `<!--\\s*wp:paragraph(?:\\s+\\{[^}]*\\})?\\s*-->\\s*<p[^>]*>\\s*${escapedToken}\\s*</p>\\s*<!--\\s*/wp:paragraph\\s*-->`
  );
  if (wrappedRe.test(html)) {
    return html.replace(wrappedRe, replacement);
  }
  // Jeton entouré d'autre texte dans le même paragraphe (ex. "...texte avant
  // [[IMAGE:n]] texte après...") : constaté le 2026-08-03 sur des pages
  // hub/sous-hub (assurance-reglementation, van-fourgon-amenage) — un simple
  // remplacement du jeton laissait le bloc wp:image imbriqué dans le <p>
  // englobant (même défaut que le cas "jeton seul" ci-dessus, corrigé le
  // 2026-07-28, mais jamais étendu à ce cas). On scinde le paragraphe en
  // deux (texte avant / texte après) de part et d'autre du bloc image, qui
  // redevient un bloc de premier niveau.
  const partialRe = new RegExp(
    `<!--\\s*wp:paragraph(?:\\s+\\{[^}]*\\})?\\s*-->\\s*<p[^>]*>([\\s\\S]*?)${escapedToken}([\\s\\S]*?)</p>\\s*<!--\\s*/wp:paragraph\\s*-->`
  );
  const partialMatch = html.match(partialRe);
  if (partialMatch) {
    const [, before, after] = partialMatch;
    const beforeBlock = before.trim() ? `<!-- wp:paragraph -->\n<p>${before.trim()}</p>\n<!-- /wp:paragraph -->\n\n` : '';
    const afterBlock = after.trim() ? `\n\n<!-- wp:paragraph -->\n<p>${after.trim()}</p>\n<!-- /wp:paragraph -->` : '';
    return html.replace(partialRe, `${beforeBlock}${replacement}${afterBlock}`);
  }
  return html.replace(token, replacement);
}

function escapeHtmlAttr(s) {
  return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

/* ---------- Génération + relecture (commun hub/sous-hub/article) ---------- */

// Logs détaillés étape par étape (2026-07-27, demande explicite de
// l'utilisateur : "j'aimerai comprendre comment ça se passe vraiment") —
// chaque appel modèle, sa taille de sortie et son verdict sont affichés en
// direct dans la console, pas seulement résumés a posteriori dans le rapport.
async function generateAndReview({ contentType, silo, item, maillageEntry, childLinks, facts, competitorAngles, slug, runDate, usageAcc, logPrefix }) {
  const tag = logPrefix || `[${contentType} ${slug}]`;
  const personaInfo = persona.getPersonaForSilo(silo);
  console.log(`${tag} auteur : ${personaInfo.nom} (persona ${persona.getPersonaKeyForSilo(silo)}) — ${facts.length} fait(s) factuel(s), ${competitorAngles.length} piste(s) concurrentielle(s)`);

  const genReq = promptBuilder.buildGenerationRequest({ contentType, silo, item, maillageEntry, childLinks, facts, competitorAngles });
  const modelCfg = config.MODEL_BY_CONTENT_TYPE[contentType];
  console.log(`${tag} appel génération — modèle ${modelCfg.model}...`);
  const genResult = await mistralClient.callMistral({
    model: modelCfg.model,
    system: genReq.system,
    messages: genReq.messages,
    schema: genReq.schema,
    maxTokens: reviewModule.MAX_TOKENS_BY_CONTENT_TYPE?.[contentType] || 16000,
  });
  console.log(`${tag} génération reçue — ${genResult.usage.input_tokens} tokens en entrée, ${genResult.usage.output_tokens} en sortie (cache: ${genResult.usage.cache_read_input_tokens}).`);
  addUsage(usageAcc, genResult.usage);

  const reviewModel = config.REVIEW_MODEL_BY_CONTENT_TYPE[contentType].model;
  console.log(`${tag} appel relecture — modèle ${reviewModel}...`);
  const reviewResult = await reviewModule.reviewContent({
    contentType,
    silo,
    slug,
    generatedContent: genResult.parsed,
    maillageEntry,
    facts,
    competitorAngles,
    runDate,
    model: reviewModel,
  });
  console.log(`${tag} relecture reçue — conforme : ${reviewResult.conforme ? 'oui' : 'non'} (${reviewResult.corrections.length} correction(s)), ${reviewResult.usage.output_tokens} tokens de sortie.`);
  if (!reviewResult.conforme) {
    for (const c of reviewResult.corrections) console.log(`${tag}   corrigé : ${c}`);
  }
  addUsage(usageAcc, reviewResult.usage);

  // 3ᵉ passe — lisibilité mécanique (2026-07-28, demande explicite de
  // l'utilisateur) : distincte de la relecture voix/faits ci-dessus, ne
  // touche jamais aux mêmes points (voir prompts/lisibilite.md).
  console.log(`${tag} appel relecture lisibilité — modèle ${reviewModel}...`);
  const readabilityResult = await reviewModule.reviewReadability({
    contentType,
    silo,
    slug,
    generatedContent: reviewResult.content,
    runDate,
    model: reviewModel,
  });
  console.log(`${tag} relecture lisibilité reçue — conforme : ${readabilityResult.conforme ? 'oui' : 'non'} (${readabilityResult.corrections.length} correction(s)), ${readabilityResult.usage.output_tokens} tokens de sortie.`);
  if (!readabilityResult.conforme) {
    for (const c of readabilityResult.corrections) console.log(`${tag}   ajusté : ${c}`);
  }
  addUsage(usageAcc, readabilityResult.usage);

  // Usage propre à cette pièce (génération + 2 relectures), distinct du cumul
  // de tout le run (usageAcc) — pour le détail par page demandé par
  // l'utilisateur le 2026-07-22 (voir report.js).
  const itemUsage = addUsage(
    { input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 },
    genResult.usage
  );
  addUsage(itemUsage, reviewResult.usage);
  addUsage(itemUsage, readabilityResult.usage);

  return { content: readabilityResult.content, usage: itemUsage };
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

  /* --- Hubs : génération + relecture + gating + INSERTION WP IMMÉDIATE ---
     Correctif critique (2026-07-26) : générer/gater TOUS les hubs d'abord
     puis insérer dans une boucle séparée faisait perdre tout le contenu déjà
     validé (accumulé seulement en mémoire) si le process était interrompu
     avant d'atteindre la boucle d'insertion — constaté en conditions réelles
     après épuisement du crédit API (43 pièces gating OK jamais écrites dans
     WordPress). Chaque hub est désormais écrit dans WordPress dès qu'il
     passe le gating, DANS LA MÊME itération — un crash/kill/épuisement de
     crédit après ce point ne peut plus faire perdre que la pièce en cours,
     jamais celles déjà traitées. */
  console.log(`\n=== Phase 0 — Hubs : ${hubs.length} à traiter ===`);
  for (const [i, hub] of hubs.entries()) {
    console.log(`[hub ${i + 1}/${hubs.length}] ${hub.slug} (${hub.silo}) : génération...`);
    try {
      // Préfixe /categorie : c'est l'URL publique réelle d'un sous-hub depuis
      // le 2026-07-24 (voir app/categorie/[...slug]/page.tsx) — maillage.json
      // garde le champ `sous_hub` brut tel quel (identifiant interne utilisé
      // ailleurs par getEntriesBySousHub etc.), seule la valeur envoyée au
      // modèle comme lien à écrire est transformée ici.
      const childLinks = maillage.getEntriesByHub(hub.url).reduce((acc, e) => {
        if (!acc.some(c => c.url === e.sous_hub)) acc.push({ url: `/categorie${e.sous_hub}`, title: e.ancres?.entite_seule || e.sous_hub });
        return acc;
      }, []);
      const logTag = `[hub ${i + 1}/${hubs.length}] ${hub.slug}`;
      const facts = factuel.searchFacts(hub.silo);
      const competitorAngles = await competitorResearch.searchCompetitorAngles(hub.silo);

      const { content, usage } = await generateAndReview({
        contentType: 'hub', silo: hub.silo, item: null, maillageEntry: null,
        childLinks, facts, competitorAngles, slug: hub.slug, runDate, usageAcc, logPrefix: logTag,
      });

      const gatingResult = gating.runGating({
        contentType: 'hub', silo: hub.silo, sousCocon: null, content,
        clusterRow: null, trackingRows: null, maillageEntry: null,
        childLinksCount: childLinks.length, parentPublished: true, factsProvided: facts,
      });

      // Demande explicite de l'utilisateur (2026-07-26, étendue le 2026-07-27
      // à TOUT motif de gating, pas seulement la longueur) : un échec de
      // gating ne doit plus jamais faire perdre le contenu généré — le coût
      // génération+relecture est déjà payé, autant l'insérer quand même (en
      // `draft`) pour qu'il reste consultable/éditable dans wp-admin,
      // validation manuelle par l'utilisateur plutôt qu'une nouvelle
      // génération à l'aveugle ou une perte pure et simple.
      console.log(`${logTag} : ${gatingResult.passed ? 'gating OK.' : 'gating KO — conservé en draft pour validation manuelle (' + gatingResult.failures.map(f => f.message).join(' ; ') + ').'}`);

      // Planification + insertion immédiate (même itération, voir note plus haut).
      const [scheduled] = scheduler.computeSchedule({
        phase: 0, phaseStartDate: state.phase_start_date, queue: [{ content, usage }],
        capacityOverride: capacity, startIndex: state.items_scheduled_in_phase,
      });
      state.items_scheduled_in_phase += 1;
      persistStateProgress(state);
      console.log(`${logTag} : programmé pour le ${scheduled.post_date.slice(0, 10)}.`);

      console.log(`${logTag} : résolution WP (auteur, catégorie, image à la une)...`);
      const authorId = await resolveAuthorId(hub.silo);
      const categoryId = await resolveCategoryId(hub.silo, null);
      const featuredMedia = await resolveFeaturedMedia(hub.silo, hub.silo, content.title);
      console.log(`${logTag}   auteur WP #${authorId ?? '(dry-run)'}, catégorie WP #${categoryId ?? '(dry-run)'}, image à la une : ${featuredMedia ? `media #${featuredMedia}` : 'aucune (repli sans image)'}.`);
      const resolvedContent = await resolveInlineImages(content.content_gutenberg, content.inline_images, hub.slug, hub.silo);
      const payload = {
        title: content.title,
        slug: hub.slug,
        // Toutes les insertions en `draft` pour l'instant (demande explicite
        // de l'utilisateur, 2026-07-26) : la file de publication réelle ne
        // démarre que le 29/08, voir la replanification faite ce jour sur
        // les 53 pages déjà publiées — cohérence sur les nouvelles aussi.
        status: 'draft',
        date_gmt: scheduled.post_date.replace(/Z$/, ''),
        content: resolvedContent,
        excerpt: content.excerpt,
        categories: [categoryId],
        author: authorId,
        featured_media: featuredMedia || undefined,
        acf: acfFields(content),
      };
      console.log(`${logTag} : insertion WP...`);
      if (!DRY_RUN) {
        const created = await wp.createPage(payload);
        hubIdBySlug.set(hub.slug, created.id);
        console.log(`${logTag} : inséré — page WP #${created.id} (${created.link || '(url non renvoyée)'}).`);
      } else {
        console.log(`${logTag} : dry-run — insertion WP simulée, rien écrit.`);
      }
      // Un hub inséré alors qu'il échoue le gating (quel que soit le motif)
      // n'est PAS considéré "publié" au sens de la date parent des sous-hubs
      // (voir hubDateBySlug plus bas) : rester bloqué tant que l'utilisateur
      // ne l'a pas validé manuellement.
      if (gatingResult.passed) hubDateBySlug.set(hub.slug, scheduled.post_date);
      items.push({
        slug: hub.slug, contentType: 'hub',
        status: gatingResult.passed ? 'publie' : 'a_valider',
        postDate: scheduled.post_date, usage,
        reasons: gatingResult.passed ? undefined : gatingResult.failures.map(f => f.message),
      });
    } catch (e) {
      console.error(`[phase0] échec hub "${hub.slug}" : ${e.message}`);
      items.push({ slug: hub.slug, contentType: 'hub', status: 'erreur', reasons: [e.message] });
    }
  }

  /* --- Sous-hubs : génération + relecture + gating + INSERTION WP IMMÉDIATE
     (même correctif critique que pour les hubs ci-dessus, voir la note
     détaillée plus haut — écriture dans la même itération, jamais accumulée
     en mémoire en attendant la fin du lot). --- */
  console.log(`\n=== Phase 0 — Sous-hubs : ${sousHubs.length} à traiter ===`);
  for (const [i, sousHub] of sousHubs.entries()) {
    console.log(`[sous-hub ${i + 1}/${sousHubs.length}] ${sousHub.slug} (${sousHub.silo}) : génération...`);
    const logTag = `[sous-hub ${i + 1}/${sousHubs.length}] ${sousHub.slug}`;
    try {
      const parentDate = await resolveHubParentDate(sousHub.hubSlug, hubDateBySlug, hubIdBySlug);
      const parentPublished = !!parentDate;

      // Les articles restent en URL plate (voir STATE.md, point ouvert avant
      // P5) — seul le dernier segment de l'identifiant maillage.json compte.
      // Ne proposer au modèle QUE les articles réellement publiés (voir
      // getExistingArticleSlugs) — jamais un lien vers une cible qui n'existe
      // pas encore. `childLinksCount` transmis au gating reste basé sur le
      // compte structurel complet du maillage (checkMaillageResolved vérifie
      // la cohérence de la structure, pas la disponibilité des liens cliquables).
      const existingArticleSlugs = await getExistingArticleSlugs();
      const linkableChildEntries = sousHub.childArticleEntries.filter((e) => existingArticleSlugs.has(lastSegment(e.url)));
      const childLinks = linkableChildEntries.map(e => ({ url: `/${lastSegment(e.url)}`, title: e.ancres?.naturelle_longue || e.mot_cle_principal }));
      const facts = factuel.searchFacts(sousHub.title);
      const competitorAngles = await competitorResearch.searchCompetitorAngles(sousHub.title);

      const { content, usage } = await generateAndReview({
        contentType: 'sous-hub', silo: sousHub.silo, item: null, maillageEntry: null,
        childLinks, facts, competitorAngles, slug: sousHub.slug, runDate, usageAcc, logPrefix: logTag,
      });

      const gatingResult = gating.runGating({
        contentType: 'sous-hub', silo: sousHub.silo, sousCocon: sousHub.title, content,
        clusterRow: null, trackingRows: null, maillageEntry: null,
        childLinksCount: sousHub.childArticleEntries.length, parentPublished, factsProvided: facts,
      });

      // Voir note équivalente sur les hubs plus haut : un échec de gating,
      // quel qu'en soit le motif, est désormais conservé (draft) pour
      // validation manuelle, jamais perdu.
      console.log(`${logTag} : ${gatingResult.passed ? 'gating OK.' : 'gating KO — conservé en draft pour validation manuelle (' + gatingResult.failures.map(f => f.message).join(' ; ') + ').'}`);

      // Planification + insertion immédiate (même itération).
      const [scheduled] = scheduler.computeSchedule({
        phase: 0, phaseStartDate: state.phase_start_date, queue: [{ content, usage, parentDate }],
        capacityOverride: capacity, startIndex: state.items_scheduled_in_phase,
      });
      state.items_scheduled_in_phase += 1;
      persistStateProgress(state);
      console.log(`${logTag} : programmé pour le ${scheduled.post_date.slice(0, 10)}.`);

      console.log(`${logTag} : résolution WP (auteur, catégorie, image à la une)...`);
      const authorId = await resolveAuthorId(sousHub.silo);
      const categoryId = await resolveCategoryId(sousHub.silo, sousHub.title);
      const featuredMedia = await resolveFeaturedMedia(sousHub.title, sousHub.silo, content.title);
      console.log(`${logTag}   auteur WP #${authorId ?? '(dry-run)'}, catégorie WP #${categoryId ?? '(dry-run)'}, image à la une : ${featuredMedia ? `media #${featuredMedia}` : 'aucune (repli sans image)'}.`);
      const resolvedContent = await resolveInlineImages(content.content_gutenberg, content.inline_images, sousHub.slug, sousHub.silo);
      const parentId = hubIdBySlug.get(sousHub.hubSlug);
      // En dry-run, le hub n'est jamais réellement créé (voir plus haut,
      // wp.createPage sauté si DRY_RUN) : aucun id ne peut donc exister pour
      // lui même s'il est publié dans ce même run simulé, ce n'est pas une
      // vraie anomalie à signaler.
      if (!parentId && !DRY_RUN) {
        console.warn(`[phase0] parent introuvable pour le sous-hub "${sousHub.slug}" (hub "${sousHub.hubSlug}"), publié quand même sans hiérarchie WP. À corriger manuellement.`);
      }
      const payload = {
        title: content.title,
        slug: sousHub.slug,
        status: 'draft',
        date_gmt: scheduled.post_date.replace(/Z$/, ''),
        content: resolvedContent,
        excerpt: content.excerpt,
        categories: [categoryId],
        author: authorId,
        parent: parentId || undefined,
        featured_media: featuredMedia || undefined,
        acf: acfFields(content),
      };
      console.log(`${logTag} : insertion WP...`);
      if (!DRY_RUN) {
        const created = await wp.createPage(payload);
        console.log(`${logTag} : inséré — page WP #${created.id} (${created.link || '(url non renvoyée)'}).`);
      } else {
        console.log(`${logTag} : dry-run — insertion WP simulée, rien écrit.`);
      }
      items.push({
        slug: sousHub.slug, contentType: 'sous-hub',
        status: gatingResult.passed ? 'publie' : 'a_valider',
        postDate: scheduled.post_date, usage,
        reasons: gatingResult.passed ? undefined : gatingResult.failures.map(f => f.message),
      });
    } catch (e) {
      console.error(`[phase0] échec sous-hub "${sousHub.slug}" : ${e.message}`);
      items.push({ slug: sousHub.slug, contentType: 'sous-hub', status: 'erreur', reasons: [e.message] });
    }
  }

  return items;
}

/* ---------- Phase 2 : articles ---------- */

// Sélectionne, parmi les clusters "à faire"/"en rédaction" d'un GROUPE
// (silo entier ou un seul sous-cocon), une file interleavée par quota
// d'intention (~65 % Info / 25 % Commercial / 10 % Transactionnel) et triée
// par volume décroissant à l'intérieur de chaque intention — voir
// skills/wordpress-publication.md section 6. Factorisé pour être appliqué
// une fois par sous-cocon (voir pickArticleQueueForSilo ci-dessous), pas
// seulement une fois pour tout le silo.
function pickInterleavedQueue(candidates, budget) {
  if (!candidates.length || budget <= 0) return [];

  const byIntent = {};
  for (const row of candidates) (byIntent[row.intention] ||= []).push(row);
  for (const list of Object.values(byIntent)) {
    list.sort((a, b) => (Number(b.volume_estime) || 0) - (Number(a.volume_estime) || 0));
  }

  const quotas = {};
  for (const [intent, share] of Object.entries(config.INTENT_QUOTA)) {
    quotas[intent] = Math.max(1, Math.round(budget * share));
  }

  const selected = [];
  const cursors = {};
  let progressed = true;
  while (selected.length < budget && progressed) {
    progressed = false;
    for (const intent of Object.keys(config.INTENT_QUOTA)) {
      if (selected.length >= budget) break;
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

  if (selected.length < budget) {
    const remaining = candidates
      .filter(r => !selected.includes(r))
      .sort((a, b) => (Number(b.volume_estime) || 0) - (Number(a.volume_estime) || 0));
    for (const row of remaining) {
      if (selected.length >= budget) break;
      selected.push(row);
    }
  }

  return selected;
}

// Priorise par SOUS-COCON (2026-07-28, demande explicite de l'utilisateur,
// pour un ranking plus rapide et plus solide) : un sous-hub publié tôt sans
// ses articles pendant des semaines reste un cluster topique incomplet — un
// signal plus faible pour Google et une navigation plus pauvre pour le
// lecteur qu'un sous-cocon qui se remplit vite derrière son sous-hub. Avant
// ce correctif, `pickArticleQueueForSilo` interleavait par intention sur TOUT
// le silo en une fois, dispersant les articles d'un même sous-cocon sur toute
// la durée de traitement du silo. Les sous-cocons sont maintenant traités un
// par un — **le plus petit d'abord** (nombre d'articles croissant, décision
// explicite de l'utilisateur le 2026-07-28 : valider le pipeline sur des
// cocons complets et peu coûteux avant les plus gros) — chacun interleavé en
// interne par quota d'intention (voir pickInterleavedQueue).
function pickArticleQueueForSilo(silo, rows, remainingBudget) {
  const candidates = rows.filter(r => r.silo === silo && ['à faire', 'en rédaction'].includes(r.statut));
  if (!candidates.length || remainingBudget <= 0) return [];

  const bySousCocon = new Map();
  for (const row of candidates) {
    const key = row.sous_cocon || '(sans sous-cocon)';
    if (!bySousCocon.has(key)) bySousCocon.set(key, []);
    bySousCocon.get(key).push(row);
  }

  const groups = [...bySousCocon.values()].sort((a, b) => a.length - b.length);

  const selected = [];
  for (const group of groups) {
    if (selected.length >= remainingBudget) break;
    const picked = pickInterleavedQueue(group, remainingBudget - selected.length);
    selected.push(...picked);
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

  let candidateRows = pickArticleQueueForSilo(silo, trackingRows, remainingBudget);
  if (MAX_ARTICLES != null) candidateRows = candidateRows.slice(0, MAX_ARTICLES);
  const capacity = config.PHASE_CAPACITY_PER_DAY[2];

  /* Génération + relecture + gating + INSERTION WP IMMÉDIATE, dans la même
     itération — même correctif critique que pour les hubs/sous-hubs
     (2026-07-26, voir la note détaillée dans runPhase0 ci-dessus) : avant ce
     correctif, tous les articles gatés étaient accumulés en mémoire
     (`gatingPassed`) et insérés seulement dans une seconde boucle après la
     fin de TOUTE la génération du lot — un crash/kill/épuisement de crédit
     entre les deux boucles faisait perdre tout le contenu déjà généré et payé
     sans qu'il n'atteigne jamais WordPress. Étendu aux articles le 2026-07-27
     (constaté reproduit en conditions réelles sur un lot d'articles, demande
     explicite de l'utilisateur de ne plus jamais perdre de tokens ainsi). */
  console.log(`\n=== Phase 2 — Articles (${silo}) : ${candidateRows.length} à traiter ===`);
  for (const [i, row] of candidateRows.entries()) {
    const maillageEntry = maillage.getEntryByKeyword(row.mot_cle_principal);
    const slug = maillageEntry ? lastSegment(maillageEntry.url) : slugifyFr(row.mot_cle_principal);
    const logTag = `[article ${i + 1}/${candidateRows.length}] ${slug}`;
    let stage = 'génération/gating';
    try {
      let facts = factuel.searchFacts(`${row.mot_cle_principal} ${row.variantes || ''}`);
      if (facts.length < MIN_LOCAL_FACTS_FOR_ARTICLE) {
        console.log(`${logTag} : seulement ${facts.length} fait(s) local(aux), recherche Tavily complémentaire...`);
        const extra = await tavilyFacts.searchFactualData(row.mot_cle_principal);
        if (extra.length) {
          console.log(`${logTag} : ${extra.length} donnée(s) factuelle(s) trouvée(s) via Tavily.`);
          facts = facts.concat(extra);
        }
      }
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

      // Même correctif que pour les sous-hubs (voir runPhase0/getExistingArticleSlugs
      // plus haut, appliqué ici par anticipation avant le premier vrai run
      // d'articles) : liens_lateraux/liens_transversaux du maillage pointent
      // vers d'autres articles qui n'existent pas forcément encore — ne
      // proposer au modèle que ceux réellement publiés.
      const existingArticleSlugs = await getExistingArticleSlugs();
      const safeMaillageEntry = maillageEntry ? {
        ...maillageEntry,
        liens_lateraux: (maillageEntry.liens_lateraux || []).filter((u) => existingArticleSlugs.has(lastSegment(u))),
        liens_transversaux: (maillageEntry.liens_transversaux || []).filter((u) => existingArticleSlugs.has(lastSegment(u))),
      } : maillageEntry;

      const { content, usage } = await generateAndReview({
        contentType: 'article', silo, item: row, maillageEntry: safeMaillageEntry, childLinks: [],
        facts, competitorAngles, slug, runDate, usageAcc, logPrefix: logTag,
      });

      const gatingResult = gating.runGating({
        contentType: 'article', silo, sousCocon: row.sous_cocon, content,
        clusterRow: row, trackingRows, maillageEntry: safeMaillageEntry, childLinksCount: 0,
        parentPublished: !!parentDate, factsProvided: facts,
      });

      // Même règle que pour les hubs/sous-hubs (voir plus haut) — étendue aux
      // articles le 2026-07-29, demande explicite de l'utilisateur après avoir
      // constaté un taux de blocage élevé sur "Carte grise & démarches" : un
      // échec de gating ne doit plus faire perdre le contenu déjà généré/payé
      // (génération + 2 relectures). Toujours inséré en draft pour validation
      // manuelle, jamais régénéré à l'aveugle au run suivant.
      console.log(`${logTag} : ${gatingResult.passed ? 'gating OK.' : 'gating KO — conservé en draft pour validation manuelle (' + gatingResult.failures.map(f => f.message).join(' ; ') + ').'}`);

      // Planification + insertion immédiate (même itération, voir note plus haut).
      const [scheduled] = scheduler.computeSchedule({
        phase: 2, phaseStartDate: state.silo_start_date, queue: [{ content, usage, parentDate }],
        capacityOverride: capacity, startIndex: state.items_scheduled_for_silo,
      });
      state.items_scheduled_for_silo += 1;
      state.budget_consomme += 1;
      persistStateProgress(state);
      console.log(`${logTag} : programmé pour le ${scheduled.post_date.slice(0, 10)}.`);

      stage = 'insertion WP';
      console.log(`${logTag} : résolution WP (auteur, catégorie, tags, image à la une)...`);
      const authorId = await resolveAuthorId(silo);
      const categoryId = await resolveCategoryId(silo, row.sous_cocon);
      const tagIds = await resolveTagIds(content.tags);
      const featuredMedia = await resolveFeaturedMedia(row.mot_cle_principal, silo, content.title);
      console.log(`${logTag}   auteur WP #${authorId ?? '(dry-run)'}, catégorie WP #${categoryId ?? '(dry-run)'}, ${tagIds.length} tag(s), image à la une : ${featuredMedia ? `media #${featuredMedia}` : 'aucune (repli sans image)'}.`);
      const resolvedContent = await resolveInlineImages(content.content_gutenberg, content.inline_images, slug, silo);
      const payload = {
        title: content.title,
        slug,
        // Toutes les insertions en `draft` pour l'instant (même règle que les
        // hubs/sous-hubs, demande explicite de l'utilisateur du 2026-07-26,
        // étendue aux articles le 2026-07-28) : la file de publication réelle
        // ne démarre que le 29/08 — `date_gmt` reste calculé pour ordonner
        // les pièces entre elles, mais `status: 'future'` aurait fait publier
        // ces articles immédiatement en direct sur WordPress (post_date déjà
        // passé au moment de l'insertion), constaté avant tout run réel.
        status: 'draft',
        date_gmt: scheduled.post_date.replace(/Z$/, ''),
        content: resolvedContent,
        excerpt: content.excerpt,
        categories: [categoryId],
        tags: tagIds,
        author: authorId,
        featured_media: featuredMedia || undefined,
        acf: acfFields(content, buildKeywords(row)),
      };

      console.log(`${logTag} : insertion WP...`);
      if (!DRY_RUN) {
        const created = await wp.createPost(payload);
        console.log(`${logTag} : inséré — article WP #${created.id} (${created.link || '(url non renvoyée)'}), publication prévue ${scheduled.post_date.slice(0, 10)}.`);
        // Un article inséré malgré un échec de gating n'est pas considéré
        // "réellement disponible" pour autant : ni comme cible de lien pour
        // les prochains articles du même sous-cocon, ni dans l'index de
        // similarité (même logique que hubDateBySlug pour les hubs) — tant
        // que l'utilisateur ne l'a pas validé manuellement.
        if (gatingResult.passed) {
          similarity.addToIndex(silo, row.sous_cocon, slug, content.content_gutenberg);
          markArticleSlugAsExisting(slug);
        }
        trackingXlsx.updateRow(trackingRows, row.mot_cle_principal, {
          statut: gatingResult.passed ? 'programmé' : 'à valider',
          url_cible: maillageEntry ? maillageEntry.url : `/${slug}`,
          date_publication: gatingResult.passed ? scheduled.post_date.slice(0, 10) : '',
        });
        // Écrit immédiatement (pas seulement en mémoire) — même principe que
        // persistStateProgress ci-dessus : avant ce correctif, le xlsx n'était
        // réécrit qu'une fois à la toute fin de main(), donc un kill brutal en
        // cours de boucle aurait laissé WordPress et tracking-mots-cles.xlsx
        // désynchronisés (article publié mais toujours marqué "à faire" —
        // risque de reprise en double au run suivant).
        trackingXlsx.writeRows(trackingRows);
      }
      items.push({
        slug, contentType: 'article',
        status: gatingResult.passed ? 'publie' : 'a_valider',
        postDate: scheduled.post_date, usage,
        reasons: gatingResult.passed ? undefined : gatingResult.failures.map(f => f.message),
      });
    } catch (e) {
      console.error(`[phase2] échec ${stage} article "${slug}" : ${e.message}`);
      items.push({ slug, contentType: 'article', status: 'erreur', reasons: [e.message] });
    }
  }

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
      // runPhase2 écrit désormais tracking-mots-cles.xlsx immédiatement après
      // chaque article publié (voir plus haut) — plus besoin d'une écriture
      // batchée ici en fin de run.
      const trackingRows = trackingXlsx.readRows();
      items = await runPhase2(state, runDate, trackingRows, usageAcc);
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
