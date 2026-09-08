// Client Firestore partagé — un seul point d'init pour tout le pipeline JS
// (niche-config.js, state.js, tracking-store.js, dashboard). Pattern repris
// de tonton-maj-v2 (même utilisateur, déjà en production dessus) : credentials
// via FIREBASE_SERVICE_ACCOUNT_JSON (JSON complet du compte de service en une
// variable d'env), pas un fichier sur disque — adapté à un cron GitHub Actions
// ou un déploiement Vercel, aucun des deux n'ayant de disque persistant pour
// un secret fichier. Repli .env local pour le développement, même convention
// que wp-client.js/mistral-client.js.
//
// Init PARESSEUSE (au premier getDb(), jamais au require) : de nombreux
// scripts du repo n'ont besoin ni de près ni de loin de Firestore (ex. tout
// ce qui ne touche qu'à data/maillage/*.json) — les faire échouer au chargement
// faute de credentials casserait des usages qui n'en ont jamais eu besoin.
const fs = require('fs');
const path = require('path');

function loadDotEnvFallback() {
  const envPath = path.join(__dirname, '..', '..', '.env');
  if (!fs.existsSync(envPath)) return {};
  const raw = fs.readFileSync(envPath, 'utf8');
  const env = {};
  raw.split('\n').filter(Boolean).forEach((line) => {
    const i = line.indexOf('=');
    if (i === -1) return;
    env[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  });
  return env;
}

const dotEnv = loadDotEnvFallback();
function getVar(name) {
  return process.env[name] ?? dotEnv[name];
}

let app = null;
let db = null;

function initFirebase() {
  if (app) return app;
  const raw = getVar('FIREBASE_SERVICE_ACCOUNT_JSON');
  if (!raw) {
    throw new Error(
      'firestore-client: FIREBASE_SERVICE_ACCOUNT_JSON doit être défini (env ou .env local) — '
      + "voir plan MVP SaaS interne pour la procédure de création du compte de service Firebase."
    );
  }
  let serviceAccount;
  try {
    serviceAccount = JSON.parse(raw);
  } catch (e) {
    throw new Error(`firestore-client: FIREBASE_SERVICE_ACCOUNT_JSON illisible (JSON invalide) : ${e.message}`);
  }
  // require() différé : évite de charger firebase-admin (et son coût
  // d'import) pour les scripts qui ne finissent jamais par appeler getDb().
  // API modulaire (firebase-admin v13) : `cert`/`initializeApp`/`getApps`
  // sont exportés directement, plus de namespace `admin.credential`/
  // `admin.firestore()` (breaking change par rapport aux versions < v12).
  const admin = require('firebase-admin');
  const { getFirestore } = require('firebase-admin/firestore');
  app = admin.getApps().length ? admin.getApp() : admin.initializeApp({ credential: admin.cert(serviceAccount) });
  db = getFirestore(app);
  return app;
}

function getDb() {
  if (!db) initFirebase();
  return db;
}

module.exports = { getDb, initFirebase };
