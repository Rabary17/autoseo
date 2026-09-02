#!/usr/bin/env node
// Régénère 10 articles dont le contenu existait (1200-2300 mots) mais dont
// les champs ACF étaient entièrement vides (aucune source, aucun meta_title)
// — probablement une insertion WordPress interrompue en plein milieu par une
// coupure de session de l'agent (2026-08-28, demande explicite de
// l'utilisateur : "régénère-les ultra rapidement").
//
// Même pipeline que run.js (génération + 2 relectures + gating), UPDATE du
// post WP existant par id (pas de création — évite un doublon de slug),
// adapté de regenerate-short.js (2026-07-30) pour couvrir 2 silos au lieu
// d'un seul codé en dur.
//
// Statut xlsx laissé à 'à valider' même si le gating passe (pas
// automatiquement 'programmé') — voir mémoire feedback-qc-avant-publication-
// autoseo : jamais de draft -> publish sans revue manuelle sur un site en
// ligne. La programmation reste une étape distincte, après relecture.
const trackingXlsx = require('./lib/tracking-xlsx');
const config = require('./config');
const factuel = require('./lib/factuel');
const competitorResearch = require('./lib/competitor-research');
const tavilyFacts = require('./lib/tavily-facts');
const promptBuilder = require('./lib/prompt-builder');
const mistralClient = require('./lib/mistral-client');
const reviewModule = require('./lib/review');
const gating = require('./lib/gating');
const wp = require('./lib/wp-client');
const fs = require('fs');
const path = require('path');
// scripts/autopublish n'a pas son propre withRetry (contrairement à
// scripts/i18n/lib/sanitize.js) — jamais porté ici, alors que "fetch failed"
// et les 504 Mistral sont des échecs documentés de façon récurrente dans
// STATE.md pour ce pipeline. Réutilisé tel quel plutôt que dupliqué
// (2026-08-28, trouvé en régénérant ces 10 articles : 1 seul passait sur 10
// à chaque tentative avant ce correctif, systématiquement le premier).
const { withRetry } = require('../i18n/lib/sanitize');

const MIN_LOCAL_FACTS_FOR_ARTICLE = 5;

const CIBLES = [
  'assurance trottinette obligatoire',
  'vélo cargo électrique famille',
  'VAE reconditionné avis',
  'entretien vélo électrique coût',
  'classement F1 direct',
  'règlement F1 2026 moteurs',
  'GP de France retour',
  'track day prix circuits France',
  'assurance track day',
  'équipement obligatoire circuit',
];

const maillageList = JSON.parse(fs.readFileSync(
  path.join(__dirname, '..', '..', 'data', 'maillage', 'maillage.json'), 'utf-8'
));
function maillageFor(motCle) {
  return maillageList.find(m => m.mot_cle_principal === motCle) || null;
}
function lastSegment(url) {
  return (url || '').replace(/\/$/, '').split('/').pop();
}

function addUsage(acc, usage) {
  if (!usage) return acc;
  acc.input_tokens += usage.input_tokens || 0;
  acc.output_tokens += usage.output_tokens || 0;
  return acc;
}

async function generateAndReview({ contentType, silo, item, maillageEntry, facts, competitorAngles, slug, runDate, usageAcc, logPrefix }) {
  const tag = logPrefix;
  const genReq = promptBuilder.buildGenerationRequest({ contentType, silo, item, maillageEntry, childLinks: [], facts, competitorAngles });
  const modelCfg = config.MODEL_BY_CONTENT_TYPE[contentType];
  const genModel = process.env.GEN_MODEL_OVERRIDE || modelCfg.model;
  console.log(`${tag} génération (${genModel})...`);
  const genResult = await mistralClient.callMistral({
    model: genModel, system: genReq.system, messages: genReq.messages, schema: genReq.schema,
    maxTokens: reviewModule.MAX_TOKENS_BY_CONTENT_TYPE?.[contentType] || 16000,
  });
  addUsage(usageAcc, genResult.usage);

  const reviewModel = config.REVIEW_MODEL_BY_CONTENT_TYPE[contentType].model;
  console.log(`${tag} relecture voix/faits (${reviewModel})...`);
  const reviewResult = await reviewModule.reviewContent({
    contentType, silo, slug, generatedContent: genResult.parsed, maillageEntry, facts, competitorAngles, runDate, model: reviewModel,
  });
  addUsage(usageAcc, reviewResult.usage);

  console.log(`${tag} relecture lisibilité (${reviewModel})...`);
  const readabilityResult = await reviewModule.reviewReadability({
    contentType, silo, slug, generatedContent: reviewResult.content, runDate, model: reviewModel,
  });
  addUsage(usageAcc, readabilityResult.usage);

  return { content: readabilityResult.content };
}

