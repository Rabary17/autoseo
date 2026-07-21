#!/usr/bin/env node
// "Sauvetage" des candidats programmatiques rejetés (volume nul mesuré par bulk() — voir
// scripts/validate-moteurs-haloscan.js) : au lieu de les abandonner, cherche pour chacun la
// VRAIE formulation que les gens recherchent réellement autour de la même entité (ex.
// "alternateur alfa romeo stelvio d" rejeté -> peut-être "alfa romeo stelvio alternateur
// panne" a du volume), via les mêmes endpoints que le P1 (keywords/similar + match/questions/
// related), en réutilisant le filtrage anti-bruit déjà éprouvé (scripts/lib_js/keyword-enrich.js).
//
// Coût : keywords/similar coûte 1 creditKeyword par candidat tenté (pool à 9999, PAS le pool
// creditBulkKeyword à 500/mois de la validation) ; match/questions/related sont gratuits en
// pratique. Beaucoup moins contraignant que la validation elle-même.
//
// Usage :
//   node scripts/rescue-rejected-candidats.js --dry-run           vérifie la logique, 0 appel réseau
//   node scripts/rescue-rejected-candidats.js --limit 20          tente 20 candidats rejetés
//   node scripts/rescue-rejected-candidats.js --min-volume 10     seuil de volume pour "sauver" (défaut 10,
//                                                                  plus strict que la validation elle-même :
//                                                                  on ne remplace un rejet que par une
//                                                                  vraie alternative solide, pas un volume
//                                                                  marginal)
//
// Résultat par candidat rejeté tenté :
//   - une alternative pertinente et non dupliquée trouvée -> mot_cle_principal remplacé par la
//     vraie formulation, volume_estime mis à jour, statut repasse à 'retenu'
//   - rien trouvé (ou seulement des doublons avec un autre candidat/mot-clé éditorial déjà
//     existant) -> statut passe à 'rejete_definitif' (ne sera plus jamais retenté)
//
// Reprise : ne retraite jamais un candidat dont statut != 'rejete' exactement. Écriture sur
// disque après CHAQUE candidat traité (jamais de perte si interrompu).
const fs = require('fs');
const path = require('path');
const haloscan = require('./haloscan-client');
const { enrichSeed, mergeCandidates, significantTokens } = require('./lib_js/keyword-enrich');

const JSON_PATH = path.join(__dirname, '..', 'data', 'keywords', 'moteurs-candidats.json');
const DELAY_MS = 400;
const MIN_CREDIT_SAFETY = 100; // creditKeyword — arrêt de précaution, pool énorme (9999) donc rarement atteint

function parseArgs(argv) {
  const args = { dryRun: false, minVolume: 10, limit: Infinity };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--dry-run') args.dryRun = true;
    else if (argv[i] === '--min-volume') args.minVolume = Number(argv[++i]);
    else if (argv[i] === '--limit') args.limit = Number(argv[++i]);
  }
  return args;
}

function loadPayload() {
  return JSON.parse(fs.readFileSync(JSON_PATH, 'utf8'));
}
function savePayload(payload) {
  fs.writeFileSync(JSON_PATH, JSON.stringify(payload, null, 2), 'utf8');
}
async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function fakeRescue(keyword) {
  // dry-run : ~1 candidat sur 3 "trouve" une alternative fictive, pour exercer les deux branches
  const hash = keyword.length % 3;
  if (hash === 0) return null;
  return { keyword: `${keyword} panne symptome`, volume: 10 + keyword.length };
}

