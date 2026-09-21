#!/usr/bin/env node
// Réattribution en masse de l'auteur WordPress du contenu traduit i18n
// (2026-09-21) — corrige rétroactivement ce que scripts/i18n/translate.js
// faisait avant son correctif du même jour : créer les posts/pages traduits
// SANS champ `author` explicite, ce qui fait retomber WordPress sur le
// compte authentifié de la requête REST (WP_USER, le compte personnel réel
// andrianina.rabarivelo@gmail.com), jamais sur une persona créée pour le
// site. Constaté par l'utilisateur sur plusieurs posts/pages anglais.
//
// Source de vérité : data/i18n/index.json (jamais WordPress lui-même) — cet
// index sait déjà, pour chaque post/page traduit, à quel silo français il
// appartient (voir scripts/i18n/lib/i18n.js). Le silo donne la persona via
// scripts/autopublish/lib/persona.js, exactement comme pour le contenu
// français (scripts/autopublish/run.js#resolveAuthorId).
//
// Toujours DRY-RUN par défaut (aucune écriture WordPress) : affiche le plan
// (quel wp_id -> quelle persona) sans rien modifier. `--apply` exécute
// réellement les changements.
//
// Usage :
//   node scripts/i18n/reassign-authors.js            # dry-run
//   node scripts/i18n/reassign-authors.js --apply     # applique
const wp = require('../autopublish/lib/wp-client');
const persona = require('../autopublish/lib/persona');
const autopublishConfig = require('../autopublish/config');
const trackingXlsx = require('../autopublish/lib/tracking-xlsx');
const i18n = require('./lib/i18n');

const APPLY = process.argv.includes('--apply');

// Même pont slug -> nom lisible que scripts/i18n/translate.js (silo au sens
// tracking, jamais codé en dur ici — une seule source de vérité).
function siloNameFromSlug(rows, siloSlug) {
  for (const r of rows) {
    if (r.url_cible && r.url_cible.replace(/^\//, '').split('/')[0] === siloSlug) return r.silo;
  }
  return null;
}

function buildPlan(index, rows) {
  const plan = [];

  for (const [siloSlug, byLocale] of Object.entries(index.taxonomie || {})) {
    const siloName = siloNameFromSlug(rows, siloSlug);
    if (!siloName) {
      console.warn(`[skip] silo "${siloSlug}" (pages) introuvable dans le tracking — ignoré.`);
      continue;
    }
    for (const [locale, taxo] of Object.entries(byLocale)) {
      if (taxo.wp_id) {
        plan.push({ type: 'pages', wpId: taxo.wp_id, siloName, locale, label: `hub ${siloSlug}` });
      }
      for (const [frSlug, sc] of Object.entries(taxo.sous_cocons || {})) {
        if (sc.wp_id) {
          plan.push({ type: 'pages', wpId: sc.wp_id, siloName, locale, label: `sous-hub ${frSlug}` });
        }
      }
    }
  }

  for (const [frSlug, byLocale] of Object.entries(index.articles || {})) {
    for (const [locale, info] of Object.entries(byLocale)) {
      if (!info.wp_id || !info.silo) continue;
      const siloName = siloNameFromSlug(rows, info.silo);
      if (!siloName) {
        console.warn(`[skip] silo "${info.silo}" (article ${frSlug}) introuvable dans le tracking — ignoré.`);
        continue;
      }
      plan.push({ type: 'posts', wpId: info.wp_id, siloName, locale, label: `article ${frSlug}` });
    }
  }

  return plan;
}

(async () => {
  const rows = trackingXlsx.readRows();
  const index = i18n.loadIndex();
  const plan = buildPlan(index, rows);

  console.log(`${plan.length} contenu(s) traduit(s) référencé(s) dans data/i18n/index.json.\n`);
  if (!plan.length) return;

  const authorCache = new Map(); // siloName -> {id, key, slug}
  let usersCache = null;
  async function resolveAuthor(siloName) {
    if (authorCache.has(siloName)) return authorCache.get(siloName);
    const key = persona.getPersonaKeyForSilo(siloName);
    const slug = autopublishConfig.WP_AUTHOR_SLUG_BY_PERSONA[key];
    if (!usersCache) usersCache = await wp.getAllUsers();
    const user = usersCache.find(u => u.slug === slug);
    if (!user) {
      throw new Error(`Compte WordPress introuvable pour la persona ${key} (slug attendu "${slug}").`);
    }
    const resolved = { id: user.id, key, slug };
    authorCache.set(siloName, resolved);
    return resolved;
  }

  let planned = 0, changed = 0, unchanged = 0, errors = 0;
  for (const item of plan) {
    try {
      const author = await resolveAuthor(item.siloName);
      if (!APPLY) {
        console.log(`[dry-run] ${item.type}/${item.wpId} (${item.label}, ${item.locale}, silo "${item.siloName}") -> persona ${author.key} (#${author.id}, ${author.slug})`);
        planned++;
        continue;
      }
      const updateFn = item.type === 'posts' ? wp.updatePost : wp.updatePage;
      const updated = await updateFn(item.wpId, { author: author.id });
      if (updated.author === author.id) {
        console.log(`[applied] ${item.type}/${item.wpId} (${item.label}, ${item.locale}) -> auteur #${updated.author} (persona ${author.key})`);
        changed++;
      } else {
        console.error(`[erreur] ${item.type}/${item.wpId} : auteur non confirmé après écriture (reçu #${updated.author}, attendu #${author.id}).`);
        errors++;
      }
    } catch (e) {
      errors++;
      console.error(`[erreur] ${item.type}/${item.wpId} (${item.label}) : ${e.message}`);
    }
  }

  if (!APPLY) {
    console.log(`\n=== Dry-run terminé — ${planned} changement(s) prévu(s), ${errors} erreur(s) ===`);
    console.log('Relancer avec --apply pour appliquer réellement ces changements sur WordPress.');
  } else {
    console.log(`\n=== Application terminée — ${changed} modifié(s), ${unchanged} inchangé(s), ${errors} erreur(s) ===`);
  }
})().catch(e => { console.error(e); process.exit(1); });
