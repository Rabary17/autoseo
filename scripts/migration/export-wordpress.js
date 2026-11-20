#!/usr/bin/env node
// Export en lecture seule du contenu WordPress réel (monauto/Techcars,
// mntdev.riseasso.com) vers des fichiers JSON locaux — Phase 0 du plan de
// migration vers Markdown/Vercel. N'écrit RIEN sur WordPress.
//
// Constat du 2026-11-20 (vérifié en direct, authentifié, context=edit, sur
// 20 articles récents dont celui explicitement documenté comme complet dans
// STATE.md) : les champs ACF (tldr/sources/faq/meta_title/meta_description)
// sont vides sur TOUS les articles déjà publiés, malgré un groupe de champs
// correctement enregistré côté mu-plugin (show_in_rest => 1, bons noms).
// Cause non élucidée (fichier local vs déploiement réel ?), hors périmètre
// de cet export. Décision utilisateur : migrer sans ces champs pour
// l'existant — seuls titre/corps/catégories/tags/auteur/image sont exportés.
//
// Usage : node scripts/migration/export-wordpress.js
"use strict";
const fs = require("fs");
const path = require("path");
const http = require("http");
const https = require("https");

const ROOT = path.join(__dirname, "..", "..");
const EXPORT_DIR = path.join(ROOT, "data", "migration", "export");
const IMAGES_DIR = path.join(ROOT, "data", "migration", "images");

function lireEnv(cle) {
  const env = fs.readFileSync(path.join(ROOT, ".env"), "utf8");
  const m = env.match(new RegExp(`^${cle}=(.*)$`, "m"));
  return m ? m[1].trim() : "";
}

const WP_ORIGIN = lireEnv("WP_URL").replace(/\/$/, "").replace(/\/wp-json\/wp\/v2\/?$/, "");
const AUTH = (() => {
  const user = lireEnv("WP_USER");
  const pass = lireEnv("WP_APP_PASSWORD");
  return user && pass ? "Basic " + Buffer.from(`${user}:${pass}`).toString("base64") : null;
})();

// --- Client WP minimal, porté de frontend/monauto/lib/wp.ts (rawGet/retry/
// concurrence) — même hébergeur fragile, mêmes constats de production : fetch()
// plante (502), per_page>15 avec _embed sature PHP-FPM, d'où les tailles de
// page "sûres" ci-dessous. Pas de cache (unstable_cache/react cache) : inutile
// pour un script one-shot, elles exigent de toute façon un runtime Next.js.
function rawGet(url) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith("https:") ? https : http;
    const req = mod.get(url, { headers: { "User-Agent": "monauto-migration/1.0", ...(AUTH ? { Authorization: AUTH } : {}) } }, (res) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => {
        const body = Buffer.concat(chunks).toString("utf-8");
        resolve({ status: res.statusCode ?? 0, ok: (res.statusCode ?? 0) >= 200 && (res.statusCode ?? 0) < 300, body });
      });
    });
    req.on("error", reject);
    req.setTimeout(10000, () => req.destroy(new Error(`timeout: ${url}`)));
  });
}

function buildWpUrl(resourcePathAndQuery) {
  const qIndex = resourcePathAndQuery.indexOf("?");
  const resourcePath = qIndex === -1 ? resourcePathAndQuery : resourcePathAndQuery.slice(0, qIndex);
  const query = qIndex === -1 ? "" : resourcePathAndQuery.slice(qIndex + 1);
  return `${WP_ORIGIN}/?rest_route=/wp/v2${resourcePath}${query ? `&${query}` : ""}`;
}

const MAX_CONCURRENT = 2;
let actifs = 0;
const file = [];
async function avecLimiteConcurrence(fn) {
  if (actifs >= MAX_CONCURRENT) await new Promise((r) => file.push(r));
  actifs++;
  try {
    return await fn();
  } finally {
    actifs--;
    file.shift()?.();
  }
}

async function wpFetch(pathAndQuery, retries = 2) {
  return avecLimiteConcurrence(async () => {
    let dernierErr;
    for (let tentative = 0; tentative <= retries; tentative++) {
      try {
        const res = await rawGet(buildWpUrl(pathAndQuery));
        if (res.status === 404) return { status: 404, body: "[]" };
        if (!res.ok) throw new Error(`WP ${res.status} — ${pathAndQuery}`);
        if (res.body.length === 0) throw new Error(`réponse vide (200) — ${pathAndQuery}`);
        return res;
      } catch (err) {
        dernierErr = err;
        if (tentative < retries) await new Promise((r) => setTimeout(r, 600));
      }
    }
    throw dernierErr;
  });
}

const wpJson = async (pathAndQuery) => JSON.parse((await wpFetch(pathAndQuery)).body);

