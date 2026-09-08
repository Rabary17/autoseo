// Lecture/écriture de data/keywords/tracking-mots-cles.xlsx — feuille "Suivi".
// Le fichier a aussi une feuille "Légende" (documentation humaine) qu'il faut
// impérativement préserver telle quelle à chaque écriture.
const fs = require('fs');
const XLSX = require('xlsx');
const nichePaths = require('./niche-paths');

const XLSX_PATH = nichePaths.dataPath('keywords', 'tracking-mots-cles.xlsx');
const SHEET_NAME = 'Suivi';

const COLUMNS = [
  'mot_cle_principal',
  'variantes',
  'silo',
  'sous_cocon',
  'intention',
  'volume_estime',
  // concurrence/score_opportunite (2026-08-26, demande explicite de
  // l'utilisateur — priorité à la qualité et aux opportunités sans
  // concurrence plutôt qu'au volume brut) : voir scripts/score-opportunite.js
  // et skills/wordpress-publication.md section 6. `concurrence` = concurrence
  // publicitaire Haloscan brute (0-1, vide si jamais renvoyée) ;
  // `score_opportunite` = volume_estime * (1 - concurrence), la clé de tri
  // utilisée par run.js à la place du volume seul.
  'concurrence',
  'score_opportunite',
  'url_cible',
  'auteur',
  'statut',
  'date_publication',
];

function readRows() {
  const wb = XLSX.readFile(XLSX_PATH);
  const sheet = wb.Sheets[SHEET_NAME];
  if (!sheet) throw new Error(`tracking-xlsx: feuille "${SHEET_NAME}" introuvable dans ${XLSX_PATH}`);
  return XLSX.utils.sheet_to_json(sheet, { defval: '' });
}

// Réécrit uniquement la feuille "Suivi" ; toutes les autres feuilles
// (dont "Légende") sont recopiées sans modification depuis le fichier source.
function writeRows(rows) {
  const wb = XLSX.readFile(XLSX_PATH);
  const newSheet = XLSX.utils.json_to_sheet(rows, { header: COLUMNS });
  wb.Sheets[SHEET_NAME] = newSheet;
  XLSX.writeFile(wb, XLSX_PATH);
}

// Trouve la ligne d'un cluster par mot_cle_principal (clé unique du fichier
// de suivi — voir skills/gestion-de-projet.md).
function findRow(rows, motClePrincipal) {
  return rows.find(r => r.mot_cle_principal === motClePrincipal) ?? null;
}

function rowsBySilo(rows, silo) {
  return rows.filter(r => r.silo === silo);
}

function rowsByStatut(rows, statut) {
  return rows.filter(r => r.statut === statut);
}

// Applique une mise à jour partielle à une ligne identifiée par
// mot_cle_principal, sans toucher aux autres colonnes ni à l'ordre des lignes.
function updateRow(rows, motClePrincipal, updates) {
  const row = findRow(rows, motClePrincipal);
  if (!row) throw new Error(`tracking-xlsx: cluster introuvable "${motClePrincipal}"`);
  Object.assign(row, updates);
  return row;
}

module.exports = { COLUMNS, readRows, writeRows, findRow, rowsBySilo, rowsByStatut, updateRow, XLSX_PATH };
