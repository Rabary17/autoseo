#!/usr/bin/env node
// Phase 1 de la migration WordPress → Markdown/Vercel : convertit l'export
// JSON de la Phase 0 (data/migration/export/) en fichiers Markdown + images
// locales, dans frontend/monauto-static/ (nouveau frontend statique, scaffoldé
// en Phase 2 — ce script prépare déjà content/posts/ et public/images/ à leur
// emplacement final).
//
// Pas de champs sources/FAQ/meta_description (ACF vide constaté en Phase 0,
// décision utilisateur de migrer l'existant sans ces champs).
//
// Usage : node scripts/migration/convertir-en-markdown.js
"use strict";
const fs = require("fs");
const path = require("path");
const https = require("https");
const http = require("http");
const TurndownService = require("turndown");
const { gfm } = require("turndown-plugin-gfm");

const ROOT = path.join(__dirname, "..", "..");
const EXPORT_DIR = path.join(ROOT, "data", "migration", "export");
const SITE_DIR = path.join(ROOT, "frontend", "monauto-static");
const POSTS_DIR = path.join(SITE_DIR, "content", "posts");
const IMAGES_PUBLIC_DIR = path.join(SITE_DIR, "public", "images", "articles");

const turndown = new TurndownService({ headingStyle: "atx", bulletListMarker: "-", codeBlockStyle: "fenced" });
turndown.use(gfm);
// Filet de sécurité : turndown-plugin-gfm plante parfois sur certaines
// structures de tableau pourtant valides (bug connu de la bibliothèque,
// `isHeadingRow` qui suppose un parentNode toujours présent) — repli sans le
// plugin GFM plutôt que de bloquer toute la conversion de l'article (perd le
// format tableau pour ce seul article, ne bloque rien d'autre).
const turndownSansGfm = new TurndownService({ headingStyle: "atx", bulletListMarker: "-", codeBlockStyle: "fenced" });
function convertirHtmlEnMarkdown(html) {
  try {
    return turndown.turndown(html);
  } catch (err) {
    console.error(`    repli sans plugin GFM (tableau) : ${err.message}`);
    return turndownSansGfm.turndown(html);
  }
}
// Gutenberg entoure chaque image d'un <figure>/<figcaption> — Turndown sait
// déjà convertir <img>, on ajoute juste une règle pour la légende (sinon le
// texte de figcaption se retrouve collé sans séparation).
turndown.addRule("figcaption", {
  filter: "figcaption",
  replacement: (content) => `\n*${content.trim()}*\n`,
});

function slugify(s) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function get(url) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith("https:") ? https : http;
    mod
      .get(url, (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => resolve({ status: res.statusCode ?? 0, body: Buffer.concat(chunks) }));
      })
      .on("error", reject);
  });
}

// Images déjà téléchargées en Phase 0 (image à la une) : juste copiées à leur
// emplacement final. Images INLINE (corps de l'article) : jamais téléchargées
// avant ce script (Phase 0 ne s'occupait que de l'image à la une) — téléchargées
// ici, une fois qu'on parcourt le corps de toute façon pour la conversion.
const cacheImagesInline = new Map(); // url WP -> chemin public local

async function telechargerImageInline(url, slug, index) {
  if (cacheImagesInline.has(url)) return cacheImagesInline.get(url);
  const ext = (url.split(".").pop() || "jpg").split("?")[0].slice(0, 5);
  const nomFichier = `${slug}-${index}.${ext}`;
  const dest = path.join(IMAGES_PUBLIC_DIR, nomFichier);
  if (!fs.existsSync(dest)) {
    const res = await get(url);
    if (res.status >= 200 && res.status < 300) fs.writeFileSync(dest, res.body);
    else {
      console.error(`    image inline échec (HTTP ${res.status}) : ${url}`);
      return null;
    }
  }
  const chemin = `/images/articles/${nomFichier}`;
  cacheImagesInline.set(url, chemin);
  return chemin;
}

// Remplace chaque URL WordPress dans le Markdown converti par le chemin local
// téléchargé — fait APRÈS la conversion Turndown (plus simple que d'intercepter
// chaque <img> pendant la conversion, et ça couvre aussi les images encodées
// différemment par Turndown).
async function localiserImagesDuCorps(markdown, slug) {
  const urls = [...markdown.matchAll(/!\[[^\]]*\]\((https?:\/\/[^\s)]+)\)/g)].map((m) => m[1]);
  let resultat = markdown;
  let index = 1;
  for (const url of [...new Set(urls)]) {
    const local = await telechargerImageInline(url, slug, index++);
    if (local) resultat = resultat.split(url).join(local);
  }
  return resultat;
}

function nettoyerMarkdown(md) {
  return md
    .replace(/\n{3,}/g, "\n\n") // Gutenberg laisse des doubles sauts de ligne entre chaque bloc
    .trim();
}

// L'export de Phase 0 ne décode les entités HTML que sur `title` (via WP),
// pas sur `excerpt_html` (laissé brut, destiné à passer par un parseur HTML
// comme Turndown qui décode au passage) — nécessaire ici puisqu'on ne fait
// qu'un strip de balises par regex, qui ne décode rien.
const ENTITES_HTML = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#039;": "'", "&nbsp;": " ", "&rsquo;": "’", "&lsquo;": "‘", "&rdquo;": "”", "&ldquo;": "“", "&hellip;": "…", "&mdash;": "—", "&ndash;": "–" };
function decoderEntites(s) {
  return s ? s.replace(new RegExp(Object.keys(ENTITES_HTML).join("|"), "g"), (m) => ENTITES_HTML[m]) : s ?? "";
}

