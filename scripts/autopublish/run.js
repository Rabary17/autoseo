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

async function resolveAuthorId(silo) {
  const key = persona.getPersonaKeyForSilo(silo);
  const slug = config.WP_AUTHOR_SLUG_BY_PERSONA[key];
  const users = await wp.getAllUsers();
  const user = users.find(u => u.slug === slug);
  if (!user) {
    throw new Error(
      `run: compte WordPress introuvable pour la persona ${key} (slug attendu "${slug}") — à créer dans wp-admin avant de publier sur le silo "${silo}".`
    );
  }
  return user.id;
}

async function resolveCategoryId(silo, sousCocon) {
  const siloTerm = await wp.findOrCreateTerm('categories', slugifyFr(silo), { name: silo, slug: slugifyFr(silo) });
  if (!sousCocon) return siloTerm.id;
  const sousTerm = await wp.findOrCreateTerm('categories', slugifyFr(sousCocon), {
    name: sousCocon,
    slug: slugifyFr(sousCocon),
    parent: siloTerm.id,
  });
  return sousTerm.id;
}

async function resolveTagIds(tagNames) {
  const ids = [];
  for (const name of tagNames || []) {
    const term = await wp.findOrCreateTerm('tags', slugifyFr(name), { name, slug: slugifyFr(name) });
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

async function resolveFeaturedMedia(entityQuery, silo) {
  if (DRY_RUN) return null;
  try {
    const found = await images.findImage(entityQuery, { silo });
    if (!found) return config.DEFAULT_IMAGE_MEDIA_ID_BY_SILO[silo] ?? null;
    const { buffer, mimeType } = await images.downloadImage(found.url);
    const ext = mimeType.includes('png') ? 'png' : 'jpg';
    const media = await wp.uploadMedia(buffer, `${slugifyFr(entityQuery)}.${ext}`, mimeType);
    return media.id;
  } catch (e) {
    console.warn(`[images] échec sourcing pour "${entityQuery}" (${silo}) : ${e.message} — repli image par défaut.`);
    return config.DEFAULT_IMAGE_MEDIA_ID_BY_SILO[silo] ?? null;
  }
}

/* ---------- Génération + relecture (commun hub/sous-hub/article) ---------- */

async function generateAndReview({ contentType, silo, item, maillageEntry, childLinks, facts, slug, runDate, usageAcc }) {
  const genReq = promptBuilder.buildGenerationRequest({ contentType, silo, item, maillageEntry, childLinks, facts });
  const modelCfg = config.MODEL_BY_CONTENT_TYPE[contentType];
  const genResult = await claudeClient.callClaude({
    model: modelCfg.model,
    thinking: modelCfg.thinking,
    effort: modelCfg.effort,
    system: genReq.system,
    messages: genReq.messages,
    schema: genReq.schema,
  });
  addUsage(usageAcc, genResult.usage);

  const reviewResult = await reviewModule.reviewContent({
    contentType,
    silo,
    slug,
    generatedContent: genResult.parsed,
    maillageEntry,
    facts,
    runDate,
    model: config.REVIEW_MODEL.model,
    thinking: config.REVIEW_MODEL.thinking,
    effort: config.REVIEW_MODEL.effort,
  });
  addUsage(usageAcc, reviewResult.usage);

  return reviewResult.content;
}

/* ---------- Phase 0 : hubs & sous-hubs ---------- */

async function buildPhase0Candidates() {
  const hubs = [];
  for (const hubUrl of maillage.getAllHubUrls()) {
    const slug = lastSegment(hubUrl);
    const existing = await wp.findBySlug('pages', slug);
    if (existing) continue;
    const anyEntry = maillage.getEntriesByHub(hubUrl)[0];
    if (!anyEntry) continue;
    hubs.push({ contentType: 'hub', url: hubUrl, slug, silo: anyEntry.silo });
  }

  const sousHubUrls = [...new Set(maillage.loadMaillage().map(e => e.sous_hub))];
  const sousHubs = [];
  for (const sousHubUrl of sousHubUrls) {
    const slug = lastSegment(sousHubUrl);
    const existing = await wp.findBySlug('pages', slug);
    if (existing) continue;
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
  return { hubs: hubs.slice(0, weekCap), sousHubs: sousHubs.slice(0, weekCap) };
}

function wpPageDateGmt(page) {
  return page && page.date_gmt ? new Date(`${page.date_gmt}Z`) : null;
}

async function runPhase0(state, runDate, usageAcc) {
  const { hubs, sousHubs } = await buildPhase0Candidates();
  const capacity = config.PHASE_CAPACITY_PER_DAY[0];
  if (!state.phase_start_date) state.phase_start_date = runDate;

  const items = [];
  const hubDateBySlug = new Map();
  const hubIdBySlug = new Map();

  /* --- Hubs --- */
  const hubGatingPassed = [];
  for (const hub of hubs) {
    const childLinks = maillage.getEntriesByHub(hub.url).reduce((acc, e) => {
      if (!acc.some(c => c.url === e.sous_hub)) acc.push({ url: e.sous_hub, title: e.ancres?.entite_seule || e.sous_hub });
      return acc;
    }, []);
    const facts = factuel.searchFacts(hub.silo);

    const content = await generateAndReview({
      contentType: 'hub', silo: hub.silo, item: null, maillageEntry: null,
      childLinks, facts, slug: hub.slug, runDate, usageAcc,
    });

    const gatingResult = gating.runGating({
      contentType: 'hub', silo: hub.silo, sousCocon: null, content,
      clusterRow: null, trackingRows: null, maillageEntry: null,
      childLinksCount: childLinks.length, parentPublished: true, factsProvided: facts,
    });

    if (gatingResult.passed) hubGatingPassed.push({ ...hub, content });
    else items.push({ slug: hub.slug, contentType: 'hub', status: 'draft', reasons: gatingResult.failures.map(f => f.message) });
  }

  const hubScheduled = scheduler.computeSchedule({
    phase: 0, phaseStartDate: state.phase_start_date, queue: hubGatingPassed,
    capacityOverride: capacity, startIndex: state.items_scheduled_in_phase,
  });
  state.items_scheduled_in_phase += hubScheduled.length;

  for (const hub of hubScheduled) {
    const authorId = await resolveAuthorId(hub.silo);
    const categoryId = await resolveCategoryId(hub.silo, null);
    const featuredMedia = await resolveFeaturedMedia(hub.silo, hub.silo);
    const payload = {
      title: hub.content.title,
      slug: hub.slug,
      status: 'future',
      date_gmt: hub.post_date.replace(/Z$/, ''),
      content: hub.content.content_gutenberg,
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
    items.push({ slug: hub.slug, contentType: 'hub', status: 'publie', postDate: hub.post_date });
  }

  /* --- Sous-hubs --- */
  const sousHubGatingPassed = [];
  for (const sousHub of sousHubs) {
    const parentDate = hubDateBySlug.get(sousHub.hubSlug) ?? (await wp.findBySlug('pages', sousHub.hubSlug).then(p => (wpPageDateGmt(p) || null)?.toISOString()));
    const parentPublished = !!parentDate;

    const childLinks = sousHub.childArticleEntries.map(e => ({ url: e.url, title: e.ancres?.naturelle_longue || e.mot_cle_principal }));
    const facts = factuel.searchFacts(sousHub.title);

    const content = await generateAndReview({
      contentType: 'sous-hub', silo: sousHub.silo, item: null, maillageEntry: null,
      childLinks, facts, slug: sousHub.slug, runDate, usageAcc,
    });

    const gatingResult = gating.runGating({
      contentType: 'sous-hub', silo: sousHub.silo, sousCocon: sousHub.title, content,
      clusterRow: null, trackingRows: null, maillageEntry: null,
      childLinksCount: childLinks.length, parentPublished, factsProvided: facts,
    });

    if (gatingResult.passed) sousHubGatingPassed.push({ ...sousHub, content, parentDate });
    else items.push({ slug: sousHub.slug, contentType: 'sous-hub', status: 'draft', reasons: gatingResult.failures.map(f => f.message) });
  }

  const sousHubScheduled = scheduler.computeSchedule({
    phase: 0, phaseStartDate: state.phase_start_date, queue: sousHubGatingPassed,
    capacityOverride: capacity, startIndex: state.items_scheduled_in_phase,
  });
  state.items_scheduled_in_phase += sousHubScheduled.length;

  for (const sousHub of sousHubScheduled) {
    const authorId = await resolveAuthorId(sousHub.silo);
    const categoryId = await resolveCategoryId(sousHub.silo, sousHub.title);
    const featuredMedia = await resolveFeaturedMedia(sousHub.title, sousHub.silo);
    const parentId = hubIdBySlug.get(sousHub.hubSlug);
    const payload = {
      title: sousHub.content.title,
      slug: sousHub.slug,
      status: 'future',
      date_gmt: sousHub.post_date.replace(/Z$/, ''),
      content: sousHub.content.content_gutenberg,
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
    items.push({ slug: sousHub.slug, contentType: 'sous-hub', status: 'publie', postDate: sousHub.post_date });
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
    const facts = factuel.searchFacts(`${row.mot_cle_principal} ${row.variantes || ''}`);

    const parentSlug = maillageEntry ? lastSegment(maillageEntry.sous_hub) : null;
    const parentPage = parentSlug ? await wp.findBySlug('pages', parentSlug) : null;
    const parentDate = wpPageDateGmt(parentPage)?.toISOString() ?? null;

    const content = await generateAndReview({
      contentType: 'article', silo, item: row, maillageEntry, childLinks: [],
      facts, slug, runDate, usageAcc,
    });

    const gatingResult = gating.runGating({
      contentType: 'article', silo, sousCocon: row.sous_cocon, content,
      clusterRow: row, trackingRows, maillageEntry, childLinksCount: 0,
      parentPublished: !!parentDate, factsProvided: facts,
    });

    if (gatingResult.passed) {
      gatingPassed.push({ row, slug, maillageEntry, content, parentDate });
    } else {
      items.push({ slug, contentType: 'article', status: 'draft', reasons: gatingResult.failures.map(f => f.message) });
    }
  }

  const scheduled = scheduler.computeSchedule({
    phase: 2, phaseStartDate: state.silo_start_date, queue: gatingPassed,
    capacityOverride: capacity, startIndex: state.items_scheduled_for_silo,
  });

  for (const art of scheduled) {
    const authorId = await resolveAuthorId(silo);
    const categoryId = await resolveCategoryId(silo, art.row.sous_cocon);
    const tagIds = await resolveTagIds(art.content.tags);
    const featuredMedia = await resolveFeaturedMedia(art.row.mot_cle_principal, silo);
    const payload = {
      title: art.content.title,
      slug: art.slug,
      status: 'future',
      date_gmt: art.post_date.replace(/Z$/, ''),
      content: art.content.content_gutenberg,
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
    items.push({ slug: art.slug, contentType: 'article', status: 'publie', postDate: art.post_date });
  }

  state.items_scheduled_for_silo += scheduled.length;
  state.budget_consomme += scheduled.length;

  return items;
}

/* ---------- Orchestration principale ---------- */

async function main() {
  const runDate = todayIso();
  const state = stateLib.loadState();
  stateLib.resetWeeklyBudgetIfNeeded(state);

  if (state.phase === 1) {
    console.log('Phase 1 (pause indexation) : aucune génération/publication. Vérifier /p6-indexation avant de repasser en phase 2.');
    return;
  }

  const usageAcc = { input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 };
  let items = [];

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

  state.derniere_execution = new Date().toISOString();
  if (!DRY_RUN) stateLib.saveState(state);

  const reportPath = report.writeRunReport({
    runDate, dryRun: DRY_RUN, phase: state.phase, silo: state.silo_en_cours, items, totalUsage: usageAcc,
  });

  console.log(`Run ${DRY_RUN ? '(dry-run) ' : ''}terminé. Rapport : ${reportPath}`);
  console.log(`Traités : ${items.length} — programmés : ${items.filter(i => i.status === 'publie').length} — bloqués : ${items.filter(i => i.status === 'draft').length}`);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
