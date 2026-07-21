// Miroir JS de scripts/lib_py/niche_config.py — chargeur de la config déclarative d'une
// niche (config/niches/<id>/niche.json). Voir ce module Python pour le contexte complet
// (industrialisation 2026-07-20 : ajouter un silo ou une niche ne doit jamais exiger
// d'éditer du code).
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const NICHES_DIR = path.join(ROOT, 'config', 'niches');
const DEFAULT_NICHE = 'auto-mobilite';

function nicheDir(nicheId) {
  return path.join(NICHES_DIR, nicheId);
}

function loadNiche(nicheId = DEFAULT_NICHE) {
  const p = path.join(nicheDir(nicheId), 'niche.json');
  if (!fs.existsSync(p)) {
    throw new Error(`Niche '${nicheId}' introuvable (${p}). Utiliser scripts/new-niche.py pour en créer une.`);
  }
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function dataPath(niche, ...parts) {
  return path.join(ROOT, niche.data_dir, ...parts);
}

module.exports = { DEFAULT_NICHE, nicheDir, loadNiche, dataPath };
