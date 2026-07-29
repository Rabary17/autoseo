// Appels Chat Completions API (Mistral) — un seul point d'entrée pour la
// génération ET la relecture (voir prompt-builder.js pour la construction des
// requêtes). Structured output (response_format.type=json_schema) : la
// réponse est déjà un JSON valide conforme au schéma, pas de parsing regex
// fragile. Migré depuis l'API Anthropic le 2026-07-27 (demande explicite de
// l'utilisateur) — voir STATE.md.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

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
const apiKey = process.env.MISTRAL_API_KEY ?? dotEnv.MISTRAL_API_KEY;
if (!apiKey) {
  throw new Error('mistral-client: MISTRAL_API_KEY manquant (env ou .env local).');
}

const API_URL = 'https://api.mistral.ai/v1/chat/completions';

// prompt-builder.js construit `system` comme un tableau de blocs
// { type: 'text', text, cache_control? } (hérité du format Anthropic) — on se
// contente d'en concaténer le texte : l'API Mistral attend un unique message
// role=system, et n'a pas d'équivalent au cache_control manuel d'Anthropic.
function flattenSystem(system) {
  if (typeof system === 'string') return system;
  return system.map(block => block.text).join('\n\n');
}

// Cache de prompt Mistral (remise ~90% sur les tokens d'entrée du préfixe mis
// en cache — opt-in via `prompt_cache_key`, voir doc Mistral) : le system
// prompt (skill complet de l'auteur + style-anti-ia + contrat du type de
// contenu) est identique à chaque pièce d'un même auteur/type/appel
// (génération ou relecture), donc un hash de ce texte suffit comme clé
// stable — pas besoin de faire remonter persona/contentType jusqu'ici, et la
// clé change automatiquement (donc jamais de cache périmé) si un prompt
// source est modifié. Ajouté le 2026-07-27 pour réduire le coût des runs
// massifs d'articles (demande explicite de l'utilisateur).
function promptCacheKey(model, systemText) {
  return crypto.createHash('sha1').update(`${model}:${systemText}`).digest('hex').slice(0, 32);
}

async function callMistral({ model, system, messages, schema, maxTokens = 16000 }) {
  const systemText = flattenSystem(system);
  const body = {
    model,
    max_tokens: maxTokens,
    messages: [
      { role: 'system', content: systemText },
      ...messages,
    ],
    prompt_cache_key: promptCacheKey(model, systemText),
    response_format: {
      type: 'json_schema',
      json_schema: { name: schema.name, schema: schema.schema, strict: true },
    },
  };

  // Un appel long (hub/sous-hub, max_tokens relevé) reste exposé à des
  // coupures réseau transitoires (même constat que sur l'ancien client
  // Anthropic) — 2 tentatives avec backoff avant d'abandonner.
  let response;
  let lastErr;
  for (let attempt = 0; attempt <= 2; attempt++) {
    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw new Error(`mistral-client: HTTP ${res.status} pour "${schema.name}" — ${errText.slice(0, 500)}`);
      }
      response = await res.json();
      break;
    } catch (e) {
      lastErr = e;
      if (attempt < 2) await new Promise(r => setTimeout(r, 2000 * (attempt + 1)));
    }
  }
  if (!response) throw lastErr;

  const choice = response.choices && response.choices[0];
  if (!choice) {
    throw new Error(`mistral-client: aucune réponse dans "choices" pour "${schema.name}"`);
  }
  if (choice.finish_reason === 'error') {
    throw new Error(`mistral-client: erreur du modèle (finish_reason=error) pour le schéma "${schema.name}"`);
  }
  if (choice.finish_reason === 'length' || choice.finish_reason === 'model_length') {
    try {
      fs.writeFileSync(path.join(__dirname, '..', '..', '..', 'logs', 'autopublish', '_debug-raw-response.txt'), choice.message?.content || '', 'utf8');
    } catch {}
    throw new Error(
      `mistral-client: réponse tronquée (finish_reason=${choice.finish_reason}, maxTokens=${maxTokens}) pour "${schema.name}" — le JSON est probablement incomplet ; augmenter maxTokens si ce type de contenu le nécessite structurellement.`
    );
  }

  const text = choice.message && choice.message.content;
  if (!text) {
    throw new Error(`mistral-client: aucun contenu texte dans la réponse (finish_reason=${choice.finish_reason})`);
  }

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    try {
      fs.writeFileSync(path.join(__dirname, '..', '..', '..', 'logs', 'autopublish', '_debug-raw-response.txt'), text, 'utf8');
    } catch {}
    throw new Error(`mistral-client: JSON invalide renvoyé par le modèle pour "${schema.name}": ${e.message}`);
  }

  const usage = response.usage || {};
  // `prompt_tokens` inclut la part mise en cache (constaté le 2026-07-27 via
  // `usage.prompt_tokens_details.cached_tokens`) — on soustrait pour que
  // `input_tokens` reste "hors cache" comme sous Anthropic (voir le libellé
  // de report.js), et que `cache_read_input_tokens` reflète le vrai hit de
  // `prompt_cache_key`. Pas d'équivalent à `cache_creation_input_tokens`
  // (Anthropic facturait la 1ʳᵉ écriture en cache plus cher ; Mistral ne
  // documente pas ce coût séparément) — conservé à 0.
  const cachedTokens = usage.prompt_tokens_details?.cached_tokens || 0;
  return {
    parsed,
    usage: {
      input_tokens: (usage.prompt_tokens || 0) - cachedTokens,
      output_tokens: usage.completion_tokens || 0,
      cache_read_input_tokens: cachedTokens,
      cache_creation_input_tokens: 0,
    },
    stopReason: choice.finish_reason,
    model: response.model,
  };
}

module.exports = { callMistral };
