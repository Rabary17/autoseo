#!/usr/bin/env node
// Reprogramme des articles déjà rédigés (contenu complet en `draft` côté
// WordPress) qui n'ont jamais été réellement programmés — typiquement après
// une coupure de session en plein run.js (2026-08-28, demande explicite de
// l'utilisateur : "lance le /p5-schedule sur ces 9 articles").
//
// Ne régénère RIEN : relit le contenu déjà en base, rejoue le gating tel
// quel (même principe que scripts/i18n/schedule.js pour les traductions),
// et ne programme que ce qui passe. `factsProvided` reçoit un tableau non
// vide factice (comme scripts/i18n/schedule.js) : pour du contenu déjà
// généré, le signal réel est `content.sources`, pas la liste éphémère de
// faits fournie au prompt d'origine (perdue, jamais persistée).
//
// Usage :
//   node scripts/autopublish/reschedule-stuck-drafts.js --start=2026-08-29
//   node scripts/autopublish/reschedule-stuck-drafts.js --start=... --apply
const wp = require('./lib/wp-client');
const gating = require('./lib/gating');
const scheduler = require('./lib/scheduler');
const trackingXlsx = require('./lib/tracking-xlsx');
const fs = require('fs');
const path = require('path');

const APPLY = process.argv.includes('--apply');
const arg = name => {
  const f = process.argv.find(a => a.startsWith(`--${name}=`));
  return f ? f.slice(name.length + 3) : null;
};
const START = arg('start');
if (!START) { console.error('Usage : --start=YYYY-MM-DD'); process.exit(1); }

const maillage = JSON.parse(fs.readFileSync(
  path.join(__dirname, '..', '..', 'data', 'maillage', 'maillage.json'), 'utf-8'
));

function lastSegment(url) {
  return (url || '').replace(/\/$/, '').split('/').pop();
}

// Cibles : lignes 'à valider' des 2 silos concernés dont le mot_cle_principal
// correspond à un des 9 articles au contenu déjà écrit (identifiés le
// 2026-08-26 depuis WordPress) — volontairement une liste EXPLICITE, pas
// "tout ce qui est à valider dans ces silos" (il y a d'autres 'à valider'
// plus anciens, déjà connus comme réellement bloqués, ex. vae-ville-confort-
// comparatif — hors périmètre de cette demande).
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

(async () => {
  const rows = trackingXlsx.readRows();
  const cibles = rows.filter(r => CIBLES.includes(r.mot_cle_principal));
  console.log(`${cibles.length}/${CIBLES.length} lignes cibles trouvées dans le tracking.\n`);

  const gated = [];
  for (const row of cibles) {
    const tag = `[${row.mot_cle_principal}]`;
    const slug = lastSegment(row.url_cible) || row.mot_cle_principal;
    const found = await wp.findBySlug('posts', slug);
    if (!found) { console.log(`${tag} introuvable sur WordPress (slug "${slug}") — ignoré.`); continue; }
    const post = await wp.request(`/posts/${found.id}?status=any&context=edit`);
    if (post.status !== 'draft') {
      console.log(`${tag} #${found.id} déjà en statut "${post.status}" — pas un draft, ignoré (déjà traité ?).`);
      continue;
    }

    const maillageEntry = maillage.find(m => m.mot_cle_principal === row.mot_cle_principal) || null;
    if (!maillageEntry) { console.log(`${tag} : pas d'entrée maillage.json — ignoré.`); continue; }

    let parentDate = null;
    const parentSlug = lastSegment(maillageEntry.sous_hub);
    if (parentSlug) {
      const parentPage = await wp.findBySlug('pages', parentSlug);
      parentDate = parentPage && parentPage.date_gmt ? new Date(`${parentPage.date_gmt}Z`) : null;
    }

    const acf = post.acf || {};
    const content = {
      content_gutenberg: post.content.raw,
      title: post.title.raw,
      meta_title: acf.meta_title || '',
      meta_description: acf.meta_description || '',
      excerpt: post.excerpt.raw,
      sources: (acf.sources || '').split('\n').filter(Boolean).map(label => ({ label, url: '' })),
      faq: (acf.faq || '').split('\n').filter(Boolean).map(l => {
        const [q, ...r] = l.split(' | '); return { question: q, answer: r.join(' | ') };
      }),
      tags: ['a', 'b', 'c'],
    };

    const res = gating.runGating({
      contentType: 'article', silo: row.silo, sousCocon: row.sous_cocon, content,
      clusterRow: row, trackingRows: rows, maillageEntry, childLinksCount: 0,
      parentPublished: !!parentDate, factsProvided: Array(20).fill({}),
    });

    if (!res.passed) {
      console.log(`${tag} #${found.id} : gating KO — ${res.failures.map(f => f.message).join(' ; ')}`);
      continue;
    }
    console.log(`${tag} #${found.id} : gating OK.`);
    gated.push({ row, wpId: found.id, parentDate: parentDate ? parentDate.toISOString() : null, maillageEntry });
  }

  console.log(`\n${gated.length}/${cibles.length} passent le gating.\n`);
  if (!gated.length) return;

  const scheduled = scheduler.computeSchedule({
    phase: 2, phaseStartDate: START,
    queue: gated.map(g => ({ ...g, parentDate: g.parentDate })),
    capacityOverride: 1,
  });

  for (const item of scheduled) {
    console.log(`${item.row.mot_cle_principal} -> ${item.post_date.slice(0, 16)} (#${item.wpId})`);
  }

  if (!APPLY) { console.log('\n(simulation — relancer avec --apply pour écrire)'); return; }

  for (const item of scheduled) {
    await wp.updatePost(item.wpId, { status: 'future', date_gmt: item.post_date.replace(/Z$/, '') });
    trackingXlsx.updateRow(rows, item.row.mot_cle_principal, {
      statut: 'programmé',
      date_publication: item.post_date.slice(0, 10),
    });
    console.log(`programmé : #${item.wpId} -> ${item.post_date.slice(0, 10)}`);
  }
  trackingXlsx.writeRows(rows);
  console.log(`\n${scheduled.length} article(s) programmé(s), tracking mis à jour.`);
})().catch(e => { console.error(e); process.exit(1); });
