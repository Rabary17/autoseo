// Client Haloscan API — usage : require('./haloscan-client')
// Clé lue depuis .env (jamais hardcodée, jamais exposée côté navigateur)
const fs = require('fs');
const path = require('path');

function loadApiKey() {
  const envPath = path.join(__dirname, '..', '.env');
  const raw = fs.readFileSync(envPath, 'utf8');
  const line = raw.split('\n').find(l => l.startsWith('HALOSCAN_API_KEY='));
  if (!line) throw new Error('HALOSCAN_API_KEY introuvable dans .env');
  return line.split('=')[1].trim();
}

const BASE_URL = 'https://api.haloscan.com/api';
const API_KEY = loadApiKey();

async function request(path, { method = 'GET', body } = {}) {
  const res = await fetch(BASE_URL + path, {
    method,
    headers: {
      'haloscan-api-key': API_KEY,
      'content-type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`Haloscan ${method} ${path} -> ${res.status}: ${JSON.stringify(json)}`);
  }
  return json;
}

// Solde de crédits restants (à vérifier avant/pendant tout run massif)
async function getCredit() {
  return request('/user/credit');
}

// Mots-clés similaires/associés à un mot-clé seed (max ~100 résultats/appel, coûte 1 creditKeyword)
async function similar(keyword) {
  return request('/keywords/similar', { method: 'POST', body: { keyword } });
}

// Volumes/metrics pour une liste de mots-clés déjà connus (coûte des creditBulkKeyword, pool plus petit)
async function bulk(keywords) {
  return request('/keywords/bulk', { method: 'POST', body: { keywords } });
}

// Vue détaillée d'un seul mot-clé (metrics + serp)
async function overview(keyword, requestedData = ['metrics']) {
  return request('/keywords/overview', { method: 'POST', body: { keyword, requested_data: requestedData } });
}

// --- Endpoints complémentaires, gratuits en pratique tant que le mot-clé seed est déjà connu de Haloscan
// (0 creditKeyword consommé constaté en test si le seed a du volume ; renvoie KEYWORD_UNKNOWN sinon, gratuit aussi).
// Toujours plafonnés à ~20 résultats/appel par Haloscan (offset/page ignorés) : on compense en filtrant/triant
// côté serveur Haloscan via volume_min / competition_max / order_by pour récupérer le meilleur sous-ensemble.
function expandBody(keyword, { volumeMin, competitionMax, orderBy = 'volume', order = 'desc' } = {}) {
  const body = { keyword, order_by: orderBy, order };
  if (volumeMin !== undefined) body.volume_min = volumeMin;
  if (competitionMax !== undefined) body.competition_max = competitionMax;
  return body;
}

// Mots-clés contenant le seed en sous-chaîne (variantes proches)
async function match(keyword, opts) {
  return request('/keywords/match', { method: 'POST', body: expandBody(keyword, opts) });
}

// Questions liées (People Also Ask) — très utile pour du contenu FAQ/longue traîne
async function questions(keyword, opts) {
  return request('/keywords/questions', { method: 'POST', body: expandBody(keyword, opts) });
}

// Recherches associées (Related Searches SERP)
async function related(keyword, opts) {
  return request('/keywords/related', { method: 'POST', body: expandBody(keyword, opts) });
}

module.exports = { getCredit, similar, bulk, overview, match, questions, related };
