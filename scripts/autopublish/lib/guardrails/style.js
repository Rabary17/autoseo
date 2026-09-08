// Porté depuis tonton-maj-v2/src/utils/stylePatterns.js (projet distinct du
// même utilisateur, un outil de mise à jour d'articles) — voir le plan MVP
// multi-niche du 2026-09-08. Ce fichier ne garde QUE les fonctions qui
// n'opèrent que sur une chaîne HTML (aucun `document`/DOM requis) : phrases
// trop longues, phrases amputées (artefact de troncature IA), sur-
// optimisation du mot-clé dans les H2, élisions orphelines. Les fonctions
// qui exigent un vrai DOM côté Tonton AI (densité de gras par section,
// réparation de structure) ne sont volontairement PAS portées ici — elles
// auraient introduit jsdom comme dépendance de production pour un gain
// marginal, alors que tout le reste de scripts/autopublish/ est 100% regex.
// Volontairement pas porté non plus : detectStylePatterns et ses listes
// VERBES_INTERDITS/PARTICIPES/CLICHES/META — un vrai guide de style éditorial
// mérite sa propre décision, pas une importation silencieuse de la liste
// d'un autre projet.
//
// Non bloquant partout : comme dans Tonton AI, ce sont des CONSTATS remontés
// au rapport (voir index.js), jamais un motif de rejet du gating.

