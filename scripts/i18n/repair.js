#!/usr/bin/env node
// Reparation en place des traductions DEJA inserees dans WordPress
// (2026-08-18).
//
// Necessaire parce que les garde-fous de lib/sanitize.js ont ete ecrits APRES
// le premier lot : les contenus deja inseres portent encore les defauts qu'ils
// corrigent desormais a la source (blocs Gutenberg mal fermes, champs meta trop
// longs). Les retraduire serait repayer pour rien — le texte est bon, seule la
// structure est a reparer, et elle l'est sans ambiguite en code.
//
// Ne touche QUE le contenu, les champs meta et l'image à la une. Ne change
// jamais le statut, ne publie rien, ne retraduit rien.
//
// Image à la une (ajouté le 2026-08-25) : `translate.js` ne la reprenait pas
// du tout de la source française jusqu'à ce jour — corrigé pour les nouvelles
// traductions, mais les ~60 déjà insérées restent sans image tant que ce
// script ne les répare pas une fois.
//
// Usage :
//   node scripts/i18n/repair.js [--locale=en]            # rapport seul
//   node scripts/i18n/repair.js [--locale=en] --apply
const wp = require('../autopublish/lib/wp-client');
const i18n = require('./lib/i18n');
const sanitize = require('./lib/sanitize');

const arg = name => {
  const f = process.argv.find(a => a.startsWith(`--${name}=`));
  return f ? f.slice(name.length + 3) : null;
};
const APPLY = process.argv.includes('--apply');
const config = i18n.loadConfig();
const LOCALE = arg('locale') || config.pilote.locale;

(async () => {
  const index = i18n.loadIndex();
  const cibles = [];

  for (const [frSlug, byLocale] of Object.entries(index.articles || {})) {
    const t = byLocale[LOCALE];
    if (t && t.wp_id) cibles.push({ type: 'posts', wpId: t.wp_id, label: t.slug, frSlug });
  }
  for (const [siloFrSlug, byLocale] of Object.entries(index.taxonomie || {})) {
    const taxo = byLocale[LOCALE];
    if (!taxo) continue;
    if (taxo.wp_id) cibles.push({ type: 'pages', wpId: taxo.wp_id, label: taxo.slug, frSlug: siloFrSlug });
    for (const [scFrSlug, t] of Object.entries(taxo.sous_cocons || {})) {
      if (t.wp_id) cibles.push({ type: 'pages', wpId: t.wp_id, label: t.slug, frSlug: scFrSlug });
    }
  }

  console.log(`${cibles.length} contenu(s) traduit(s) en ${LOCALE} a examiner${APPLY ? '' : ' (rapport seul)'}\n`);

  let repares = 0;
  for (const c of cibles) {
    let p;
    try {
      p = await wp.request(`/${c.type}/${c.wpId}?status=any&context=edit`);
    } catch (e) {
      console.log(`!! ${c.label} (#${c.wpId}) : illisible — ${e.message}`);
      continue;
    }

    const blocs = sanitize.repairGutenbergBlocks(p.content.raw);
    const meta = { meta_title: (p.acf || {}).meta_title || '', meta_description: (p.acf || {}).meta_description || '' };
    const clips = sanitize.clipMetaFields(meta);

    let featuredMedia = null;
    if (!p.featured_media && c.frSlug) {
      const source = await wp.findBySlug(c.type, c.frSlug).catch(() => null);
      if (source && source.featured_media) featuredMedia = source.featured_media;
    }

    if (!blocs.repairs.length && !clips.length && !featuredMedia) continue;

    console.log(`${c.label} (#${c.wpId})`);
    for (const r of blocs.repairs) console.log(`   bloc : ${r}`);
    for (const k of clips) console.log(`   meta : ${k}`);
    if (featuredMedia) console.log(`   image à la une : absente, reprise de la source (#${featuredMedia})`);
    repares++;

    if (!APPLY) continue;
    const payload = {};
    if (blocs.repairs.length) payload.content = blocs.html;
    if (clips.length) payload.acf = meta;
    if (featuredMedia) payload.featured_media = featuredMedia;
    const update = c.type === 'posts' ? wp.updatePost : wp.updatePage;
    await sanitize.withRetry(() => update(c.wpId, payload), { log: m => console.log(`   ${m}`) });
    console.log(`   -> corrige dans WordPress`);
  }

  console.log(`\n${repares} contenu(s) ${APPLY ? 'repare(s)' : 'a reparer'}.`);
  if (!APPLY && repares) console.log('(relancer avec --apply)');
})().catch(e => { console.error(e); process.exit(1); });
