#!/usr/bin/env node
// Télécharge UNE FOIS les 19 images de couverture + 19 miniatures de silo (statiques,
// jamais régénérées — contrairement aux images d'articles/à la une qui restent éditables
// dans WordPress via le pipeline autopublish, voir scripts/autopublish/lib/images.js).
//
// Cascade Pexels → Unsplash → Pixabay (mêmes clés que le pipeline éditorial, RI_*_KEY dans
// .env). Léger par construction : on demande directement une variante de taille réduite à
// chaque API (aucun traitement d'image local, pas de dépendance sharp) — le recadrage
// visuel (couverture 21:9, miniature carrée) est fait en CSS (object-fit: cover) côté
// frontend, une seule image source suffit pour les deux usages.
//
// Usage :
//   node scripts/fetch-silo-images.js              télécharge les silos manquants uniquement
//   node scripts/fetch-silo-images.js --force       retélécharge même les silos déjà servis
//   node scripts/fetch-silo-images.js --silo <slug> ne traite qu'un seul silo (test/relance ciblée)
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

const OUT_DIR = path.join(__dirname, '..', 'frontend', 'monauto', 'public', 'silos');

// Requêtes de recherche EN ANGLAIS (meilleure couverture/qualité sur les banques d'images
// que des requêtes en français) — une par silo, choisie pour représenter le sujet sans
// dépendre d'une marque/modèle précis (photo générique mais reconnaissable).
const SILO_QUERIES = {
  'entretien-revision': 'car mechanic garage service',
  'pannes-diagnostic': 'car engine diagnostic check',
  'pieces-detachees-accessoires': 'car spare parts workshop',
  'marques-modeles': 'car showroom dealership',
  'essais-comparatifs': 'two cars road test',
  'sport-auto-passion': 'race car track motorsport',
  'achat-voiture-neuve': 'new car dealership handshake',
  'voiture-d-occasion': 'used car lot',
  'electrique-hybride': 'electric car charging station',
  'carte-grise-demarches': 'car registration paperwork documents',
  'assurance-auto': 'car insurance agent',
  'permis-conduite': 'driving lesson car',
  'moto-scooter': 'motorcycle scooter city',
  'velo-nouvelles-mobilites': 'electric bike urban',
  'mobilite-partagee-transports': 'carsharing city street',
  'carburants-consommation': 'gas station fuel pump',
  'camping-car-van': 'campervan road trip',
  'utilitaires-flottes-pro': 'van fleet delivery',
  'road-trips-voyage-auto': 'scenic road trip highway',
};

function parseArgs(argv) {
  const args = { force: false, onlySilo: null };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--force') args.force = true;
    else if (argv[i] === '--silo') args.onlySilo = argv[++i];
  }
  return args;
}

async function searchPexels(query) {
  if (!PEXELS_KEY) return null;
  const res = await fetch(`https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=5&orientation=landscape`, {
    headers: { Authorization: PEXELS_KEY },
  });
  if (!res.ok) return null;
  const json = await res.json();
  const p = (json.photos || [])[0];
  if (!p) return null;
  return { cover: p.src.large, thumb: p.src.small, credit: `${p.photographer} (Pexels)` };
}

async function searchUnsplash(query) {
  if (!UNSPLASH_KEY) return null;
  const res = await fetch(`https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=5&orientation=landscape`, {
    headers: { Authorization: `Client-ID ${UNSPLASH_KEY}` },
  });
  if (!res.ok) return null;
  const json = await res.json();
  const p = (json.results || [])[0];
  if (!p) return null;
  // Variantes de taille demandées directement à l'API (fit=crop -> déjà cadré serré,
  // utile pour la miniature) plutôt que de retélécharger la même image en plusieurs tailles.
  return {
    cover: `${p.urls.raw}&w=960&q=70&fit=max&fm=jpg`,
    thumb: `${p.urls.raw}&w=160&h=160&q=65&fit=crop&fm=jpg`,
    credit: `${p.user?.name ?? 'inconnu'} (Unsplash)`,
  };
}

