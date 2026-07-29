// Complète les faits factuels d'un cluster quand data/factuel/*.json n'en
// fournit pas assez pour rédiger 1500+ mots sans inventer de chiffre (demande
// explicite de l'utilisateur, 2026-07-29). Contrairement à
// competitor-research.js (angles à reformuler, jamais cités), ces résultats
// SONT destinés à être cités dans `sources[]` — chaque fait garde son nom de
// source et son URL d'origine, comme une entrée data/factuel/*.json classique
// (voir factuel.js : le champ `source` alimente `sources[].label`).
const fs = require('fs');
const path = require('path');

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

const TAVILY_API_KEY = getVar('TAVILY_API_KEY');
const TAVILY_URL = 'https://api.tavily.com/search';

// Même heuristique que gating.js (checkFactsNotInvented) : un résultat n'est
// utile que s'il porte une vraie donnée chiffrée, pas juste un avis général.
const NUMERIC_CLAIM_PATTERN = /\d+(?:[.,]\d+)?\s?(€|%|km|kms|kilom[eè]tres|ans?|mois|jours?|heures?|h\b)/i;

// Variantes de requête pour élargir la recherche round après round plutôt que
// de répéter la même requête (qui renverrait les mêmes résultats) — s'arrête
// dès que la cible est atteinte, jamais de round inutile.
const QUERY_SUFFIXES = [' France chiffres 2026', ' prix moyen', ' statistiques officielles', ' réglementation France'];

function domainOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch (e) {
    return url;
  }
}

// Dégradation gracieuse (même principe que competitor-research.js/images.js) :
// une panne Tavily ne doit jamais faire échouer la génération, seulement la
// priver de cet enrichissement pour ce cluster.
async function searchOnce(query) {
  try {
    const res = await fetch(TAVILY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: TAVILY_API_KEY,
        query,
        search_depth: 'advanced',
        include_answer: false,
        max_results: 5,
      }),
    });
    if (!res.ok) {
      console.warn(`[tavily-facts] Tavily ${res.status} pour "${query}" — ignoré.`);
      return [];
    }
    const data = await res.json();
    return data.results || [];
  } catch (e) {
    console.warn(`[tavily-facts] échec réseau pour "${query}" (${e.message}) — ignoré.`);
    return [];
  }
}

// Recherche des données factuelles réelles (chiffrées, sourcées) pour un
// cluster dont data/factuel/*.json ne couvre pas assez — round après round
// avec des requêtes élargies, jusqu'à atteindre `targetCount` faits utiles ou
// épuiser `maxRounds` (jamais de boucle infinie même si Tavily ne renvoie
// jamais de donnée chiffrée pertinente pour un sujet donné).
async function searchFactualData(topic, { targetCount = 6, maxRounds = QUERY_SUFFIXES.length } = {}) {
  if (!TAVILY_API_KEY || !topic) return [];
  const found = [];
  const seenUrls = new Set();

  for (let round = 0; round < maxRounds && found.length < targetCount; round++) {
    const query = `${topic}${QUERY_SUFFIXES[round]}`;
    const results = await searchOnce(query);
    for (const r of results) {
      if (found.length >= targetCount) break;
      if (!r.url || seenUrls.has(r.url)) continue;
      const content = (r.content || '').trim();
      if (!NUMERIC_CLAIM_PATTERN.test(content)) continue;
      seenUrls.add(r.url);
      // Même forme que les entrées data/factuel/*.json (fait/valeur/source,
      // URL entre parenthèses dans `source`) — voir prompt-builder.js
      // CONTENT_SCHEMA.sources[].label : le modèle sait déjà extraire label +
      // URL de ce format précis à partir des fichiers factuels existants.
      found.push({
        fait: r.title || domainOf(r.url),
        valeur: content.slice(0, 500),
        source: `${r.title || domainOf(r.url)} (${r.url})`,
        _source: 'tavily',
      });
    }
  }
  return found;
}

module.exports = { searchFactualData };
