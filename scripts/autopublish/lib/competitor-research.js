// Recherche d'idées auprès des concurrents (Tavily), pour enrichir le
// contenu généré de nouveaux angles utiles aux lecteurs — demande explicite
// de l'utilisateur le 2026-07-22, en complément de data/factuel/*.json.
//
// Règle non négociable (anti-plagiat, demande explicite de l'utilisateur :
// "on ne citera pas la source") : on ne transmet JAMAIS au modèle le contenu
// intégral d'une page concurrente, ni son URL, ni le nom d'un concurrent.
// Seuls deux éléments, déjà des synthèses et non des citations :
//   - `answer` de Tavily (résumé généré par Tavily à partir de plusieurs
//     sources, pas le texte brut d'un article) ;
//   - les `title` des résultats (quelques mots, pas un contenu protégeable).
// Le modèle a ensuite pour consigne (voir prompts/system-*.md) de reformuler
// entièrement ces pistes dans ses propres mots, jamais de les citer ni de
// laisser deviner une source externe dans le texte final ni dans `sources[]`.
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

// Dégradation gracieuse (même principe que images.js/wp-client.js) : une
// panne réseau ou un quota Tavily épuisé ne doit jamais faire échouer la
// génération d'une pièce — juste la priver de cet enrichissement pour ce run.
async function searchCompetitorAngles(topic, { maxResults = 5 } = {}) {
  if (!TAVILY_API_KEY || !topic) return [];
  try {
    const res = await fetch(TAVILY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: TAVILY_API_KEY,
        query: `${topic} France`,
        search_depth: 'basic',
        include_answer: true,
        max_results: maxResults,
      }),
    });
    if (!res.ok) {
      console.warn(`[competitor-research] Tavily ${res.status} pour "${topic}" — ignoré ce run.`);
      return [];
    }
    const data = await res.json();
    const angles = [];
    if (data.answer) angles.push(data.answer);
    for (const r of data.results || []) {
      if (r.title) angles.push(r.title);
    }
    return angles;
  } catch (e) {
    console.warn(`[competitor-research] échec réseau pour "${topic}" (${e.message}) — ignoré ce run.`);
    return [];
  }
}

module.exports = { searchCompetitorAngles };
