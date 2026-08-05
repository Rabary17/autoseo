// Le "feu vert quotidien" : liste les actus en brouillon (catégorie
// Actualités) pour validation humaine, et publie seulement celles
// explicitement approuvées. Rien n'est jamais publié sans ce geste manuel
// (voir generate.js et skills/gestion-de-projet.md).
// Usage :
//   node scripts/actus/approve.js                 -> liste les brouillons
//   node scripts/actus/approve.js --publish=123    -> publie le post #123
//   node scripts/actus/approve.js --publish-all    -> publie tous les brouillons listés
//   node scripts/actus/approve.js --reject=123     -> supprime le post #123 (pas de corbeille, "trash" refusé par ce WP)
const wp = require('../autopublish/lib/wp-client');

async function listDraftActus() {
  const term = await wp.request('/categories?slug=actualites');
  if (!Array.isArray(term) || !term.length) {
    console.log('Aucune catégorie "Actualités" trouvée (aucune actu générée pour l\'instant).');
    return [];
  }
  const categoryId = term[0].id;
  return wp.request(`/posts?categories=${categoryId}&status=draft&per_page=50&context=edit`);
}

async function main() {
  const publishArg = process.argv.find((a) => a.startsWith('--publish='));
  const rejectArg = process.argv.find((a) => a.startsWith('--reject='));
  const publishAll = process.argv.includes('--publish-all');

  if (publishArg) {
    const id = Number(publishArg.split('=')[1]);
    await wp.updatePost(id, { status: 'publish', date_gmt: new Date().toISOString().replace(/Z$/, '') });
    console.log(`Publié : post WP #${id}`);
    return;
  }
  if (rejectArg) {
    const id = Number(rejectArg.split('=')[1]);
    await wp.request(`/posts/${id}?force=true`, { method: 'DELETE' });
    console.log(`Rejeté (supprimé) : post WP #${id}`);
    return;
  }

  const drafts = await listDraftActus();
  if (!drafts.length) {
    console.log('Aucune actu en attente de validation.');
    return;
  }

  console.log(`=== ${drafts.length} actu(s) en attente de validation ===\n`);
  for (const p of drafts) {
    const words = (p.content.raw || '').replace(/<[^>]+>/g, ' ').trim().split(/\s+/).filter(Boolean).length;
    console.log(`#${p.id} — ${p.title.raw}`);
    console.log(`  ${words} mots — sources: ${p.acf?.sources || '(non renseigné)'}`);
    console.log(`  extrait : ${p.acf?.tldr || p.excerpt.raw}`);
    console.log(`  -> node scripts/actus/approve.js --publish=${p.id}   (ou --reject=${p.id})\n`);
  }

  if (publishAll) {
    for (const p of drafts) {
      await wp.updatePost(p.id, { status: 'publish', date_gmt: new Date().toISOString().replace(/Z$/, '') });
      console.log(`Publié : #${p.id}`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
