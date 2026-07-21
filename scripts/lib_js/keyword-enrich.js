// Logique d'enrichissement de mots-clés partagée entre scripts/fetch-keywords.js (P1,
// seeds éditoriaux) et scripts/rescue-rejected-candidats.js (sauvetage des candidats
// programmatiques à volume nul) — extraite le 2026-07-21 pour ne jamais dupliquer/diverger
// les règles de filtrage déjà éprouvées sur des milliers de mots-clés réels.
const { match, questions, related } = require('../haloscan-client');

const ENRICH_VOLUME_MIN = 10;
const ENRICH_COMPETITION_MAX = 0.35;

// Enseignes/marques auto connues qui ressortent souvent en "related"/"match" (SERP concurrentiel)
// sans être des sujets d'article valables pour ce réseau de contenu — filtrées même quand
// si_brand/si_nav renvoie "NA" au lieu de true/false (incohérence observée sur l'API Haloscan).
const BRAND_BLOCKLIST = new Set([
  'feu vert', 'feuvert', 'feux vert', 'norauto', 'midas', 'speedy', 'speedy avis', 'euromaster',
  'point s', 'roady', 'carter cash', 'cartercash', 'carter-cash', 'oscaro', 'mister auto', 'allopneu',
  'vroomly', 'autobacs', 'leclerc automobiles', 'leclerc location', 'leclerc auto', 'wordreference',
  'best drive', 'firststop', 'first stop', 'ad distribution', 'my renault', 'pneus',
]);

const STOPWORDS = new Set([
  'le', 'la', 'les', 'de', 'des', 'du', 'un', 'une', 'et', 'ou', 'à', 'a', 'pour', 'avec', 'sans',
  'sur', 'dans', 'par', 'plus', 'que', 'qui', 'ce', 'cette', 'ces', 'son', 'sa', 'ses', 'vs', 'au',
  'aux', 'en', 'est', 'quand', 'comment', 'combien',
]);

// Mots trop génériques DANS CETTE NICHE pour servir de signal de pertinence (ils reviennent dans
// quasi tous les seeds, donc un simple partage de ce mot ne prouve rien sur le sujet réel) — ex.
// "contrôle technique prix" matchait à tort "vidange prix moyen" via le seul mot "prix" avant ce
// durcissement (2026-07-11). Ils restent affichés tels quels dans le mot-clé candidat, seulement
// exclus du calcul de chevauchement lexical.
const NICHE_GENERIC_WORDS = new Set([
  'prix', 'tarif', 'tarifs', 'coût', 'cout', 'couts', 'coûts', 'voiture', 'voitures', 'auto', 'autos',
  'moyen', 'moyenne', 'meilleur', 'meilleure', 'meilleurs', 'meilleures', 'changer', 'changement',
  'entretien', 'garage', 'marque', 'marques', 'modele', 'modèle', 'modeles', 'modèles', 'cher',
  'chere', 'chère', 'pas cher', 'gratuit', 'gratuite', 'astuce', 'astuces', 'guide', 'conseil', 'conseils',
]);

function significantTokens(text) {
  return (text || '').toLowerCase().split(/[^a-zà-ÿ0-9]+/)
    .filter(t => t.length >= 4 && !STOPWORDS.has(t) && !NICHE_GENERIC_WORDS.has(t) && !/^\d+$/.test(t));
}

// Fusionne les résultats des 3 endpoints d'enrichissement en une liste de candidats dédupliqués,
// en excluant le bruit navigationnel/marques concurrentes (pas des sujets d'article exploitables).
function mergeCandidates(seedKeyword, sources) {
  const seedTokens = significantTokens(seedKeyword);
  const byKeyword = new Map();
  for (const { source, results } of sources) {
    for (const r of results || []) {
      if (!r.keyword) continue;
      const kwLower = r.keyword.toLowerCase();
      if (r.si_nav === true || r.si_brand === true) continue;
      if (BRAND_BLOCKLIST.has(kwLower)) continue;
      const shared = significantTokens(kwLower).some(t => seedTokens.includes(t));
      if (!shared) continue;
      const cand = {
        keyword: r.keyword,
        volume: r.volume ?? null,
        competition: r.competition === 'NA' ? null : r.competition,
        source,
      };
      const existingCand = byKeyword.get(r.keyword);
      if (!existingCand || (cand.volume ?? 0) > (existingCand.volume ?? 0)) {
        byKeyword.set(r.keyword, cand);
      }
    }
  }
  return [...byKeyword.values()].sort((a, b) => (b.volume ?? 0) - (a.volume ?? 0));
}

async function enrichSeed(keyword) {
  const opts = { volumeMin: ENRICH_VOLUME_MIN, competitionMax: ENRICH_COMPETITION_MAX };
  const [matchRes, questionsRes, relatedRes] = await Promise.all([
    match(keyword, opts).catch(() => ({ results: [] })),
    questions(keyword, opts).catch(() => ({ results: [] })),
    related(keyword, opts).catch(() => ({ results: [] })),
  ]);
  return mergeCandidates(keyword, [
    { source: 'match', results: matchRes.results },
    { source: 'questions', results: questionsRes.results },
    { source: 'related', results: relatedRes.results },
  ]);
}

module.exports = {
  ENRICH_VOLUME_MIN, ENRICH_COMPETITION_MAX,
  BRAND_BLOCKLIST, STOPWORDS, NICHE_GENERIC_WORDS,
  significantTokens, mergeCandidates, enrichSeed,
};
