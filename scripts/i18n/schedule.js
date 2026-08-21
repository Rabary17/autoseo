#!/usr/bin/env node
// Programmation de la file de publication des traductions (2026-08-18).
// Equivalent de /p5-schedule pour les locales : meme principe, meme prudence.
//
// ================= AVERTISSEMENT D'ORDONNANCEMENT =================
// Ne JAMAIS basculer une traduction en `future`/`publish` avant que le
// frontend serve les routes `/en/...` (etape 3 du chantier i18n).
//
// Raison verifiee le 2026-08-18 : `frontend/monauto/lib/wp.ts::getAllPosts()`
// recupere TOUS les articles publies sans aucun filtre de langue, et
// `app/[slug]/page.tsx` resout n'importe quel article par son slug. Un article
// anglais publie aujourd'hui serait donc servi a `/motorhome-speed-limits-law/`
// — dans l'espace de noms FRANCAIS, sans prefixe — inscrit dans le sitemap
// francais, affiche sur l'accueil et dans /archives/, avec `<html lang="fr">`.
// Une fois cette URL indexee, la deplacer vers /en/... coute des redirections
// et de l'autorite.
//
// Ce script REFUSE donc d'appliquer sans `--je-confirme-que-le-front-est-pret`.
// ==================================================================
//
// Cadence par defaut : 3 traductions/jour, en plus des 5 articles francais
// (decision utilisateur 2026-08-18 : « on vise la regularite »). 3/jour plutot
// que 5 parce que le stock traduit est FINI : 52 pages a 3/jour tiennent 17
// jours de publication reguliere, contre 10 jours a 5/jour — puis file a sec,
// exactement le probleme qu'on vient de corriger cote francais.
//
// Usage :
//   node scripts/i18n/schedule.js --locale=en --start=2026-09-01 [--per-day=3]
//   node scripts/i18n/schedule.js --locale=en --start=... --apply --je-confirme-que-le-front-est-pret
const wp = require('../autopublish/lib/wp-client');
const gating = require('../autopublish/lib/gating');
const trackingXlsx = require('../autopublish/lib/tracking-xlsx');
const i18n = require('./lib/i18n');
const sanitize = require('./lib/sanitize');

const arg = name => {
  const f = process.argv.find(a => a.startsWith(`--${name}=`));
  return f ? f.slice(name.length + 3) : null;
};
const APPLY = process.argv.includes('--apply');
const FRONT_PRET = process.argv.includes('--je-confirme-que-le-front-est-pret');
const config = i18n.loadConfig();
const LOCALE = arg('locale') || config.pilote.locale;
const PER_DAY = Number(arg('per-day') || 3);
const START = arg('start');

// Memes creneaux horaires que le pipeline francais (scheduler.js) : etales dans
// la journee plutot que groupes, et decales d'une heure par rapport aux
// creneaux francais pour ne pas empiler deux publications a la meme minute.
const HEURES = [9, 12, 15, 18, 21];

