#!/usr/bin/env node
// Télécharge UNE FOIS les avatars des 6 personas éditoriaux — de VRAIES photos (pas des
// illustrations), mais SANS VISAGE VISIBLE (mains, geste, silhouette de dos) : décision
// explicite de l'utilisateur le 2026-07-21, pour ne jamais faire passer une personne réelle
// identifiable pour l'auteur fictif (voir STATE.md 2026-07-17 puis 2026-07-21).
//
// Statique comme les images de silo (scripts/fetch-silo-images.js) — jamais régénéré
// automatiquement. Cascade Pexels → Unsplash → Pixabay (mêmes clés .env).
//
// IMPORTANT : chaque image doit être VÉRIFIÉE VISUELLEMENT après téléchargement (le champ de
// recherche ne garantit pas l'absence de visage) — voir la sortie du script pour la liste des
// fichiers à contrôler avant mise en ligne réelle.
//
// Usage :
//   node scripts/fetch-author-avatars.js              télécharge les avatars manquants
//   node scripts/fetch-author-avatars.js --force       retélécharge même ceux déjà présents
//   node scripts/fetch-author-avatars.js --slug <slug> ne traite qu'un seul persona
const fs = require('fs');
const path = require('path');

function loadDotEnvFallback() {
  const envPath = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) return {};
  const raw = fs.readFileSync(envPath, 'utf8');
  const env = {};
  raw.split('\n').filter(Boolean).forEach((line) => {
    const i = line.indexOf('=');
    if (i === -1) return;
    env[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  });
  return env;
}
const dotEnv = loadDotEnvFallback();
const getVar = (name) => process.env[name] ?? dotEnv[name];

const PEXELS_KEY = getVar('RI_PEXELS_KEY');
const UNSPLASH_KEY = getVar('RI_UNSPLASH_KEY');
const PIXABAY_KEY = getVar('RI_PIXABAY_KEY');

const OUT_DIR = path.join(__dirname, '..', 'frontend', 'monauto', 'public', 'authors');

// Requêtes ciblant des compositions mains/geste/dos — jamais un portrait de face. Validées
// le 2026-07-21 par vérification visuelle manuelle de chaque résultat un par un (5 essais
// nécessaires sur 3 des 6 personas : les premières formulations plus "lifestyle"
// — "mechanic", "electric car charging", "holding map" — ramenaient systématiquement des
// portraits de face malgré la mention "close up" ; resserrer sur "hand[s] + objet précis"
// a fini par produire des cadrages strictement mains/objet sans visage).
const AVATAR_QUERIES = {
  'julien-fabre': 'man hand car engine repair close up',
  'thomas-lefevre': 'man hands steering wheel driving close up',
  'camille-roussel': 'hand holding car key close up',
  'sophie-andrieu': 'woman hands paperwork documents desk close up',
  'karim-belaid': 'man hands motorcycle handlebar close up',
  'nathalie-moreau': 'hands on campervan steering wheel close up',
};

function parseArgs(argv) {
  const args = { force: false, onlySlug: null };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--force') args.force = true;
    else if (argv[i] === '--slug') args.onlySlug = argv[++i];
  }
  return args;
}

async function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function searchPexels(query) {
  if (!PEXELS_KEY) return null;
  const res = await fetch(`https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=5&orientation=square`, {
    headers: { Authorization: PEXELS_KEY },
  });
  if (!res.ok) return null;
  const json = await res.json();
  const p = (json.photos || [])[0];
  if (!p) return null;
  return { url: p.src.medium, credit: `${p.photographer} (Pexels)`, page: p.url };
}

async function searchUnsplash(query) {
  if (!UNSPLASH_KEY) return null;
  const res = await fetch(`https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=5`, {
    headers: { Authorization: `Client-ID ${UNSPLASH_KEY}` },
  });
  if (!res.ok) return null;
  const json = await res.json();
  const p = (json.results || [])[0];
  if (!p) return null;
  return { url: `${p.urls.raw}&w=320&h=320&q=70&fit=crop&fm=jpg`, credit: `${p.user?.name ?? 'inconnu'} (Unsplash)`, page: p.links?.html };
}

async function searchPixabay(query) {
  if (!PIXABAY_KEY) return null;
  const res = await fetch(`https://pixabay.com/api/?key=${encodeURIComponent(PIXABAY_KEY)}&q=${encodeURIComponent(query)}&image_type=photo&per_page=5&safesearch=true`);
  if (!res.ok) return null;
  const json = await res.json();
  const p = (json.hits || [])[0];
  if (!p) return null;
  return { url: p.webformatURL, credit: `${p.user} (Pixabay)`, page: p.pageURL };
}

const PROVIDERS = [searchPexels, searchUnsplash, searchPixabay];

async function withRetry(fn, label) {
  try {
    return await fn();
  } catch (e) {
    console.warn(`  [warn] ${label} a échoué, nouvel essai dans 1.5s : ${e.message}`);
    await sleep(1500);
    try {
      return await fn();
    } catch {
      return null;
    }
  }
}

async function findVariant(query) {
  for (const provider of PROVIDERS) {
    const result = await withRetry(() => provider(query), provider.name);
    if (result) return result;
  }
  return null;
}

// Conversion WebP systématique (voir STATE.md 2026-07-22) : toute image
// statique servie par le site doit être en WebP.
const sharp = require('sharp');

async function download(url, destPath) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`téléchargement échoué (${res.status})`);
  const buffer = Buffer.from(await res.arrayBuffer());
  const webpBuffer = await sharp(buffer).webp({ quality: 82 }).toBuffer();
  fs.writeFileSync(destPath, webpBuffer);
  return webpBuffer.length;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!PEXELS_KEY && !UNSPLASH_KEY && !PIXABAY_KEY) {
    console.error('Aucune clé RI_PEXELS_KEY / RI_UNSPLASH_KEY / RI_PIXABAY_KEY trouvée.');
    process.exit(1);
  }
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const entries = Object.entries(AVATAR_QUERIES).filter(([slug]) => !args.onlySlug || slug === args.onlySlug);
  let done = 0, skipped = 0, failed = 0;
  const toVerify = [];

  for (const [slug, query] of entries) {
    const destPath = path.join(OUT_DIR, `${slug}.webp`);
    if (!args.force && fs.existsSync(destPath)) {
      skipped++;
      continue;
    }
    const variant = await findVariant(query);
    if (!variant) {
      console.error(`  [échec] ${slug} — aucune image trouvée pour "${query}".`);
      failed++;
      continue;
    }
    try {
      const size = await withRetry(() => download(variant.url, destPath), `téléchargement ${slug}`);
      if (size == null) throw new Error('échec après retry');
      console.log(`  ✓ ${slug} — ${variant.credit} (${(size / 1024).toFixed(0)} Ko) — À VÉRIFIER : ${variant.page ?? variant.url}`);
      toVerify.push(slug);
      done++;
    } catch (e) {
      console.error(`  [échec] ${slug} — ${e.message}`);
      failed++;
    }
    await sleep(600);
  }

  console.log('---');
  console.log(`Terminé : ${done} téléchargées, ${skipped} déjà présentes, ${failed} échecs.`);
  if (toVerify.length) {
    console.log(`\n⚠️  À VÉRIFIER VISUELLEMENT avant usage réel (aucun visage ne doit être visible) : ${toVerify.join(', ')}`);
  }
}

main().catch((e) => {
  console.error('[fetch-author-avatars] échec :', e);
  process.exit(1);
});
