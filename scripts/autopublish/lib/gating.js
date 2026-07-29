// Vérification programmatique des 9 règles de blocage — voir
// skills/wordpress-publication.md section 5. Aucun appel IA supplémentaire :
// tout est vérifiable depuis des données déjà en main (contenu généré/relu,
// ligne de suivi, entrée de maillage, faits fournis au prompt). Un contenu
// qui échoue une seule règle reste en `draft`, jamais publié "quand même".
const similarity = require('./similarity');
const persona = require('./persona');

// Hub/sous-hub : plancher ferme, plafond large plutôt qu'une fourchette
// stricte — un silo à peu de sous-hubs/articles doit quand même atteindre le
// plancher (voir system-hub.md/system-sous-hub.md, contenu complémentaire
// utile plutôt que du remplissage), et un silo large qui dépasse 4000/2500
// mots légitimement ne doit pas être bloqué pour ça (voir STATE.md 2026-07-22).
const LENGTH_RANGES = {
  hub: [1300, 6000],
  'sous-hub': [1300, 4000],
  // Cible de génération 1500-2500 (voir system-article.md), mais seuil de
  // blocage plus tolérant côté gating (demande explicite de l'utilisateur
  // 2026-07-29) : un article > 900 mots avec du contenu réellement
  // substantiel (pas de remplissage détecté par les autres règles) ne doit
  // pas être rejeté juste pour ne pas avoir atteint 1500 pile.
  article: [900, 2500],
  'article-editorial': [1500, 2500],
};

const SIMILARITY_THRESHOLD = 0.20;

