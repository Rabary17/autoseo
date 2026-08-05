// Veille quotidienne d'actualités auto/mobilité — agrège les flux RSS listés
// dans data/actus/sources.json, filtre sur les dernières 48h, déduplique et
// affiche une short-list à valider manuellement (jamais de rédaction/
// publication automatique à partir de ce script, voir skills/gestion-de-projet.md).
// Usage : node scripts/actus/veille.js [--hours=48]
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

const SOURCES_PATH = path.join(__dirname, '..', '..', 'data', 'actus', 'sources.json');
const OUT_DIR = path.join(__dirname, '..', '..', 'data', 'actus');

const hoursArg = process.argv.find(a => a.startsWith('--hours='));
const WINDOW_HOURS = hoursArg ? Number(hoursArg.split('=')[1]) : 48;

function get(url, redirectsLeft = 3) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https:') ? https : http;
    const req = mod.get(
      url,
      { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; autoseo-veille/1.0)' }, timeout: 10000 },
      (res) => {
        if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location && redirectsLeft > 0) {
          res.resume();
          const next = new URL(res.headers.location, url).toString();
          resolve(get(next, redirectsLeft - 1));
          return;
        }
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
      }
    );
    req.on('error', reject);
    req.on('timeout', () => req.destroy(new Error(`timeout: ${url}`)));
  });
}

function decodeEntities(s) {
  if (!s) return '';
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&#8217;/g, '’')
    .trim();
}

function extractTag(block, tag) {
  const m = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i'));
  return m ? decodeEntities(m[1]) : '';
}

function extractLink(block) {
  // RSS: <link>URL</link> ; Atom: <link href="URL" .../>
  const rss = block.match(/<link>([\s\S]*?)<\/link>/i);
  if (rss) return decodeEntities(rss[1]);
  const atom = block.match(/<link[^>]*href="([^"]*)"/i);
  return atom ? atom[1] : '';
}

function parseFeed(xml) {
  const items = [];
  const blocks = [...xml.matchAll(/<item[\s\S]*?<\/item>/gi)].map((m) => m[0]);
  const entries = blocks.length ? blocks : [...xml.matchAll(/<entry[\s\S]*?<\/entry>/gi)].map((m) => m[0]);
  for (const block of entries) {
    const title = extractTag(block, 'title');
    const link = extractLink(block);
    const pubDateRaw = extractTag(block, 'pubDate') || extractTag(block, 'published') || extractTag(block, 'updated');
    const pubDate = pubDateRaw ? new Date(pubDateRaw) : null;
    if (!title || !link) continue;
    items.push({ title, link, pubDate: pubDate && !isNaN(pubDate) ? pubDate.toISOString() : null });
  }
  return items;
}

async function main() {
  const { sources } = JSON.parse(fs.readFileSync(SOURCES_PATH, 'utf-8'));
  const cutoff = Date.now() - WINDOW_HOURS * 3600 * 1000;

  const all = [];
  for (const src of sources) {
    try {
      const xml = await get(src.url);
      const items = parseFeed(xml).map((it) => ({ ...it, source: src.name, category: src.category }));
      all.push(...items);
      console.log(`[ok]   ${src.name} — ${items.length} items`);
    } catch (e) {
      console.warn(`[fail] ${src.name} — ${e.message}`);
    }
  }

  // Filtre fenêtre temporelle — garde les items sans date plutôt que de les
  // perdre silencieusement (certains flux n'exposent pas toujours pubDate).
  const recent = all.filter((it) => !it.pubDate || new Date(it.pubDate).getTime() >= cutoff);

  // Dédoublonnage par URL normalisée (query string retirée) puis par titre.
  const seenUrls = new Set();
  const seenTitles = new Set();
  const deduped = [];
  for (const it of recent) {
    const urlKey = it.link.split('?')[0].replace(/\/$/, '');
    const titleKey = it.title.toLowerCase().trim();
    if (seenUrls.has(urlKey) || seenTitles.has(titleKey)) continue;
    seenUrls.add(urlKey);
    seenTitles.add(titleKey);
    deduped.push(it);
  }

  deduped.sort((a, b) => new Date(b.pubDate || 0) - new Date(a.pubDate || 0));

  const today = new Date().toISOString().slice(0, 10);
  const outPath = path.join(OUT_DIR, `veille-${today}.json`);
  fs.writeFileSync(outPath, JSON.stringify({ generatedAt: new Date().toISOString(), windowHours: WINDOW_HOURS, items: deduped }, null, 2));

  console.log(`\n=== Short-list (${deduped.length} candidats, dernières ${WINDOW_HOURS}h) ===\n`);
  const byCategory = {};
  for (const it of deduped) {
    byCategory[it.category] = byCategory[it.category] || [];
    byCategory[it.category].push(it);
  }
  for (const [cat, items] of Object.entries(byCategory)) {
    console.log(`--- ${cat} (${items.length}) ---`);
    for (const it of items) {
      const d = it.pubDate ? new Date(it.pubDate).toLocaleString('fr-FR') : 'date inconnue';
      console.log(`  [${it.source}] ${it.title}\n    ${it.link}  (${d})`);
    }
    console.log('');
  }
  console.log(`Écrit dans ${outPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
