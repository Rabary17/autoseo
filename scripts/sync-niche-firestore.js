#!/usr/bin/env node
// CLI : node scripts/sync-niche-firestore.js <pull|push> --niche <id> [--all]
// À invoquer comme étape SÉPARÉE avant run.js (jamais requis par lui, voir
// lib_js/niche-firestore-sync.js) — un `pull` avant chaque run automatique
// (cron) pour prendre en compte les éditions faites depuis le dashboard, un
// `push` après toute création/édition de niche via new-niche.py/add-silo.py.
const { pullNiche, pushNiche } = require('./lib_js/niche-firestore-sync');
const nicheConfig = require('./lib_js/niche-config');

function parseArgs(argv) {
  const args = { niche: null, all: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--niche') args.niche = argv[++i];
    else if (argv[i] === '--all') args.all = true;
  }
  return args;
}

async function main() {
  const [action] = process.argv.slice(2);
  const { niche, all } = parseArgs(process.argv.slice(3));
  if (!['pull', 'push'].includes(action)) {
    console.error('Usage: node scripts/sync-niche-firestore.js <pull|push> --niche <id> | --all');
    process.exit(1);
  }
  const ids = all ? nicheConfig.listNiches?.() ?? [] : [niche || nicheConfig.DEFAULT_NICHE];
  if (!ids.length) {
    console.error('Aucune niche ciblée (--niche <id> ou --all).');
    process.exit(1);
  }
  const fn = action === 'pull' ? pullNiche : pushNiche;
  for (const id of ids) {
    const result = await fn(id);
    console.log(`${action} ${id} -> ${result.skipped ? 'ignoré (Firestore non configuré)' : 'ok'}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
