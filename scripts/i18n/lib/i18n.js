// Accès à la configuration i18n et à l'index des traductions (2026-08-18).
//
// Deux fichiers, deux rôles distincts :
//   - `config/i18n.json` : ce qu'on VEUT (langues, silos traduisibles, pilote).
//     Écrit à la main, décision éditoriale.
//   - `data/i18n/index.json` : ce qui EXISTE réellement (quel article français
//     a quelle traduction, sous quel slug, dans quel post WordPress).
//     Écrit par le pipeline, jamais à la main.
//
// L'index est la piece maîtresse : c'est lui qui permet de générer les balises
// hreflang côté frontend sans interroger WordPress, et de savoir ce qui reste
// à traduire sans tout re-scanner. Il joue pour les traductions le rôle que
// `tracking-mots-cles.xlsx` joue pour les articles français.
//
// Choix assumé : la relation article français <-> traduction vit ICI, dans le
// repo versionné, et PAS dans un champ ACF WordPress. Raisons :
//   1. aucun changement de schéma WordPress requis (le mu-plugin n'est pas
//      dans ce dépôt, voir STATE.md 2026-08-18) ;
//   2. le frontend lit l'index en local au build/ISR — zéro appel réseau
//      supplémentaire pour construire les hreflang de chaque page ;
//   3. l'historique des traductions est dans git, relisible et réversible.
// Contrepartie acceptée : l'index doit être régénérable depuis WordPress en
// cas de perte — c'est le rôle de `reconcile()` ci-dessous.
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..', '..');
const CONFIG_PATH = path.join(ROOT, 'config', 'i18n.json');
const INDEX_PATH = path.join(ROOT, 'data', 'i18n', 'index.json');
const EXCLUSIONS_PATH = path.join(ROOT, 'config', 'i18n-exclusions.json');

function loadConfig() {
  return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
}

function loadIndex() {
  if (!fs.existsSync(INDEX_PATH)) {
    return { _doc: 'Index des traductions — écrit par scripts/i18n/, jamais à la main.', articles: {} };
  }
  return JSON.parse(fs.readFileSync(INDEX_PATH, 'utf8'));
}

function saveIndex(index) {
  fs.mkdirSync(path.dirname(INDEX_PATH), { recursive: true });
  fs.writeFileSync(INDEX_PATH, JSON.stringify(index, null, 2) + '\n', 'utf8');
}

// Articles exclus de la traduction parce que leur sujet n'existe que pour un
// resident francais (decision utilisateur 2026-08-18, voir
// config/i18n-exclusions.json pour le critere et le detail par article).
// Chargement paresseux et mis en cache : appele une fois par article traite.
let _exclusions = null;
function loadExclusions() {
  if (_exclusions) return _exclusions;
  if (!fs.existsSync(EXCLUSIONS_PATH)) {
    _exclusions = { explicites: {}, motifs: [], exceptions: new Set() };
    return _exclusions;
  }
  const raw = JSON.parse(fs.readFileSync(EXCLUSIONS_PATH, 'utf8'));
  _exclusions = {
    explicites: raw.articles_france_uniquement || {},
    motifs: (raw.motifs_auto_france_uniquement || []).map(m => ({ re: new RegExp(m.motif, 'i'), raison: m.raison })),
    exceptions: new Set(raw.exceptions_a_traduire || []),
  };
  return _exclusions;
}

/**
 * Motif d'exclusion d'un article, ou null s'il est traduisible.
 *
 * Trois niveaux, dans cet ordre :
 *   1. liste explicite — classee a la main sur le stock existant ;
 *   2. exceptions — un slug qui matche un motif mais doit quand meme etre
 *      traduit (les demarches d'un ETRANGER qui arrive en France) ;
 *   3. motifs automatiques — indispensables pour les articles A VENIR, dont le
 *      slug n'existe pas encore et qui ne peuvent donc pas etre listes. Sans
 *      eux, chaque nouveau lot exigerait une classification manuelle, et un
 *      oubli ferait traduire du contenu franco-francais en silence.
 */
function raisonExclusion(frSlug) {
  const ex = loadExclusions();
  if (ex.explicites[frSlug]) return ex.explicites[frSlug];
  if (ex.exceptions.has(frSlug)) return null;
  for (const m of ex.motifs) {
    if (m.re.test(frSlug)) return `${m.raison} (motif automatique)`;
  }
  return null;
}

/** Locales cibles réellement autorisées pour ce silo (jamais toutes par défaut). */
function localesForSilo(config, siloSlug) {
  return config.silos_traduisibles[siloSlug] || [];
}

function isTranslatable(config, siloSlug, locale) {
  return localesForSilo(config, siloSlug).includes(locale);
}

/** Préfixe d'URL d'une locale ('' pour le français, qui n'en a pas). */
function urlPrefix(config, locale) {
  const prefix = config.locales[locale] && config.locales[locale].prefixe_url;
  return prefix ? `/${prefix}` : '';
}

/**
 * Enregistre une traduction dans l'index. `frSlug` est la clé stable : c'est
 * l'article français qui fait foi, une traduction n'existe jamais seule.
 */
function recordTranslation(index, frSlug, locale, data) {
  if (!index.articles[frSlug]) index.articles[frSlug] = {};
  const existant = index.articles[frSlug][locale] || {};
  index.articles[frSlug][locale] = {
    slug: data.slug,
    wp_id: data.wp_id,
    titre: data.titre,
    statut: data.statut,
    traduit_le: data.traduit_le,
    // Silo d'appartenance (slug FRANCAIS du silo). Indispensable au frontend :
    // une URL traduite est /en/{silo}/{slug}, il doit donc pouvoir retrouver le
    // silo depuis le seul slug francais pour construire les hreflang. Sans ce
    // champ, il faudrait le deviner a l'execution — fragile et non persistant.
    silo: data.silo || existant.silo || null,
  };
  return index;
}

function getTranslation(index, frSlug, locale) {
  return (index.articles[frSlug] || {})[locale] || null;
}

/** Slugs français déjà traduits dans cette locale — pour ne pas repayer deux fois. */
function translatedFrSlugs(index, locale) {
  return new Set(Object.entries(index.articles)
    .filter(([, byLocale]) => byLocale[locale])
    .map(([frSlug]) => frSlug));
}

module.exports = {
  CONFIG_PATH, INDEX_PATH,
  loadConfig, loadIndex, saveIndex,
  localesForSilo, isTranslatable, urlPrefix,
  recordTranslation, getTranslation, translatedFrSlugs,
  raisonExclusion, loadExclusions, EXCLUSIONS_PATH,
};
