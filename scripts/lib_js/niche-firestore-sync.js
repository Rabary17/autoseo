// Synchronise config/niches/<id>/niche.json avec Firestore (collection
// `niches`, un document par niche = le JSON entier, largement sous la limite
// de 1 Mo/document — voir plan MVP SaaS interne).
//
// Design choisi pour éviter un refactor async de tout le pipeline : Firestore
// devient la source canonique, mais niche-config.js / niche-paths.js /
// persona.js / config.js restent des lecteurs SYNCHRONES du fichier local
// (aucun changement requis dedans). Le pont entre les deux est un `pull`
// explicite, invoqué en étape PRÉALABLE (workflow CI, ou avant un run manuel)
// — jamais depuis l'intérieur de run.js lui-même, où tout le graphe de
// require (config.js, persona.js) s'exécute avant qu'un premier `await`
// puisse avoir eu lieu.
//
// Repli gracieux : si FIREBASE_SERVICE_ACCOUNT_JSON n'est pas configuré,
// pull()/push() se contentent d'un avertissement — le fichier local reste
// la seule source de vérité, comme avant cette migration (dev local sans
// Firebase configuré toujours fonctionnel).
const fs = require('fs');
const path = require('path');
const nicheConfig = require('./niche-config');

function hasFirestoreConfigured() {
  return Boolean(process.env.FIREBASE_SERVICE_ACCOUNT_JSON) || (() => {
    try {
      const envPath = path.join(__dirname, '..', '..', '.env');
      return fs.existsSync(envPath) && fs.readFileSync(envPath, 'utf8').includes('FIREBASE_SERVICE_ACCOUNT_JSON');
    } catch {
      return false;
    }
  })();
}

/** Firestore -> fichier local. Écrase config/niches/<id>/niche.json avec le document distant. */
async function pullNiche(nicheId) {
  if (!hasFirestoreConfigured()) {
    console.warn(`niche-firestore-sync: FIREBASE_SERVICE_ACCOUNT_JSON absent — pull ignoré, fichier local conservé tel quel (${nicheId}).`);
    return { skipped: true };
  }
  const { getDb } = require('./firestore-client');
  const snap = await getDb().collection('niches').doc(nicheId).get();
  if (!snap.exists) {
    throw new Error(`niche-firestore-sync: document Firestore niches/${nicheId} introuvable — utiliser push d'abord pour l'y créer.`);
  }
  const niche = snap.data();
  const filePath = path.join(nicheConfig.nicheDir(nicheId), 'niche.json');
  fs.writeFileSync(filePath, JSON.stringify(niche, null, 2) + '\n', 'utf8');
  return { skipped: false, niche };
}

/** Fichier local -> Firestore. Le fichier local reste la source de vérité au moment du push. */
async function pushNiche(nicheId) {
  if (!hasFirestoreConfigured()) {
    console.warn(`niche-firestore-sync: FIREBASE_SERVICE_ACCOUNT_JSON absent — push ignoré (${nicheId}).`);
    return { skipped: true };
  }
  const niche = nicheConfig.loadNiche(nicheId);
  const { getDb } = require('./firestore-client');
  await getDb().collection('niches').doc(nicheId).set(niche);
  return { skipped: false, niche };
}

module.exports = { pullNiche, pushNiche, hasFirestoreConfigured };
