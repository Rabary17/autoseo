// Relecture/auto-correction obligatoire après génération (règle explicite de
// l'utilisateur) : deux appels dédiés vérifient la conformité — voix de
// l'auteur/faits/maillage (`reviewContent`), puis lisibilité mécanique
// (`reviewReadability`, ajoutée le 2026-07-28) — et justifient leurs choix
// dans un fichier de log lisible par un humain, jamais de correction
// silencieuse. Chaque passe reste unique, jamais de boucle (voir plan
// section 3.bis) — la lisibilité est une 3ᵉ passe distincte, pas une
// itération de la relecture voix/faits.
const fs = require('fs');
const path = require('path');
const promptBuilder = require('./prompt-builder');
const mistralClient = require('./mistral-client');

const LOGS_ROOT = path.join(__dirname, '..', '..', '..', 'logs', 'autopublish');

// Modèle de relecture par défaut : mistral-large-latest, jugement qualité
// (voir plan section 5, "répartition modèle par type") — surchageable par config.js.
const DEFAULT_REVIEW_MODEL = 'mistral-large-latest';

// `slug` alimente un nom de fichier — normalement toujours un slug propre
// (persona.js/scheduler.js le construisent ainsi), mais on neutralise ici tout
// caractère qui casserait le chemin (`/`, `..`) plutôt que de faire confiance
// aveuglément à l'appelant.
function safeFileSlug(slug) {
  return String(slug).replace(/[^a-zA-Z0-9-_]/g, '-');
}

// `kind` distingue le fichier de log entre les 2 passes de relecture d'une
// même pièce (voix/faits vs lisibilité) — sinon la 2e passe écraserait le
// log de la 1ère (même slug).
function writeReviewLog({ runDate, slug, contentType, silo, conforme, justification, corrections, kind = 'voix-faits' }) {
  const dir = path.join(LOGS_ROOT, runDate);
  fs.mkdirSync(dir, { recursive: true });
  slug = safeFileSlug(slug);
  const lines = [
    `# Relecture (${kind}) — ${slug}`,
    '',
    `- Type de contenu : ${contentType}`,
    `- Silo : ${silo}`,
    `- Conforme sans correction : ${conforme ? 'oui' : 'non'}`,
    '',
    '## Justification',
    '',
    justification,
    '',
    '## Corrections appliquées',
    '',
    corrections.length ? corrections.map(c => `- ${c}`).join('\n') : '_Aucune._',
    '',
  ];
  fs.writeFileSync(path.join(dir, `${slug}-review-${kind}.md`), lines.join('\n'), 'utf8');
}

// La relecture renvoie l'enveloppe de contenu COMPLÈTE (content) en plus de
// justification/corrections_appliquees — donc toujours plus lourde en tokens
// de sortie que la génération initiale du même type. Plafonds fixés à
// l'époque de l'API Anthropic (test P4 2026-07-22, `hub`/`sous-hub` relevés
// après plusieurs finish_reason=length constatés sur du contenu long).
// `article` relevé 16000 -> 24000 le 2026-07-27 (migration Mistral) : premier
// test end-to-end sur mistral-large-latest tronqué à 16000 sur un article de
// relecture (3730 tokens de sortie sur une tentative réussie juste après,
// donc plutôt une variance ponctuelle qu'un besoin structurel plus élevé —
// mais la marge est gardée par prudence plutôt que de retenter le hasard en
// production). À surveiller aussi sur hub/sous-hub si des troncatures
// réapparaissent avec Mistral (tokenizer différent de celui de Claude).
const MAX_TOKENS_BY_CONTENT_TYPE = {
  hub: 32000,
  'sous-hub': 48000,
  article: 24000,
};

async function reviewContent({
  contentType,
  silo,
  slug,
  generatedContent,
  maillageEntry,
  facts,
  competitorAngles,
  runDate,
  model = DEFAULT_REVIEW_MODEL,
}) {
  const req = promptBuilder.buildReviewRequest({
    contentType,
    silo,
    generatedContent,
    maillageEntry,
    facts,
    competitorAngles,
  });

  const result = await mistralClient.callMistral({
    model,
    system: req.system,
    messages: req.messages,
    schema: req.schema,
    maxTokens: MAX_TOKENS_BY_CONTENT_TYPE[contentType] || 16000,
  });

  const { conforme, justification, corrections_appliquees: corrections = [], content } = result.parsed;
  // `content: null` quand `conforme: true` (voir prompts/review.md et
  // prompt-builder.js REVIEW_SCHEMA) : le modèle ne réémet pas l'enveloppe
  // déjà bonne, on réutilise celle générée initialement.
  const finalContent = content ?? generatedContent;

  writeReviewLog({ runDate, slug, contentType, silo, conforme, justification, corrections });

  return { conforme, justification, corrections, content: finalContent, usage: result.usage };
}

// 3ᵉ passe (2026-07-28, demande explicite de l'utilisateur) : lisibilité
// mécanique (longueur de phrase, taille de paragraphe/section, connecteurs
// logiques) — voir prompts/lisibilite.md. Ne touche jamais à la voix, aux
// faits ou au maillage (déjà validés par reviewContent ci-dessus) : contrat
// et schéma distincts (READABILITY_REVIEW_SCHEMA), mais même mécanique
// `content: null` si déjà conforme pour économiser les tokens de sortie.
async function reviewReadability({
  contentType,
  silo,
  slug,
  generatedContent,
  runDate,
  model = DEFAULT_REVIEW_MODEL,
}) {
  const req = promptBuilder.buildReadabilityReviewRequest({ contentType, silo, generatedContent });

  const result = await mistralClient.callMistral({
    model,
    system: req.system,
    messages: req.messages,
    schema: req.schema,
    maxTokens: MAX_TOKENS_BY_CONTENT_TYPE[contentType] || 16000,
  });

  const { conforme, justification, corrections_appliquees: corrections = [], content } = result.parsed;
  const finalContent = content ?? generatedContent;

  writeReviewLog({ runDate, slug, contentType, silo, conforme, justification, corrections, kind: 'lisibilite' });

  return { conforme, justification, corrections, content: finalContent, usage: result.usage };
}

module.exports = { reviewContent, reviewReadability, DEFAULT_REVIEW_MODEL, MAX_TOKENS_BY_CONTENT_TYPE };
