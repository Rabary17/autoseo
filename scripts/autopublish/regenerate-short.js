#!/usr/bin/env node
// QC du silo "Carte grise & démarches" (2026-07-30, demande explicite de
// l'utilisateur) : 15 des 16 articles "à valider" étaient bloqués au gating
// uniquement pour longueur (<900 mots) — liens et images déjà vérifiés OK
// (sources gouvernementales réelles : ants.gouv.fr, service-public.fr...).
// Régénère le contenu (même pipeline que run.js : génération + 2 relectures +
// gating), mais UPDATE le post WP existant (par id) au lieu d'en créer un
// nouveau — évite un doublon de slug pour un article déjà en draft.
const config = require('./config');
const trackingXlsx = require('./lib/tracking-xlsx');
const maillage = require('./lib/maillage');
const factuel = require('./lib/factuel');
const competitorResearch = require('./lib/competitor-research');
const tavilyFacts = require('./lib/tavily-facts');
const promptBuilder = require('./lib/prompt-builder');
const mistralClient = require('./lib/mistral-client');
const reviewModule = require('./lib/review');
const gating = require('./lib/gating');
const wp = require('./lib/wp-client');

const MIN_LOCAL_FACTS_FOR_ARTICLE = 5;
const SILO = 'Carte grise & démarches';

// id WP existant <-> mot_cle_principal (résolu manuellement le 2026-07-30 via
// /posts?categories=...&status=draft, voir conversation).
const POST_ID_BY_KEYWORD = {
  'délai carte grise après achat': 955,
  'quitus fiscal véhicule étranger': 897,
  'taxe CO2 véhicule occasion': 907,
  'vendre voiture sans contrôle technique': 922,
  'déclaration cession véhicule en ligne': 933,
  'changement titulaire carte grise en ligne': 958,
  'carte grise prix par région': 969,
  'code de cession obtenir': 974,
  'certificat cession cerfa 15776': 937,
  'certificat conformité européen COC': 903,
  'calcul malus occasion importée': 911,
  'exonération malus famille nombreuse': 915,
  'cheval fiscal prix par région': 918,
  'contre-visite délai défauts': 945,
  'contrôle technique pas cher près': 941,
  'contrôle technique moto 2026': 952,
};

function lastSegment(url) {
  const parts = url.split('/').filter(Boolean);
  return parts[parts.length - 1];
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

  const onlyArg = process.argv.find(a => a.startsWith('--only='));
  const only = onlyArg ? onlyArg.slice('--only='.length).split(';') : null;

  const rows = trackingRows.filter(r => r.silo === SILO && r.statut === 'à valider' && POST_ID_BY_KEYWORD[r.mot_cle_principal]
    && (!only || only.includes(r.mot_cle_principal)));
  console.log(`${rows.length} article(s) à régénérer.`);

  for (const [i, row] of rows.entries()) {
    const postId = POST_ID_BY_KEYWORD[row.mot_cle_principal];
    const maillageEntry = maillage.getEntryByKeyword(row.mot_cle_principal);
    const slug = maillageEntry ? lastSegment(maillageEntry.url) : null;
    const logTag = `[${i + 1}/${rows.length}] ${row.mot_cle_principal} (post #${postId})`;
    try {
      let facts = factuel.searchFacts(`${row.mot_cle_principal} ${row.variantes || ''}`);
      if (facts.length < MIN_LOCAL_FACTS_FOR_ARTICLE) {
        const extra = await tavilyFacts.searchFactualData(row.mot_cle_principal);
        if (extra.length) facts = facts.concat(extra);
      }
      const competitorAngles = await competitorResearch.searchCompetitorAngles(row.mot_cle_principal);

      const { content } = await generateAndReview({
        contentType: 'article', silo: SILO, item: row, maillageEntry, facts, competitorAngles,
        slug: slug || row.mot_cle_principal, runDate, usageAcc, logPrefix: logTag,
      });

      const gatingResult = gating.runGating({
        contentType: 'article', silo: SILO, sousCocon: row.sous_cocon, content,
        clusterRow: row, trackingRows, maillageEntry, childLinksCount: 0,
        parentPublished: true, factsProvided: facts,
      });

      const wordCount = content.content_gutenberg.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;
      console.log(`${logTag} : ${wordCount} mots, gating ${gatingResult.passed ? 'OK' : 'KO (' + gatingResult.failures.map(f => f.message).join(' ; ') + ')'}`);

      const variants = (row.variantes || '').split(';').map(v => v.trim()).filter(Boolean).slice(0, 8);
      const keywords = [row.mot_cle_principal, ...variants].filter(Boolean).join(', ');

      await wp.updatePost(postId, {
        title: content.title,
        content: content.content_gutenberg,
        excerpt: content.excerpt,
        acf: {
          tldr: content.excerpt,
          sources: (content.sources || []).map(s => `${s.label} | ${s.url}`).join('\n'),
          faq: (content.faq || []).map(f => `${f.question} | ${f.answer}`).join('\n'),
          meta_title: content.meta_title,
          meta_description: content.meta_description,
          keywords,
        },
      });

      // Statut xlsx laissé inchangé ('à valider') : le gating passé ne veut
      // dire "publiable" qu'après ma propre relecture finale (liens/faits),
      // jamais automatique — voir mémoire feedback-qc-avant-publication-autoseo.

      results.push({ postId, keyword: row.mot_cle_principal, wordCount, passed: gatingResult.passed, failures: gatingResult.failures?.map(f => f.message) });
    } catch (e) {
      console.error(`${logTag} : ERREUR ${e.message}`);
      results.push({ postId, keyword: row.mot_cle_principal, error: e.message });
    }
  }

  console.log('\n=== Résumé ===');
  for (const r of results) console.log(JSON.stringify(r));
  console.log(`Tokens : ${usageAcc.input_tokens} entrée / ${usageAcc.output_tokens} sortie.`);
}

main().catch(e => { console.error(e); process.exit(1); });
