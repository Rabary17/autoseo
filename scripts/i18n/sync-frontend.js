#!/usr/bin/env node
// Synchronise la configuration i18n et l'index des traductions vers le
// frontend Next.js (2026-08-21).
//
// Pourquoi une copie plutot qu'un import direct : `frontend/monauto` est un
// package a part, avec son propre `tsconfig` et son alias `@/` pointant sur sa
// racine. Importer `../../../data/i18n/index.json` depuis un composant
// fonctionnerait peut-etre au build local, mais dependrait du resolveur de
// modules et casserait au deploiement Vercel (racine de build differente).
// Une copie explicite, versionnee dans git, est verifiable et sans surprise.
//
// A RELANCER apres chaque lot de traduction — c'est automatique : appele en fin
// de `scripts/i18n/translate.js`. Sans cela, le frontend servirait un index
// perime : des articles traduits invisibles, ou pire, des liens vers des pages
// dont le slug a change.
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const DEST_DIR = path.join(ROOT, 'frontend', 'monauto', 'data');

const FICHIERS = [
  { src: path.join(ROOT, 'config', 'i18n.json'), dest: path.join(DEST_DIR, 'i18n-config.json') },
  { src: path.join(ROOT, 'data', 'i18n', 'index.json'), dest: path.join(DEST_DIR, 'i18n-index.json') },
];

function sync({ silencieux = false } = {}) {
  if (!fs.existsSync(DEST_DIR)) {
    if (!silencieux) console.warn(`[sync-frontend] ${DEST_DIR} absent — frontend non synchronise.`);
    return false;
  }
  let modifies = 0;
  for (const { src, dest } of FICHIERS) {
    if (!fs.existsSync(src)) {
      if (!silencieux) console.warn(`[sync-frontend] source absente : ${src}`);
      continue;
    }
    const contenu = fs.readFileSync(src, 'utf8');
    // JSON.parse avant ecriture : ne jamais propager un fichier invalide vers
    // le frontend, ou le build Next casserait sur un import JSON malforme.
    try {
      JSON.parse(contenu);
    } catch (e) {
      console.error(`[sync-frontend] ${path.basename(src)} est un JSON invalide (${e.message}) — copie annulee.`);
      return false;
    }
    const ancien = fs.existsSync(dest) ? fs.readFileSync(dest, 'utf8') : null;
    if (ancien === contenu) continue;
    fs.writeFileSync(dest, contenu, 'utf8');
    modifies++;
    if (!silencieux) console.log(`[sync-frontend] ${path.basename(src)} -> data/${path.basename(dest)}`);
  }
  if (!silencieux && !modifies) console.log('[sync-frontend] frontend deja a jour.');
  return true;
}

module.exports = { sync, FICHIERS, DEST_DIR };

if (require.main === module) {
  const ok = sync();
  process.exitCode = ok ? 0 : 1;
}