// --- Pagination sûre (constats de frontend/monauto/lib/wp.ts) ---
const SAFE_EMBED_PAGE_SIZE = 10; // /posts avec _embed=1
const SAFE_PAGE_SIZE = 20; // /pages (contenu hub/sous-hub volumineux)

async function toutesLesPages(ressource, tailleSure, extraQuery = "") {
  const tout = [];
  let page = 1;
  while (true) {
    const res = await wpFetch(`/${ressource}?per_page=${tailleSure}&status=publish&page=${page}&_embed=1${extraQuery}`);
    const lot = JSON.parse(res.body);
    if (!Array.isArray(lot) || lot.length === 0) break;
    tout.push(...lot);
    if (lot.length < tailleSure) break;
    page++;
  }
  return tout;
}

function decoderEntites(s) {
  const ENTITIES = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#039;": "'", "&nbsp;": " ", "&rsquo;": "’", "&lsquo;": "‘", "&rdquo;": "”", "&ldquo;": "“", "&hellip;": "…", "&mdash;": "—", "&ndash;": "–" };
  return s ? s.replace(new RegExp(Object.keys(ENTITIES).join("|"), "g"), (m) => ENTITIES[m]) : s ?? "";
}

// --- Détection de langue : même source de vérité que lib/i18n.ts
// (TOUS_SLUGS_NON_FR pour les pages, catégorie 528 pour les posts). ---
function construireIndexNonFr() {
  const indexPath = path.join(ROOT, "frontend", "monauto", "data", "i18n-index.json");
  const index = JSON.parse(fs.readFileSync(indexPath, "utf8"));
  const slugs = new Set();
  for (const parLocale of Object.values(index.articles || {})) {
    for (const t of Object.values(parLocale)) if (t?.slug) slugs.add(t.slug);
  }
  for (const parLocale of Object.values(index.taxonomie || {})) {
    for (const taxo of Object.values(parLocale)) {
      if (taxo.slug) slugs.add(taxo.slug);
      for (const sc of Object.values(taxo.sous_cocons || {})) if (sc.slug) slugs.add(sc.slug);
    }
  }
  return slugs;
}

function categorieAnglaise() {
  const cfgPath = path.join(ROOT, "frontend", "monauto", "data", "i18n-config.json");
  const cfg = JSON.parse(fs.readFileSync(cfgPath, "utf8"));
  return cfg.categories_marqueur?.en ?? null;
}

// Téléchargement BINAIRE (chunks Buffer concaténés directement, jamais
// `.toString("utf-8")`) — `rawGet()` ci-dessus décode chaque réponse en texte
// UTF-8, ce qui est correct pour du JSON mais corrompt silencieusement tout
// octet binaire qui ne forme pas une séquence UTF-8 valide (remplacé par
// U+FFFD, puis tronqué à 0xFD lors du `Buffer.from(str, "binary")` qui
// suivait) — bug découvert le 2026-11-20 : les 328 images à la une
// téléchargées via cette fonction étaient toutes corrompues (jamais les
// images inline de `convertir-en-markdown.js`, qui utilisent déjà un
// téléchargement binaire correct). Voir scripts/migration/reparer-images-couverture.js
// pour le script de réparation des images déjà téléchargées avant ce correctif.
function telechargerBinaire(url) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith("https:") ? https : http;
    mod
      .get(url, { headers: { "User-Agent": "monauto-migration/1.0", ...(AUTH ? { Authorization: AUTH } : {}) } }, (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => resolve({ status: res.statusCode ?? 0, ok: (res.statusCode ?? 0) >= 200 && (res.statusCode ?? 0) < 300, body: Buffer.concat(chunks) }));
      })
      .on("error", reject);
  });
}

async function telechargerImage(url, id) {
  if (!url) return null;
  const ext = (url.split(".").pop() || "jpg").split("?")[0].slice(0, 5);
  const fichier = path.join(IMAGES_DIR, `${id}.${ext}`);
  if (fs.existsSync(fichier)) return path.relative(ROOT, fichier).replace(/\\/g, "/");
  const res = await telechargerBinaire(url);
  if (!res.ok) {
    console.error(`  image ${id} : échec téléchargement (HTTP ${res.status})`);
    return null;
  }
  fs.writeFileSync(fichier, res.body);
  return path.relative(ROOT, fichier).replace(/\\/g, "/");
}