function stripHtmlToText(html) {
  return html.replace(/<!--[\s\S]*?-->/g, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function countWords(html) {
  const text = stripHtmlToText(html);
  return text.length ? text.split(' ').filter(Boolean).length : 0;
}

// Motifs de donnée chiffrée "sensible" (prix, %, durée, distance) — sert
// uniquement de heuristique pour la règle 4 (faits non inventés), pas une
// détection exhaustive de tout chiffre présent dans le texte.
const NUMERIC_CLAIM_PATTERN = /\d+(?:[.,]\d+)?\s?(€|%|km|kms|kilom[eè]tres|ans?|mois|jours?|heures?|h\b)/i;

function hasNumericClaim(text) {
  return NUMERIC_CLAIM_PATTERN.test(text);
}

// Tiret cadratin espacé (U+2014, " — "), jamais autorisé dans le texte
// généré (demande explicite de l'utilisateur, 2026-07-22) — à ne pas
// confondre avec le tiret court U+2013 ("–") légitime dans une fourchette de
// prix ("50 – 180 €"), volontairement exclu de ce motif. Étendu le 2026-07-28
// à meta_title/meta_description/title (audit WXR : trouvé dans un meta_title
// alors que la règle n'avait jamais été vérifiée que sur content_gutenberg —
// ces champs suivent les mêmes règles de style depuis qu'ils sont réellement
// publiés, voir STATE.md).
const EM_DASH_PATTERN = /\s—\s/;

function checkNoEmDash(content) {
  const fields = [content.content_gutenberg, content.title, content.meta_title, content.meta_description];
  return fields.every((f) => !EM_DASH_PATTERN.test(stripHtmlToText(f || '')));
}

// Caractères hors script latin (CJK, hangul, kana...) constatés à deux
// reprises le 2026-07-28 dans des meta_title tronqués par `maxLength`
// (probable artefact de troncature en plein milieu d'un token multi-octets
// côté Mistral) — jamais légitime dans du contenu francophone.
const FOREIGN_SCRIPT_PATTERN = /[一-鿿぀-ヿ가-힯]/;

function checkNoForeignScript(content) {
  const fields = [content.title, content.meta_title, content.meta_description, content.content_gutenberg];
  const offending = fields.filter((f) => FOREIGN_SCRIPT_PATTERN.test(f || ''));
  return { ok: offending.length === 0 };
}

// Valide l'appariement des commentaires de bloc Gutenberg (<!-- wp:X -->/
// <!-- /wp:X -->) — constaté le 2026-07-28 (audit WXR) sur 58/137 pages
// publiées : un `<!-- wp:heading -->` fermé par `<!-- /wp:paragraph -->` (ou
// l'inverse), invisible à l'écran (le HTML brut reste valide) mais casse la
// ré-édition du bloc dans l'éditeur WordPress. Détection par pile, pas par
// simple comptage — un décalage doit être associé au bon endroit.
function checkGutenbergBlocksWellFormed(content) {
  const html = content.content_gutenberg || '';
  const markers = html.match(/<!--\s*\/?wp:[a-z-]+(?:\s+\{[^}]*\})?\s*-->/g) || [];
  const stack = [];
  const mismatches = [];
  for (const marker of markers) {
    const closeMatch = marker.match(/<!--\s*\/wp:([a-z-]+)/);
    const openMatch = marker.match(/<!--\s*wp:([a-z-]+)/);
    if (closeMatch) {
      const expected = stack.pop();
      if (expected && expected !== closeMatch[1]) {
        mismatches.push(`bloc "${expected}" fermé par "/wp:${closeMatch[1]}"`);
      }
    } else if (openMatch) {
      stack.push(openMatch[1]);
    }
  }
  return { ok: mismatches.length === 0, mismatches };
}

// Ouverture générique bannie depuis le 2026-07-24 dans style-anti-ia.md
// ("Ce silo/sous-cocon réunit/rassemble/regroupe...") mais constatée encore
// deux fois sur 137 pages lors de l'audit WXR du 2026-07-28 — la relecture
// (jugement humain par le modèle) ne l'a pas rattrapée à chaque fois. Motif
// assez précis pour un vrai garde-fou programmatique, contrairement à
// l'ancre forcée (trop variable en formulation pour une regex fiable).
const GENERIC_HUB_OPENING_PATTERN = /\bce (silo|sous-cocon|cocon)\b[^.!?]{0,40}\b(r[ée]unit|rassemble|regroupe)\b/i;

function checkNoGenericOpening(content, contentType) {
  if (contentType !== 'hub' && contentType !== 'sous-hub') return true;
  return !GENERIC_HUB_OPENING_PATTERN.test(stripHtmlToText(content.content_gutenberg || '').slice(0, 500));
}

/* ---------- Règles individuelles ---------- */

function checkParentPublished(parentPublished) {
  return parentPublished !== false; // true ou undefined (hub sans parent) => ok
}

function checkClusterNotDuplicated(clusterRow, trackingRows) {
  if (!clusterRow || !trackingRows) return true;
  return !trackingRows.some(
    r =>
      r !== clusterRow &&
      r.mot_cle_principal === clusterRow.mot_cle_principal &&
      r.url_cible &&
      clusterRow.url_cible &&
      r.url_cible !== clusterRow.url_cible &&
      ['programmé', 'publié'].includes(r.statut)
  );
}

function checkSimilarity(content, silo, sousCocon) {
  const { max, against } = similarity.maxSimilarity(content.content_gutenberg, silo, sousCocon);
  return { ok: max < SIMILARITY_THRESHOLD, max, against };
}

function checkFactsNotInvented(content, factsProvided) {
  const text = stripHtmlToText(content.content_gutenberg) + ' ' + (content.faq || []).map(f => f.answer).join(' ');
  const hasClaim = hasNumericClaim(text);
  if (!hasClaim) return { ok: true };
  if (!factsProvided || factsProvided.length === 0) {
    return { ok: false, reason: 'Donnée chiffrée présente dans le texte alors qu\'aucun fait n\'a été fourni au prompt.' };
  }
  if ((content.sources || []).length === 0) {
    return { ok: false, reason: 'Donnée chiffrée présente mais aucune source citée dans sources[].' };
  }
  return { ok: true };
}

// La FAQ ne doit exister QUE dans faq[] — le frontend la rend séparément
// (FaqSection + JSON-LD FAQPage, voir components/FaqSection.tsx), donc la
// recopier aussi en section visible du corps produit une FAQ dupliquée à
// l'écran. Jusqu'au 2026-07-24 la règle exigeait l'inverse (miroir strict
// obligatoire) — inversée après avoir constaté la duplication en conditions
// réelles sur les hubs/sous-hubs publiés le 2026-07-22 (voir STATE.md).
// Détection par titre de section plutôt que par substring de chaque question :
// une correspondance partielle de phrase dans une page qui aborde légitimement
// un sujet proche donnerait de faux positifs, alors que le vrai bug se
// manifeste toujours par un vrai H2/H3 "Questions fréquentes" redondant.
const FAQ_HEADING_PATTERN = /questions?\s+fr[ée]quentes?|foire\s+aux\s+questions/i;

function checkFaqNotDuplicated(content) {
  if (!(content.faq || []).length) return { ok: true };
  const text = stripHtmlToText(content.content_gutenberg || '');
  return { ok: !FAQ_HEADING_PATTERN.test(text) };
}

function checkSeoFields(content) {
  const reasons = [];
  if (!content.meta_title || content.meta_title.length > 60) reasons.push('meta_title vide ou > 60 caractères');
  if (!content.meta_description || content.meta_description.length > 155) reasons.push('meta_description vide ou > 155 caractères');
  if (!content.tags || content.tags.length < 1 || content.tags.length > 5) reasons.push('tags absents ou hors plage 1-5');
  return { ok: reasons.length === 0, reasons };
}

function checkLength(content, contentType, lengthRangeOverride) {
  const [min, max] = lengthRangeOverride || LENGTH_RANGES[contentType] || LENGTH_RANGES.article;
  const words = countWords(content.content_gutenberg);
  return { ok: words >= min && words <= max, words, min, max };
}

// Le champ `source` des faits (data/factuel/*.json) contient parfois une
// mention de méthodologie interne ("recoupé avec X et Y", "consulté le...")
// destinée à la traçabilité, jamais à être publiée telle quelle (demande
// explicite de l'utilisateur, 2026-07-22) — sources[].label doit rester un
// simple nom de source.
const SOURCE_COMMENTARY_PATTERN = /recoup[ée]|vérifié aupr[eè]s|consult[ée] le/i;

// Vérifie sources[].label ET le corps du texte lui-même : constaté en
// publication réelle le 2026-07-22 que le modèle recopie ce commentaire dans
// une légende de tableau (figcaption) plutôt que dans sources[] — les deux
// emplacements doivent être propres.
function checkSourceLabelsClean(content) {
  const offendingLabels = (content.sources || []).filter(s => SOURCE_COMMENTARY_PATTERN.test(s.label || ''));
  const bodyText = stripHtmlToText(content.content_gutenberg || '');
  const offendingBody = SOURCE_COMMENTARY_PATTERN.test(bodyText);
  return { ok: offendingLabels.length === 0 && !offendingBody, offendingLabels, offendingBody };
}

function checkYmylSource(content, silo) {
  if (!persona.isYmylSilo(silo)) return { ok: true };
  return { ok: (content.sources || []).length > 0, reason: 'Silo YMYL sans source officielle citée dans sources[].' };
}

function checkMaillageResolved(contentType, maillageEntry, childLinksCount) {
  if (contentType === 'article') return !!maillageEntry;
  return (childLinksCount ?? 0) > 0;
}

/* ---------- Orchestration ---------- */

function runGating({
  contentType,
  silo,
  sousCocon,
  content,
  clusterRow,
  trackingRows,
  maillageEntry,
  childLinksCount,
  parentPublished,
  factsProvided,
  lengthRange,
}) {
  const failures = [];

  if (!checkParentPublished(parentPublished)) {
    failures.push({ rule: 'parent_publie', message: 'Le hub/sous-hub parent n\'est pas encore publié.' });
  }

  if (contentType === 'article' && !checkClusterNotDuplicated(clusterRow, trackingRows)) {
    failures.push({ rule: 'cluster_duplique', message: 'Cluster déjà couvert par une autre URL programmée/publiée.' });
  }

  // Règle documentée (wordpress-publication.md section 5) : uniqueness
  // s'applique entre articles d'un même sous-cocon, jamais entre un article
  // et son propre hub/sous-hub parent (qui résume forcément leur vocabulaire
  // — comparer les deux ferait échouer tout premier lot d'articles d'un
  // sous-cocon, constaté en test réel le 2026-07-29).
  if (contentType === 'article') {
    const sim = checkSimilarity(content, silo, sousCocon);
    if (!sim.ok) {
      failures.push({
        rule: 'similarite',
        message: `Similarité ${(sim.max * 100).toFixed(1)}% avec "${sim.against}" (seuil ${SIMILARITY_THRESHOLD * 100}%).`,
      });
    }
  }

  const facts = checkFactsNotInvented(content, factsProvided);
  if (!facts.ok) failures.push({ rule: 'faits_non_inventes', message: facts.reason });

  const faq = checkFaqNotDuplicated(content);
  if (!faq.ok) failures.push({ rule: 'schema_coherent', message: 'FAQ dupliquée : une section "Questions fréquentes" apparaît dans le corps alors que faq[] est déjà renseigné.' });

  const seo = checkSeoFields(content);
  if (!seo.ok) failures.push({ rule: 'champs_seo', message: seo.reasons.join('; ') });

  const length = checkLength(content, contentType, lengthRange);
  if (!length.ok) {
    failures.push({
      rule: 'longueur',
      message: `${length.words} mots, attendu entre ${length.min} et ${length.max}.`,
    });
  }

  const sourceLabels = checkSourceLabelsClean(content);
  if (!sourceLabels.ok) {
    const parts = [];
    if (sourceLabels.offendingLabels.length) {
      parts.push(`sources[] : ${sourceLabels.offendingLabels.map(s => `"${s.label}"`).join(', ')}`);
    }
    if (sourceLabels.offendingBody) parts.push('texte du corps (ex. légende de tableau)');
    failures.push({ rule: 'sources_propres', message: `Commentaire de méthodologie repéré dans ${parts.join(' ; ')}.` });
  }

  if (!checkNoEmDash(content)) {
    failures.push({ rule: 'tiret_cadratin', message: 'Tiret cadratin espacé (" — ") détecté dans le contenu — interdit.' });
  }

  const foreignScript = checkNoForeignScript(content);
  if (!foreignScript.ok) {
    failures.push({ rule: 'script_etranger', message: 'Caractère hors script latin (CJK/hangul/kana) détecté dans le titre ou les champs meta — jamais légitime en contenu francophone.' });
  }

  const blocks = checkGutenbergBlocksWellFormed(content);
  if (!blocks.ok) {
    failures.push({ rule: 'blocs_gutenberg', message: `Bloc(s) Gutenberg mal fermé(s) : ${blocks.mismatches.join(' ; ')}.` });
  }

  if (!checkNoGenericOpening(content, contentType)) {
    failures.push({ rule: 'ouverture_generique', message: 'Ouverture générique bannie ("Ce silo/sous-cocon réunit/rassemble/regroupe...") détectée.' });
  }

  const ymyl = checkYmylSource(content, silo);
  if (!ymyl.ok) failures.push({ rule: 'source_ymyl', message: ymyl.reason });

  if (!checkMaillageResolved(contentType, maillageEntry, childLinksCount)) {
    failures.push({ rule: 'maillage_resolu', message: 'Maillage non résolu (entrée maillage.json absente ou liens descendants vides).' });
  }

  return { passed: failures.length === 0, failures };
}

module.exports = { runGating, LENGTH_RANGES, SIMILARITY_THRESHOLD, countWords, stripHtmlToText };
