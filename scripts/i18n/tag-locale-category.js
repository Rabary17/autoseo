#!/usr/bin/env node
// Marque les contenus traduits d'une categorie WordPress dediee (2026-08-21).
//
// POURQUOI : francais et traductions partagent le meme espace WordPress.
// `lib/wp.ts::getPosts()` alimente l'accueil, /archives/, /tag/*, /auteur/*,
// /recherche et le sitemap — sans distinction de langue. Filtrer APRES la
// requete ne suffit pas : `getPosts` renvoie aussi `total` et `totalPages`,
// qui servent a la pagination. Retirer des elements du resultat sans corriger
// les compteurs donnerait des pages a 11 articles sur 12 annonces, et une
// derniere page vide.
//
// La seule exclusion EXACTE est cote requete : `categories_exclude=<id>`. Elle
// exige un marqueur, d'ou cette categorie. Elle ne sert qu'a marquer la langue,
// jamais a l'affichage : les listings anglais sont construits depuis
// `data/i18n/index.json`, pas depuis les categories WordPress.
//
// Idempotent : relancable sans effet de bord, ne retire jamais une categorie
// existante.
//
// Usage :
//   node scripts/i18n/tag-locale-category.js --locale=en            # rapport
//   node scripts/i18n/tag-locale-category.js --locale=en --apply
const fs = require('fs');
const wp = require('../autopublish/lib/wp-client');
const i18n = require('./lib/i18n');
const sanitize = require('./lib/sanitize');

const arg = name => {
  const f = process.argv.find(a => a.startsWith(`--${name}=`));
  return f ? f.slice(name.length + 3) : null;
};
const APPLY = process.argv.includes('--apply');
const config = i18n.loadConfig();
const LOCALE = arg('locale') || config.pilote.locale;

const wpGet = p => sanitize.withRetry(() => wp.request(p));

(async () => {
  const index = i18n.loadIndex();

  // 1. La categorie marqueur, creee si absente.
  const slugCat = `lang-${LOCALE}`;
  const existantes = await wpGet(`/categories?per_page=100&search=${slugCat}&_fields=id,slug,name`);
  let cat = existantes.find(c => c.slug === slugCat);
  if (!cat) {
    if (!APPLY) {
      console.log(`Categorie "${slugCat}" a creer.`);
    } else {
      cat = await sanitize.withRetry(() => wp.request('/categories', {
        method: 'POST',
        body: { name: `Langue : ${LOCALE.toUpperCase()}`, slug: slugCat },
      }));
      console.log(`Categorie "${slugCat}" creee (id ${cat.id}).`);
    }
  } else {
    console.log(`Categorie "${slugCat}" deja presente (id ${cat.id}).`);
  }

  // 2. Tous les articles traduits de la locale, servables OU exclus : le
  // marquage doit etre plus large que le service. Un article exclu reste un
  // article non francophone et ne doit jamais remonter dans un listing FR.
  const cibles = [];
  for (const [frSlug, byLoc] of Object.entries(index.articles || {})) {
    const t = byLoc[LOCALE];
    if (t && t.wp_id) cibles.push({ wpId: t.wp_id, slug: t.slug, frSlug });
  }
  console.log(`${cibles.length} article(s) ${LOCALE} a verifier.\n`);

  if (!cat) { console.log('(simulation — relancer avec --apply)'); return; }

  let marques = 0, deja = 0;
  for (const c of cibles) {
    const p = await wpGet(`/posts/${c.wpId}?status=any&context=edit&_fields=id,categories`);
    if ((p.categories || []).includes(cat.id)) { deja++; continue; }
    if (!APPLY) { console.log(`   a marquer : ${c.slug}`); marques++; continue; }
    // Remplace la categorie par defaut (1) mais conserve toute autre
    // categorie deja posee : on ajoute un marqueur, on ne reorganise pas.
    const categories = [...new Set([...(p.categories || []).filter(id => id !== 1), cat.id])];
    await sanitize.withRetry(() => wp.updatePost(c.wpId, { categories }));
    console.log(`   marque #${c.wpId} ${c.slug}`);
    marques++;
  }

  console.log(`\n${deja} deja marque(s), ${marques} ${APPLY ? 'marque(s)' : 'a marquer'}.`);

  if (APPLY && cat) {
    // L'id est memorise dans la config : le frontend en a besoin pour
    // construire `categories_exclude`, et le deviner a l'execution
    // couterait un appel reseau sur chaque page.
    const cfg = JSON.parse(fs.readFileSync(i18n.CONFIG_PATH, 'utf8'));
    cfg.categories_marqueur = cfg.categories_marqueur || {};
    cfg.categories_marqueur[LOCALE] = cat.id;
    cfg._doc_categories_marqueur = "Id des categories WordPress qui marquent la langue d'un contenu. Sert UNIQUEMENT a exclure les traductions des requetes francaises (`categories_exclude`), jamais a l'affichage. Ecrit par scripts/i18n/tag-locale-category.js.";
    fs.writeFileSync(i18n.CONFIG_PATH, JSON.stringify(cfg, null, 2) + '\n', 'utf8');
    console.log(`config/i18n.json : categories_marqueur.${LOCALE} = ${cat.id}`);
    require('./sync-frontend').sync();
  }
})().catch(e => { console.error(e); process.exit(1); });