function addDays(iso, n) {
  const d = new Date(`${iso}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d;
}

(async () => {
  if (!START) { console.error('Usage : --start=YYYY-MM-DD (date de la premiere publication)'); process.exit(1); }
  if (PER_DAY > HEURES.length) { console.error(`--per-day max ${HEURES.length} (creneaux horaires definis).`); process.exit(1); }

  const index = i18n.loadIndex();
  const rows = trackingXlsx.readRows();
  const file = [];
  const exclus = [];

  // 1. Les PAGES d'abord : un article ne doit jamais etre publie avant son
  // sous-hub parent (meme regle que le pipeline francais, scheduler.js).
  for (const [siloSlug, byLocale] of Object.entries(index.taxonomie || {})) {
    const taxo = byLocale[LOCALE];
    if (!taxo) continue;
    if (taxo.wp_id) file.push({ type: 'pages', wpId: taxo.wp_id, slug: taxo.slug, silo: siloSlug, rang: 0 });
    for (const t of Object.values(taxo.sous_cocons || {})) {
      if (t.wp_id) file.push({ type: 'pages', wpId: t.wp_id, slug: t.slug, silo: siloSlug, rang: 1 });
    }
  }

  // 2. Les articles, gates un par un — jamais programmer ce qui echoue.
  for (const [frSlug, byLocale] of Object.entries(index.articles || {})) {
    const t = byLocale[LOCALE];
    if (!t || !t.wp_id) continue;

    // Contenu reserve aux residents francais : traduit avant la decision du
    // 2026-08-18, conserve en draft mais JAMAIS publie (voir
    // config/i18n-exclusions.json).
    const raisonFr = i18n.raisonExclusion(frSlug);
    if (raisonFr) { exclus.push([t.slug, `reserve aux residents francais : ${raisonFr}`]); continue; }

    const row = rows.find(r => r.url_cible && r.url_cible.replace(/\/$/, '').endsWith('/' + frSlug));
    if (!row) { exclus.push([t.slug, 'aucune ligne de tracking pour la source']); continue; }

    const p = await wp.request(`/posts/${t.wp_id}?status=any&context=edit`);
    if (p.status !== 'draft') { exclus.push([t.slug, `deja en statut "${p.status}"`]); continue; }

    const frFound = await wp.findBySlug('posts', frSlug);
    const src = frFound ? await wp.request(`/posts/${frFound.id}?status=any&context=edit`) : null;
    const acf = p.acf || {};
    const res = gating.runGating({
      contentType: 'article', silo: row.silo, sousCocon: row.sous_cocon,
      content: {
        content_gutenberg: p.content.raw, title: p.title.raw,
        meta_title: acf.meta_title || '', meta_description: acf.meta_description || '',
        excerpt: p.excerpt.raw,
        sources: (acf.sources || '').split('\n').filter(Boolean).map(label => ({ label, url: '' })),
        faq: (acf.faq || '').split('\n').filter(Boolean).map(l => {
          const [q, ...r] = l.split(' | '); return { question: q, answer: r.join(' | ') };
        }),
        tags: ['a', 'b', 'c'],
      },
      clusterRow: row, trackingRows: [], maillageEntry: null, childLinksCount: 0,
      parentPublished: true, factsProvided: Array(20).fill({}), lang: LOCALE,
      lengthRange: src ? sanitize.lengthRangeFromSource(src.content.raw) : null,
    });
    if (!res.passed) { exclus.push([t.slug, 'gating KO : ' + res.failures.map(f => f.message).join(' ; ')]); continue; }

    file.push({
      type: 'posts', wpId: t.wp_id, slug: t.slug, silo: null, rang: 2,
      sousCocon: row.sous_cocon, volume: Number(row.volume_estime) || 0, frSlug,
    });
  }

  // Tri : hub, puis sous-hubs, puis articles par sous-cocon et volume decroissant.
  file.sort((a, b) => a.rang - b.rang
    || String(a.sousCocon || '').localeCompare(String(b.sousCocon || ''))
    || (b.volume || 0) - (a.volume || 0));

  // Dates
  for (const [i, item] of file.entries()) {
    const d = addDays(START, Math.floor(i / PER_DAY));
    d.setUTCHours(HEURES[i % PER_DAY], 0, 0, 0);
    item.date = d.toISOString();
  }

  console.log(`=== File de publication ${LOCALE} — ${PER_DAY}/jour a partir du ${START} ===\n`);
  for (const it of file) {
    console.log(`${it.date.slice(0, 16).replace('T', ' ')}  ${it.type === 'pages' ? 'PAGE   ' : 'article'} #${it.wpId} ${it.slug}`);
  }
  console.log(`\n${file.length} contenu(s), du ${file[0]?.date.slice(0, 10)} au ${file[file.length - 1]?.date.slice(0, 10)}`);
  if (exclus.length) {
    console.log(`\n${exclus.length} exclu(s) :`);
    for (const [s, why] of exclus) console.log(`   ${s} — ${why}`);
  }

  if (!APPLY) { console.log('\n(simulation — ajouter --apply pour ecrire dans WordPress)'); return; }

  if (!FRONT_PRET) {
    console.error('\nREFUS : le frontend ne sert pas encore les routes /' + LOCALE + '/.');
    console.error('Publier maintenant exposerait ces pages a des URLs FRANCAISES et les ferait');
    console.error('entrer dans le sitemap francais (voir l\'avertissement en tete de ce fichier).');
    console.error('Quand l\'etape 3 est deployee et verifiee, relancer avec');
    console.error('  --je-confirme-que-le-front-est-pret');
    process.exitCode = 1;
    return;
  }

  for (const it of file) {
    const update = it.type === 'posts' ? wp.updatePost : wp.updatePage;
    await sanitize.withRetry(() => update(it.wpId, { status: 'future', date_gmt: it.date.replace(/Z$/, '') }),
      { log: m => console.log(`   ${m}`) });
    console.log(`programme #${it.wpId} ${it.slug} -> ${it.date.slice(0, 16)}`);
  }
  console.log(`\n${file.length} contenu(s) programme(s).`);
})().catch(e => { console.error(e); process.exit(1); });