function descriptionDepuisExtrait(excerptHtml, titre) {
  const texte = decoderEntites((excerptHtml || "").replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim();
  if (texte) return texte.slice(0, 155);
  return `Tout savoir sur ${titre.toLowerCase()}.`;
}

async function convertirItem(fichierJson, { estPage }) {
  const data = JSON.parse(fs.readFileSync(fichierJson, "utf8"));
  const slug = data.slug;
  const dossierPosts = estPage ? path.join(SITE_DIR, "content", "hubs") : POSTS_DIR;
  fs.mkdirSync(dossierPosts, { recursive: true });
  const cheminSortie = path.join(dossierPosts, `${slug}.md`);

  // 120/172 posts FR+EN commencent par un <h1> qui répète le titre (constaté
  // à la vérification) — redondant avec le <h1> que la page rendra depuis le
  // frontmatter `title`, à retirer avant conversion plutôt que d'afficher le
  // titre deux fois sur chaque page concernée.
  const htmlSansH1EnTete = (data.content_html || "").replace(/^\s*<h1[^>]*>[\s\S]*?<\/h1>\s*/i, "");
  let corpsMarkdown = nettoyerMarkdown(convertirHtmlEnMarkdown(htmlSansH1EnTete));
  corpsMarkdown = await localiserImagesDuCorps(corpsMarkdown, slug);

  // "Langue : EN" est un marqueur technique (voir lib/i18n.ts côté ancien
  // frontend), jamais une vraie catégorie éditoriale — à exclure du choix.
  // Constat : 34 des 35 posts anglais n'ont AUCUNE autre catégorie assignée
  // (contenu jamais catégorisé côté WordPress) — on laisse `category` absent
  // plutôt que d'en inventer une.
  const categoriesReelles = (data.categories || []).filter((c) => c !== "Langue : EN");
  const categorie = categoriesReelles[0] ? slugify(categoriesReelles[0]) : null;
  const date = (data.date || "").slice(0, 10);

  const frontmatterLignes = [
    "---",
    `title: ${JSON.stringify(data.title)}`,
    `description: ${JSON.stringify(descriptionDepuisExtrait(data.excerpt_html, data.title))}`,
    `date: "${date}"`,
  ];
  if (!estPage && data.author?.slug) frontmatterLignes.push(`author: "${data.author.slug}"`);
  if (categorie) frontmatterLignes.push(`category: "${categorie}"`);
  if (estPage && data.parent) frontmatterLignes.push(`parent: ${data.parent}`);
  frontmatterLignes.push(`wp_id: ${data.id}`, `wp_locale: "${data.locale}"`);

  if (data.image?.local) {
    const extOriginal = path.extname(data.image.local) || ".jpg";
    const nomCouverture = `${slug}-couverture${extOriginal}`;
    const destCouverture = path.join(IMAGES_PUBLIC_DIR, nomCouverture);
    fs.mkdirSync(IMAGES_PUBLIC_DIR, { recursive: true });
    fs.copyFileSync(path.join(ROOT, data.image.local), destCouverture);
    frontmatterLignes.push(`image: "/images/articles/${nomCouverture}"`);
    frontmatterLignes.push(`imageAlt: ${JSON.stringify(data.image.alt || data.title)}`);
  }
  frontmatterLignes.push("---", "");

  fs.writeFileSync(cheminSortie, frontmatterLignes.join("\n") + corpsMarkdown + "\n", "utf8");
  return cheminSortie;
}

async function main() {
  fs.mkdirSync(POSTS_DIR, { recursive: true });
  fs.mkdirSync(IMAGES_PUBLIC_DIR, { recursive: true });

  const resultats = { posts: 0, pages: 0, erreurs: [] };

  for (const locale of ["fr", "en"]) {
    for (const type of ["posts", "pages"]) {
      const dossier = path.join(EXPORT_DIR, locale, type);
      if (!fs.existsSync(dossier)) continue;
      const fichiers = fs.readdirSync(dossier).filter((f) => f.endsWith(".json"));
      for (const fichier of fichiers) {
        try {
          await convertirItem(path.join(dossier, fichier), { estPage: type === "pages" });
          resultats[type]++;
          if ((resultats.posts + resultats.pages) % 25 === 0) {
            console.log(`  ${resultats.posts + resultats.pages} items convertis...`);
          }
        } catch (err) {
          console.error(`Erreur conversion ${fichier} :`, err.message);
          resultats.erreurs.push({ fichier, erreur: err.message });
        }
      }
    }
  }

  console.log("\n=== Résumé conversion ===");
  console.log(`Posts convertis : ${resultats.posts}`);
  console.log(`Pages/hubs convertis : ${resultats.pages}`);
  console.log(`Images inline téléchargées : ${cacheImagesInline.size}`);
  console.log(`Erreurs : ${resultats.erreurs.length}`);
  for (const e of resultats.erreurs) console.log(`  - ${e.fichier} : ${e.erreur}`);
  console.log(`Sortie : ${SITE_DIR}`);
}

main().catch((err) => {
  console.error("Erreur conversion :", err);
  process.exit(1);
});
