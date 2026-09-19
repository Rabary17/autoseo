// Publie le brouillon d'article du silo "Combien ça coûte vraiment" (ex-"Tests", pipeline agents IA) dans WordPress.
// Usage : node scripts/publish-test-article.js --slug=<slug> [--apply]
// Sans --apply : simulation complète (aucun appel d'écriture), affiche ce qui serait fait.
//
// Étapes : catégorie "Combien ça coûte vraiment" + sous-catégorie du sous-cocon (idempotent, comme
// create-wp-category.js) -> upload des 2 captures preuves comme médias -> résolution
// auteur (persona -> slug WP -> user id) -> résolution tags -> insertion du post en
// post_status=draft (jamais publish/future depuis ce script, conformément à
// skills/agents-ia.md section 5 et au contrôle humain systématique du projet).
//
// Ce script suit exactement les conventions déjà en usage dans scripts/autopublish/run.js
// (mêmes helpers wp-client, même forme de payload createPost, même façon de résoudre
// catégories/tags/auteur/média) — voir ce fichier pour les cas plus généraux (silos P1-P6).
const fs = require('fs');
const path = require('path');
const wp = require(path.join(__dirname, 'autopublish', 'lib', 'wp-client'));

const arg = name => {
  const f = process.argv.find(a => a.startsWith(`--${name}=`));
  return f ? f.slice(name.length + 3) : null;
};
const APPLY = process.argv.includes('--apply');
const slug = arg('slug');
if (!slug) { console.error('Usage: --slug=<slug> [--apply]'); process.exit(1); }

function slugifyFr(s) {
  return s
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/&/g, ' ')
    .replace(/'/g, '-')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const ROOT = path.join(__dirname, '..');
const draftPath = path.join(ROOT, 'data', 'tests', 'articles', `${slug}.json`);
if (!fs.existsSync(draftPath)) { console.error(`Brouillon introuvable : ${draftPath}`); process.exit(1); }
const draft = JSON.parse(fs.readFileSync(draftPath, 'utf8'));

const reportPath = path.join(ROOT, draft.rapport_source);
const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
if (!report.critique || report.critique.verdict !== 'Validé') {
  console.error(`Refus : le rapport Testeur (${draft.rapport_source}) n'a pas de verdict de critique "Validé". Lance /agent-critique avant de publier.`);
  process.exit(1);
}

const gutenbergPath = path.join(ROOT, draft.content_gutenberg_file);
let content = fs.readFileSync(gutenbergPath, 'utf8');

const niche = require(path.join(ROOT, 'config', 'niches', 'auto-mobilite', 'niche.json'));
const authorInfo = niche.authors[draft.auteur];
if (!authorInfo) { console.error(`Auteur "${draft.auteur}" introuvable dans niche.json.`); process.exit(1); }

console.log(`Article : ${draft.titre_h1}`);
console.log(`Slug : ${draft.slug} | Silo : ${draft.silo} | Sous-cocon : ${draft.sous_cocon}`);
console.log(`Auteur : ${authorInfo.nom} (wp_slug=${authorInfo.wp_slug})`);
console.log(`Images à uploader : ${draft.images_corps.map(i => i.path).join(', ')}`);
console.log(`Statut cible : ${draft.post_status_cible} (jamais publish/future depuis ce script)`);

if (!APPLY) {
  console.log('\n(simulation — relancer avec --apply pour publier réellement en brouillon WordPress)');
  process.exit(0);
}

(async () => {
  // 1. Catégories (idempotent)
  const parentSlug = 'combien-ca-coute-vraiment';
  let parentCat = (await wp.request(`/categories?slug=${parentSlug}`))[0];
  if (!parentCat) {
    parentCat = await wp.request('/categories', { method: 'POST', body: { name: 'Combien ça coûte vraiment', slug: parentSlug } });
    console.log(`Catégorie "Combien ça coûte vraiment" créée (id ${parentCat.id}).`);
  } else {
    console.log(`Catégorie "Combien ça coûte vraiment" déjà présente (id ${parentCat.id}).`);
  }

  const sousCoconSlug = slugifyFr(draft.sous_cocon);
  let sousCoconCat = (await wp.request(`/categories?slug=${sousCoconSlug}`))[0];
  if (!sousCoconCat) {
    sousCoconCat = await wp.request('/categories', {
      method: 'POST',
      body: { name: draft.sous_cocon, slug: sousCoconSlug, parent: parentCat.id },
    });
    console.log(`Sous-catégorie "${draft.sous_cocon}" créée (id ${sousCoconCat.id}).`);
  } else {
    console.log(`Sous-catégorie "${draft.sous_cocon}" déjà présente (id ${sousCoconCat.id}).`);
  }

  // 2. Upload des images preuves comme médias
  const mediaBySlot = {};
  for (const img of draft.images_corps) {
    const filePath = path.join(ROOT, img.path);
    const buffer = fs.readFileSync(filePath);
    const filename = path.basename(filePath);
    const mime = filename.endsWith('.png') ? 'image/png' : 'image/jpeg';
    const media = await wp.uploadMedia(buffer, filename, mime, img.alt);
    console.log(`Média uploadé : ${filename} -> id ${media.id} (${media.source_url})`);
    content = content.split(img.placeholder).join(media.source_url);
    mediaBySlot[img.placeholder] = media;
  }
  // Image à la une = la première image (Dacia)
  const featuredImgPath = path.join(ROOT, draft.image_a_la_une);
  const featuredPlaceholderEntry = draft.images_corps.find(i => path.join(ROOT, i.path) === featuredImgPath);
  const featuredMediaId = featuredPlaceholderEntry ? mediaBySlot[featuredPlaceholderEntry.placeholder].id : undefined;

  // 3. Auteur
  const users = await wp.getAllUsers();
  const user = users.find(u => u.slug === authorInfo.wp_slug);
  if (!user) { throw new Error(`Compte WordPress introuvable pour l'auteur ${draft.auteur} (slug attendu "${authorInfo.wp_slug}").`); }

  // 4. Tags
  const tagIds = [];
  for (const tagName of draft.tags) {
    const tagSlug = slugifyFr(tagName);
    const tag = await wp.findOrCreateTerm('tags', tagSlug, { name: tagName, slug: tagSlug });
    tagIds.push(tag.id);
  }

  // 5. Création du post en draft
  const payload = {
    title: draft.titre_h1,
    slug: draft.slug,
    status: 'draft',
    content,
    excerpt: draft.meta_description,
    categories: [sousCoconCat.id],
    tags: tagIds,
    author: user.id,
    featured_media: featuredMediaId,
    acf: {
      meta_title: draft.meta_title,
      meta_description: draft.meta_description,
    },
  };
  const created = await wp.createPost(payload);
  console.log(`\nArticle inséré en brouillon WordPress : id ${created.id}`);
  console.log(`Lien de prévisualisation (édition) : ${created.link ? created.link.replace(/\/$/, '') + '?preview=true' : '(non renvoyé par l\'API)'}`);
  console.log('Statut :', created.status, '(jamais publish/future depuis ce script)');
})().catch(e => { console.error('Erreur:', e.message); process.exit(1); });
