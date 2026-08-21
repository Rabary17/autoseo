// Assainissement du contenu traduit, avant gating et avant insertion WordPress
// (2026-08-18). Chaque fonction ici corrige un defaut CONSTATE au premier lot
// reel du silo pilote (log i18n-en-pilote.log), jamais un defaut theorique.

function stripHtmlToText(html) {
  return String(html || '').replace(/<!--[\s\S]*?-->/g, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function countWords(html) {
  const t = stripHtmlToText(html);
  return t ? t.split(' ').filter(Boolean).length : 0;
}

/* ---------- 1. Fourchette de longueur relative a la source ---------- */

// Defaut constate : 11 contenus sur 25 rejetes pour « trop court », alors
// qu'aucun n'etait maigre. Mesure faite sur 5 paires FR/EN : l'anglais pese
// systematiquement 82 a 93 % du francais (89 % en moyenne) — l'anglais est
// structurellement plus dense. Le plancher absolu du gating francais (900 mots
// pour un article, 1300 pour un sous-hub) est donc la MAUVAISE regle appliquee
// a une traduction : il mesure une quantite absolue quand ce qui compte est la
// FIDELITE a la source. Une traduction de 869 mots d'un article de 975 mots est
// complete ; une traduction de 400 mots du meme article a perdu des sections.
//
// D'ou une fourchette derivee de la source. Plancher a 75 % : laisse passer la
// densification normale (jusqu'a -25 %, au-dela du pire cas observe) tout en
// detectant une vraie perte de contenu. Plafond a 130 % : detecte le modele qui
// s'est mis a broder au lieu de traduire.
const RATIO_MIN = 0.75;
const RATIO_MAX = 1.30;

function lengthRangeFromSource(sourceHtml) {
  const src = countWords(sourceHtml);
  if (!src) return null;
  return [Math.round(src * RATIO_MIN), Math.round(src * RATIO_MAX)];
}

/* ---------- 2. Reparation des blocs Gutenberg ---------- */

// Defaut constate sur 3 contenus : le prompt exige de recopier les
// commentaires de bloc a l'identique, le modele ne le fait pas toujours
// (« bloc "image" ferme par "/wp:heading" »). Meme classe de defaillance que
// la boucle de relecture francaise qui annonce des corrections non appliquees
// (voir lib/maillage-repair.js) : quand une regle est mecaniquement
// verifiable, on ne la delegue pas au modele.
//
// Le defaut est invisible a l'ecran (le HTML rendu reste valide) mais casse la
// re-edition du bloc dans l'editeur WordPress. Reparable sans ambiguite : la
// pile des blocs ouverts dit exactement quel commentaire de fermeture etait
// attendu.
// Delegue au module commun scripts/autopublish/lib/content-repair.js : la
// reparation etait definie ici alors que le pipeline FRANCAIS souffre du meme
// defaut. Remontee au niveau commun le 2026-08-21 pour ne pas maintenir deux
// implementations divergentes.
const { repairGutenbergBlocks } = require('../../autopublish/lib/content-repair');

/* ---------- 3. Ecretage des champs meta ---------- */

// Defaut constate : WordPress REJETTE l'insertion en HTTP 400 quand
// acf[meta_title] depasse 60 caracteres (contrainte declaree cote ACF). Un
// article entierement traduit et paye a ete perdu pour ce seul motif
// (van-fourgon-amenage). Le gating l'avait bien signale, mais APRES la
// depense et sans empecher l'appel WordPress.
//
// Ecretage sur une frontiere de mot : une meta coupee en plein milieu d'un mot
// est un defaut deja rencontre plusieurs fois cote francais (voir STATE.md
// 2026-08-03, `maxLength` structurel).
const META_TITLE_MAX = 60;
const META_DESCRIPTION_MAX = 155;

// Coupe d'abord sur une FIN DE PHRASE, seulement ensuite sur un mot.
// Constate le 2026-08-18 : une coupe sur frontiere de mot produisait
// « ... €4 excess per trip, capped at », une proposition laissee en suspens.
// Ce n'est pas coupe en plein mot, mais ca se lit aussi mal — et une
// meta-description tronquee au milieu d'une clause est visible dans les
// resultats de recherche. Une phrase complete plus courte vaut mieux qu'une
// phrase longue amputee.
function clipAtWordBoundary(s, max) {
  const str = String(s || '').trim();
  if (str.length <= max) return str;
  const coupe = str.slice(0, max);

  // Derniere ponctuation de fin de phrase, si elle laisse un texte encore
  // substantiel (60 % de la longueur cible) : en dessous, on perdrait trop
  // d'information et la coupe sur mot reste preferable.
  const finPhrase = Math.max(coupe.lastIndexOf('. '), coupe.lastIndexOf('! '), coupe.lastIndexOf('? '));
  if (finPhrase > max * 0.6) return coupe.slice(0, finPhrase + 1);
  // Point final colle a la fin de la coupe (pas suivi d'espace).
  if (/[.!?]$/.test(coupe) && coupe.length > max * 0.6) return coupe;

  const dernierEspace = coupe.lastIndexOf(' ');
  return (dernierEspace > max * 0.6 ? coupe.slice(0, dernierEspace) : coupe).replace(/[\s,;:.–-]+$/, '');
}

function clipMetaFields(traduit) {
  const clips = [];
  if ((traduit.meta_title || '').length > META_TITLE_MAX) {
    const avant = traduit.meta_title.length;
    traduit.meta_title = clipAtWordBoundary(traduit.meta_title, META_TITLE_MAX);
    clips.push(`meta_title ecrete de ${avant} a ${traduit.meta_title.length} caracteres`);
  }
  if ((traduit.meta_description || '').length > META_DESCRIPTION_MAX) {
    const avant = traduit.meta_description.length;
    traduit.meta_description = clipAtWordBoundary(traduit.meta_description, META_DESCRIPTION_MAX);
    clips.push(`meta_description ecretee de ${avant} a ${traduit.meta_description.length} caracteres`);
  }
  return clips;
}

/* ---------- 4. Nouvelle tentative sur echec reseau ---------- */

// Defaut constate : 2 articles perdus sur « fetch failed » (echec reseau
// transitoire, cote Mistral ou WordPress). wp-client retente deja ses propres
// appels, mais rien ne retentait l'ENCHAINEMENT traduction + insertion.
const MOTIFS_TRANSITOIRES = /fetch failed|ECONNRESET|ETIMEDOUT|socket hang up|HTTP 5\d\d|429/i;

async function withRetry(fn, { tentatives = 3, attenteMs = 3000, log = () => {} } = {}) {
  let derniere;
  for (let i = 1; i <= tentatives; i++) {
    try {
      return await fn();
    } catch (e) {
      derniere = e;
      if (!MOTIFS_TRANSITOIRES.test(e.message) || i === tentatives) throw e;
      log(`echec transitoire (${e.message}) — nouvelle tentative ${i + 1}/${tentatives} dans ${attenteMs / 1000}s`);
      await new Promise(r => setTimeout(r, attenteMs));
    }
  }
  throw derniere;
}

module.exports = {
  countWords, lengthRangeFromSource, repairGutenbergBlocks,
  clipMetaFields, clipAtWordBoundary, withRetry,
  RATIO_MIN, RATIO_MAX, META_TITLE_MAX, META_DESCRIPTION_MAX,
};
