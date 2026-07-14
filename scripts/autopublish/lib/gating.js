// Vérification programmatique des 9 règles de blocage — voir
// skills/wordpress-publication.md section 5. Aucun appel IA supplémentaire :
// tout est vérifiable depuis des données déjà en main (contenu généré/relu,
// ligne de suivi, entrée de maillage, faits fournis au prompt). Un contenu
// qui échoue une seule règle reste en `draft`, jamais publié "quand même".
const similarity = require('./similarity');
const persona = require('./persona');

const LENGTH_RANGES = {
  hub: [2500, 4000],
  'sous-hub': [1500, 2500],
  article: [800, 1200], // programmatique par défaut (voir seo.md section 4)
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

// Miroir strict FAQ ⇄ texte visible (voir geo.md section 3) : chaque question
// doit apparaître dans le texte, dans le même ordre. Le schema.org FAQPage
// est construit par run.js depuis faq[], donc sa cohérence dépend entièrement
// de ce miroir.
function checkFaqMirror(content) {
  const text = stripHtmlToText(content.content_gutenberg).toLowerCase();
  let lastIndex = -1;
  for (const item of content.faq || []) {
    const idx = text.indexOf(item.question.toLowerCase());
    if (idx === -1) return { ok: false, reason: `Question FAQ absente du texte visible : "${item.question}"` };
    if (idx < lastIndex) return { ok: false, reason: `Question FAQ hors ordre par rapport au texte : "${item.question}"` };
    lastIndex = idx;
  }
  return { ok: true };
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

  const sim = checkSimilarity(content, silo, sousCocon);
  if (!sim.ok) {
    failures.push({
      rule: 'similarite',
      message: `Similarité ${(sim.max * 100).toFixed(1)}% avec "${sim.against}" (seuil ${SIMILARITY_THRESHOLD * 100}%).`,
    });
  }

  const facts = checkFactsNotInvented(content, factsProvided);
  if (!facts.ok) failures.push({ rule: 'faits_non_inventes', message: facts.reason });

  const faq = checkFaqMirror(content);
  if (!faq.ok) failures.push({ rule: 'schema_coherent', message: faq.reason });

  const seo = checkSeoFields(content);
  if (!seo.ok) failures.push({ rule: 'champs_seo', message: seo.reasons.join('; ') });

  const length = checkLength(content, contentType, lengthRange);
  if (!length.ok) {
    failures.push({
      rule: 'longueur',
      message: `${length.words} mots, attendu entre ${length.min} et ${length.max}.`,
    });
  }

  const ymyl = checkYmylSource(content, silo);
  if (!ymyl.ok) failures.push({ rule: 'source_ymyl', message: ymyl.reason });

  if (!checkMaillageResolved(contentType, maillageEntry, childLinksCount)) {
    failures.push({ rule: 'maillage_resolu', message: 'Maillage non résolu (entrée maillage.json absente ou liens descendants vides).' });
  }

  return { passed: failures.length === 0, failures };
}

module.exports = { runGating, LENGTH_RANGES, SIMILARITY_THRESHOLD, countWords, stripHtmlToText };
