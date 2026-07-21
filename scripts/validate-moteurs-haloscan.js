#!/usr/bin/env node
// Valide les mots-clés principaux des candidats programmatiques (scripts/expand-moteurs.py)
// via l'API Haloscan bulk(), et MET À JOUR data/keywords/moteurs-candidats.json en place
// (volume_estime réel + statut 'retenu'/'rejete'). Seuls les mots_cle_principal sont
// validés, JAMAIS les variantes (14 748 variantes vs 3 611 principaux — les variantes
// enrichissent l'article une fois la page décidée, elles n'ont pas besoin d'un volume
// individuel validé).
//
// IMPORTANT — contrainte de crédits découverte le 2026-07-20 : bulk() consomme le pool
// `creditBulkKeyword`, distinct et bien plus petit (500/mois vu ce jour-là) que le pool
// `creditKeyword` (9999) déjà utilisé pour le P1. Avec 3 611 candidats à valider, un run
// complet dépasse largement le pool mensuel — ce script est donc conçu pour être
// interrompu/relancé sur plusieurs mois SANS jamais retraiter un candidat déjà validé.
//
// Usage :
//   node scripts/validate-moteurs-haloscan.js --dry-run              vérifie toute la logique
//                                                                     (batching, seuils, reprise)
//                                                                     SANS AUCUN appel réseau ni
//                                                                     écriture du fichier réel.
//   node scripts/validate-moteurs-haloscan.js                        VRAI run, consomme des
//                                                                     crédits réels — ne lancer
//                                                                     qu'après validation explicite.
//   node scripts/validate-moteurs-haloscan.js --limit 400             plafonne ce run à 400
//                                                                     mots-clés traités (contrôle
//                                                                     fin en plus du budget crédit).
//   node scripts/validate-moteurs-haloscan.js --min-volume 5          seuil de rétention (défaut 1 :
//                                                                     tout volume mesurable > 0 est
//                                                                     retenu, 0/absent est rejeté).
//   node scripts/validate-moteurs-haloscan.js --batch-size 50         taille de lot bulk() (défaut
//                                                                     20 — voir découverte ci-dessous ;
//                                                                     repli automatique par 2 en cas
//                                                                     d'erreur réseau, voir bulkAdaptive).
//
// DÉCOUVERTE 2026-07-21 (premier run à grande échelle, batch-size 100) : bulk() plafonne
// silencieusement à 20 RÉSULTATS PAR APPEL quel que soit le nombre de mots-clés envoyés
// (constaté : 100 envoyés -> returned_result_count=20, remaining_result_count=80 dans la
// réponse). Les mots-clés au-delà du 20e ne sont ni traités ni facturés (aucun crédit gaspillé,
// confirmé : 42 crédits réels pour tout le run contre un plafond de 200 fixé) — mais ils restent
// bloqués en boucle "sans volume exploitable" à chaque relance tant que batch-size dépasse 20.
// D'où le nouveau défaut à 20, qui traite réellement 100% de chaque lot envoyé.
//   node scripts/validate-moteurs-haloscan.js --max-credits 200       plafonne la dépense de CE run à
//                                                                     200 crédits creditBulkKeyword
//                                                                     (suivi en temps réel, pas une
//                                                                     estimation a priori) — s'arrête
//                                                                     proprement avant de dépasser.
//
// Reprise : ne retraite jamais un candidat dont statut != 'à valider'. S'arrête proprement
// (code 0, pas une erreur) si le pool restant ne permet plus un lot complet — relançable
// plus tard sans aucune perte (écriture sur disque après CHAQUE lot traité).
const fs = require('fs');
const path = require('path');
const haloscan = require('./haloscan-client');

const JSON_PATH = path.join(__dirname, '..', 'data', 'keywords', 'moteurs-candidats.json');
const DEBUG_SAMPLE_PATH = path.join(__dirname, '..', 'data', 'keywords', '_debug-bulk-response-sample.json');
const CREDIT_SAFETY_MARGIN = 5; // ne jamais viser pile le solde restant

function parseArgs(argv) {
  const args = { dryRun: false, minVolume: 1, batchSize: 20, limit: Infinity, maxCredits: Infinity };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--dry-run') args.dryRun = true;
    else if (argv[i] === '--min-volume') args.minVolume = Number(argv[++i]);
    else if (argv[i] === '--batch-size') args.batchSize = Number(argv[++i]);
    else if (argv[i] === '--limit') args.limit = Number(argv[++i]);
    else if (argv[i] === '--max-credits') args.maxCredits = Number(argv[++i]);
  }
  return args;
}

function loadPayload() {
  return JSON.parse(fs.readFileSync(JSON_PATH, 'utf8'));
}

