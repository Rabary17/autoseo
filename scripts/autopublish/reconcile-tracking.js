#!/usr/bin/env node
// Rapprochement entre l'état réel WordPress et `tracking-mots-cles.xlsx`
// (2026-08-18, demande explicite de l'utilisateur).
//
// Pourquoi ce script existe : le tracking peut affirmer `programmé` ou
// `publié` alors que l'article est resté `draft` côté WordPress — donc ne
// sortira jamais. Constaté le 2026-07-30 (8 articles annoncés publiés jamais
// devenus publics), reconstaté le 2026-08-10 (8 autres), reconstaté le
// 2026-08-18 (11, dont 6 antérieurs à la session). À chaque fois découvert à
// la main, par hasard, en allant regarder autre chose. Rien dans le pipeline
// ne comparait les deux sources.
//
// Le tracking est déclaratif (ce que le pipeline pense avoir fait), WordPress
// est la réalité (ce qui sortira vraiment). Quand les deux divergent, c'est
// toujours WordPress qui a raison : ce script ne corrige donc jamais
// WordPress d'après le tracking, seulement l'inverse, et uniquement avec
// --apply. Sans argument, il ne fait que lister.
//
// Usage :
//   node scripts/autopublish/reconcile-tracking.js            # rapport seul
//   node scripts/autopublish/reconcile-tracking.js --apply    # aligne le xlsx sur WordPress
const wp = require('./lib/wp-client');
const trackingXlsx = require('./lib/tracking-xlsx');

const APPLY = process.argv.includes('--apply');

// Statut xlsx attendu pour chaque statut WordPress. `pending`/`private` ne
// sont jamais produits par le pipeline : s'ils apparaissent, c'est une action
// manuelle dans wp-admin, à signaler plutôt qu'à normaliser en silence.
const EXPECTED_BY_WP_STATUS = {
  publish: 'publié',
  future: 'programmé',
  draft: null, // 'à faire', 'en rédaction' ou 'à valider' — tous légitimes
};
const DRAFT_OK = new Set(['à faire', 'en rédaction', 'à valider']);

async function fetchAllPosts() {
  const posts = [];
  for (const status of ['publish', 'future', 'draft', 'pending', 'private']) {
    let page = 1;
    for (;;) {
      const batch = await wp.request(
        `/posts?status=${status}&per_page=100&page=${page}&_fields=id,slug,status,date_gmt`
      );
      if (!Array.isArray(batch) || !batch.length) break;
      posts.push(...batch);
      if (batch.length < 100) break;
      page++;
    }
  }
  return posts;
}

function slugOf(url) {
  return url ? url.replace(/\/$/, '').split('/').pop() : null;
}

