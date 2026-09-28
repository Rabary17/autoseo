#!/usr/bin/env node
// Réattribution en masse de l'auteur (et backfill de l'image à la une) des
// actus déjà publiées avant le correctif du 2026-09-28 de generate.js, qui
// créait ses brouillons sans `author` ni `featured_media` — WordPress les
// attribuait alors au compte authentifié de la requête REST (le compte
// personnel réel), jamais à une persona, et sans image du tout.
//
// Contrairement à scripts/i18n/reassign-authors.js, il n'existe aucun index
// local fiable pour les actus (data/actus/generated-log.json est écrit par
// un runner GitHub Actions éphémère, jamais recommité dans le repo — voir
// generate.js). Ce script interroge donc directement WordPress : tous les
// posts de la catégorie "actualites", quel que soit leur auteur actuel.
//
// Persona déduite du champ ACF `sources` (`"<nom source> — <lien>"`, écrit
// par generate.js) recoupé avec data/actus/sources.json (category par
// source) et ACTUS_PERSONA_BY_CATEGORY — exactement la même table que dans
// generate.js. Une actu dont la source n'est plus dans sources.json (source
// retirée depuis) retombe sur la persona "actualite-generaliste" par défaut.
//
// Toujours DRY-RUN par défaut (aucune écriture WordPress). `--apply` pour
// appliquer réellement. `--backfill-images` (avec --apply) source aussi une
// image à la une pour les actus qui n'en ont pas.
//
// Usage :
//   node scripts/actus/reassign-authors.js                          # dry-run
//   node scripts/actus/reassign-authors.js --apply                  # auteurs uniquement
//   node scripts/actus/reassign-authors.js --apply --backfill-images
const fs = require('fs');
const path = require('path');
const wp = require('../autopublish/lib/wp-client');
const persona = require('../autopublish/lib/persona');
const autopublishConfig = require('../autopublish/config');
const images = require('../autopublish/lib/images');

const APPLY = process.argv.includes('--apply');
const BACKFILL_IMAGES = process.argv.includes('--backfill-images');

const SOURCES_PATH = path.join(__dirname, '..', '..', 'data', 'actus', 'sources.json');
const sourcesConfig = JSON.parse(fs.readFileSync(SOURCES_PATH, 'utf8'));
const CATEGORY_BY_SOURCE_NAME = new Map(sourcesConfig.sources.map((s) => [s.name, s.category]));

// Même table que scripts/actus/generate.js — dupliquée volontairement plutôt
// qu'importée : generate.js n'exporte rien (c'est un script `main()`), et
// une vraie extraction commune serait plus de churn que ces 2 lignes.
const ACTUS_PERSONA_BY_CATEGORY = {
  reglementaire: 'D',
  'actualite-generaliste': 'B',
};

function categoryFromAcfSources(acfSources) {
  // Format écrit par generate.js : "<nom source> — <lien>".
  const name = String(acfSources || '').split(' — ')[0].trim();
  return CATEGORY_BY_SOURCE_NAME.get(name) || 'actualite-generaliste';
}

(async () => {
  const catTerm = await wp.request(`/categories?slug=actualites`);
  const category = Array.isArray(catTerm) && catTerm[0];
  if (!category) {
    console.log('Aucune catégorie "actualites" trouvée sur WordPress — rien à faire.');
    return;
  }

  const posts = [];
  for (let pageNum = 1; ; pageNum++) {
    const batch = await wp.request(`/posts?categories=${category.id}&status=any&context=edit&per_page=100&page=${pageNum}`);
    if (!Array.isArray(batch) || !batch.length) break;
    posts.push(...batch);
    if (batch.length < 100) break;
  }
  console.log(`${posts.length} actu(s) trouvée(s) sur WordPress (catégorie "actualites").\n`);
  if (!posts.length) return;

  const authorIdCache = new Map();
  let usersCache = null;
  async function resolveAuthor(cat) {
    const key = ACTUS_PERSONA_BY_CATEGORY[cat] || ACTUS_PERSONA_BY_CATEGORY['actualite-generaliste'];
    if (authorIdCache.has(key)) return authorIdCache.get(key);
    const slug = autopublishConfig.WP_AUTHOR_SLUG_BY_PERSONA[key];
    if (!usersCache) usersCache = await wp.getAllUsers();
    const user = usersCache.find((u) => u.slug === slug);
    if (!user) throw new Error(`Compte WordPress introuvable pour la persona ${key} (slug attendu "${slug}").`);
    const resolved = { id: user.id, key, slug };
    authorIdCache.set(key, resolved);
    return resolved;
  }

  let planned = 0, changed = 0, imagesBackfilled = 0, errors = 0;
  for (const post of posts) {
    try {
      const acfSources = (post.acf && post.acf.sources) || '';
      const cat = categoryFromAcfSources(acfSources);
      const author = await resolveAuthor(cat);
      const needsImage = BACKFILL_IMAGES && !post.featured_media;
      const title = post.title && (post.title.raw || post.title.rendered) || `#${post.id}`;

      if (!APPLY) {
        console.log(`[dry-run] post/${post.id} "${title}" (source="${acfSources.split(' — ')[0]}", cat=${cat}) -> persona ${author.key} (#${author.id}, ${author.slug})${needsImage ? ' + image à backfiller' : ''}`);
        planned++;
        continue;
      }

      const payload = { author: author.id };
      if (needsImage) {
        try {
          const found = await images.findImage(title, { silo: 'actualites' });
          if (found) {
            const { buffer } = await images.downloadImage(found.url);
            const webpBuffer = await images.toWebp(buffer);
            const media = await wp.uploadMedia(webpBuffer, images.buildImageFilename(title, 'actu-une'), 'image/webp', title);
            payload.featured_media = media.id;
          }
        } catch (e) {
          console.warn(`  [images] échec backfill pour post/${post.id} : ${e.message}`);
        }
      }

      const updated = await wp.updatePost(post.id, payload);
      changed++;
      if (payload.featured_media) imagesBackfilled++;
      console.log(`[applied] post/${post.id} "${title}" -> auteur #${updated.author} (persona ${author.key})${payload.featured_media ? `, image #${payload.featured_media}` : ''}`);
    } catch (e) {
      errors++;
      console.error(`[erreur] post/${post.id} : ${e.message}`);
    }
  }

  if (!APPLY) {
    console.log(`\n=== Dry-run terminé — ${planned} changement(s) prévu(s), ${errors} erreur(s) ===`);
    console.log('Relancer avec --apply pour appliquer réellement ces changements sur WordPress.');
  } else {
    console.log(`\n=== Application terminée — ${changed} modifié(s) (dont ${imagesBackfilled} image(s) ajoutée(s)), ${errors} erreur(s) ===`);
  }
})().catch((e) => { console.error(e); process.exit(1); });
