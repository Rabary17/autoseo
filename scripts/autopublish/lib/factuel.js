// Charge data/factuel/*.json — schémas hétérogènes selon le fichier (prix par
// prestation, codes OBD, fiabilité par marque/modèle, barèmes permis/assurance,
// etc.), donc pas de forme commune imposée : chaque entrée garde ses champs
// d'origine, avec _source (nom de fichier) ajouté pour traçabilité.
//
// Règle non négociable (gating, voir skills/wordpress-publication.md section 5) :
// une entrée marquée "a_verifier": true est exclue — elle ne doit JAMAIS
// nourrir un prompt de génération tant qu'elle n'a pas été validée par un humain.
const fs = require('fs');
const path = require('path');

const FACTUEL_DIR = path.join(__dirname, '..', '..', '..', 'data', 'factuel');

let cache = null;

function normalize(s) {
  return String(s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

// Les fichiers factuel n'ont pas de forme commune : certains sont un tableau
// plat d'entrées (chacune avec son propre "a_verifier"), d'autres un objet
// avec des sections imbriquées à plusieurs niveaux (ex. bonus_malus,
// niveaux_de_garantie), où "a_verifier" apparaît à des profondeurs variables.
// On descend récursivement jusqu'à trouver un objet qui porte lui-même le
// champ "a_verifier" : c'est une entrée factuelle terminale (on ne descend
// pas plus bas dedans), sinon on continue à explorer ses enfants.
function collectFacts(node, source, out) {
  if (Array.isArray(node)) {
    for (const child of node) collectFacts(child, source, out);
    return;
  }
  if (node && typeof node === 'object') {
    if (Object.prototype.hasOwnProperty.call(node, 'a_verifier')) {
      if (node.a_verifier !== true) out.push({ ...node, _source: source });
      return; // entrée terminale, jamais utilisable tant que non vérifiée si true
    }
    for (const value of Object.values(node)) collectFacts(value, source, out);
  }
}

function loadAllFacts() {
  if (cache) return cache;
  const files = fs.readdirSync(FACTUEL_DIR).filter(f => f.endsWith('.json'));
  const all = [];
  for (const file of files) {
    const root = JSON.parse(fs.readFileSync(path.join(FACTUEL_DIR, file), 'utf8'));
    collectFacts(root, file, all);
  }
  cache = all;
  return cache;
}

// Recherche simple par sous-chaîne (insensible casse/accents) sur la
// représentation JSON de chaque entrée — suffisant pour cibler les faits
// pertinents à injecter dans le prompt d'un cluster donné, sans dépendance
// externe (pas de vrai moteur de recherche pour ce volume de données).
function searchFacts(query, { limit = 20 } = {}) {
  const terms = normalize(query).split(/\s+/).filter(Boolean);
  if (!terms.length) return [];
  return loadAllFacts()
    .map(entry => {
      const haystack = normalize(JSON.stringify(entry));
      const score = terms.reduce((acc, t) => acc + (haystack.includes(t) ? 1 : 0), 0);
      return { entry, score };
    })
    .filter(r => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(r => r.entry);
}

module.exports = { loadAllFacts, searchFacts, FACTUEL_DIR };
