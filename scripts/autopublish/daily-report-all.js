#!/usr/bin/env node
// Orchestre un daily-report.js par niche active (celles avec un wp_url —
// voir discover-niches dans .github/workflows/autopublish.yml pour la même
// logique de découverte), un sous-process par niche (même contrainte que
// tracking-firestore-sync.js : NICHE_ID n'est résolu qu'une fois par
// process), puis combine les fragments en UN SEUL e-mail — plus pratique à
// lire que 10-20 e-mails séparés par jour.
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { listNiches, loadNiche } = require('../lib_js/niche-config');

const LOGS_ROOT = path.join(__dirname, '..', '..', 'logs', 'autopublish');
const OUTPUT_PATH = path.join(LOGS_ROOT, 'daily-report-latest.html');

function activeNiches() {
  return listNiches().filter((id) => !!loadNiche(id).wp_url);
}

function main() {
  const ids = activeNiches();
  if (!ids.length) {
    console.log('Aucune niche active (wp_url défini) — rien à rapporter.');
    fs.mkdirSync(LOGS_ROOT, { recursive: true });
    fs.writeFileSync(OUTPUT_PATH, '<p>Aucune niche active pour l\'instant.</p>', 'utf8');
    return;
  }

  const fragments = [];
  for (const id of ids) {
    console.log(`\n=== ${id} ===`);
    const res = spawnSync(
      process.execPath,
      [path.join(__dirname, 'daily-report.js')],
      { env: { ...process.env, NICHE_ID: id }, stdio: 'inherit' }
    );
    const fragmentPath = path.join(LOGS_ROOT, id, 'daily-report-fragment.html');
    if (res.status === 0 && fs.existsSync(fragmentPath)) {
      fragments.push(fs.readFileSync(fragmentPath, 'utf8'));
    } else {
      fragments.push(`<p style="color:#a8253a;">⚠️ Rapport indisponible pour <strong>${id}</strong> (échec du run).</p>`);
    }
  }

  fs.mkdirSync(LOGS_ROOT, { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, fragments.join('\n<hr>\n'), 'utf8');
  console.log(`\nRapport combiné écrit : ${OUTPUT_PATH} (${ids.length} niche(s)).`);
}

main();
