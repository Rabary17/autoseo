// Génère des brouillons d'actus (≤400 mots) à partir de la short-list du jour
// (data/actus/veille-<date>.json, voir veille.js). QC automatique (longueur,
// tirets cadratins, script étranger) mais TOUJOURS inséré en `draft` — jamais
// publié directement par ce script (voir skills/gestion-de-projet.md : la
// mise en ligne effective reste un geste manuel, voir approve.js).
// Usage : node scripts/actus/generate.js [--max=2]
const fs = require('fs');
const path = require('path');
const wp = require('../autopublish/lib/wp-client');
const mistralClient = require('../autopublish/lib/mistral-client');
const gating = require('../autopublish/lib/gating');

const DATA_DIR = path.join(__dirname, '..', '..', 'data', 'actus');
const LOG_PATH = path.join(DATA_DIR, 'generated-log.json');
const MAX_WORDS = 400;
const maxArg = process.argv.find((a) => a.startsWith('--max='));
const MAX_ITEMS = maxArg ? Number(maxArg.split('=')[1]) : 2;

function slugifyFr(s) {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function loadLog() {
  if (!fs.existsSync(LOG_PATH)) return {};
  return JSON.parse(fs.readFileSync(LOG_PATH, 'utf-8'));
}
function saveLog(log) {
  fs.writeFileSync(LOG_PATH, JSON.stringify(log, null, 2));
}

// Décodage minimal des entités HTML numériques/nommées les plus courantes en
// FR — suffisant pour du texte de grounding (pas un rendu final), pas besoin
// d'exhaustivité.
const HTML_ENTITIES = {
  '&eacute;': 'é', '&egrave;': 'è', '&agrave;': 'à', '&ecirc;': 'ê', '&icirc;': 'î',
  '&ucirc;': 'û', '&ouml;': 'ö', '&rsquo;': '’', '&lsquo;': '‘', '&ccedil;': 'ç',
  '&Eacute;': 'É', '&Agrave;': 'À', '&#039;': "'", '&amp;': '&', '&nbsp;': ' ',
  '&hellip;': '…', '&#8209;': '-', '&quot;': '"', '&laquo;': '«', '&raquo;': '»',
};
function decodeEntitiesRough(s) {
  return s.replace(/&[a-zA-Z#0-9]+;/g, (m) => HTML_ENTITIES[m] ?? m);
}

// Récupère le TEXTE RÉEL de l'article source avant génération — indispensable
// contre l'hallucination : donner seulement un titre RSS à un LLM et lui
// demander 250-400 mots l'a conduit (constaté le 2026-08-05) à inventer des
// chiffres et une URL entièrement fictifs pour combler le vide. Heuristique
// générique (pas de sélecteur par site) : parmi tous les <p>, ne garder que
// ceux de longueur 80-800 caractères — trop court = libellé de nav/menu, trop
// long = un bloc de navigation entier concaténé sans balises entre les items.
// Vérifié sur Caradisiac/Argus/AutoPlus/Motorlegend : isole proprement le
// corps de l'article du reste de la page (nav, "vous aimerez aussi", etc.).
async function fetchSourceText(url) {
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; autoseo-actus/1.0)' } });
  if (!res.ok) throw new Error(`HTTP ${res.status} en récupérant ${url}`);
  const html = await res.text();
  const paras = [...html.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((m) => decodeEntitiesRough(m[1].replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim())
    .filter((p) => p.length >= 80 && p.length <= 800);
  const text = paras.join('\n\n').slice(0, 6000); // plafond raisonnable de tokens
  if (text.length < 200) throw new Error('texte source extrait trop court (page probablement bloquée/paywall/JS) — abandon plutôt que de risquer une génération sans base factuelle');
  return text;
}

function latestVeilleFile() {
  const today = new Date().toISOString().slice(0, 10);
  const todayPath = path.join(DATA_DIR, `veille-${today}.json`);
  if (fs.existsSync(todayPath)) return todayPath;
  const files = fs.readdirSync(DATA_DIR).filter((f) => /^veille-\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort();
  if (!files.length) return null;
  return path.join(DATA_DIR, files[files.length - 1]);
}

const SCHEMA = {
  name: 'actu',
  schema: {
    type: 'object',
    additionalProperties: false,
    required: ['title', 'meta_title', 'meta_description', 'excerpt', 'content_gutenberg', 'tags'],
    properties: {
      title: { type: 'string' },
      meta_title: { type: 'string' },
      meta_description: { type: 'string' },
      excerpt: { type: 'string' },
      content_gutenberg: { type: 'string' },
      tags: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 5 },
    },
  },
};

const SYSTEM_PROMPT = `Tu rédiges une brève d'actualité automobile/mobilité pour un média français (techcars.fr), à partir d'un extrait du texte RÉEL de l'article source fourni ci-dessous.

Contraintes strictes :
- 400 mots MAXIMUM pour le corps de l'article (content_gutenberg). Vise plutôt 250-350.
- Style journalistique factuel, phrases courtes, aucune tournure IA générique ("dans le monde d'aujourd'hui", "il est important de noter"...).
- INTERDICTION ABSOLUE d'inventer un fait, un chiffre, un nom de modèle/marque ou une citation qui n'apparaît pas explicitement dans le texte source fourni. Si le texte source est mince sur un point, reste vague sur ce point plutôt que d'extrapoler ou de deviner.
- N'inclus JAMAIS de lien ni d'URL dans content_gutenberg — le paragraphe "Source : ..." est ajouté automatiquement par le système après coup, ce n'est pas ton rôle.
- Mentionne le nom du média source dans le corps du texte (ex. "selon Caradisiac", "rapporte L'Argus").
- content_gutenberg : uniquement des blocs <!-- wp:paragraph -->...<!-- /wp:paragraph --> et éventuellement un <!-- wp:heading {"level":2} -->, pas de tableau/liste/image/lien.
- Jamais de tiret cadratin (—) nulle part.
- meta_title ≤ 60 caractères, meta_description entre 120 et 155 caractères.
- excerpt : 1 phrase résumant l'actu (pour l'aperçu de la carte).
- tags : 1 à 5 mots-clés pertinents (marques, thèmes), en minuscules.`;

async function generateOne(item, sourceText) {
  const userMsg = `Titre de la source (${item.source}) : "${item.title}"\nCatégorie : ${item.category}\n\nTexte réel de l'article source (seule base factuelle autorisée) :\n"""\n${sourceText}\n"""\n\nRédige la brève selon les contraintes du system prompt, en te basant UNIQUEMENT sur ce texte.`;
  const result = await mistralClient.callMistral({
    model: 'mistral-large-latest',
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userMsg }],
    schema: SCHEMA,
    maxTokens: 4000,
  });
  return result.parsed;
}

// Anti-hallucination : tout nombre à 3+ chiffres (montants, quantités,
// pourcentages, années à part) présent dans la sortie mais absent du texte
// source est un signe fort d'invention — c'est précisément ce qui s'est
// produit le 2026-08-05 (chiffres de malus écologique inventés). Les nombres
// à 1-2 chiffres sont ignorés (trop de faux positifs : "3 modèles", "2ème"...).
function findUnsourcedNumbers(generatedText, sourceText) {
  const numbers = [...generatedText.matchAll(/\d[\d\s.,]{2,}\d|\d{3,}/g)].map((m) => m[0].replace(/\s/g, ''));
  return [...new Set(numbers)].filter((n) => !sourceText.replace(/\s/g, '').includes(n));
}

function runGate(content, sourceText) {
  const failures = [];
  const words = gating.countWords(content.content_gutenberg);
  if (words > MAX_WORDS) failures.push(`trop long (${words} mots > ${MAX_WORDS})`);
  if (/\s—\s/.test(gating.stripHtmlToText(content.content_gutenberg))) failures.push('tiret cadratin détecté');
  if (/[一-鿿぀-ヿ가-힯]/.test(content.content_gutenberg)) failures.push('script étranger détecté');
  if (/<a\s/i.test(content.content_gutenberg)) failures.push('lien inattendu dans le corps (le modèle ne doit jamais en générer)');
  if (!content.meta_title || content.meta_title.length > 65) failures.push('meta_title absent ou trop long');
  if (!content.meta_description || content.meta_description.length < 100 || content.meta_description.length > 165) {
    failures.push('meta_description hors bornes');
  }
  const unsourced = findUnsourcedNumbers(gating.stripHtmlToText(content.content_gutenberg), sourceText);
  if (unsourced.length) failures.push(`chiffre(s) absent(s) du texte source (suspicion d'invention) : ${unsourced.join(', ')}`);
  return { passed: failures.length === 0, failures, words };
}

let categoryIdCache = null;
async function resolveActusCategory() {
  if (categoryIdCache) return categoryIdCache;
  const term = await wp.findOrCreateTerm('categories', 'actualites', { name: 'Actualités', slug: 'actualites' });
  categoryIdCache = term.id;
  return categoryIdCache;
}

async function resolveTagIds(tagNames) {
  const ids = [];
  for (const name of tagNames || []) {
    const term = await wp.findOrCreateTerm('tags', slugifyFr(name), { name, slug: slugifyFr(name) });
    ids.push(term.id);
  }
  return ids;
}

async function main() {
  const veilleFile = latestVeilleFile();
  if (!veilleFile) {
    console.error('Aucun fichier data/actus/veille-*.json trouvé — lance d\'abord `npm run veille-actus`.');
    process.exit(1);
  }
  const { items } = JSON.parse(fs.readFileSync(veilleFile, 'utf-8'));
  const log = loadLog();

  // Priorité aux sujets réglementaires (meilleur alignement avec les silos
  // existants du site, donc meilleur potentiel de trafic — voir la réponse
  // du 2026-08-05 à l'utilisateur sur la structure Actus).
  const ranked = [...items].sort((a, b) => {
    const pa = a.category === 'reglementaire' ? 0 : 1;
    const pb = b.category === 'reglementaire' ? 0 : 1;
    return pa - pb;
  });

  // Les liens Google Actualités sont des redirections côté JS (pas résolues
  // par un simple fetch, vérifié le 2026-08-05 : on reste sur news.google.com
  // sans contenu exploitable) — ignorés tant qu'on n'a pas de mécanisme de
  // résolution dédié. On ne génère qu'à partir des flux directs des médias.
  const usable = ranked.filter((it) => !/news\.google\.com/.test(it.link));
  const candidates = usable.filter((it) => !log[it.link]).slice(0, MAX_ITEMS);
  if (!candidates.length) {
    console.log('Aucun candidat nouveau (tout a déjà été traité, ou short-list vide hors Google Actualités).');
    return;
  }

  const categoryId = await resolveActusCategory();

  for (const item of candidates) {
    console.log(`\n=== ${item.title} (${item.source}) ===`);

    let sourceText;
    try {
      sourceText = await fetchSourceText(item.link);
    } catch (e) {
      console.error(`  échec récupération texte source : ${e.message}`);
      log[item.link] = { date: new Date().toISOString(), status: 'echec-fetch-source', error: e.message };
      saveLog(log);
      continue;
    }

    let content;
    try {
      content = await generateOne(item, sourceText);
    } catch (e) {
      console.error(`  échec génération : ${e.message}`);
      log[item.link] = { date: new Date().toISOString(), status: 'echec-generation', error: e.message };
      saveLog(log);
      continue;
    }

    const gate = runGate(content, sourceText);
    console.log(`  mots: ${gate.words} — gating: ${gate.passed ? 'OK' : 'ÉCHEC (' + gate.failures.join(' ; ') + ')'}`);

    if (!gate.passed) {
      log[item.link] = { date: new Date().toISOString(), status: 'echec-gating', failures: gate.failures };
      saveLog(log);
      continue;
    }

    const tagIds = await resolveTagIds(content.tags);
    const slug = slugifyFr(content.title);
    // Le lien de la source est ajouté ici, en dur, avec l'URL RSS d'origine
    // (jamais celle du modèle — voir SYSTEM_PROMPT, qui interdit désormais
    // tout lien dans content_gutenberg).
    const sourceParagraph = `\n\n<!-- wp:paragraph --><p>Source : <a href="${item.link}">${item.source}</a></p><!-- /wp:paragraph -->`;
    const payload = {
      title: content.title,
      slug,
      status: 'draft', // jamais publié directement — voir approve.js
      content: content.content_gutenberg + sourceParagraph,
      excerpt: content.excerpt,
      categories: [categoryId],
      tags: tagIds,
      acf: {
        tldr: content.excerpt,
        sources: `${item.source} — ${item.link}`,
        meta_title: content.meta_title,
        meta_description: content.meta_description,
      },
    };

    try {
      const created = await wp.createPost(payload);
      console.log(`  inséré en brouillon — WP #${created.id}`);
      log[item.link] = { date: new Date().toISOString(), status: 'brouillon', wpId: created.id, title: content.title };
    } catch (e) {
      console.error(`  échec insertion WP : ${e.message}`);
      log[item.link] = { date: new Date().toISOString(), status: 'echec-insertion', error: e.message };
    }
    saveLog(log);
  }

  console.log(`\nTerminé. Vérifie les brouillons avec: node scripts/actus/approve.js`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
