// Résout tous les chemins de données de scripts/autopublish/ à partir de
// NICHE_ID (env var), en s'appuyant sur scripts/lib_js/niche-config.js déjà
// utilisé par les scripts P1/P3 (fetch-keywords.js, gen-maillage.py via son
// miroir JS). Sans NICHE_ID, retombe sur 'auto-mobilite' (data_dir: "data")
// — comportement strictement inchangé pour le réseau existant.
//
// Chargé une seule fois au démarrage du process (cache module-level, comme
// tous les autres modules de lib/) : NICHE_ID doit être défini avant le
// premier require de ce fichier (ou de tout module qui en dépend), jamais
// changé en cours de run.
const path = require('path');
const nicheConfig = require('../../lib_js/niche-config');

const NICHE_ID = process.env.NICHE_ID || nicheConfig.DEFAULT_NICHE;
const niche = nicheConfig.loadNiche(NICHE_ID);

function dataPath(...parts) {
  return nicheConfig.dataPath(niche, ...parts);
}

module.exports = { NICHE_ID, niche, dataPath, path };
