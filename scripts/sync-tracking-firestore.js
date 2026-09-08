#!/usr/bin/env node
// CLI : node scripts/sync-tracking-firestore.js <pull|push> --niche <id> | --all
// À invoquer comme étape SÉPARÉE, jamais requis depuis run.js/reconcile-tracking.js/
// etc. (voir lib_js/tracking-firestore-sync.js) — un `pull` avant tout run
// automatique (cron) pour prendre en compte les éditions faites depuis le
// dashboard ou Haloscan, un `push` après toute regénération/édition locale du
// xlsx (build-tracking-xlsx.py, populate-tracking-xlsx.py, score-opportunite.js).
//
// --all relance ce script en sous-process pour chaque niche plutôt que de
// boucler en mémoire : tracking-xlsx.js (via niche-paths.js) ne résout
// NICHE_ID qu'une seule fois par process.
const { spawnSync } = require('child_process');

function parseArgs(argv) {
  const args = { niche: null, all: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--niche') args.niche = argv[++i];
    else if (argv[i] === '--all') args.all = true;
  }
  return args;
}

async function runOne(action, nicheId) {
  process.env.NICHE_ID = nicheId;
  const { pullTracking, pushTracking } = require('./lib_js/tracking-firestore-sync');
  const fn = action === 'pull' ? pullTracking : pushTracking;
  const result = await fn(nicheId);
  if (result.skipped) {
    console.log(`${action} ${nicheId} -> ignoré (Firestore non configuré)`);
    return;
  }
  const extra = action === 'push' && result.deleted ? `, ${result.deleted} supprimé(s)` : '';
  console.log(`${action} ${nicheId} -> ok (${result.count} ligne(s)${extra})`);
}

function main() {
  const [action] = process.argv.slice(2);
  const { niche, all } = parseArgs(process.argv.slice(3));
  if (!['pull', 'push'].includes(action)) {
    console.error('Usage: node scripts/sync-tracking-firestore.js <pull|push> --niche <id> | --all');
    process.exit(1);
  }

  if (all) {
    const nicheConfig = require('./lib_js/niche-config');
    const ids = nicheConfig.listNiches();
    if (!ids.length) {
      console.error('Aucune niche trouvée sous config/niches/.');
      process.exit(1);
    }
    let failed = false;
    for (const id of ids) {
      const res = spawnSync(process.execPath, [__filename, action, '--niche', id], { stdio: 'inherit' });
      if (res.status !== 0) failed = true;
    }
    process.exit(failed ? 1 : 0);
    return;
  }

  if (!niche) {
    console.error('Usage: node scripts/sync-tracking-firestore.js <pull|push> --niche <id> | --all');
    process.exit(1);
  }

  runOne(action, niche).catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

main();
