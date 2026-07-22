// Client WordPress REST API pour le pipeline autopublish — auth Application
// Password (Basic Auth), même principe que scripts/wp-client.js, mais via le
// format `?rest_route=/wp/v2/...` : l'hébergement de production
// (mntdev.passion4humanity.com) bloque le préfixe /wp-json/ au niveau du
// pare-feu, seul le paramètre rest_route= passe (voir frontend/monauto/lib/wp.ts
// et docs/architecture-headless.md). scripts/wp-client.js reste sur l'ancien
// format car il ne cible que l'environnement Local (thermotowel.local).
//
// Credentials : lus depuis process.env (injectés par les secrets GitHub Actions
// en CI), avec repli sur le .env local pour les tests en dry-run sur poste.
const fs = require('fs');
const path = require('path');

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
function getVar(name) {
  return process.env[name] ?? dotEnv[name];
}

const WP_ORIGIN = (getVar('WP_URL') || '').replace(/\/$/, '');
const WP_USER = getVar('WP_USER');
const WP_APP_PASSWORD = getVar('WP_APP_PASSWORD');

if (!WP_ORIGIN || !WP_USER || !WP_APP_PASSWORD) {
  throw new Error(
    'wp-client: WP_URL, WP_USER et WP_APP_PASSWORD doivent être définis (env ou .env local).'
  );
}

const AUTH = 'Basic ' + Buffer.from(`${WP_USER}:${WP_APP_PASSWORD}`).toString('base64');

function buildUrl(pathAndQuery) {
  const qIndex = pathAndQuery.indexOf('?');
  const resourcePath = qIndex === -1 ? pathAndQuery : pathAndQuery.slice(0, qIndex);
  const query = qIndex === -1 ? '' : pathAndQuery.slice(qIndex + 1);
  const restRoute = `/wp/v2${resourcePath}`;
  return `${WP_ORIGIN}/?rest_route=${encodeURIComponent(restRoute).replace(/%2F/g, '/')}${query ? `&${query}` : ''}`;
}

// 2 tentatives, backoff court fixe — cohérent avec le choix déjà fait dans
// frontend/monauto/lib/wp.ts (un vrai serveur répond vite dans un sens ou
// l'autre ; un backoff long ne répare rien). Ne retente QUE les erreurs
// réseau et les statuts 429/5xx — un 400/401/403/404 ne se corrige jamais en
// réessayant, retenter dans ce cas ne fait que perdre 1-2s pour rien.
async function request(pathAndQuery, { method = 'GET', body, retries = 2 } = {}) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    let res;
    try {
      res = await fetch(buildUrl(pathAndQuery), {
        method,
        headers: { Authorization: AUTH, 'content-type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch (e) {
      lastErr = e;
      if (attempt < retries) {
        await new Promise(r => setTimeout(r, 500));
        continue;
      }
      throw lastErr;
    }

    if (res.ok) return res.json().catch(() => ({}));

    const json = await res.json().catch(() => ({}));
    const err = new Error(`WP ${method} ${pathAndQuery} -> ${res.status}: ${JSON.stringify(json)}`);
    err.status = res.status;
    const retryable = res.status === 429 || res.status >= 500;
    if (retryable && attempt < retries) {
      lastErr = err;
      await new Promise(r => setTimeout(r, 500));
      continue;
    }
    throw err;
  }
  throw lastErr;
}

/* ---------- Helpers haut niveau réutilisés par le pipeline ---------- */

async function findBySlug(type, slug) {
  const items = await request(`/${type}?slug=${encodeURIComponent(slug)}&status=any`);
  return Array.isArray(items) && items[0] ? items[0] : null;
}

async function createPost(payload) {
  return request('/posts', { method: 'POST', body: payload });
}

async function updatePost(id, payload) {
  return request(`/posts/${id}`, { method: 'POST', body: payload });
}

async function createPage(payload) {
  return request('/pages', { method: 'POST', body: payload });
}

async function updatePage(id, payload) {
  return request(`/pages/${id}`, { method: 'POST', body: payload });
}

async function findOrCreateTerm(taxonomy, slug, payload) {
  const existing = await request(`/${taxonomy}?slug=${encodeURIComponent(slug)}`);
  if (Array.isArray(existing) && existing.length) return existing[0];
  return request(`/${taxonomy}`, { method: 'POST', body: payload });
}

async function getAllUsers() {
  return request('/users?per_page=100');
}

// Upload d'un média binaire (image) — route WP dédiée, pas de JSON body,
// content-type = celui du fichier, nom transmis via Content-Disposition.
async function uploadMedia(buffer, filename, mimeType, altText) {
  const res = await fetch(buildUrl('/media'), {
    method: 'POST',
    headers: {
      Authorization: AUTH,
      'content-type': mimeType,
      'content-disposition': `attachment; filename="${filename}"`,
    },
    body: buffer,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`WP POST /media -> ${res.status}: ${JSON.stringify(json)}`);
  // alt_text n'est pas accepté par l'upload binaire lui-même (pas de champ
  // de formulaire possible avec un body brut) — deuxième appel JSON dédié,
  // requis pour toute image (accessibilité + SEO image), jamais laissé vide.
  if (altText) {
    await request(`/media/${json.id}`, { method: 'POST', body: { alt_text: altText } });
  }
  return json;
}

module.exports = {
  request,
  findBySlug,
  createPost,
  updatePost,
  createPage,
  updatePage,
  findOrCreateTerm,
  getAllUsers,
  uploadMedia,
};
