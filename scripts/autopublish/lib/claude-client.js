// Appels Messages API — un seul point d'entrée pour la génération ET la
// relecture (voir prompt-builder.js pour la construction des requêtes).
// Structured output (output_config.format json_schema) : la réponse est déjà
// un JSON valide conforme au schéma, pas de parsing regex fragile.
const fs = require('fs');
const path = require('path');
const Anthropic = require('@anthropic-ai/sdk');

function loadDotEnvFallback() {
  const envPath = path.join(__dirname, '..', '..', '..', '.env');
  if (!fs.existsSync(envPath)) return {};
  const raw = fs.readFileSync(envPath, 'utf8');
  const env = {};
  raw.split('\n').filter(Boolean).forEach(line => {
    const i = line.indexOf('=');
    if (i === -1) return;
    env[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  });
  return env;
}

const dotEnv = loadDotEnvFallback();
const apiKey = process.env.ANTHROPIC_API_KEY ?? dotEnv.ANTHROPIC_API_KEY;
if (!apiKey) {
  throw new Error('claude-client: ANTHROPIC_API_KEY manquant (env ou .env local).');
}

const client = new Anthropic({ apiKey });

// `thinking`/`effort` sont laissés au choix de l'appelant (config.js décide
// selon le modèle et le type de contenu — voir plan section 5, économie de
// tokens) : Haiku 4.5 n'accepte ni `thinking: adaptive` ni `effort`, donc ce
// module reste volontairement agnostique et transmet tel quel ce qu'on lui donne.
async function callClaude({ model, system, messages, schema, thinking, effort, maxTokens = 16000 }) {
  const outputConfig = { format: { type: 'json_schema', schema: schema.schema } };
  if (effort) outputConfig.effort = effort;

  const params = {
    model,
    max_tokens: maxTokens,
    system,
    messages,
    output_config: outputConfig,
  };
  if (thinking) params.thinking = thinking;

  const response = await client.messages.create(params);

  if (response.stop_reason === 'refusal') {
    throw new Error(`claude-client: refus du modèle (stop_reason=refusal) pour le schéma "${schema.name}"`);
  }
  if (response.stop_reason === 'max_tokens') {
    throw new Error(
      `claude-client: réponse tronquée (stop_reason=max_tokens, maxTokens=${maxTokens}) pour "${schema.name}" — le JSON est probablement incomplet ; augmenter maxTokens si ce type de contenu le nécessite structurellement.`
    );
  }

  const textBlock = response.content.find(b => b.type === 'text');
  if (!textBlock) {
    throw new Error(`claude-client: aucun bloc texte dans la réponse (stop_reason=${response.stop_reason})`);
  }

  let parsed;
  try {
    parsed = JSON.parse(textBlock.text);
  } catch (e) {
    throw new Error(`claude-client: JSON invalide renvoyé par le modèle pour "${schema.name}": ${e.message}`);
  }

  return {
    parsed,
    usage: response.usage,
    stopReason: response.stop_reason,
    model: response.model,
  };
}

module.exports = { callClaude };
