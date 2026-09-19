// Crée (ou retrouve) une catégorie WP parente + ses catégories enfants (sous-cocons) pour un
// silo donné, à partir de config/niches/<niche>/niche.json — complète add-silo.py, qui ne
// touche jamais WordPress lui-même. Idempotent : ne recrée jamais une catégorie existante
// (recherche par slug avant création).
//
// Usage : node scripts/create-wp-category.js --niche auto-mobilite --silo "Combien ça coûte vraiment" [--apply]
// Sans --apply : simulation (affiche ce qui serait créé, aucun appel d'écriture).
const path = require('path');
const wp = require(path.join(__dirname, 'autopublish', 'lib', 'wp-client'));

const arg = name => {
  const f = process.argv.find(a => a.startsWith(`--${name}=`));
  return f ? f.slice(name.length + 3) : null;
};
const APPLY = process.argv.includes('--apply');
const nicheId = arg('niche') || 'auto-mobilite';
const siloName = arg('silo');
if (!siloName) { console.error('Usage: --niche <id> --silo "<nom exact>" [--apply]'); process.exit(1); }

function slugify(s) {
  return s
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // accents
    .replace(/&/g, ' ')
    .replace(/'/g, '-')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

(async () => {
  const niche = require(path.join(__dirname, '..', 'config', 'niches', nicheId, 'niche.json'));
  const silo = niche.silos.find(s => s.name === siloName);
  if (!silo) { console.error(`Silo "${siloName}" introuvable dans niche.json (${nicheId}).`); process.exit(1); }

  const parentSlug = silo.hub_slug || slugify(silo.name);
  console.log(`Niche: ${nicheId} | Silo: ${silo.name} | slug parent: ${parentSlug}`);
  console.log(`Sous-cocons (${silo.sous_cocons.length}): ${silo.sous_cocons.join(', ')}`);

  if (!APPLY) {
    console.log('\n(simulation — relancer avec --apply pour créer réellement les catégories WP)');
    return;
  }

  async function getOrCreate(name, slug, parentId) {
    const existing = await wp.request(`/categories?per_page=100&search=${encodeURIComponent(slug)}`);
    let cat = existing.find(c => c.slug === slug);
    if (cat) { console.log(`- "${name}" déjà présente (id ${cat.id}, slug ${cat.slug}).`); return cat; }
    cat = await wp.request('/categories', {
      method: 'POST',
      body: { name, slug, parent: parentId || 0 },
    });
    console.log(`- "${name}" créée (id ${cat.id}, slug ${cat.slug}).`);
    return cat;
  }

  const parent = await getOrCreate(silo.name, parentSlug, 0);
  for (const sc of silo.sous_cocons) {
    await getOrCreate(sc, slugify(sc), parent.id);
  }
  console.log('\nTerminé.');
})().catch(e => { console.error('Erreur:', e.message); process.exit(1); });
