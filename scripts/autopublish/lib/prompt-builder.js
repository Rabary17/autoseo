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
    // `maxLength` fait respecter la limite structurellement (validé le
    // 2026-07-28 : même en demandant explicitement au modèle d'ignorer toute
    // limite et d'écrire 100/250 caractères, Mistral tronque exactement à
    // 60/155) — un vrai garde-fou, pas seulement une consigne. Cible resserrée
    // de 50/145 à 45/140 le même jour (audit WXR : 22/137 pages avaient un
    // meta_title tronqué en plein mot à la limite dure, ex. "...pour votreT",
    // "...Guide 20") — plus de marge pour que la troncature reste rare, et
    // consigne explicite de s'arrêter sur un mot complet.
    meta_title: { type: 'string', maxLength: 60, description: 'Vise 45 caractères, jamais plus de 60 (dur, tronqué au mot près sinon). Mot-clé principal en tête, termine sur un mot complet.' },
    meta_description: { type: 'string', maxLength: 155, description: 'Vise 140 caractères, jamais plus de 155 (dur, tronqué au mot près sinon). Incite au clic, chiffre/donnée réelle si pertinent, termine sur un mot complet.' },
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
          label: {
            type: 'string',
            description:
              "Nom de la source SEUL (ex. \"Vroomly\", \"service-public.gouv.fr\") — jamais de commentaire de "
              + "méthodologie ou de recoupement (interdit : \"recoupé avec X et Y\", \"vérifié auprès de...\", "
              + "\"consulté le...\"). Le champ `source` fourni dans les faits peut contenir ce type de mention "
              + "en interne (traçabilité) : n'en reprends jamais que le nom de la source principale.",
          },
          url: { type: 'string' },
        },
        required: ['label', 'url'],
        additionalProperties: false,
      },
    },
    tags: { type: 'array', items: { type: 'string' }, description: '2 à 5 entités transversales max' },
    inline_images: {
      type: 'array',
      description:
        "Images d'appui à insérer dans le corps, en plus de l'image à la une. Pour chacune, place le jeton "
        + "[[IMAGE:n]] (n = index base 1) comme paragraphe Gutenberg à lui seul, juste après le paragraphe "
        + "d'ouverture du H2 concerné — jamais dans le TL;DR, un tableau ou la FAQ. Le pipeline remplace ensuite "
        + "chaque jeton par le vrai bloc wp:image une fois l'image sourcée.",
      items: {
        type: 'object',
        properties: {
          index: { type: 'integer', description: 'Doit correspondre au n du jeton [[IMAGE:n]] utilisé dans content_gutenberg' },
          query: { type: 'string', description: "Requête de recherche stock-photo précise et concrète (scène/objet réel, en anglais si besoin), jamais un mot-clé SEO brut" },
          alt: { type: 'string', description: "Texte alternatif descriptif et naturel (ce que montre l'image), <= 125 caractères, sans bourrage de mot-clé" },
        },
        required: ['index', 'query', 'alt'],
        additionalProperties: false,
      },
    },
  },
  required: ['title', 'meta_title', 'meta_description', 'excerpt', 'content_gutenberg', 'faq', 'sources', 'tags', 'inline_images'],
  additionalProperties: false,
};

const GENERATION_SCHEMA = { name: 'contenu_wp', schema: CONTENT_SCHEMA };

// `content: null` quand `conforme: true` (voir review.md) — évite de réémettre
// l'intégralité de l'enveloppe en sortie quand rien n'a changé (économie de
// tokens vérifiée le 2026-07-27 : content=null coûte ~13 tokens de sortie
// contre l'enveloppe complète sinon). review.js réutilise le contenu généré
// initial quand `content` revient `null`.
// Forme commune aux deux passes de relecture (voix/faits/maillage, puis
// lisibilité) — seuls `name` et le contrat système (system-*.md vs
// lisibilite.md) diffèrent, voir buildReviewRequest/buildReadabilityReviewRequest.
function reviewSchema(name) {
  return {
    name,
    schema: {
      type: 'object',
      properties: {
        conforme: { type: 'boolean' },
        justification: { type: 'string' },
        corrections_appliquees: { type: 'array', items: { type: 'string' } },
        content: { anyOf: [CONTENT_SCHEMA, { type: 'null' }] },
      },
      required: ['conforme', 'justification', 'corrections_appliquees', 'content'],
      additionalProperties: false,
    },
  };
}

