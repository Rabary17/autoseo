#!/usr/bin/env node
// Migration one-shot : pousse la config niche.json ET l'état d'exécution
// existant (data/autopublish-state.json ou son équivalent par niche) vers
// Firestore. Idempotent : ré-exécutable sans risque, écrase (set) le document
// avec les valeurs actuellement en fichier.
//
// Usage : node scripts/migrate-to-firestore.js --niche <id> | --all
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const nicheConfig = require('./lib_js/niche-config');
const { pushNiche } = require('./lib_js/niche-firestore-sync');
const { getDb } = require('./lib_js/firestore-client');

function parseArgs(argv) {
  const args = { niche: null, all: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--niche') args.niche = argv[++i];
    else if (argv[i] === '--all') args.all = true;
  }
  return args;
}

async function migrateOne(nicheId) {
  console.log(`\n=== ${nicheId} ===`);
  const pushResult = await pushNiche(nicheId);
  if (pushResult.skipped) {
    console.error('FIREBASE_SERVICE_ACCOUNT_JSON absent — impossible de migrer sans credentials.');
    process.exit(1);
  }
  console.log(`niche.json -> Firestore niches/${nicheId} : ok`);

  const niche = nicheConfig.loadNiche(nicheId);
  const statePath = nicheConfig.dataPath(niche, 'autopublish-state.json');
  if (!fs.existsSync(statePath)) {
    console.log(`(pas de ${path.basename(statePath)} existant pour cette niche — rien à migrer côté état)`);
    return;
  }
  const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
  await getDb().collection('niches').doc(nicheId).collection('state').doc('pipeline').set(state);
  console.log(`autopublish-state.json -> Firestore niches/${nicheId}/state/pipeline : ok (phase ${state.phase}, silo "${state.silo_en_cours}")`);

  // Délégué à sync-tracking-firestore.js (sous-process dédié) plutôt qu'un
  // require direct : tracking-xlsx.js (via niche-paths.js) ne résout NICHE_ID
  // qu'une seule fois par process, incompatible avec la boucle --all de main().
  const trackingRes = spawnSync(
    process.execPath,
    [path.join(__dirname, 'sync-tracking-firestore.js'), 'push', '--niche', nicheId],
    { stdio: 'inherit' }
  );
  if (trackingRes.status !== 0) {
    console.error(`Échec de la migration de tracking-mots-cles.xlsx pour ${nicheId} (voir sortie ci-dessus).`);
    process.exitCode = 1;
  }
}

async function main() {
  const { niche, all } = parseArgs(process.argv.slice(2));
  const ids = all ? nicheConfig.listNiches() : [niche || nicheConfig.DEFAULT_NICHE];
  if (!ids.length) {
    console.error('Aucune niche ciblée (--niche <id> ou --all) ou aucune niche trouvée sous config/niches/.');
    process.exit(1);
  }
  for (const id of ids) {
    await migrateOne(id);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
