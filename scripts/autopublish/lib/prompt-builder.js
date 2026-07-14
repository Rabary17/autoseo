// Construit les blocs system/user pour la génération et la relecture d'une
// pièce (hub / sous-hub / article). Le skill complet de l'auteur assigné est
// TOUJOURS chargé en entier (jamais un extrait condensé) — règle explicite de
// l'utilisateur, voir skills/redaction.md.
const fs = require('fs');
const path = require('path');
const persona = require('./persona');

const PROMPTS_DIR = path.join(__dirname, '..', 'prompts');

const CONTRACT_FILE_BY_TYPE = {
  article: 'system-article.md',
  'sous-hub': 'system-sous-hub.md',
  hub: 'system-hub.md',
};

function readFile(p) {
  return fs.readFileSync(p, 'utf8');
}

// Schéma de génération : une enveloppe de contenu structurée, exploitée
// telle quelle par gating.js (longueur, champs SEO) et par run.js pour
// construire le payload WP (le schema.org JSON-LD est reconstruit par le
// pipeline lui-même à partir de faq[]/sources[], jamais généré par le modèle
// — voir skills/wordpress-publication.md section 5).
const CONTENT_SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string', description: 'Titre H1 de la page' },
    meta_title: { type: 'string', description: '<= 60 caractères' },
    meta_description: { type: 'string', description: '<= 155 caractères' },
    excerpt: { type: 'string', description: 'Résumé court (1-2 phrases), utilisé comme extrait WP' },
    content_gutenberg: { type: 'string', description: 'Corps de la page en blocs Gutenberg valides' },
    faq: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          question: { type: 'string' },
          answer: { type: 'string' },
        },
        required: ['question', 'answer'],
        additionalProperties: false,
      },
    },
    sources: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          label: { type: 'string' },
          url: { type: 'string' },
        },
        required: ['label', 'url'],
        additionalProperties: false,
      },
    },
    tags: { type: 'array', items: { type: 'string' }, description: '2 à 5 entités transversales max' },
  },
  required: ['title', 'meta_title', 'meta_description', 'excerpt', 'content_gutenberg', 'faq', 'sources', 'tags'],
  additionalProperties: false,
};

const GENERATION_SCHEMA = { name: 'contenu_wp', schema: CONTENT_SCHEMA };

const REVIEW_SCHEMA = {
  name: 'relecture_wp',
  schema: {
    type: 'object',
    properties: {
      conforme: { type: 'boolean' },
      justification: { type: 'string' },
      corrections_appliquees: { type: 'array', items: { type: 'string' } },
      content: CONTENT_SCHEMA,
    },
    required: ['conforme', 'justification', 'corrections_appliquees', 'content'],
    additionalProperties: false,
  },
};

// system[] : skill complet de l'auteur, puis contrat universel du type de
// contenu — un seul cache_control en fin de tableau suffit à mettre en cache
// l'ensemble (voir shared/prompt-caching.md : le breakpoint met en cache tout
// ce qui précède). Réutilisé identique en génération ET en relecture, pour
// que le cache serve aux deux appels d'une même pièce.
function buildSystemBlocks(silo, contentType) {
  const personaInfo = persona.getPersonaForSilo(silo);
  const skillContent = readFile(personaInfo.skill);
  const contract = readFile(path.join(PROMPTS_DIR, CONTRACT_FILE_BY_TYPE[contentType]));
  return {
    personaInfo,
    system: [
      { type: 'text', text: skillContent },
      { type: 'text', text: contract, cache_control: { type: 'ephemeral' } },
    ],
  };
}

function buildGenerationRequest({ contentType, silo, item, maillageEntry, childLinks, facts }) {
  if (!CONTRACT_FILE_BY_TYPE[contentType]) throw new Error(`prompt-builder: type de contenu inconnu "${contentType}"`);
  const { personaInfo, system } = buildSystemBlocks(silo, contentType);
  const ymyl = persona.isYmylSilo(silo);

  const userPayload = {
    type_de_contenu: contentType,
    silo,
    ymyl,
    cluster: item
      ? {
          mot_cle_principal: item.mot_cle_principal,
          variantes: item.variantes,
          intention: item.intention,
          volume_estime: item.volume_estime,
        }
      : undefined,
    maillage: maillageEntry
      ? {
          url: maillageEntry.url,
          hub: maillageEntry.hub,
          sous_hub: maillageEntry.sous_hub,
          liens_lateraux: maillageEntry.liens_lateraux,
          liens_transversaux: maillageEntry.liens_transversaux,
          ancres: maillageEntry.ancres,
        }
      : undefined,
    liens_descendants: childLinks && childLinks.length ? childLinks : undefined,
    faits_disponibles: facts && facts.length ? facts : [],
  };

  return {
    personaKey: Object.keys(persona.PERSONAS).find(k => persona.PERSONAS[k] === personaInfo),
    system,
    messages: [{ role: 'user', content: JSON.stringify(userPayload, null, 2) }],
    schema: GENERATION_SCHEMA,
  };
}

function buildReviewRequest({ contentType, silo, generatedContent, maillageEntry, facts }) {
  const { personaInfo, system } = buildSystemBlocks(silo, contentType);
  const reviewContract = readFile(path.join(PROMPTS_DIR, 'review.md'));
  const ymyl = persona.isYmylSilo(silo);

  const userPayload = {
    type_de_contenu: contentType,
    silo,
    ymyl,
    maillage_attendu: maillageEntry
      ? { liens_lateraux: maillageEntry.liens_lateraux, ancres: maillageEntry.ancres }
      : undefined,
    faits_disponibles: facts && facts.length ? facts : [],
    contenu_a_relire: generatedContent,
  };

  return {
    personaKey: Object.keys(persona.PERSONAS).find(k => persona.PERSONAS[k] === personaInfo),
    system: [...system, { type: 'text', text: reviewContract, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: JSON.stringify(userPayload, null, 2) }],
    schema: REVIEW_SCHEMA,
  };
}

module.exports = {
  CONTENT_SCHEMA,
  GENERATION_SCHEMA,
  REVIEW_SCHEMA,
  buildGenerationRequest,
  buildReviewRequest,
};