const REVIEW_SCHEMA = reviewSchema('relecture_wp');
// 3ᵉ passe obligatoire (2026-07-28, demande explicite de l'utilisateur) :
// lisibilité mécanique (longueur de phrase, taille de paragraphe/section,
// connecteurs logiques) — voir prompts/lisibilite.md. Passe distincte de la
// relecture voix/faits/maillage ci-dessus, jamais une 3e itération de la même
// chose (voir docs/architecture-autopublish.md section 4).
const READABILITY_REVIEW_SCHEMA = reviewSchema('relecture_lisibilite_wp');

// system[] : skill complet de l'auteur, puis contrat universel du type de
// contenu — mistral-client.js concatène ces blocs en un seul message
// role=system. Réutilisé identique en génération ET en relecture.
function buildSystemBlocks(silo, contentType) {
  const personaInfo = persona.getPersonaForSilo(silo);
  const skillContent = readFile(personaInfo.skill);
  const styleGuide = readFile(path.join(PROMPTS_DIR, 'style-anti-ia.md'));
  const contract = readFile(path.join(PROMPTS_DIR, CONTRACT_FILE_BY_TYPE[contentType]));
  return {
    personaInfo,
    system: [
      { type: 'text', text: skillContent },
      { type: 'text', text: styleGuide },
      { type: 'text', text: contract },
    ],
  };
}

function buildGenerationRequest({ contentType, silo, item, maillageEntry, childLinks, facts, competitorAngles }) {
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
    // Pistes tirées d'une recherche concurrentielle (Tavily), déjà des
    // synthèses (jamais le texte brut d'une page tierce) — à reformuler
    // entièrement, jamais à citer (voir prompts/system-*.md et
    // lib/competitor-research.js pour la règle complète).
    pistes_concurrentielles_a_reformuler: competitorAngles && competitorAngles.length ? competitorAngles : [],
  };

  return {
    personaKey: Object.keys(persona.PERSONAS).find(k => persona.PERSONAS[k] === personaInfo),
    system,
    messages: [{ role: 'user', content: JSON.stringify(userPayload, null, 2) }],
    schema: GENERATION_SCHEMA,
  };
}

function buildReviewRequest({ contentType, silo, generatedContent, maillageEntry, facts, competitorAngles }) {
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
    // Fourni pour que la relecture (point 7 de review.md) puisse vérifier
    // qu'aucune trace/citation de ces pistes ne subsiste dans le texte final.
    pistes_concurrentielles_a_reformuler: competitorAngles && competitorAngles.length ? competitorAngles : [],
    contenu_a_relire: generatedContent,
  };

  return {
    personaKey: Object.keys(persona.PERSONAS).find(k => persona.PERSONAS[k] === personaInfo),
    system: [...system, { type: 'text', text: reviewContract }],
    messages: [{ role: 'user', content: JSON.stringify(userPayload, null, 2) }],
    schema: REVIEW_SCHEMA,
  };
}

// 3ᵉ passe (voir READABILITY_REVIEW_SCHEMA) : pas besoin du contexte
// maillage/faits/pistes concurrentielles (déjà validés par la relecture
// précédente, cette passe ne les touche pas) — seul le contenu à ajuster est
// transmis, message utilisateur plus léger.
function buildReadabilityReviewRequest({ contentType, silo, generatedContent }) {
  const { personaInfo, system } = buildSystemBlocks(silo, contentType);
  const readabilityContract = readFile(path.join(PROMPTS_DIR, 'lisibilite.md'));

  const userPayload = {
    type_de_contenu: contentType,
    silo,
    contenu_a_relire: generatedContent,
  };

  return {
    personaKey: Object.keys(persona.PERSONAS).find(k => persona.PERSONAS[k] === personaInfo),
    system: [...system, { type: 'text', text: readabilityContract }],
    messages: [{ role: 'user', content: JSON.stringify(userPayload, null, 2) }],
    schema: READABILITY_REVIEW_SCHEMA,
  };
}

module.exports = {
  CONTENT_SCHEMA,
  GENERATION_SCHEMA,
  REVIEW_SCHEMA,
  READABILITY_REVIEW_SCHEMA,
  buildGenerationRequest,
  buildReviewRequest,
  buildReadabilityReviewRequest,
};
