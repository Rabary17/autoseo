// Runner P1 — expansion des mots-clés seed via Haloscan.
// NE PAS LANCER SANS VALIDATION. Usage prévu :
//   node scripts/fetch-keywords.js --silo "Entretien & révision"   (un silo à la fois)
//   node scripts/fetch-keywords.js --dry-run                       (simulation, 0 crédit consommé)
//   node scripts/fetch-keywords.js --resume                        (reprend là où ça s'est arrêté)
//
// Comportement :
// - Vérifie le crédit restant AVANT de démarrer, s'arrête si < 100 creditKeyword restants.
// - Pace les appels (1 req / 400ms) pour rester prudent, aucune limite de débit publiée par Haloscan.
// - Sauvegarde incrémentale dans data/keywords/<silo>.json après CHAQUE seed (reprise possible si coupure).
// - Idempotent : un seed déjà présent dans le fichier de sortie n'est jamais rappelé (sauf --force).
//
// Enrichissement (2026-07-11) : en plus de `keywords/similar`, chaque seed est complété par
// `keywords/match`, `keywords/questions` et `keywords/related` — coût constaté faible mais RÉEL et
// répété à chaque appel (~1 creditKeyword par combinaison endpoint/mot-clé productive, y compris en
// rappelant un mot-clé déjà interrogé ; observé ~40 crédits pour 40 seeds à chaque exécution ;
// KEYWORD_UNKNOWN = 0 crédit). Donc `--force-enrich` n'est PAS gratuit à répéter à volonté : l'utiliser
// avec parcimonie (ex. après une amélioration du filtre de nettoyage), pas en routine. Vérifier
// /credit-check après un run sur un nouveau silo. Ces 3 endpoints sont plafonnés à ~20 résultats/appel par Haloscan
// (offset/page ignorés), donc on demande à Haloscan de nous donner directement le meilleur sous-ensemble
// via volume_min / competition_max / order_by=volume desc, plutôt que de paginer. Les résultats
// navigationnels/marques concurrentes seules (si_nav/si_brand, ou blocklist de marques connues) sont
// exclus : ce ne sont pas des sujets d'article exploitables (les requêtes longue traîne qui MENTIONNENT
// une marque, ex. "vidange feu vert prix", restent gardées — ce sont de vrais sujets de contenu).
// Un seed déjà présent mais non enrichi (ancien run) est complété automatiquement, sans re-payer `similar`.
// --force-enrich : refait l'enrichissement (match/questions/related) même si déjà fait, sans re-payer `similar`
// (utile après une amélioration du filtre de nettoyage, cf. mergeCandidates ci-dessous).

const fs = require('fs');
const path = require('path');
const { getCredit, similar, match, questions, related } = require('./haloscan-client');

const DATA_DIR = path.join(__dirname, '..', 'data', 'keywords');
const SEEDS_PATH = path.join(DATA_DIR, 'seeds.json');
const DELAY_MS = 400;
const MIN_CREDIT_SAFETY = 100;
const ENRICH_VOLUME_MIN = 10;
const ENRICH_COMPETITION_MAX = 0.35;

function parseArgs() {
  const args = process.argv.slice(2);
  const get = (flag) => {
    const i = args.indexOf(flag);
    return i !== -1 ? args[i + 1] : undefined;
  };
  return {
    silo: get('--silo'),
    dryRun: args.includes('--dry-run'),
    resume: args.includes('--resume'),
    force: args.includes('--force'),
    forceEnrich: args.includes('--force-enrich'),
  };
}

