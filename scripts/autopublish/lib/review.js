// Relecture/auto-correction obligatoire après génération (règle explicite de
// l'utilisateur) : un second appel Messages API dédié vérifie la conformité
// au skill de l'auteur et aux contraintes, corrige si besoin, et justifie ses
// choix dans un fichier de log lisible par un humain — jamais de correction
// silencieuse. Une seule passe, jamais de boucle (voir plan section 3.bis).
const fs = require('fs');
const path = require('path');
const promptBuilder = require('./prompt-builder');
const claudeClient = require('./claude-client');

const LOGS_ROOT = path.join(__dirname, '..', '..', '..', 'logs', 'autopublish');

// Modèle de relecture par défaut : Sonnet 5, jugement qualité (voir plan
// section 5, "répartition modèle par type") — surchageable par config.js.
const DEFAULT_REVIEW_MODEL = 'claude-sonnet-5';
const DEFAULT_THINKING = { type: 'adaptive' };
const DEFAULT_EFFORT = 'medium';

// `slug` alimente un nom de fichier — normalement toujours un slug propre
// (persona.js/scheduler.js le construisent ainsi), mais on neutralise ici tout
// caractère qui casserait le chemin (`/`, `..`) plutôt que de faire confiance
// aveuglément à l'appelant.
function safeFileSlug(slug) {
  return String(slug).replace(/[^a-zA-Z0-9-_]/g, '-');
}

function writeReviewLog({ runDate, slug, contentType, silo, conforme, justification, corrections }) {
  const dir = path.join(LOGS_ROOT, runDate);
  fs.mkdirSync(dir, { recursive: true });
  slug = safeFileSlug(slug);
  const lines = [
    `# Relecture — ${slug}`,
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
  fs.writeFileSync(path.join(dir, `${slug}-review.md`), lines.join('\n'), 'utf8');
}

async function reviewContent({
  contentType,
  silo,
  slug,
  generatedContent,
  maillageEntry,
  facts,
  runDate,
  model = DEFAULT_REVIEW_MODEL,
  thinking = DEFAULT_THINKING,
  effort = DEFAULT_EFFORT,
}) {
  const req = promptBuilder.buildReviewRequest({
    contentType,
    silo,
    generatedContent,
    maillageEntry,
    facts,
  });

  const result = await claudeClient.callClaude({
    model,
    system: req.system,
    messages: req.messages,
    schema: req.schema,
    thinking,
    effort,
  });

  const { conforme, justification, corrections_appliquees: corrections = [], content } = result.parsed;

  writeReviewLog({ runDate, slug, contentType, silo, conforme, justification, corrections });

  return { conforme, justification, corrections, content, usage: result.usage };
}

module.exports = { reviewContent, DEFAULT_REVIEW_MODEL, DEFAULT_THINKING, DEFAULT_EFFORT };