/** Texte brut d'un fragment HTML, balises retirées, espaces normalisés. */
const texteDe = (html = '') =>
  String(html)
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&(?:nbsp|#160);/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&(?:lt|gt|quot|#\d+);/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const FIN_DE_BLOC = ' ¶ ';

/** Texte avec une frontière de phrase à chaque fin de bloc (titre, <br>, </p>...). */
const texteParBlocs = (html = '') =>
  texteDe(
    String(html)
      .replace(/<h[1-6][^>]*>[\s\S]*?<\/h[1-6]>/gi, FIN_DE_BLOC)
      .replace(/<br\s*\/?>/gi, FIN_DE_BLOC)
      .replace(/<\/(p|h[1-6]|li|td|th|dt|dd|div|section|article|blockquote|figcaption|summary|details|tr|caption)\s*>/gi, FIN_DE_BLOC),
  );

/** Découpe en phrases exploitables (au moins trois mots). */
const phrasesDe = (texte = '') =>
  texte
    .split(/(?<=[.!?…])\s+|\s*¶\s*/)
    .map((p) => p.trim())
    .filter((p) => p.split(/\s+/).length >= 3);

/** Retire ce qui n'est PAS de la prose : tableaux, listes, FAQ. */
const retireHorsProse = (html = '') =>
  String(html)
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<table\b[\s\S]*?<\/table>/gi, ' ')
    .replace(/<(ul|ol|dl)\b[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<details\b[\s\S]*?<\/details>/gi, ' ');

/** Phrases de la PROSE seule — la seule base honnête pour juger une longueur. */
const phrasesDeProse = (html = '') => phrasesDe(texteParBlocs(retireHorsProse(html)));

const MOTS_MAX_PHRASE = 20;

/** Phrases dépassant le plafond — constat, jamais un motif de rejet. */
function phrasesTropLongues(html = '') {
  return phrasesDeProse(html)
    .map((p) => ({ extrait: p, mots: p.split(/\s+/).length }))
    .filter((o) => o.mots > MOTS_MAX_PHRASE)
    .sort((a, b) => b.mots - a.mots);
}

const LIGNE_EXTRAIT = (texte, motif) => {
  const i = texte.indexOf(motif);
  if (i < 0) return motif.trim();
  let debut = Math.max(0, i - 60);
  let fin = Math.min(texte.length, i + motif.length + 60);
  while (debut > 0 && /\S/.test(texte[debut - 1])) debut -= 1;
  while (fin < texte.length && /\S/.test(texte[fin])) fin += 1;
  return texte.slice(debut, fin).trim();
};

const MOTS_SUSPENDUS = [
  'à', 'de', 'du', 'des', 'en', 'dans', 'sur', 'sous', 'par', 'pour', 'vers', 'chez',
  'avec', 'sans', 'entre', 'depuis', 'pendant', 'selon', 'malgré', 'dès', 'jusqu',
  'le', 'la', 'les', 'un', 'une', 'ce', 'cet', 'cette', 'ces', 'son', 'sa', 'ses',
  'leur', 'leurs', 'mon', 'ma', 'mes', 'notre', 'nos', 'votre', 'vos', 'au', 'aux',
  'et', 'ou', 'mais', 'car', 'donc', 'ni', 'que', 'qui', 'dont', 'quand', 'comme',
  'est', 'sont', 'était', 'étaient', 'a', 'ont', 'avait', 'avaient', 'sera', 'seront',
];

const ABREVIATIONS = ['etc', 'cf', 'ex', 'env', 'av', 'ap', 'M', 'Mme', 'Dr', 'no', 'nº', 'vs', 'p'];

/**
 * PHRASES AMPUTÉES — artefact de troncature IA. Motifs syntaxiquement
 * impossibles en français (fin sur un mot qui exige une suite, ponctuation
 * fusionnée, reprise en minuscule après un point) — jamais de jugement
 * éditorial requis, donc pas de faux positif sur de la prose correcte.
 */
function phrasesCoupees(html = '') {
  const out = [];
  const vu = new Set();
  const ajoute = (motif, extrait, terme = '') => {
    const cle = `${motif}::${extrait}`;
    if (vu.has(cle)) return;
    vu.add(cle);
    out.push({ motif, extrait, terme });
  };

  const prose = retireHorsProse(html);
  const continu = texteDe(prose);

  (continu.match(/\p{L}+\s*[.!?…]\s*[,;:]\s*\p{L}+/giu) || []).forEach((m) => {
    ajoute('ponctuation', LIGNE_EXTRAIT(continu, m), m.trim());
  });

  phrasesDeProse(html).forEach((phrase) => {
    const mots = phrase.split(/\s+/).filter(Boolean);
    if (!mots.length) return;
    const dernier = mots[mots.length - 1].replace(/[.!?…,;:»)\]]+$/u, '').toLowerCase();
    if (dernier && MOTS_SUSPENDUS.includes(dernier.replace(/['’]$/u, ''))) {
      ajoute('suspendue', phrase, dernier);
    }
  });

  (continu.match(/\p{L}{2,}[.!?]\s+\p{Ll}\p{L}+/gu) || []).forEach((m) => {
    const avant = m.split(/[.!?]/u)[0];
    if (ABREVIATIONS.includes(avant)) return;
    if (/\d/u.test(m)) return;
    ajoute('minuscule', LIGNE_EXTRAIT(continu, m), m.trim());
  });

  return out;
}

const MOTIFS_COUPURE = {
  suspendue: 'Phrase finissant sur un mot qui exige une suite',
  ponctuation: 'Ponctuation fusionnée (« complète., elle »)',
  minuscule: 'Reprise en minuscule après un point',
};

const MAX_H2_AVEC_MOT_CLE = 2;
const echappe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Sur-optimisation du mot-clé principal — chiffrée, notamment via les H2. */
function suroptimisationMotCle(html = '', motCle = '') {
  const cle = String(motCle || '').trim();
  const vide = { exact: 0, densite: 0, h2Total: 0, h2AvecMotCle: 0, excesH2: 0 };
  if (!cle) return vide;
  const texte = texteDe(html);
  const mots = texte ? texte.split(/\s+/).length : 0;
  const motif2 = cle.split(/\s+/).map(echappe).join('\\s+');
  const exact = (texte.match(new RegExp(motif2, 'giu')) || []).length;
  const titres = String(html).match(/<h2\b[^>]*>[\s\S]*?<\/h2>/gi) || [];
  const rxTitre = new RegExp(motif2, 'iu');
  const h2AvecMotCle = titres.filter((h) => rxTitre.test(texteDe(h))).length;
  return {
    exact,
    densite: mots ? +((exact / mots) * 100).toFixed(2) : 0,
    h2Total: titres.length,
    h2AvecMotCle,
    excesH2: Math.max(0, h2AvecMotCle - MAX_H2_AVEC_MOT_CLE),
  };
}

/**
 * ÉLISIONS ORPHELINES — « face à l' toiture ». Détection seulement, jamais de
 * réparation automatique (corriger exige de connaître le genre).
 */
function elisionsOrphelines(html = '') {
  const texte = texteDe(retireHorsProse(html));
  return texte.match(/\b[ldnjcmts]['’]\s+\p{L}+/giu) || [];
}

module.exports = {
  texteDe,
  texteParBlocs,
  phrasesDe,
  retireHorsProse,
  phrasesDeProse,
  MOTS_MAX_PHRASE,
  phrasesTropLongues,
  phrasesCoupees,
  MOTIFS_COUPURE,
  MAX_H2_AVEC_MOT_CLE,
  suroptimisationMotCle,
  elisionsOrphelines,
};
