#!/usr/bin/env node
// Rapport quotidien — aucune génération, aucun appel Claude, coût ~nul.
// Interroge WordPress (source de vérité) pour lister : ce qui est publié
// aujourd'hui, ce qui est prévu demain, et un aperçu des jours suivants.
// Écrit un e-mail HTML que le workflow GitHub Actions envoie ensuite (voir
// .github/workflows/daily-report.yml). Destinataire configuré dans config.js.
const fs = require('fs');
const path = require('path');
const wp = require('./lib/wp-client');
const stateLib = require('./lib/state');
const config = require('./config');

const OUTPUT_PATH = path.join(__dirname, '..', '..', 'logs', 'autopublish', 'daily-report-latest.html');

function dayStart(date) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  return d;
}

function addDays(date, days) {
  const d = new Date(date.getTime());
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function fmtDay(date) {
  return date.toISOString().slice(0, 10);
}

function fmtIso(date) {
  return date.toISOString().replace(/\.\d{3}Z$/, '');
}

async function fetchWindow(afterDate, beforeDate) {
  const query = `_fields=id,link,title,date_gmt,status,type&status=publish,future&per_page=100&orderby=date&order=asc&after=${encodeURIComponent(fmtIso(afterDate))}Z&before=${encodeURIComponent(fmtIso(beforeDate))}Z`;
  const [posts, pages] = await Promise.all([
    wp.request(`/posts?${query}`).catch(() => []),
    wp.request(`/pages?${query}`).catch(() => []),
  ]);
  return [...posts, ...pages].sort((a, b) => new Date(a.date_gmt) - new Date(b.date_gmt));
}

function itemLine(item) {
  const title = item.title?.rendered || item.title || '(sans titre)';
  return `<li><a href="${item.link}">${title}</a> — <code>${item.link}</code></li>`;
}

function section(title, items, emptyLabel) {
  if (!items.length) return `<h3>${title}</h3><p><em>${emptyLabel}</em></p>`;
  return `<h3>${title} (${items.length})</h3><ul>${items.map(itemLine).join('')}</ul>`;
}

async function main() {
  const now = new Date();
  const today0 = dayStart(now);
  const tomorrow0 = addDays(today0, 1);
  const afterTomorrow0 = addDays(today0, 2);
  const weekEnd0 = addDays(today0, 8);

  const state = stateLib.loadState();

  const window = await fetchWindow(today0, weekEnd0);

  const publishedToday = window.filter(i => i.status === 'publish' && new Date(i.date_gmt) >= today0 && new Date(i.date_gmt) < tomorrow0);
  const laterToday = window.filter(i => i.status === 'future' && new Date(i.date_gmt) >= today0 && new Date(i.date_gmt) < tomorrow0);
  const tomorrow = window.filter(i => new Date(i.date_gmt) >= tomorrow0 && new Date(i.date_gmt) < afterTomorrow0);
  const upcoming = window.filter(i => new Date(i.date_gmt) >= afterTomorrow0);

  const upcomingByDay = new Map();
  for (const item of upcoming) {
    const day = fmtDay(new Date(item.date_gmt));
    if (!upcomingByDay.has(day)) upcomingByDay.set(day, []);
    upcomingByDay.get(day).push(item);
  }

  const upcomingHtml = [...upcomingByDay.entries()]
    .map(([day, items]) => `<h4>${day} (${items.length})</h4><ul>${items.map(itemLine).join('')}</ul>`)
    .join('') || '<p><em>Rien de programmé au-delà de demain pour l\'instant.</em></p>';

  const html = `
<h2>Rapport quotidien monauto — ${fmtDay(now)}</h2>
<p>Phase courante : <strong>${state.phase}</strong>${state.silo_en_cours ? ` — silo en cours : <strong>${state.silo_en_cours}</strong>` : ''}. Dernier run autopublish : ${state.derniere_execution ?? 'jamais'}.</p>

${section('Publié aujourd\'hui', publishedToday, 'Rien publié aujourd\'hui pour l\'instant.')}
${section('Prévu plus tard aujourd\'hui', laterToday, 'Rien d\'autre prévu aujourd\'hui.')}
${section('Prévu demain', tomorrow, 'Rien de programmé demain pour l\'instant.')}

<h3>Aperçu des jours suivants</h3>
${upcomingHtml}

<p style="color:#888;font-size:0.9em;">Rapport généré automatiquement, aucun contenu n'a été modifié par ce script.</p>
`.trim();

  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, html, 'utf8');
  console.log(`Rapport écrit : ${OUTPUT_PATH}`);
  console.log(`Publiés aujourd'hui : ${publishedToday.length} — demain : ${tomorrow.length} — total fenêtre 8j : ${window.length}`);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
