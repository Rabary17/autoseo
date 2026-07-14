// Lookup sur data/maillage/maillage.json — chaque entrée décrit le maillage
// déjà résolu pour un article (hub/sous-hub parents, liens latéraux,
// transversaux, ancres). Les hubs/sous-hubs eux-mêmes ne sont PAS des entrées
// de ce fichier : ce sont des URL de référence portées par les entrées
// d'articles (champs "hub"/"sous_hub") — leur contenu est géré par les
// commandes /p4-hubs, en amont de ce pipeline.
const fs = require('fs');
const path = require('path');

const MAILLAGE_PATH = path.join(__dirname, '..', '..', '..', 'data', 'maillage', 'maillage.json');

let cache = null;

function loadMaillage() {
  if (!cache) {
    cache = JSON.parse(fs.readFileSync(MAILLAGE_PATH, 'utf8'));
  }
  return cache;
}

function getEntryByUrl(url) {
  return loadMaillage().find(e => e.url === url) ?? null;
}

function getEntryByKeyword(motClePrincipal) {
  return loadMaillage().find(e => e.mot_cle_principal === motClePrincipal) ?? null;
}

function getEntriesByHub(hub) {
  return loadMaillage().filter(e => e.hub === hub);
}

function getEntriesBySousHub(sousHub) {
  return loadMaillage().filter(e => e.sous_hub === sousHub);
}

function getEntriesBySilo(silo) {
  return loadMaillage().filter(e => e.silo === silo);
}

// Toutes les URL de hub référencées (sans doublon) — pas forcément publiées,
// juste ce que le maillage attend comme squelette de navigation.
function getAllHubUrls() {
  return [...new Set(loadMaillage().map(e => e.hub))];
}

function getAllSousHubUrls(hub) {
  const entries = hub ? getEntriesByHub(hub) : loadMaillage();
  return [...new Set(entries.map(e => e.sous_hub))];
}

module.exports = {
  loadMaillage,
  getEntryByUrl,
  getEntryByKeyword,
  getEntriesByHub,
  getEntriesBySousHub,
  getEntriesBySilo,
  getAllHubUrls,
  getAllSousHubUrls,
};