async function main() {
  if (!WP_ORIGIN) throw new Error("WP_URL manquant dans .env");
  fs.mkdirSync(path.join(EXPORT_DIR, "fr", "posts"), { recursive: true });
  fs.mkdirSync(path.join(EXPORT_DIR, "fr", "pages"), { recursive: true });
  fs.mkdirSync(path.join(EXPORT_DIR, "en", "posts"), { recursive: true });
  fs.mkdirSync(path.join(EXPORT_DIR, "en", "pages"), { recursive: true });
  fs.mkdirSync(IMAGES_DIR, { recursive: true });

  console.log(`Export depuis ${WP_ORIGIN} (authentifié : ${AUTH ? "oui" : "non"})`);

  const nonFrSlugs = construireIndexNonFr();
  const catEn = categorieAnglaise();

  console.log("Récupération des catégories/tags/auteurs...");
  const [categories, tags, auteurs] = await Promise.all([
    wpJson("/categories?per_page=100&hide_empty=false"),
    wpJson("/tags?per_page=100&hide_empty=false"),
    wpJson("/users?per_page=100"),
  ]);
  const nomCategorie = new Map(categories.map((c) => [c.id, decoderEntites(c.name)]));
  const nomTag = new Map(tags.map((t) => [t.id, decoderEntites(t.name)]));
  const auteurParId = new Map(auteurs.map((a) => [a.id, { slug: a.slug, name: decoderEntites(a.name) }]));

  console.log("Récupération de tous les posts publiés...");
  const posts = await toutesLesPages("posts", SAFE_EMBED_PAGE_SIZE);
  console.log(`  ${posts.length} posts trouvés.`);

  console.log("Récupération de toutes les pages publiées...");
  const pages = await toutesLesPages("pages", SAFE_PAGE_SIZE);
  console.log(`  ${pages.length} pages trouvées.`);

  const resume = { postsFr: 0, postsEn: 0, pagesFr: 0, pagesEn: 0, imagesTelechargees: 0, erreursImages: 0 };

  for (const post of posts) {
    const locale = post.categories?.includes(catEn) ? "en" : "fr";
    const media = post._embedded?.["wp:featuredmedia"]?.[0];
    let imageLocale = null;
    if (media?.source_url) {
      imageLocale = await telechargerImage(media.source_url, media.id).catch(() => null);
      if (imageLocale) resume.imagesTelechargees++;
      else if (media.source_url) resume.erreursImages++;
    }
    const sortie = {
      id: post.id,
      slug: post.slug,
      locale,
      link: post.link,
      title: decoderEntites(post.title?.rendered),
      content_html: post.content?.rendered ?? "",
      excerpt_html: post.excerpt?.rendered ?? "",
      date: post.date_gmt,
      modified: post.modified_gmt,
      author: auteurParId.get(post.author) ?? null,
      categories: (post.categories ?? []).map((id) => nomCategorie.get(id)).filter(Boolean),
      tags: (post.tags ?? []).map((id) => nomTag.get(id)).filter(Boolean),
      image: media ? { id: media.id, source_url: media.source_url, alt: media.alt_text || "", local: imageLocale } : null,
    };
    fs.writeFileSync(path.join(EXPORT_DIR, locale, "posts", `${post.slug}.json`), JSON.stringify(sortie, null, 2), "utf8");
    if (locale === "en") resume.postsEn++;
    else resume.postsFr++;
  }

  for (const page of pages) {
    const locale = nonFrSlugs.has(page.slug) ? "en" : "fr";
    const media = page._embedded?.["wp:featuredmedia"]?.[0];
    let imageLocale = null;
    if (media?.source_url) {
      imageLocale = await telechargerImage(media.source_url, media.id).catch(() => null);
      if (imageLocale) resume.imagesTelechargees++;
      else if (media.source_url) resume.erreursImages++;
    }
    const sortie = {
      id: page.id,
      slug: page.slug,
      locale,
      parent: page.parent || null,
      link: page.link,
      title: decoderEntites(page.title?.rendered),
      content_html: page.content?.rendered ?? "",
      date: page.date_gmt,
      modified: page.modified_gmt,
      image: media ? { id: media.id, source_url: media.source_url, alt: media.alt_text || "", local: imageLocale } : null,
    };
    fs.writeFileSync(path.join(EXPORT_DIR, locale, "pages", `${page.slug}.json`), JSON.stringify(sortie, null, 2), "utf8");
    if (locale === "en") resume.pagesEn++;
    else resume.pagesFr++;
  }

  fs.writeFileSync(
    path.join(EXPORT_DIR, "_summary.json"),
    JSON.stringify({ date: new Date().toISOString(), ...resume, total: posts.length + pages.length }, null, 2),
    "utf8"
  );

  console.log("\n=== Résumé export ===");
  console.log(`Posts FR : ${resume.postsFr} · Posts EN : ${resume.postsEn}`);
  console.log(`Pages FR : ${resume.pagesFr} · Pages EN : ${resume.pagesEn}`);
  console.log(`Total : ${posts.length + pages.length}`);
  console.log(`Images téléchargées : ${resume.imagesTelechargees} (échecs : ${resume.erreursImages})`);
  console.log(`Sortie : ${EXPORT_DIR}`);
}

main().catch((err) => {
  console.error("Erreur export :", err);
  process.exit(1);
});
