// Cascade de sourcing d'images libres de droits : Pexels → Unsplash →
// Pixabay, recherche par entité (marque/pièce/prestation extraite du
// cluster). Ledger de déduplication par silo pour ne pas réutiliser la même
// image sur plusieurs articles d'un même silo — voir plan
// `indexed-hugging-flurry`. Si les 3 API ne retournent rien de pertinent,
// l'appelant (run.js) doit se replier sur une image par défaut pré-uploadée
// (jamais de blocage du gating pour absence d'image).
//
// Clés lues depuis process.env (secrets GitHub Actions), repli sur .env
// local pour test — jamais commitées en clair dans le repo.
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const nichePaths = require('./niche-paths');

function loadDotEnvFallback() {
  const envPath = path.join(__dirname, '..', '..', '..', '.env');
  if (!fs.existsSync(envPath)) return {};
  const raw = fs.readFileSync(envPath, 'utf8');
  const env = {};
  raw.split('\n').filter(Boolean).forEach(line => {
    const i = line.indexOf('=');
    if (i === -1) return;
    env[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  });
  return env;
}

const dotEnv = loadDotEnvFallback();
function getVar(name) {
  return process.env[name] ?? dotEnv[name];
}

const PEXELS_KEY = getVar('RI_PEXELS_KEY');
const UNSPLASH_KEY = getVar('RI_UNSPLASH_KEY');
const PIXABAY_KEY = getVar('RI_PIXABAY_KEY');

const LEDGER_PATH = nichePaths.dataPath('autopublish-image-ledger.json');

function loadLedger() {
  if (!fs.existsSync(LEDGER_PATH)) return {};
  try {
    return JSON.parse(fs.readFileSync(LEDGER_PATH, 'utf8'));
  } catch (e) {
    console.warn(`images: ledger illisible ignoré (${LEDGER_PATH}) : ${e.message}`);
    return {};
  }
}

function saveLedger(ledger) {
  fs.writeFileSync(LEDGER_PATH, JSON.stringify(ledger, null, 2) + '\n', 'utf8');
}

async function searchPexels(query) {
  if (!PEXELS_KEY) return null;
  const res = await fetch(`https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=10&orientation=landscape`, {
    headers: { Authorization: PEXELS_KEY },
  });
  if (!res.ok) return null;
  const json = await res.json();
  return (json.photos || []).map(p => ({
    id: `pexels-${p.id}`,
    url: p.src.large2x || p.src.large,
    credit: `Photo par ${p.photographer} (Pexels)`,
    source: 'pexels',
  }));
}

async function searchUnsplash(query) {
  if (!UNSPLASH_KEY) return null;
  const res = await fetch(`https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=10&orientation=landscape`, {
    headers: { Authorization: `Client-ID ${UNSPLASH_KEY}` },
  });
  if (!res.ok) return null;
  const json = await res.json();
  return (json.results || []).map(p => ({
    id: `unsplash-${p.id}`,
    url: p.urls.regular,
    credit: `Photo par ${p.user?.name ?? 'inconnu'} (Unsplash)`,
    source: 'unsplash',
  }));
}

async function searchPixabay(query) {
  if (!PIXABAY_KEY) return null;
  const res = await fetch(`https://pixabay.com/api/?key=${encodeURIComponent(PIXABAY_KEY)}&q=${encodeURIComponent(query)}&image_type=photo&orientation=horizontal&per_page=10&safesearch=true`);
  if (!res.ok) return null;
  const json = await res.json();
  return (json.hits || []).map(p => ({
    id: `pixabay-${p.id}`,
    url: p.largeImageURL,
    credit: `Photo par ${p.user} (Pixabay)`,
    source: 'pixabay',
  }));
}

const PROVIDERS = [searchPexels, searchUnsplash, searchPixabay];

// Cherche une image pertinente pour `entityQuery` (ex. "vidange moteur",
// "Renault Clio", "plaquettes de frein"), en évitant toute image déjà
// utilisée pour ce silo. Retourne null si aucune des 3 API ne renvoie de
// résultat inédit — l'appelant doit alors utiliser l'image par défaut.
async function findImage(entityQuery, { silo }) {
  const ledger = loadLedger();
  const used = new Set(ledger[silo] || []);

  for (const provider of PROVIDERS) {
    let results;
    try {
      results = await provider(entityQuery);
    } catch {
      results = null;
    }
    if (!results) continue;
    const candidate = results.find(r => !used.has(r.id));
    if (candidate) {
      ledger[silo] = [...used, candidate.id];
      saveLedger(ledger);
      return candidate;
    }
  }
  return null;
}

async function downloadImage(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`images: téléchargement échoué (${res.status}) pour ${url}`);
  const arrayBuffer = await res.arrayBuffer();
  const mimeType = res.headers.get('content-type') || 'image/jpeg';
  return { buffer: Buffer.from(arrayBuffer), mimeType };
}

// Toute image servie par le site (featured ET inline, stock ET statique)
// doit être du WebP — conversion faite ici une bonne fois pour toutes plutôt
// que de dépendre d'Imagify (pas encore configuré côté WP, voir STATE.md
// 2026-07-12). qualité 82 : compromis net/poids standard pour de la photo.
async function toWebp(buffer) {
  return sharp(buffer).webp({ quality: 82 }).toBuffer();
}

// Nom de fichier explicite et unique : slug de l'alt/requête + slug de la
// pièce (article/hub/sous-hub) pour ne jamais collisionner deux images
// distinctes portant la même description générique (ex. deux "vidange
// moteur" sur des articles différents).
function slugifyFr(s) {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

function buildImageFilename(description, pieceSlug) {
  return `${slugifyFr(description)}-${slugifyFr(pieceSlug)}.webp`;
}

module.exports = { findImage, downloadImage, toWebp, slugifyFr, buildImageFilename, LEDGER_PATH };
