// Publie ou met à jour le brouillon d'article du silo "Combien ça coûte vraiment" (ex-"Tests", pipeline agents IA) dans WordPress.
// Usage :
//   node scripts/publish-test-article.js --slug=<slug> [--apply]            crée un nouveau brouillon (comportement historique)
//   node scripts/publish-test-article.js --slug=<slug> --update [--apply]   met à jour le CONTENU du brouillon existant (même slug), sans toucher catégories/tags/auteur/image à la une
// Sans --apply : simulation complète (aucun appel d'écriture), affiche ce qui serait fait.
//
// Étapes (création) : catégorie "Combien ça coûte vraiment" + sous-catégorie du sous-cocon (idempotent, comme
// create-wp-category.js) -> upload des captures preuves comme médias -> résolution
// auteur (persona -> slug WP -> user id) -> résolution tags -> insertion du post en
// post_status=draft (jamais publish/future depuis ce script, conformément à
// skills/agents-ia.md section 5 et au contrôle humain systématique du projet).
//
// Étapes (--update) : retrouve le post existant par slug (context=edit, status=any),
// réutilise les images déjà uploadées (URLs extraites du content.raw déjà publié —
// aucun nouvel upload, pas de doublon media) et ne remplace QUE le champ `content`.
// Sert à intégrer une réécriture éditoriale (ex. passe anti-clichés IA) sans recréer
// un second brouillon ni retoucher catégories/tags/auteur/image à la une/statut.
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
const UPDATE = process.argv.includes('--update');
const slug = arg('slug');
if (!slug) { console.error('Usage: --slug=<slug> [--update] [--apply]'); process.exit(1); }

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
console.log(`Mode : ${UPDATE ? "mise à jour du contenu du brouillon existant" : "création d'un nouveau brouillon"}`);
if (!UPDATE) console.log(`Images à uploader : ${draft.images_corps.map(i => i.path).join(', ')}`);
console.log(`Statut cible : ${draft.post_status_cible} (jamais publish/future depuis ce script)`);

if (!APPLY) {
  console.log('\n(simulation — relancer avec --apply pour publier réellement en brouillon WordPress)');
  process.exit(0);
}

(async () => {
  if (UPDATE) {
    // Mode mise à jour : retrouve le post existant, réutilise ses images déjà
    // uploadées (pas de re-upload -> pas de doublon media), ne touche à rien
    // d'autre (catégories/tags/auteur/image à la une/statut inchangés).
    const existingList = await wp.request(`/posts?slug=${encodeURIComponent(draft.slug)}&status=any&context=edit`);
    const existing = Array.isArray(existingList) && existingList[0];
    if (!existing) {
      console.error(`Aucun post existant trouvé pour le slug "${draft.slug}" — utilise le script sans --update pour créer le premier brouillon.`);
      process.exit(1);
    }
    const existingHtml = (existing.content && (existing.content.raw || existing.content.rendered)) || '';
    const existingImgUrls = Array.from(existingHtml.matchAll(/<img[^>]+src="([^"]+)"/g)).map(m => m[1]);
    if (existingImgUrls.length !== draft.images_corps.length) {
      console.error(
        `Incohérence : ${existingImgUrls.length} image(s) trouvée(s) dans le post existant (id ${existing.id}), ` +
        `${draft.images_corps.length} attendue(s) d'après ${draft.slug}.json. Abandon plutôt que de deviner l'association.`
      );
      process.exit(1);
    }
    draft.images_corps.forEach((img, i) => {
      content = content.split(img.placeholder).join(existingImgUrls[i]);
    });
    const updated = await wp.updatePost(existing.id, { content });
    console.log(`\nContenu mis à jour sur le brouillon WordPress existant : id ${updated.id}`);
    console.log(`Lien de prévisualisation (édition) : ${updated.link ? updated.link.replace(/\/$/, '') + '?preview=true' : "(non renvoyé par l'API)"}`);
    console.log('Statut :', updated.status, '(inchangé par --update)');
    return;
  }

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
  console.log(`Lien de prévisualisation (édition) : ${created.link ? created.link.replace(/\/$/, '') + '?preview=true' : "(non renvoyé par l'API)"}`);
  console.log('Statut :', created.status, '(jamais publish/future depuis ce script)');
})().catch(e => { console.error('Erreur:', e.message); process.exit(1); });
