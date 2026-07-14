// TF-IDF + cosinus pur JS (aucun appel API) — QA unicité du gating (voir
// skills/wordpress-publication.md section 5 : "similarité < 20 % avec tout
// autre article publié du même template/moteur programmatique"). Un index
// par silo+sous-cocon, persisté dans data/similarity-index/.
const fs = require('fs');
const path = require('path');

const INDEX_DIR = path.join(__dirname, '..', '..', '..', 'data', 'similarity-index');

// Liste courte, suffisante pour ne pas fausser la similarité avec des mots
// grammaticaux très fréquents — pas besoin d'une liste exhaustive, seuls les
// mots qui reviendraient dans presque tous les articles comptent ici.
const STOPWORDS = new Set([
  'le','la','les','de','des','du','un','une','et','en','à','au','aux','ce','ces','cet','cette',
  'pour','par','sur','dans','avec','sans','ou','où','que','qui','quoi','dont','se','sa','son',
  'ses','leur','leurs','est','sont','être','avoir','ont','plus','moins','très','tout','toute',
  'tous','toutes','comme','mais','donc','car','ne','pas','vous','nous','il','elle','ils','elles',
  'on','wp','paragraph','heading','list','table','href','class','figure',
]);

function stripHtml(html) {
  return html.replace(/<!--[\s\S]*?-->/g, ' ').replace(/<[^>]+>/g, ' ');
}

function normalize(text) {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

function tokenize(text) {
  const clean = normalize(stripHtml(text));
  return clean.split(/[^a-z0-9]+/).filter(t => t.length >= 3 && !STOPWORDS.has(t));
}

function termFrequency(tokens) {
  const tf = {};
  for (const t of tokens) tf[t] = (tf[t] || 0) + 1;
  return tf;
}

function slugifyPart(s) {
  return normalize(s).replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function indexPath(silo, sousCocon) {
  return path.join(INDEX_DIR, `${slugifyPart(silo)}__${slugifyPart(sousCocon || 'general')}.json`);
}

// Un index corrompu (écriture interrompue, disque plein) ne doit jamais
// bloquer tout le silo/sous-cocon indéfiniment — on le traite comme vide et
// on avertit, plutôt que de laisser JSON.parse crasher gating.js pour chaque
// pièce suivante du même silo tant que le fichier n'est pas réparé à la main.
function loadIndex(silo, sousCocon) {
  const p = indexPath(silo, sousCocon);
  if (!fs.existsSync(p)) return [];
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (e) {
    console.warn(`similarity: index illisible ignoré (${p}) : ${e.message}`);
    return [];
  }
}

function saveIndex(silo, sousCocon, entries) {
  fs.mkdirSync(INDEX_DIR, { recursive: true });
  fs.writeFileSync(indexPath(silo, sousCocon), JSON.stringify(entries, null, 2) + '\n', 'utf8');
}

// Ajoute (ou remplace) l'entrée d'un slug dans l'index — appelé par run.js
// uniquement après qu'un contenu ait passé le gating et soit inséré dans WP,
// jamais avant (sinon un contenu refusé pollue le corpus de comparaison).
function addToIndex(silo, sousCocon, slug, text) {
  const entries = loadIndex(silo, sousCocon).filter(e => e.slug !== slug);
  entries.push({ slug, tf: termFrequency(tokenize(text)) });
  saveIndex(silo, sousCocon, entries);
}

function buildIdf(allTfMaps) {
  const df = new Map();
  for (const tf of allTfMaps) {
    for (const term of Object.keys(tf)) df.set(term, (df.get(term) || 0) + 1);
  }
  const N = allTfMaps.length;
  const idf = new Map();
  for (const [term, d] of df) idf.set(term, Math.log((N + 1) / (d + 1)) + 1);
  return idf;
}

function tfidfVector(tf, idf) {
  const vec = new Map();
  for (const [term, count] of Object.entries(tf)) {
    vec.set(term, count * (idf.get(term) || 0));
  }
  return vec;
}

function cosine(a, b) {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (const [term, val] of a) {
    normA += val * val;
    if (b.has(term)) dot += val * b.get(term);
  }
  for (const val of b.values()) normB += val * val;
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

// Similarité maximale du texte candidat contre tout le corpus existant du
// même silo+sous-cocon. Retourne 0 (et against: null) si le corpus est vide
// — un premier article du sous-cocon ne peut pas être jugé similaire à rien.
function maxSimilarity(text, silo, sousCocon) {
  const entries = loadIndex(silo, sousCocon);
  if (!entries.length) return { max: 0, against: null };
  const candidateTf = termFrequency(tokenize(text));
  const idf = buildIdf([...entries.map(e => e.tf), candidateTf]);
  const candidateVec = tfidfVector(candidateTf, idf);

  let max = 0;
  let against = null;
  for (const entry of entries) {
    const sim = cosine(candidateVec, tfidfVector(entry.tf, idf));
    if (sim > max) {
      max = sim;
      against = entry.slug;
    }
  }
  return { max, against };
}

module.exports = { tokenize, addToIndex, loadIndex, maxSimilarity, indexPath };