async function searchPixabay(query) {
  if (!PIXABAY_KEY) return null;
  const res = await fetch(`https://pixabay.com/api/?key=${encodeURIComponent(PIXABAY_KEY)}&q=${encodeURIComponent(query)}&image_type=photo&orientation=horizontal&per_page=5&safesearch=true`);
  if (!res.ok) return null;
  const json = await res.json();
  const p = (json.hits || [])[0];
  if (!p) return null;
  return { cover: p.webformatURL, thumb: p.previewURL, credit: `${p.user} (Pixabay)` };
}

const PROVIDERS = [searchPexels, searchUnsplash, searchPixabay];

async function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

// Repli réseau constaté en conditions réelles (2026-07-21) : un run enchaînant les 19 silos
// à la suite déclenche des "fetch failed" transitoires (réseau du bac à sable, pas les clés
// — un silo isolé retenté juste après réussit systématiquement). Une seule retentative après
// une courte pause suffit à absorber ça.
async function withRetry(fn, label) {
  try {
    return await fn();
  } catch (e) {
    console.warn(`  [warn] ${label} a échoué, nouvel essai dans 1.5s : ${e.message}`);
    await sleep(1500);
    try {
      return await fn();
    } catch (e2) {
      console.warn(`  [warn] ${label} a échoué à nouveau : ${e2.message}`);
      return null;
    }
  }
}

async function findVariants(query) {
  for (const provider of PROVIDERS) {
    const result = await withRetry(() => provider(query), provider.name);
    if (result) return result;
  }
  return null;
}

async function download(url, destPath) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`téléchargement échoué (${res.status})`);
  const buffer = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(destPath, buffer);
  return buffer.length;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!PEXELS_KEY && !UNSPLASH_KEY && !PIXABAY_KEY) {
    console.error('Aucune clé RI_PEXELS_KEY / RI_UNSPLASH_KEY / RI_PIXABAY_KEY trouvée (process.env ou .env).');
    process.exit(1);
  }
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const entries = Object.entries(SILO_QUERIES).filter(([slug]) => !args.onlySilo || slug === args.onlySilo);
  let done = 0, skipped = 0, failed = 0;
  const credits = [];

  for (const [slug, query] of entries) {
    const coverPath = path.join(OUT_DIR, `${slug}-cover.jpg`);
    const thumbPath = path.join(OUT_DIR, `${slug}-thumb.jpg`);
    if (!args.force && fs.existsSync(coverPath) && fs.existsSync(thumbPath)) {
      skipped++;
      continue;
    }

    const variants = await findVariants(query);
    if (!variants) {
      console.error(`  [échec] ${slug} — aucune image trouvée (3 API épuisées) pour "${query}".`);
      failed++;
      continue;
    }
    try {
      const [coverSize, thumbSize] = await Promise.all([
        withRetry(() => download(variants.cover, coverPath), `téléchargement couverture ${slug}`),
        withRetry(() => download(variants.thumb, thumbPath), `téléchargement miniature ${slug}`),
      ]);
      if (coverSize == null || thumbSize == null) {
        console.error(`  [échec] ${slug} — téléchargement définitivement impossible après retry.`);
        failed++;
        continue;
      }
      console.log(`  ✓ ${slug} — ${variants.credit} (couverture ${(coverSize / 1024).toFixed(0)} Ko, miniature ${(thumbSize / 1024).toFixed(0)} Ko)`);
      credits.push(`${slug}: ${variants.credit}`);
      done++;
    } catch (e) {
      console.error(`  [échec] ${slug} — téléchargement : ${e.message}`);
      failed++;
    }
    await sleep(600); // pacing prudent, pas de limite publiée
  }

  if (credits.length) {
    fs.writeFileSync(
      path.join(OUT_DIR, 'CREDITS.txt'),
      'Crédits photo (Pexels/Unsplash/Pixabay — licences gratuites, attribution non requise mais consignée ici par traçabilité) :\n\n' +
        credits.join('\n') + '\n',
      'utf8'
    );
  }

  console.log('---');
  console.log(`Terminé : ${done} téléchargées, ${skipped} déjà présentes (ignorées), ${failed} échecs, sur ${entries.length} silos.`);
}

main().catch((e) => {
  console.error('[fetch-silo-images] échec :', e);
  process.exit(1);
});
