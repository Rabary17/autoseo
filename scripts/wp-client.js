// Client WordPress REST API — auth via Application Password (Basic Auth)
// Clé lue depuis .env, jamais exposée côté navigateur.
const fs = require('fs');
const path = require('path');

function loadEnv() {
  const raw = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8');
  const env = {};
  raw.split('\n').filter(Boolean).forEach(line => {
    const i = line.indexOf('=');
    env[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  });
  return env;
}

const env = loadEnv();
const BASE_URL = env.WP_URL.replace(/\/$/, '') + '/wp-json/wp/v2';
const AUTH = 'Basic ' + Buffer.from(`${env.WP_USER}:${env.WP_APP_PASSWORD}`).toString('base64');

async function request(pathAndQuery, { method = 'GET', body } = {}) {
  const res = await fetch(BASE_URL + pathAndQuery, {
    method,
    headers: { Authorization: AUTH, 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`WP ${method} ${pathAndQuery} -> ${res.status}: ${JSON.stringify(json)}`);
  return json;
}

async function listAll(type) {
  return request(`/${type}?per_page=100&status=any`);
}

async function deleteItem(type, id) {
  return request(`/${type}/${id}?force=true`, { method: 'DELETE' });
}

async function listPlugins() {
  return request('/plugins');
}

async function setPluginStatus(pluginFile, status) {
  // pluginFile format: "elementor/elementor" — la route WP attend le slash littéral, pas encodé
  return request(`/plugins/${pluginFile}`, { method: 'POST', body: { status } });
}

async function deletePlugin(pluginFile) {
  return request(`/plugins/${pluginFile}`, { method: 'DELETE' });
}

module.exports = { request, listAll, deleteItem, listPlugins, setPluginStatus, deletePlugin };
