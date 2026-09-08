// Synchronise data/keywords/tracking-mots-cles.xlsx (feuille "Suivi") avec
// Firestore : niches/<id>/tracking/<slug>, un document par cluster de
// mots-clés (clé unique = mot_cle_principal, voir
// scripts/autopublish/lib/tracking-xlsx.js).
//
// Même design que niche-firestore-sync.js : Firestore devient la source
// canonique, mais les scripts qui lisent/écrivent le xlsx (run.js,
// score-opportunite.js, reconcile-tracking.js, etc. — 11 au total, voir
// `grep -rl "require.*tracking-xlsx" scripts/`) restent des lecteurs/
// écrivains SYNCHRONES du fichier local, sans aucun changement. Le pont est
// un pull/push explicite (scripts/sync-tracking-firestore.js), jamais invoqué
// depuis l'intérieur de ces scripts.
//
// Contrainte héritée de scripts/autopublish/lib/niche-paths.js (dont dépend
// tracking-xlsx.js) : NICHE_ID n'est résolu qu'une seule fois, au premier
// require, pour tout le process. Ce module ne traite donc qu'UNE niche par
// process, comme tracking-xlsx.js lui-même — d'où le require() différé de
// tracking-xlsx à l'intérieur de pullTracking/pushTracking (jamais en haut de
// fichier), et le CLI (sync-tracking-firestore.js) qui relance un process par
// niche pour --all plutôt que de boucler en mémoire.
//
// Repli gracieux identique à niche-firestore-sync.js : sans
// FIREBASE_SERVICE_ACCOUNT_JSON, pull()/push() se contentent d'un
// avertissement, le fichier local reste la seule source de vérité.
const crypto = require('crypto');
const { getDb } = require('./firestore-client');
const { hasFirestoreConfigured } = require('./niche-firestore-sync');

const COLLECTION = 'tracking';
const BATCH_SIZE = 400; // marge sous la limite de 500 écritures/batch Firestore

// Slug lisible + suffixe déterministe (8 hex de sha1) : évite les collisions
// entre deux mots-clés qui ne différeraient que par accents/ponctuation une
// fois nettoyés, tout en gardant un id humainement identifiable.
function slugifyKeyword(motClePrincipal) {
  const value = String(motClePrincipal);
  const base = value
    .normalize('NFD').replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
  const hash = crypto.createHash('sha1').update(value).digest('hex').slice(0, 8);
  return `${base || 'kw'}-${hash}`;
}

/** Firestore -> fichier local. Écrase la feuille "Suivi" avec les documents distants. */
async function pullTracking(nicheId) {
  if (!hasFirestoreConfigured()) {
    console.warn(`tracking-firestore-sync: FIREBASE_SERVICE_ACCOUNT_JSON absent — pull ignoré, fichier local conservé tel quel (${nicheId}).`);
    return { skipped: true };
  }
  const trackingXlsx = require('../autopublish/lib/tracking-xlsx');
  const snap = await getDb().collection('niches').doc(nicheId).collection(COLLECTION).get();
  const rows = snap.docs
    .map((doc) => {
      const data = doc.data();
      const row = {};
      trackingXlsx.COLUMNS.forEach((col) => { row[col] = data[col] ?? ''; });
      return row;
    })
    .sort((a, b) =>
      String(a.silo).localeCompare(String(b.silo))
      || String(a.sous_cocon).localeCompare(String(b.sous_cocon))
      || String(a.mot_cle_principal).localeCompare(String(b.mot_cle_principal))
    );
  trackingXlsx.writeRows(rows);
  return { skipped: false, count: rows.length };
}

/**
 * Fichier local -> Firestore. Le fichier local reste la source de vérité au
 * moment du push. Miroir complet : les documents Firestore qui ne
 * correspondent plus à aucune ligne locale (mot-clé supprimé du xlsx) sont
 * supprimés, pour qu'un pull ultérieur ne les fasse pas réapparaître.
 */
async function pushTracking(nicheId) {
  if (!hasFirestoreConfigured()) {
    console.warn(`tracking-firestore-sync: FIREBASE_SERVICE_ACCOUNT_JSON absent — push ignoré (${nicheId}).`);
    return { skipped: true };
  }
  const trackingXlsx = require('../autopublish/lib/tracking-xlsx');
  const rows = trackingXlsx.readRows().filter((r) => r.mot_cle_principal);
  const db = getDb();
  const collection = db.collection('niches').doc(nicheId).collection(COLLECTION);

  const pushedIds = new Set();
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = db.batch();
    for (const row of rows.slice(i, i + BATCH_SIZE)) {
      const id = slugifyKeyword(row.mot_cle_principal);
      pushedIds.add(id);
      batch.set(collection.doc(id), row);
    }
    await batch.commit();
  }

  const existingSnap = await collection.get();
  const staleIds = existingSnap.docs.map((d) => d.id).filter((id) => !pushedIds.has(id));
  for (let i = 0; i < staleIds.length; i += BATCH_SIZE) {
    const batch = db.batch();
    staleIds.slice(i, i + BATCH_SIZE).forEach((id) => batch.delete(collection.doc(id)));
    await batch.commit();
  }

  return { skipped: false, count: rows.length, deleted: staleIds.length };
}

module.exports = { pullTracking, pushTracking, slugifyKeyword };