function slug(name) {
  return name.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function stripIntent(kw) {
  const [keyword, intent] = kw.split('|');
  return { keyword, intent: intent || null };
}

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

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
      // Chevauchement lexical exigé pour les 3 sources, y compris `questions` : contrairement à
      // l'hypothèse initiale, les questions "People Also Ask" renvoyées par Haloscan pour un seed
      // donné ne sont pas toujours spécifiques à ce seed (ex. des questions génériques "prix
      // entretien auto" ressortaient pour le seed "vidange prix moyen" sans rapport réel avec la
      // vidange) — constaté et corrigé le 2026-07-11.
      const shared = significantTokens(kwLower).some(t => seedTokens.includes(t));
      if (!shared) continue;
      const cand = {
        keyword: r.keyword,
        volume: r.volume ?? null,
        competition: r.competition === 'NA' ? null : r.competition,
        source,
      };
      // garde la meilleure info si le même mot-clé ressort de plusieurs endpoints
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

async function processSilo(siloName, siloData, { dryRun, force, forceEnrich }) {
  const outPath = path.join(DATA_DIR, `${slug(siloName)}.json`);
  const existing = fs.existsSync(outPath) ? JSON.parse(fs.readFileSync(outPath, 'utf8')) : { silo: siloName, seeds: {} };

  const allSeeds = siloData.subs.flatMap(sub => sub.kws.map(k => ({ sub: sub.name, ...stripIntent(k) })));
  const alreadyDone = Object.keys(existing.seeds).length;
  const needEnrichOnly = Object.values(existing.seeds).filter(s => !s.candidates).length;
  console.log(`[${siloName}] ${allSeeds.length} seeds au total, ${alreadyDone} déjà traités (dont ${needEnrichOnly} à enrichir).`);

  let calls = 0;
  for (const seed of allSeeds) {
    const already = existing.seeds[seed.keyword];
    if (!force && !forceEnrich && already && already.candidates) continue;

    if (dryRun) {
      if (!already) {
        console.log(`  (dry-run) appellerait keywords/similar + enrichissement (match/questions/related) pour: "${seed.keyword}"`);
      } else {
        console.log(`  (dry-run) appellerait l'enrichissement seul (match/questions/related) pour: "${seed.keyword}" (déjà collecté via similar)`);
      }
      continue;
    }

    try {
      let entry = already;
      if (!entry || force) {
        const result = await similar(seed.keyword);
        entry = {
          sub: seed.sub,
          intent: seed.intent,
          volume: result.results?.[0]?.volume ?? null,
          total_similar: result.total_result_count,
          results: result.results,
          fetched_at: new Date().toISOString(),
        };
        calls++;
      }

      const candidates = await enrichSeed(seed.keyword);
      entry.candidates = candidates;
      entry.enriched_at = new Date().toISOString();
      existing.seeds[seed.keyword] = entry;
      fs.writeFileSync(outPath, JSON.stringify(existing, null, 2));
      console.log(`  ✓ ${seed.keyword} — ${candidates.length} candidats enrichis (volume/difficulté filtrés)`);
    } catch (err) {
      console.error(`  ✗ ${seed.keyword} — ${err.message}`);
    }

    await sleep(DELAY_MS);
  }

  console.log(`[${siloName}] terminé : ${calls} appels API "similar" (payants) effectués, résultats -> ${outPath}`);
  return calls;
}

async function main() {
  const { silo, dryRun, force, forceEnrich } = parseArgs();
  const seeds = JSON.parse(fs.readFileSync(SEEDS_PATH, 'utf8'));

  if (!dryRun) {
    const credit = await getCredit();
    const remaining = credit.totalCredit.creditKeyword;
    console.log(`Crédit "keyword" restant : ${remaining}`);
    if (remaining < MIN_CREDIT_SAFETY) {
      console.error(`Arrêt : crédit trop bas (< ${MIN_CREDIT_SAFETY}). Vérifie ton compte Haloscan.`);
      process.exit(1);
    }
  } else {
    console.log('Mode --dry-run : aucun appel API réel, aucun crédit consommé.');
  }

  const silosToRun = silo ? { [silo]: seeds[silo] } : seeds;
  if (silo && !seeds[silo]) {
    console.error(`Silo inconnu: "${silo}". Silos disponibles: ${Object.keys(seeds).join(', ')}`);
    process.exit(1);
  }

  let total = 0;
  for (const [name, data] of Object.entries(silosToRun)) {
    total += await processSilo(name, data, { dryRun, force, forceEnrich });
  }
  console.log(`\nTotal appels API cette session : ${total}`);
}

main().catch(err => { console.error(err); process.exit(1); });
