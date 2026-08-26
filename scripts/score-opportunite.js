#!/usr/bin/env node
// Score d'opportunité par mot-clé : volume élevé + concurrence faible plutôt
// que volume brut seul (2026-08-26, demande explicite de l'utilisateur, suite
// au déclassement/desindexation attribué par l'utilisateur à un profil
// "keyword farm" — voir STATE.md du jour).
//
// Aucun nouvel appel Haloscan : `data/keywords/*.json` contient déjà, pour
// chaque candidat, `competition` (concurrence publicitaire Haloscan, 0-1) et
// parfois `allintitle` (nombre de pages ciblant ce titre — sert au calcul du
// Keyword Golden Ratio, allintitle/volume, quand disponible). Cette donnée
// est payée et stockée depuis le début, jamais reportée dans
// tracking-mots-cles.xlsx ni utilisée pour prioriser la production.
//
// score_opportunite = volume_estime * (1 - concurrence)
// `concurrence` par défaut à 0.5 (neutre) si Haloscan ne l'a jamais renvoyée
// pour ce mot-clé — ne pas confondre "concurrence inconnue" avec "concurrence
// nulle" (survaloriserait à tort) ni "concurrence maximale" (dévaloriserait
// à tort) : un mot-clé sans donnée retombe sur un classement proche du
// volume seul, comportement précédent.
//
// Usage :
//   node scripts/score-opportunite.js               # rapport seul
//   node scripts/score-opportunite.js --apply        # écrit dans le xlsx
const fs = require('fs');
const path = require('path');
const trackingXlsx = require('./autopublish/lib/tracking-xlsx');

const APPLY = process.argv.includes('--apply');
const KEYWORDS_DIR = path.join(__dirname, '..', 'data', 'keywords');
const DEFAULT_COMPETITION = 0.5;

function normalise(kw) {
  return String(kw || '').trim().toLowerCase();
}

// Construit l'index mot-clé -> {competition, volume, allintitle} en balayant
// TOUS les résultats Haloscan déjà collectés, tous silos confondus. Premier
// résultat rencontré gagne en cas de doublon (les valeurs sont censées être
// identiques pour un même mot-clé, indépendamment du silo qui l'a collecté).
function buildIndex() {
  const index = new Map();
  const files = fs.readdirSync(KEYWORDS_DIR).filter(f => f.endsWith('.json') && !f.startsWith('_'));
  for (const file of files) {
    let data;
    try {
      data = JSON.parse(fs.readFileSync(path.join(KEYWORDS_DIR, file), 'utf-8'));
    } catch (e) {
      console.warn(`[score-opportunite] "${file}" illisible, ignoré : ${e.message}`);
      continue;
    }
    for (const seed of Object.values(data.seeds || {})) {
      for (const r of seed.results || []) {
        const key = normalise(r.keyword);
        if (!key || index.has(key)) continue;
        const competition = typeof r.competition === 'number' ? r.competition : null;
        const volume = typeof r.ads_volume === 'number' ? r.ads_volume : null;
        const allintitle = typeof r.allintitle === 'number' ? r.allintitle : null;
        if (competition !== null || volume !== null) index.set(key, { competition, volume, allintitle });
      }
    }
  }
  return index;
}

function scoreRow(row, index) {
  const match = index.get(normalise(row.mot_cle_principal));
  const volume = Number(row.volume_estime) || 0;
  const competition = match && match.competition !== null ? match.competition : DEFAULT_COMPETITION;
  const score = volume * (1 - competition);
  return { competition, score, kgr: match && match.allintitle !== null && volume > 0 ? match.allintitle / volume : null };
}

(async () => {
  const index = buildIndex();
  console.log(`Index construit : ${index.size} mot(s)-clé(s) avec donnée de concurrence/volume Haloscan.\n`);

  const rows = trackingXlsx.readRows();
  const candidats = rows.filter(r => ['à faire', 'en rédaction'].includes(r.statut));
  console.log(`${candidats.length} cluster(s) "à faire"/"en rédaction" à scorer sur ${rows.length} au total.\n`);

  let matched = 0;
  const updated = [];
  for (const row of candidats) {
    const { competition, score, kgr } = scoreRow(row, index);
    if (index.has(normalise(row.mot_cle_principal))) matched++;
    row.concurrence = Math.round(competition * 1000) / 1000;
    row.score_opportunite = Math.round(score * 100) / 100;
    updated.push({ row, kgr });
  }

  console.log(`${matched}/${candidats.length} clusters retrouvés dans les données Haloscan collectées (les autres reçoivent une concurrence neutre par défaut, ${DEFAULT_COMPETITION}).\n`);

  const top = [...updated].sort((a, b) => b.row.score_opportunite - a.row.score_opportunite).slice(0, 20);
  console.log('--- Top 20 opportunités (fort volume, faible concurrence) ---');
  for (const { row, kgr } of top) {
    const kgrStr = kgr !== null ? `  KGR=${kgr.toFixed(3)}${kgr < 0.25 ? ' (en or)' : ''}` : '';
    console.log(`${row.score_opportunite.toString().padStart(8)}  vol=${row.volume_estime}  conc=${row.concurrence}  [${row.silo}] ${row.mot_cle_principal}${kgrStr}`);
  }

  if (!APPLY) {
    console.log('\n(simulation — relancer avec --apply pour écrire concurrence/score_opportunite dans tracking-mots-cles.xlsx)');
    return;
  }

  trackingXlsx.writeRows(rows);
  console.log(`\n${candidats.length} ligne(s) mise(s) à jour dans ${trackingXlsx.XLSX_PATH}.`);
})();
