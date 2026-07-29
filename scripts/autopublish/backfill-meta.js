#!/usr/bin/env node
// Backfill meta_title/meta_description sur les hubs/sous-hubs déjà publiés
// (draft) — demande explicite de l'utilisateur du 2026-07-28, une fois
// identifié que ces 2 champs n'avaient jamais été persistés ni consommés par
// le frontend (voir STATE.md). Un seul appel Mistral LÉGER par page
// (mistral-small, schéma minimal avec `maxLength` structurel — validé le même
// jour : Mistral tronque réellement au lieu de juste "viser" la limite), pas
// de re-génération du corps déjà rédigé et déjà payé.
//
// Prérequis : le mu-plugin (wordpress/mu-plugins/monauto-headless.php) doit
// être déployé sur le serveur live AVANT de lancer ce script pour de vrai —
// sinon `acf: { meta_title, meta_description }` est silencieusement ignoré
// par ACF (champ non déclaré), confirmé le 2026-07-28 par une sonde directe.
const wp = require('./lib/wp-client');
const maillage = require('./lib/maillage');
const mistralClient = require('./lib/mistral-client');

const DRY_RUN = process.argv.includes('--dry-run');

function lastSegment(url) {
  return url.split('/').filter(Boolean).pop();
}

function stripHtml(html) {
  return String(html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

// slug -> { keyword, contentType } pour tous les hubs/sous-hubs attendus par
// le maillage — mêmes règles que buildPhase0Candidates dans run.js (silo pour
// un hub, entité du sous-cocon pour un sous-hub).
function buildKeywordBySlug() {
  const map = new Map();
  for (const hubUrl of maillage.getAllHubUrls()) {
    const entry = maillage.getEntriesByHub(hubUrl)[0];
    if (!entry) continue;
    map.set(lastSegment(hubUrl), { keyword: entry.silo, contentType: 'hub' });
  }
  const sousHubUrls = [...new Set(maillage.loadMaillage().map(e => e.sous_hub))];
  for (const sousHubUrl of sousHubUrls) {
    const entries = maillage.getEntriesBySousHub(sousHubUrl);
    const entry = entries[0];
    if (!entry) continue;
    map.set(lastSegment(sousHubUrl), {
      keyword: entry.ancres?.entite_seule || lastSegment(sousHubUrl),
      contentType: 'sous-hub',
    });
  }
  return map;
}

const SCHEMA = {
  name: 'meta_seo',
  schema: {
    type: 'object',
    properties: {
      meta_title: {
        type: 'string',
        maxLength: 60,
        description: 'Vise 50 caractères, jamais plus de 60 (dur). Mot-clé principal en tête, distinct du H1 fourni.',
      },
      meta_description: {
        type: 'string',
        maxLength: 155,
        description: 'Vise 145 caractères, jamais plus de 155 (dur). Incite au clic, cohérente avec le résumé fourni.',
      },
    },
    required: ['meta_title', 'meta_description'],
    additionalProperties: false,
  },
};

async function generateMeta({ keyword, title, excerpt }) {
  const system = [
    'Tu écris UNIQUEMENT un titre SEO (meta_title) et une meta description (meta_description) pour une page déjà rédigée — tu ne réécris rien du corps, tu ne réponds pas au format article.',
    'meta_title : mot-clé principal en tête, doit apporter autre chose que la simple recopie du titre H1 fourni (angle SERP différent), ≤ 60 caractères.',
    "meta_description : incite au clic, cohérente avec le titre et le résumé réels fournis — jamais un chiffre ou une donnée qui n'y figure pas déjà, ≤ 155 caractères.",
  ].join('\n');
  const user = JSON.stringify({ mot_cle_principal: keyword, titre_h1: title, resume: excerpt });
  const result = await mistralClient.callMistral({
    model: 'mistral-small-latest',
    system: [{ type: 'text', text: system }],
    messages: [{ role: 'user', content: user }],
    schema: SCHEMA,
    maxTokens: 300,
  });
  return { meta_title: result.parsed.meta_title, meta_description: result.parsed.meta_description, usage: result.usage };
}

// L'API WP plafonne per_page à 100 — sans pagination, tout ce qui dépasse la
// 1ʳᵉ page est silencieusement ignoré (constaté le 2026-07-28 : 125 pages
// draft réelles, seules les 100 premières récupérées, "entretien-revision"
// manquait). On boucle jusqu'à une page vide.
async function fetchAllDraftPages() {
  const all = [];
  for (let page = 1; ; page += 1) {
    const batch = await wp.request(`/pages?per_page=100&page=${page}&status=draft&_fields=id,slug,title,excerpt,acf`);
    if (!batch.length) break;
    all.push(...batch);
    if (batch.length < 100) break;
  }
  return all;
}

async function main() {
  const keywordBySlug = buildKeywordBySlug();
  const pages = await fetchAllDraftPages();
  const targets = pages.filter((p) => keywordBySlug.has(p.slug));
  console.log(
    `${targets.length} page(s) en draft correspondant à un hub/sous-hub du maillage (sur ${pages.length} page(s) draft au total — les pages statiques hors pipeline, ex. à-propos, sont ignorées).`
  );

  let done = 0;
  let skipped = 0;
  let errors = 0;
  const usageAcc = { input_tokens: 0, output_tokens: 0 };

  for (const [i, page] of targets.entries()) {
    const { keyword, contentType } = keywordBySlug.get(page.slug);
    const tag = `[${i + 1}/${targets.length}] ${page.slug} (${contentType})`;

    if (page.acf?.meta_title && page.acf?.meta_description) {
      console.log(`${tag} : déjà renseigné, ignoré.`);
      skipped += 1;
      continue;
    }

    try {
      const title = page.title?.rendered || page.slug;
      const excerpt = stripHtml(page.excerpt?.rendered) || page.acf?.tldr || '';
      console.log(`${tag} : mot-clé principal "${keyword}" — appel génération (mistral-small-latest)...`);
      const { meta_title, meta_description, usage } = await generateMeta({ keyword, title, excerpt });
      usageAcc.input_tokens += usage.input_tokens || 0;
      usageAcc.output_tokens += usage.output_tokens || 0;
      console.log(`${tag} : meta_title (${meta_title.length} car.) — "${meta_title}"`);
      console.log(`${tag} : meta_description (${meta_description.length} car.) — "${meta_description}"`);

      if (!DRY_RUN) {
        await wp.updatePage(page.id, { acf: { meta_title, meta_description } });
        console.log(`${tag} : écrit dans WP (page #${page.id}).`);
      } else {
        console.log(`${tag} : dry-run — rien écrit.`);
      }
      done += 1;
    } catch (e) {
      console.error(`${tag} : ERREUR — ${e.message}`);
      errors += 1;
    }
  }

  console.log(`\nTerminé. ${done} mis à jour, ${skipped} déjà renseigné(s) (ignorés), ${errors} erreur(s).`);
  console.log(`Coût : ${usageAcc.input_tokens} tokens entrée, ${usageAcc.output_tokens} tokens sortie.`);
}

main().catch((e) => {
  console.error('[backfill-meta] échec fatal :', e);
  process.exit(1);
});