async function main() {
  const runDate = new Date().toISOString().slice(0, 10);
  const trackingRows = trackingXlsx.readRows();
  const usageAcc = { input_tokens: 0, output_tokens: 0 };
  const results = [];

  const rows = trackingRows.filter(r => CIBLES.includes(r.mot_cle_principal));
  console.log(`${rows.length}/${CIBLES.length} lignes trouvées dans le tracking.\n`);

  for (const [i, row] of rows.entries()) {
    const maillageEntry = maillageFor(row.mot_cle_principal);
    const slug = maillageEntry ? lastSegment(maillageEntry.url) : lastSegment(row.url_cible);
    const logTag = `[${i + 1}/${rows.length}] ${row.mot_cle_principal}`;
    try {
      const found = await wp.findBySlug('posts', slug);
      if (!found) { console.log(`${logTag} : introuvable sur WordPress (slug "${slug}") — ignoré.`); continue; }
      const postId = found.id;

      let facts = factuel.searchFacts(`${row.mot_cle_principal} ${row.variantes || ''}`);
      if (facts.length < MIN_LOCAL_FACTS_FOR_ARTICLE) {
        const extra = await tavilyFacts.searchFactualData(row.mot_cle_principal);
        if (extra.length) facts = facts.concat(extra);
      }
      const competitorAngles = await competitorResearch.searchCompetitorAngles(row.mot_cle_principal);

      const { content } = await generateAndReview({
        contentType: 'article', silo: row.silo, item: row, maillageEntry, facts, competitorAngles,
        slug, runDate, usageAcc, logPrefix: logTag,
      });

      const gatingResult = gating.runGating({
        contentType: 'article', silo: row.silo, sousCocon: row.sous_cocon, content,
        clusterRow: row, trackingRows, maillageEntry, childLinksCount: 0,
        parentPublished: true, factsProvided: facts,
      });

      const wordCount = content.content_gutenberg.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;
      console.log(`${logTag} #${postId} : ${wordCount} mots, gating ${gatingResult.passed ? 'OK' : 'KO (' + gatingResult.failures.map(f => f.message).join(' ; ') + ')'}`);

      const variants = (row.variantes || '').split(';').map(v => v.trim()).filter(Boolean).slice(0, 8);
      const keywords = [row.mot_cle_principal, ...variants].filter(Boolean).join(', ');

      await wp.updatePost(postId, {
        title: content.title,
        content: content.content_gutenberg,
        excerpt: content.excerpt,
        acf: {
          tldr: content.excerpt,
          sources: (content.sources || []).map(s => s.label).join('\n'),
          faq: (content.faq || []).map(f => `${f.question} | ${f.answer}`).join('\n'),
          meta_title: content.meta_title,
          meta_description: content.meta_description,
          keywords,
        },
      });

      // Statut laissé à 'à valider' même si gating OK — revue manuelle avant
      // programmation (voir mémoire feedback-qc-avant-publication-autoseo).
      results.push({ postId, keyword: row.mot_cle_principal, silo: row.silo, url: maillageEntry ? maillageEntry.url : `/${slug}`, wordCount, passed: gatingResult.passed, failures: gatingResult.failures?.map(f => f.message) });
    } catch (e) {
      console.error(`${logTag} : ERREUR ${e.message}`);
      results.push({ keyword: row.mot_cle_principal, error: e.message });
    }
  }

  console.log('\n=== Résumé ===');
  for (const r of results) console.log(JSON.stringify(r));
  console.log(`Tokens : ${usageAcc.input_tokens} entrée / ${usageAcc.output_tokens} sortie.`);
}

main().catch(e => { console.error(e); process.exit(1); });