(async () => {
  const rows = trackingXlsx.readRows();
  const posts = await fetchAllPosts();
  const postBySlug = new Map(posts.map(p => [p.slug, p]));
  const trackedSlugs = new Set();

  const ecarts = [];       // le xlsx ment sur l'état réel
  const orphelinsWp = [];  // article WP sans ligne de tracking
  const orphelinsXlsx = []; // ligne "faite" sans article WP

  for (const row of rows) {
    const slug = slugOf(row.url_cible);
    if (!slug) {
      // Pas d'URL cible : normal tant que le cluster n'est pas rédigé.
      if (row.statut && !['à faire'].includes(row.statut)) {
        orphelinsXlsx.push({ keyword: row.mot_cle_principal, silo: row.silo, statut: row.statut, why: 'statut avancé sans url_cible' });
      }
      continue;
    }
    trackedSlugs.add(slug);
    const post = postBySlug.get(slug);
    if (!post) {
      if (row.statut !== 'à faire') {
        orphelinsXlsx.push({ keyword: row.mot_cle_principal, silo: row.silo, statut: row.statut, slug, why: 'aucun article WordPress pour ce slug' });
      }
      continue;
    }

    const expected = EXPECTED_BY_WP_STATUS[post.status];
    const coherent = post.status === 'draft'
      ? DRAFT_OK.has(row.statut)
      : expected !== undefined && row.statut === expected;

    if (!coherent) {
      ecarts.push({
        keyword: row.mot_cle_principal, silo: row.silo, slug, id: post.id,
        wp: post.status, xlsx: row.statut,
        dateWp: post.date_gmt ? post.date_gmt.slice(0, 10) : null,
        dateXlsx: row.date_publication || null,
        // Un draft dont le tracking dit "programmé"/"publié" ne sortira
        // jamais : c'est le cas grave. L'inverse (WP en avance sur le xlsx)
        // est bénin, l'article est bien en ligne.
        grave: post.status === 'draft',
        corrige: post.status === 'draft' ? 'à valider' : expected,
      });
    } else if (post.status === 'future' && row.date_publication && post.date_gmt.slice(0, 10) !== row.date_publication) {
      ecarts.push({
        keyword: row.mot_cle_principal, silo: row.silo, slug, id: post.id,
        wp: post.status, xlsx: row.statut,
        dateWp: post.date_gmt.slice(0, 10), dateXlsx: row.date_publication,
        grave: false, corrige: null, dateOnly: true,
      });
    }
  }

  for (const p of posts) {
    if (!trackedSlugs.has(p.slug)) orphelinsWp.push({ slug: p.slug, id: p.id, status: p.status });
  }

  /* ---------- Rapport ---------- */
  const graves = ecarts.filter(e => e.grave);
  console.log(`Articles WordPress : ${posts.length} — lignes de tracking avec url_cible : ${trackedSlugs.size}\n`);

  if (graves.length) {
    console.log(`⚠️  ${graves.length} article(s) annoncé(s) programmé/publié mais restés en DRAFT (ne sortiront jamais) :`);
    for (const e of graves) {
      console.log(`   #${e.id} ${e.slug} — xlsx "${e.xlsx}" (date ${e.dateXlsx || '?'}) / WordPress "draft" — ${e.silo}`);
    }
    console.log('');
  }

  const benins = ecarts.filter(e => !e.grave && !e.dateOnly);
  if (benins.length) {
    console.log(`${benins.length} écart(s) de statut sans gravité (WordPress en avance sur le tracking) :`);
    for (const e of benins) console.log(`   #${e.id} ${e.slug} — xlsx "${e.xlsx}" / WordPress "${e.wp}" -> corrigeable en "${e.corrige}"`);
    console.log('');
  }

  const dates = ecarts.filter(e => e.dateOnly);
  if (dates.length) {
    console.log(`${dates.length} écart(s) de date de publication :`);
    for (const e of dates) console.log(`   #${e.id} ${e.slug} — xlsx ${e.dateXlsx} / WordPress ${e.dateWp}`);
    console.log('');
  }

  if (orphelinsXlsx.length) {
    console.log(`${orphelinsXlsx.length} ligne(s) de tracking sans article WordPress correspondant :`);
    for (const o of orphelinsXlsx) console.log(`   "${o.keyword}" (${o.silo}) — statut "${o.statut}" — ${o.why}`);
    console.log('');
  }

  if (orphelinsWp.length) {
    console.log(`${orphelinsWp.length} article(s) WordPress hors tracking (actus ou contenu manuel, normal) :`);
    for (const o of orphelinsWp) console.log(`   #${o.id} ${o.slug} (${o.status})`);
    console.log('');
  }

  if (!ecarts.length && !orphelinsXlsx.length) console.log('✅ Aucun écart : tracking et WordPress sont alignés.');

  /* ---------- Correction (xlsx uniquement, jamais WordPress) ---------- */
  if (!APPLY) {
    if (ecarts.length) console.log('(rapport seul — relancer avec --apply pour aligner le xlsx sur WordPress)');
    return;
  }

  let corriges = 0;
  for (const e of ecarts) {
    const updates = {};
    if (e.corrige && e.corrige !== e.xlsx) updates.statut = e.corrige;
    if (e.wp === 'draft') updates.date_publication = null;
    else if (e.dateWp && e.dateWp !== e.dateXlsx) updates.date_publication = e.dateWp;
    if (!Object.keys(updates).length) continue;
    trackingXlsx.updateRow(rows, e.keyword, updates);
    console.log(`corrigé : ${e.slug} -> ${JSON.stringify(updates)}`);
    corriges++;
  }
  if (corriges) {
    trackingXlsx.writeRows(rows);
    console.log(`\n${corriges} ligne(s) corrigée(s) dans tracking-mots-cles.xlsx. WordPress n'a pas été touché.`);
  } else {
    console.log('\nRien à corriger dans le xlsx.');
  }
})().catch(e => { console.error(e); process.exit(1); });
