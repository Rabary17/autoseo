#!/usr/bin/env node
// Application des exclusions "France uniquement" aux traductions DEJA faites
// (2026-08-18).
//
// Contexte : 13 articles avaient ete traduits avant la decision d'exclure le
// contenu reserve aux residents francais. Leur traduction existe dans
// WordPress (en draft) et dans l'index. Deux consequences a traiter :
//
//   1. Les traductions CONSERVEES contiennent des liens vers ces 13 pages, qui
//      ne seront jamais publiees. Un lien vers une page qui ne sortira jamais
//      est un lien mort — meme classe de defaut que le 2026-08-03 cote
//      francais. On delie en gardant le texte d'ancre (politique identique a
//      lib/maillage-repair.js et lib/link-remap.js).
//
//   2. L'index doit porter la trace de l'exclusion, pour que personne ne se
//      demande dans six mois pourquoi ces drafts dorment sans etre programmes.
//
// Les drafts WordPress sont CONSERVES, pas supprimes : la decision est
// reversible, le contenu est deja paye, et si le perimetre rouvre on ne
// repaiera pas. `schedule.js` refuse de les programmer, c'est suffisant.
//
// Usage :
//   node scripts/i18n/apply-exclusions.js [--locale=en]            # rapport
//   node scripts/i18n/apply-exclusions.js [--locale=en] --apply
const wp = require('../autopublish/lib/wp-client');
const i18n = require('./lib/i18n');
const linkRemap = require('./lib/link-remap');
const sanitize = require('./lib/sanitize');

const arg = name => {
  const f = process.argv.find(a => a.startsWith(`--${name}=`));
  return f ? f.slice(name.length + 3) : null;
};
const APPLY = process.argv.includes('--apply');
const config = i18n.loadConfig();
const LOCALE = arg('locale') || config.pilote.locale;
const PREFIX = i18n.urlPrefix(config, LOCALE);

(async () => {
  const index = i18n.loadIndex();

  // Chemins des traductions desormais exclues.
  const cheminsMorts = new Map(); // chemin -> slug traduit
  const exclues = [];
  for (const [frSlug, byLocale] of Object.entries(index.articles || {})) {
    const t = byLocale[LOCALE];
    if (!t) continue;
    const raison = i18n.raisonExclusion(frSlug);
    if (!raison) continue;
    exclues.push({ frSlug, ...t, raison });
    for (const byLoc of Object.values(index.taxonomie || {})) {
      const taxo = byLoc[LOCALE];
      if (taxo) cheminsMorts.set(`${PREFIX}/${taxo.slug}/${t.slug}`, t.slug);
    }
  }

  console.log(`${exclues.length} traduction(s) ${LOCALE} desormais exclue(s) :`);
  for (const e of exclues) console.log(`   #${e.wp_id} ${e.slug} — ${e.raison}`);
  console.log('');

  if (!exclues.length) return;

  // Contenus conserves : articles non exclus + toutes les pages.
  const conserves = [];
  for (const [frSlug, byLocale] of Object.entries(index.articles || {})) {
    const t = byLocale[LOCALE];
    if (t && t.wp_id && !i18n.raisonExclusion(frSlug)) conserves.push({ type: 'posts', wpId: t.wp_id, slug: t.slug });
  }
  for (const byLoc of Object.values(index.taxonomie || {})) {
    const taxo = byLoc[LOCALE];
    if (!taxo) continue;
    if (taxo.wp_id) conserves.push({ type: 'pages', wpId: taxo.wp_id, slug: taxo.slug });
    for (const t of Object.values(taxo.sous_cocons || {})) {
      if (t.wp_id) conserves.push({ type: 'pages', wpId: t.wp_id, slug: t.slug });
    }
  }

  let touches = 0, liensDelies = 0;
  for (const c of conserves) {
    const p = await sanitize.withRetry(() => wp.request(`/${c.type}/${c.wpId}?status=any&context=edit`));
    let html = p.content.raw;
    const delies = [];
    for (const href of [...new Set(linkRemap.extractHrefs(html))]) {
      if (!cheminsMorts.has(href.replace(/\/$/, ''))) continue;
      html = linkRemap.unlink(html, href);
      delies.push(href);
    }
    if (!delies.length) continue;
    touches++; liensDelies += delies.length;
    console.log(`${c.slug} (#${c.wpId}) : ${delies.length} lien(s) vers du contenu exclu`);
    for (const d of delies) console.log(`   ${d}`);
    if (!APPLY) continue;
    const update = c.type === 'posts' ? wp.updatePost : wp.updatePage;
    await sanitize.withRetry(() => update(c.wpId, { content: html }));
    console.log('   -> delie(s) dans WordPress');
  }

  console.log(`\n${touches} contenu(s) conserve(s) referencaient du contenu exclu, ${liensDelies} lien(s) au total.`);

  if (!APPLY) { console.log('(rapport seul — relancer avec --apply)'); return; }

  for (const e of exclues) {
    index.articles[e.frSlug][LOCALE].statut = 'exclu_france_uniquement';
  }
  i18n.saveIndex(index);
  console.log(`Index mis a jour : ${exclues.length} traduction(s) marquee(s) "exclu_france_uniquement".`);
  console.log('Les drafts WordPress sont CONSERVES (decision reversible, contenu deja paye).');
})().catch(e => { console.error(e); process.exit(1); });
