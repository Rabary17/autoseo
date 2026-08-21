#!/usr/bin/env node
// Etoffement des articles deja inseres mais bloques au gating pour longueur
// (2026-08-21).
//
// Distinct de `regenerate-short.js`, qui REGENERE l'article de zero (et perd
// donc le contenu deja relu, deja corrige a la main dans certains cas, en
// repayant la generation complete). Ici on AJOUTE, on ne refait pas : meme
// passe d'etoffement que celle integree a `run.js`, avec les memes trois
// garde-fous, appliquee aux brouillons existants.
//
// Ne touche jamais le statut WordPress ni la date : un article etoffe reste en
// draft, sa programmation est une decision distincte (/p5-schedule).
//
// Usage :
//   node scripts/autopublish/expand-short.js               # rapport
//   node scripts/autopublish/expand-short.js --apply
const config = require('./config');
const trackingXlsx = require('./lib/tracking-xlsx');
const maillage = require('./lib/maillage');
const factuel = require('./lib/factuel');
const promptBuilder = require('./lib/prompt-builder');
const mistralClient = require('./lib/mistral-client');
const gating = require('./lib/gating');
const maillageRepair = require('./lib/maillage-repair');
const contentRepair = require('./lib/content-repair');
const wp = require('./lib/wp-client');

const APPLY = process.argv.includes('--apply');
const MOTS_CIBLE = 1400;
const MOTS_PLAFOND_PROMPT = 1900;
const MOTS_PLAFOND_GATING = 3500;

const compterMots = html => {
  const t = String(html || '').replace(/<!--[\s\S]*?-->/g, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  return t ? t.split(' ').filter(Boolean).length : 0;
};
const structure = html => ({
  h2: (String(html || '').match(/<h2[\s>]/gi) || []).length,
  liens: (String(html || '').match(/<a\s[^>]*href=/gi) || []).length,
});

(async () => {
  const rows = trackingXlsx.readRows();
  const candidats = rows.filter(r => r.statut === 'à valider' && r.url_cible);
  const resultats = [];

  for (const row of candidats) {
    const slug = row.url_cible.replace(/\/$/, '').split('/').pop();
    const found = await wp.findBySlug('posts', slug).catch(() => null);
    if (!found) continue;
    const p = await wp.request(`/posts/${found.id}?status=any&context=edit`);
    const mots = compterMots(p.content.raw);
    if (mots >= 900) continue; // bloque pour autre chose que la longueur

    const acf = p.acf || {};
    const contenu = {
      title: p.title.raw, meta_title: acf.meta_title || '', meta_description: acf.meta_description || '',
      excerpt: p.excerpt.raw, content_gutenberg: p.content.raw,
      faq: (acf.faq || '').split('\n').filter(Boolean).map(l => {
        const [q, ...r] = l.split(' | '); return { question: q, answer: r.join(' | ') };
      }),
      sources: (acf.sources || '').split('\n').filter(Boolean).map(label => ({ label })),
      tags: ['a', 'b', 'c'], inline_images: [],
    };
    const facts = factuel.searchFacts(`${row.mot_cle_principal} ${row.variantes || ''}`);
    const maillageEntry = maillage.getEntryByKeyword(row.mot_cle_principal);

    console.log(`\n${slug} : ${mots} mots, ${facts.length} fait(s) disponible(s) — etoffement...`);
    const req = promptBuilder.buildExpansionRequest({
      generatedContent: contenu, facts, competitorAngles: [],
      motsActuels: mots, motsCible: MOTS_CIBLE, motsPlafond: MOTS_PLAFOND_PROMPT,
    });

    let etoffe;
    try {
      const res = await mistralClient.callMistral({
        model: config.MODEL_BY_CONTENT_TYPE.article.model,
        system: req.system, messages: req.messages, schema: req.schema, maxTokens: 16000,
      });
      etoffe = res.parsed;
    } catch (e) {
      console.log(`   ECHEC : ${e.message}`);
      resultats.push({ slug, avant: mots, verdict: 'erreur' });
      continue;
    }

    const avantS = structure(contenu.content_gutenberg);
    const apresS = structure(etoffe.content_gutenberg);
    const motsApres = compterMots(etoffe.content_gutenberg);

    // Memes trois garde-fous que run.js — un etoffement doit ajouter du texte
    // sans perdre de section ni toucher aux liens, et sans depasser le
    // plafond de gating.
    const rejets = [];
    if (motsApres <= mots) rejets.push(`aucun gain (${motsApres})`);
    if (apresS.h2 < avantS.h2) rejets.push(`sections perdues (${avantS.h2} -> ${apresS.h2})`);
    if (apresS.liens !== avantS.liens) rejets.push(`liens modifies (${avantS.liens} -> ${apresS.liens})`);
    if (motsApres > MOTS_PLAFOND_GATING) rejets.push(`depasse le plafond (${motsApres} > ${MOTS_PLAFOND_GATING})`);
    if (rejets.length) {
      console.log(`   REFUSE : ${rejets.join(' ; ')}`);
      resultats.push({ slug, avant: mots, apres: motsApres, verdict: 'refuse' });
      continue;
    }

    // Reparation du maillage, comme dans run.js : la passe peut avoir touche
    // un lien malgre l'interdiction.
    const cr = contentRepair.repairContent(etoffe);
    for (const r of cr.repairs) console.log(`   contenu repare : ${r}`);
    const rep = maillageRepair.repairArticleLinks({ content: cr.content, maillageEntry });
    for (const r of rep.repairs) console.log(`   maillage repare : ${r}`);
    const finale = rep.content;

    const g = gating.runGating({
      contentType: 'article', silo: row.silo, sousCocon: row.sous_cocon,
      content: { ...finale, sources: contenu.sources, tags: ['a', 'b', 'c'] },
      clusterRow: row, trackingRows: rows, maillageEntry,
      childLinksCount: 0, parentPublished: true, factsProvided: facts,
    });
    console.log(`   ${mots} -> ${motsApres} mots (${apresS.h2} sections) — gating ${g.passed ? 'OK' : 'KO : ' + g.failures.map(f => f.message).join(' ; ')}`);
    resultats.push({ slug, avant: mots, apres: motsApres, verdict: g.passed ? 'ok' : 'gating-ko', wpId: found.id, html: finale.content_gutenberg, motCle: row.mot_cle_principal });
  }

  const ok = resultats.filter(r => r.verdict === 'ok');
  console.log(`\n=== ${resultats.length} article(s) traites — ${ok.length} passent le gating ===`);
  for (const r of resultats) console.log(`   ${r.verdict.padEnd(9)} ${r.slug} ${r.avant}${r.apres ? ' -> ' + r.apres : ''}`);

  if (!APPLY) { console.log('\n(simulation — --apply pour ecrire dans WordPress)'); return; }

  for (const r of ok) {
    await wp.updatePost(r.wpId, { content: r.html });
    trackingXlsx.updateRow(rows, r.motCle, { statut: 'en rédaction' });
    console.log(`ecrit #${r.wpId} ${r.slug} (statut -> en rédaction, programmation via /p5-schedule)`);
  }
  trackingXlsx.writeRows(rows);
  console.log(`\n${ok.length} article(s) etoffe(s). Statut WordPress inchange (draft).`);
})().catch(e => { console.error(e); process.exit(1); });
