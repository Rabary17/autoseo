#!/usr/bin/env node
// Répare les images à la une ("-couverture.*") téléchargées avant le correctif
// de scripts/migration/export-wordpress.js (bug du 2026-11-20 : `telechargerImage`
// utilisait `rawGet()`, qui décode la réponse en texte UTF-8 — corrompt tout
// octet binaire invalide en UTF-8, remplacé par 0xFD une fois réencodé). Les
// 328 images à la une sont concernées (jpg ET webp) ; les images inline de
// convertir-en-markdown.js sont saines (téléchargement déjà binaire).
//
// Retélécharge chaque image depuis sa source_url WordPress d'origine
// (`data.image.source_url`, lecture seule) et écrase à la fois le cache
// data/migration/images/{id}.{ext} et le fichier public déjà copié
// frontend/monauto-static/public/images/articles/{slug}-couverture.{ext}.
//
// Usage : node scripts/migration/reparer-images-couverture.js
"use strict";
const fs = require("fs");
const path = require("path");
const http = require("http");
const https = require("https");

const ROOT = path.join(__dirname, "..", "..");
const EXPORT_DIR = path.join(ROOT, "data", "migration", "export");
const IMAGES_CACHE_DIR = path.join(ROOT, "data", "migration", "images");
const IMAGES_PUBLIC_DIR = path.join(ROOT, "frontend", "monauto-static", "public", "images", "articles");

function telechargerBinaire(url) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith("https:") ? https : http;
    mod
      .get(url, { headers: { "User-Agent": "monauto-migration/1.0" } }, (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => resolve({ status: res.statusCode ?? 0, ok: (res.statusCode ?? 0) >= 200 && (res.statusCode ?? 0) < 300, body: Buffer.concat(chunks) }));
      })
      .on("error", reject);
  });
}

function listerExports() {
  const fichiers = [];
  for (const locale of ["fr", "en"]) {
    for (const type of ["posts", "pages"]) {
      const dir = path.join(EXPORT_DIR, locale, type);
      if (!fs.existsSync(dir)) continue;
      for (const f of fs.readdirSync(dir)) if (f.endsWith(".json")) fichiers.push(path.join(dir, f));
    }
  }
  return fichiers;
}

async function main() {
  const fichiers = listerExports();
  let ok = 0;
  let echecs = 0;
  let sansImage = 0;
  for (const fichier of fichiers) {
    const data = JSON.parse(fs.readFileSync(fichier, "utf8"));
    const slug = data.slug;
    if (!data.image?.source_url) {
      sansImage++;
      continue;
    }
    const ext = path.extname(data.image.local || "") || ".jpg";
    const cheminPublic = path.join(IMAGES_PUBLIC_DIR, `${slug}-couverture${ext}`);
    if (!fs.existsSync(cheminPublic)) {
      // Phase 1 n'a pas produit ce fichier (article sans couverture au final) — rien à réparer ici.
      continue;
    }
    try {
      const res = await telechargerBinaire(data.image.source_url);
      if (!res.ok) {
        console.error(`  échec (HTTP ${res.status}) : ${slug} — ${data.image.source_url}`);
        echecs++;
        continue;
      }
      fs.writeFileSync(cheminPublic, res.body);
      if (data.image.local) fs.writeFileSync(path.join(ROOT, data.image.local), res.body);
      ok++;
      if (ok % 50 === 0) console.log(`  ${ok} images réparées...`);
    } catch (err) {
      console.error(`  erreur : ${slug} — ${err.message}`);
      echecs++;
    }
  }
  console.log(`\nTerminé : ${ok} images réparées, ${echecs} échecs, ${sansImage} articles sans image.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