function savePayload(payload) {
  fs.writeFileSync(JSON_PATH, JSON.stringify(payload, null, 2), 'utf8');
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

// Simule une réponse bulk() en dry-run : volume déterministe (jamais Math.random — ce
// script doit rester reproductible), dérivé de la longueur du mot-clé pour obtenir un
// mélange plausible de retenus/rejetés sans appel réseau.
function fakeBulkResponse(keywords) {
  return keywords.map(kw => ({ keyword: kw, volume: (kw.length * 7) % 40 }));
}

// Format confirmé en conditions réelles le 2026-07-21 (premier vrai appel, 10 mots-clés) :
// response.results[] avec un champ "volume" — mais Haloscan renvoie la CHAÎNE "NA" (pas
// null/undefined) quand aucun volume n'est mesurable. C'est un vrai résultat (le mot-clé
// n'a pas de volume mesurable, donc 0), PAS un échec d'extraction : sans ce traitement
// explicite, ces mots-clés resteraient bloqués en boucle "à valider" indéfiniment et
// consommeraient à nouveau des crédits à chaque relance sans jamais aboutir (constaté :
// 8 candidats sur 10 avaient "volume": "NA" au premier essai réel).
function extractVolume(entry) {
  if (entry == null) return null;
  const v = entry.volume ?? entry.ads_volume ?? entry.search_volume ?? entry.metrics?.volume;
  if (v === 'NA') return 0;
  return typeof v === 'number' ? v : null;
}

// Appel bulk() avec repli automatique : si l'API rejette le lot (taille inconnue non
// testée en conditions réelles), on retente avec un lot deux fois plus petit avant
// d'abandonner ce sous-lot (jamais plus de 4 divisions, pour ne pas boucler indéfiniment
// sur une erreur non liée à la taille).
async function bulkAdaptive(keywords, depth = 0) {
  try {
    return await haloscan.bulk(keywords);
  } catch (e) {
    if (depth >= 4 || keywords.length <= 1) throw e;
    const mid = Math.ceil(keywords.length / 2);
    console.warn(`  [warn] échec bulk() sur lot de ${keywords.length} (${e.message}) — nouvel essai en 2 sous-lots.`);
    const [a, b] = await Promise.all([
      bulkAdaptive(keywords.slice(0, mid), depth + 1),
      bulkAdaptive(keywords.slice(mid), depth + 1),
    ]);
    const listA = Array.isArray(a) ? a : a.results || a.data || [];
    const listB = Array.isArray(b) ? b : b.results || b.data || [];
    return [...listA, ...listB];
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const payload = loadPayload();
  const candidates = payload.candidats;

  const pending = candidates.filter(c => c.statut === 'à valider');
  console.log(`Candidats en attente de validation : ${pending.length} / ${candidates.length}`);
  if (!pending.length) {
    console.log('Rien à valider.');
    return;
  }

  let creditRemaining = Infinity;
  if (!args.dryRun) {
    const credit = await haloscan.getCredit();
    creditRemaining = credit.totalCredit.creditBulkKeyword;
    console.log(`Crédit creditBulkKeyword disponible : ${creditRemaining}`);
    if (args.maxCredits !== Infinity) {
      console.log(`Plafond fixé pour ce run : ${args.maxCredits} crédits maximum.`);
    }
  } else {
    console.log('[dry-run] aucun appel réseau, aucune écriture du fichier réel — simulation en mémoire uniquement.');
  }

  const toProcess = pending.slice(0, args.limit);
  const batches = chunk(toProcess, args.batchSize);

  let processed = 0, retenu = 0, rejete = 0, sansVolume = 0;
  let costPerKeywordEstimate = null; // mesuré au premier lot réel, sert à budgeter la suite
  let debugDumped = false;
  let arreteParBudget = false;
  let creditSpentThisRun = 0;

  for (const batch of batches) {
    if (!args.dryRun && costPerKeywordEstimate != null) {
      const estCost = costPerKeywordEstimate * batch.length;
      if (creditRemaining - estCost < CREDIT_SAFETY_MARGIN) {
        console.log(`Pool creditBulkKeyword insuffisant pour continuer (reste ${creditRemaining}, lot suivant coûterait ~${estCost.toFixed(1)}) — arrêt propre, reprise possible plus tard (ou le mois prochain).`);
        arreteParBudget = true;
        break;
      }
      if (creditSpentThisRun + estCost > args.maxCredits) {
        console.log(`Plafond --max-credits atteint (${creditSpentThisRun.toFixed(1)}/${args.maxCredits} déjà dépensés, lot suivant coûterait ~${estCost.toFixed(1)}) — arrêt propre, relançable pour continuer au-delà de ce plafond.`);
        arreteParBudget = true;
        break;
      }
    }

    const keywords = batch.map(c => c.mot_cle_principal);
    let response;
    const creditBefore = creditRemaining;
    try {
      if (args.dryRun) {
        response = fakeBulkResponse(keywords);
      } else {
        response = await bulkAdaptive(keywords);
        if (!debugDumped) {
          fs.writeFileSync(DEBUG_SAMPLE_PATH, JSON.stringify(response, null, 2), 'utf8');
          debugDumped = true;
          console.log(`Échantillon de réponse brute écrit dans ${path.relative(process.cwd(), DEBUG_SAMPLE_PATH)} (à inspecter si "sans volume exploitable" apparaît ci-dessous).`);
        }
        const credit = await haloscan.getCredit();
        creditRemaining = credit.totalCredit.creditBulkKeyword;
        const consumed = creditBefore - creditRemaining;
        creditSpentThisRun += consumed;
        costPerKeywordEstimate = consumed / keywords.length;
        console.log(`Lot de ${keywords.length} mots-clés : ${consumed} crédits consommés (~${costPerKeywordEstimate.toFixed(2)}/mot-clé), reste ${creditRemaining} (cumul ce run : ${creditSpentThisRun.toFixed(1)}/${args.maxCredits === Infinity ? '∞' : args.maxCredits}).`);
      }
    } catch (e) {
      console.error(`Échec définitif du lot (${keywords.length} mots-clés) : ${e.message} — lot laissé 'à valider', réessayable plus tard.`);
      continue;
    }

    const byKeyword = new Map();
    const list = Array.isArray(response) ? response : response.results || response.data || [];
    for (const r of list) {
      const kw = r.keyword ?? r.mot_cle ?? null;
      // tolérant à la casse/espaces : le contrat exact de normalisation de Haloscan sur le
      // champ "keyword" renvoyé n'a jamais été observé (aucun appel payant fait à ce jour).
      if (kw) byKeyword.set(kw, r);
      if (kw) byKeyword.set(kw.trim().toLowerCase(), r);
    }

    let batchSansVolume = 0;
    for (const cand of batch) {
      const raw = byKeyword.get(cand.mot_cle_principal) ?? byKeyword.get(cand.mot_cle_principal.trim().toLowerCase());
      const volume = extractVolume(raw);
      if (volume == null) {
        sansVolume++;
        batchSansVolume++;
        console.warn(`  [warn] pas de volume exploitable pour "${cand.mot_cle_principal}" — laissé 'à valider' pour réessai après ajustement de extractVolume().`);
        continue;
      }
      cand.volume_estime = volume;
      cand.statut = volume >= args.minVolume ? 'retenu' : 'rejete';
      if (cand.statut === 'retenu') retenu++; else rejete++;
      processed++;
    }

    // Garde-fou crédits : si le tout premier lot RÉEL n'a produit AUCUN volume exploitable,
    // le format de réponse ne correspond probablement à aucun des champs devinés par
    // extractVolume() — mieux vaut arrêter immédiatement (l'échantillon debug ci-dessus donne
    // de quoi corriger) que de continuer à consommer le pool creditBulkKeyword lot après lot
    // sans rien extraire.
    if (!args.dryRun && batch === batches[0] && batchSansVolume === batch.length) {
      console.error(`Aucun volume exploitable sur le tout premier lot réel (${batch.length} mots-clés) — arrêt immédiat avant de consommer plus de crédits. Inspecter ${path.relative(process.cwd(), DEBUG_SAMPLE_PATH)} et ajuster extractVolume() avant de relancer.`);
      if (!args.dryRun) savePayload(payload);
      process.exitCode = 1;
      return;
    }

    if (!args.dryRun) savePayload(payload); // écrit après CHAQUE lot réel — jamais de perte si interrompu
  }

  console.log('---');
  console.log(`Traités : ${processed} (retenus : ${retenu}, rejetés : ${rejete}, sans volume exploitable : ${sansVolume})`);
  if (args.dryRun) {
    console.log(`[dry-run] restants 'à valider' simulés (non écrits sur disque) : ${candidates.filter(c => c.statut === 'à valider').length}`);
    console.log('[dry-run] terminé — AUCUNE donnée réelle modifiée (ni fichier, ni crédits). Relancer sans --dry-run pour un vrai run.');
  } else {
    console.log(`Restants 'à valider' : ${candidates.filter(c => c.statut === 'à valider').length}`);
    if (arreteParBudget) console.log('Arrêt anticipé : pool de crédits insuffisant pour un lot de plus (voir ci-dessus) — relançable dès reconstitution du pool.');
    console.log(`data/keywords/moteurs-candidats.json mis à jour. Étape suivante : python scripts/populate-tracking-xlsx.py puis python scripts/gen-maillage.py --all.`);
  }
}

main().catch(e => { console.error('[validate-moteurs] échec :', e); process.exit(1); });