// Normalise pour comparaison insensible aux accents/casse/ponctuation, en conservant les
// codes alphanumériques collés (ex. "cx-5" -> tokens "cx","5" ; "l200" reste "l200" un seul bloc).
function stripAccents(s) {
  return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

// 2026-07-21 — CORRECTIF QUALITÉ (run à grande échelle) : le filtrage hérité de
// mergeCandidates() (scripts/lib_js/keyword-enrich.js) n'exige qu'UN SEUL mot significatif
// partagé avec l'original — souvent juste la MARQUE, commune à des dizaines de modèles.
// Constaté en conditions réelles : "batterie mazda cx-5" sauvé vers "mazda cx-60 prime-line"
// (mauvais modèle), "démarreur mini one" -> "voiture mini" (perte totale de spécificité),
// "pompe à eau bmw série 1" -> un résultat sur une Peugeot 106 sans rapport. Ce filtrage
// convient au P1 (enrichir un seed déjà large) mais PAS au sauvetage d'un candidat
// hyper-spécifique (marque + modèle précis) : une alternative "sauvée" doit impérativement
// conserver TOUS les tokens identifiants de l'entité d'origine (entite_source), pas juste la
// marque. Ex. "Mitsubishi L200" exige "mitsubishi" ET "l200" dans le candidat — une
// alternative qui ne garde que "mitsubishi" (ex. "mitsubishi captur") est rejetée.
function tokenize(s) {
  return stripAccents(s).split(/[^a-z0-9]+/).filter(Boolean);
}

function requiredEntityTokens(entiteSource) {
  return tokenize(entiteSource);
}

// Comparaison par ENSEMBLE DE TOKENS EXACTS, pas une sous-chaîne : un token court ("5" dans
// "CX-5", "B" dans "Classe B") ferait sinon un faux positif en sous-chaîne (ex. requis "b"
// matcherait n'importe quel mot contenant la lettre b) — testé et corrigé le 2026-07-21 après
// que "Mazda CX-5" ait initialement laissé passer "mazda cx-60" (le "5" isolé était filtré par
// une contrainte de longueur trop stricte du premier jet).
function candidateMatchesEntity(candidateKeyword, requiredTokens) {
  if (!requiredTokens.length) return true; // entite_source vide/inexploitable : pas de garde-fou possible
  const candTokens = new Set(tokenize(candidateKeyword));
  return requiredTokens.every(t => candTokens.has(t));
}

// 2e garde-fou, trouvé en auditant le run à grande échelle qui a suivi le premier correctif :
// vérifier l'ENTITÉ (véhicule/pays) ne suffit pas — le SUJET (prestation/angle : "péage",
// "fiabilité", "occasion"...) peut disparaître alors que l'entité reste correcte. Constaté :
// "péage andorre" sauvé vers "webcam andorre" (entité OK, sujet totalement différent),
// "péage islande" -> "islande" (perd le sujet, devient un terme touristique générique),
// "volkswagen passat fiabilité" -> "volkswagen passat" (perd la notion de fiabilité). On exige
// donc qu'AU MOINS UN des mots du mot-clé d'origine qui ne fait PAS partie de l'entité
// survive aussi dans le candidat (le sujet peut être reformulé, mais pas disparaître entièrement).
// Comparaison par PRÉFIXE (pas exacte) pour le sujet, contrairement à l'entité : le français a
// des variations morphologiques fréquentes (amortisseur/amortisseurs, changement/changer) qui
// casseraient une égalité stricte sur des reformulations pourtant valables. Mots de moins de 4
// lettres comparés en exact (un préfixe de 3 lettres ou moins serait trop permissif, ex. "pri"
// matcherait à tort "prime" alors que le sujet était "prix").
function stemMatches(topicToken, candTokenList) {
  if (topicToken.length < 4) return candTokenList.includes(topicToken);
  const prefix = topicToken.slice(0, 5);
  return candTokenList.some(c => c.length >= 4 && c.slice(0, 5) === prefix);
}

function candidateKeepsTopic(originalKeyword, candidateKeyword, entityTokens) {
  const entitySet = new Set(entityTokens);
  const topicTokens = tokenize(originalKeyword).filter(t => !entitySet.has(t));
  if (!topicTokens.length) return true; // mot-clé d'origine = entité seule, rien d'autre à préserver
  const candTokenList = tokenize(candidateKeyword);
  return topicTokens.some(t => stemMatches(t, candTokenList));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const payload = loadPayload();
  const candidates = payload.candidats;

  // Clés déjà utilisées par TOUT le reste (autres candidats + editoriaux via mot_cle_principal
  // déjà chargé dans moteurs-candidats.json) — anti-cannibalisation : une alternative "sauvée"
  // ne doit jamais dupliquer une URL déjà prise.
  const usedKeys = new Set(candidates.map(c => norm_key(c.mot_cle_principal)));

  function norm_key(s) {
    return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, ' ').trim();
  }

  const pending = candidates.filter(c => c.statut === 'rejete');
  console.log(`Candidats rejetés en attente de sauvetage : ${pending.length} / ${candidates.length}`);
  if (!pending.length) {
    console.log('Rien à sauver.');
    return;
  }

  if (!args.dryRun) {
    const credit = await haloscan.getCredit();
    console.log(`Crédit creditKeyword disponible : ${credit.totalCredit.creditKeyword}`);
    if (credit.totalCredit.creditKeyword < MIN_CREDIT_SAFETY) {
      console.error(`Arrêt : crédit creditKeyword trop bas (< ${MIN_CREDIT_SAFETY}).`);
      process.exit(1);
    }
  } else {
    console.log('[dry-run] aucun appel réseau, aucune écriture réelle — simulation en mémoire uniquement.');
  }

  const toProcess = pending.slice(0, args.limit);
  let sauves = 0, definitifs = 0, doublonsEcartes = 0, erreurs = 0;

  for (const cand of toProcess) {
    const original = cand.mot_cle_principal;
    const requiredTokens = requiredEntityTokens(cand.entite_source);
    let bestAlt;
    try {
      if (args.dryRun) {
        bestAlt = fakeRescue(original);
      } else {
        const [similarRes, enriched] = await Promise.all([
          haloscan.similar(original).catch(() => ({ results: [] })),
          enrichSeed(original),
        ]);
        const merged = mergeCandidates(original, [
          { source: 'similar', results: similarRes.results },
        ]).concat(enriched);
        const seen = new Set();
        const pool = [];
        for (const c of merged) {
          const k = norm_key(c.keyword);
          if (seen.has(k)) continue;
          if (!candidateMatchesEntity(c.keyword, requiredTokens)) continue; // garde-fou entité (voir commentaire plus haut)
          if (!candidateKeepsTopic(original, c.keyword, requiredTokens)) continue; // garde-fou sujet (idem)
          seen.add(k);
          pool.push(c);
        }
        pool.sort((a, b) => (b.volume ?? 0) - (a.volume ?? 0));
        bestAlt = pool.find(c => (c.volume ?? 0) >= args.minVolume) || null;
      }
    } catch (e) {
      console.error(`  [erreur] "${original}" : ${e.message} — laissé 'rejete', réessayable plus tard.`);
      erreurs++;
      continue;
    }

    if (bestAlt) {
      const newKey = norm_key(bestAlt.keyword);
      if (usedKeys.has(newKey)) {
        console.log(`  [doublon écarté] "${original}" -> "${bestAlt.keyword}" existe déjà ailleurs — marqué rejete_definitif.`);
        cand.statut = 'rejete_definitif';
        doublonsEcartes++;
      } else {
        console.log(`  [sauvé] "${original}" -> "${bestAlt.keyword}" (volume ${bestAlt.volume})`);
        cand.note = `${cand.note ? cand.note + ' ; ' : ''}Sauvé depuis "${original}" (volume nul) via keywords/similar+match/questions/related.`;
        cand.mot_cle_principal = bestAlt.keyword;
        cand.volume_estime = bestAlt.volume;
        cand.statut = 'retenu';
        usedKeys.add(newKey);
        sauves++;
      }
    } else {
      cand.statut = 'rejete_definitif';
      definitifs++;
    }

    if (!args.dryRun) {
      savePayload(payload);
      await sleep(DELAY_MS);
    }
  }

  console.log('---');
  console.log(`Traités : ${toProcess.length} (sauvés : ${sauves}, définitivement rejetés : ${definitifs}, doublons écartés : ${doublonsEcartes}, erreurs : ${erreurs})`);
  if (args.dryRun) {
    console.log('[dry-run] terminé — AUCUNE donnée réelle modifiée.');
  } else {
    console.log(`Restants 'rejete' à tenter : ${candidates.filter(c => c.statut === 'rejete').length}`);
    console.log('data/keywords/moteurs-candidats.json mis à jour. Relancer scripts/validate-moteurs-haloscan.js n\'est PAS nécessaire pour les candidats sauvés (déjà "retenu" avec un vrai volume) — enchaîner directement populate-tracking-xlsx.py puis gen-maillage.py --all.');
  }
}

main().catch(e => { console.error('[rescue] échec :', e); process.exit(1); });
