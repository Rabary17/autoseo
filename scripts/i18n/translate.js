#!/usr/bin/env node
// Pipeline de traduction d'un silo vers une locale (2026-08-18).
//
// Deux passes, dans cet ordre obligatoire :
//   PASSE 1 — slugs. Traduit en un seul appel les titres du silo (articles +
//     sous-cocons + hub) et en dérive les slugs cibles. Doit précéder la
//     traduction du contenu : un article cite ses frères, il faut connaître
//     leur slug traduit AVANT d'écrire ses liens. Résultat mémorisé dans
//     data/i18n/index.json — la passe 1 ne se repaie jamais deux fois.
//   PASSE 2 — contenu. Traduit chaque article, réécrit son maillage avec la
//     table de la passe 1, rejoue le gating dans la langue cible, insère dans
//     WordPress en `draft`.
//
// Insertion TOUJOURS en draft, jamais de date de publication : la mise en
// ligne des traductions est une décision distincte, comme /p5-schedule l'est
// pour le français. Rien de ce script ne rend quoi que ce soit public.
//
// Usage :
//   node scripts/i18n/translate.js --silo=camping-car-van --locale=en [--max=N] [--dry-run]
//   node scripts/i18n/translate.js --pilote          # lit config/i18n.json
const path = require('path');
const wp = require('../autopublish/lib/wp-client');
const gating = require('../autopublish/lib/gating');
const mistralClient = require('../autopublish/lib/mistral-client');
const trackingXlsx = require('../autopublish/lib/tracking-xlsx');
const i18n = require('./lib/i18n');
const prompts = require('./lib/translate-prompt');
const linkRemap = require('./lib/link-remap');
const sanitize = require('./lib/sanitize');
const institutions = require('./lib/institutions');
const syncFrontend = require('./sync-frontend');

// Toute lecture WordPress passe par une reprise sur echec transitoire. Sans
// elle, un simple ETIMEDOUT pendant la phase de COLLECTE fait echouer le silo
// entier avant meme la premiere traduction — constate le 2026-08-18 sur
// « Carburants & consommation », qui n'a produit aucune ligne. Les appels au
// modele et les ecritures WordPress etaient deja proteges ; les lectures ne
// l'etaient pas, et c'est par elles que tout commence.
const wpGet = (p) => sanitize.withRetry(() => wp.request(p),
  { log: m => console.warn(`  [reseau] ${m}`) });
const wpFind = (type, slug) => sanitize.withRetry(() => wp.findBySlug(type, slug),
  { log: m => console.warn(`  [reseau] ${m}`) });

const arg = name => {
  const found = process.argv.find(a => a.startsWith(`--${name}=`));
  return found ? found.slice(name.length + 3) : null;
};
const DRY_RUN = process.argv.includes('--dry-run');
const PILOTE = process.argv.includes('--pilote');
const MAX = arg('max') ? Number(arg('max')) : null;

const config = i18n.loadConfig();
const SILO_SLUG = PILOTE ? config.pilote.silo : arg('silo');
const LOCALE = PILOTE ? config.pilote.locale : arg('locale');

function slugify(s) {
  return String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function siloNameFromSlug(rows, siloSlug) {
  // Le tracking porte le nom lisible du silo ("Camping-car & van"), le
  // maillage et la config portent le slug — on fait le pont par le slug de
  // l'url_cible plutôt que par une table en dur.
  for (const r of rows) {
    if (r.url_cible && r.url_cible.replace(/^\//, '').split('/')[0] === siloSlug) return r.silo;
  }
  return null;
}

/* ---------- Collecte des articles français publiables ---------- */

async function collectSourceArticles(rows, siloName) {
  const candidats = rows.filter(r =>
    r.silo === siloName && ['publié', 'programmé'].includes(r.statut) && r.url_cible
  );
  const out = [];
  const exclus = [];
  for (const row of candidats) {
    const slug = row.url_cible.replace(/\/$/, '').split('/').pop();
    // Contenu reserve aux residents francais : jamais traduit (voir
    // config/i18n-exclusions.json). Filtre par ARTICLE et non par silo, parce
    // que les silos sont mixtes — « Mobilite partagee » contient 11 articles
    // franco-francais sur 20.
    const raison = i18n.raisonExclusion(slug);
    if (raison) { exclus.push([slug, raison]); continue; }
    const found = await wpFind('posts', slug);
    if (!found) {
      console.warn(`[collect] "${slug}" absent de WordPress malgré un statut "${row.statut}" — ignoré.`);
      continue;
    }
    const p = await wpGet(`/posts/${found.id}?status=any&context=edit`);
    out.push({
      row, slug, wpId: found.id,
      frPath: row.url_cible.replace(/\/$/, ''),
      source: {
        title: p.title.raw,
        content_gutenberg: p.content.raw,
        excerpt: p.excerpt.raw,
        meta_title: p.acf.meta_title || '',
        meta_description: p.acf.meta_description || '',
        faq: (p.acf.faq || '').split('\n').filter(Boolean).map(l => {
          const [question, ...rest] = l.split(' | ');
          return { question, answer: rest.join(' | ') };
        }),
        sources: p.acf.sources || '',
        featuredMedia: p.featured_media || 0,
      },
    });
  }
  if (exclus.length) {
    console.log(`[collect] ${exclus.length} article(s) exclu(s) (reserves aux residents francais) :`);
    for (const [s, r] of exclus) console.log(`   ${s} — ${r}`);
    console.log('');
  }
  return out;
}

/* ---------- PASSE 1 : slugs ---------- */

async function passeSlugs(articles, index) {
  const dejaFaits = i18n.translatedFrSlugs(index, LOCALE);
  const aTraduire = articles.filter(a => !dejaFaits.has(a.slug));
  if (!aTraduire.length) {
    console.log('[passe 1] tous les slugs sont déjà traduits, rien à payer.');
    return index;
  }

  console.log(`[passe 1] traduction de ${aTraduire.length} titre(s) en ${LOCALE}...`);
  const req = prompts.buildSlugRequest({
    locale: LOCALE,
    items: aTraduire.map(a => ({ slug: a.slug, titre: a.source.title })),
  });
  const res = await mistralClient.callMistral({
    model: config.traduction.modele, system: req.system,
    messages: req.messages, schema: req.schema, maxTokens: config.traduction.max_tokens,
  });

  const vus = new Set();
  for (const item of res.parsed.slugs) {
    const article = aTraduire.find(a => a.slug === item.slug_fr);
    if (!article) {
      console.warn(`[passe 1] slug_fr inconnu renvoyé par le modèle : "${item.slug_fr}" — ignoré.`);
      continue;
    }
    // Le modèle peut proposer deux fois le même slug malgré la consigne : on
    // désambiguïse en code plutôt que de laisser WordPress créer un doublon
    // silencieux (-2 suffixé), qui casserait la correspondance de l'index.
    let slug = slugify(item.slug_traduit);
    if (vus.has(slug)) {
      let n = 2;
      while (vus.has(`${slug}-${n}`)) n++;
      console.warn(`[passe 1] slug en doublon "${slug}" -> "${slug}-${n}"`);
      slug = `${slug}-${n}`;
    }
    vus.add(slug);
    i18n.recordTranslation(index, article.slug, LOCALE, {
      slug, wp_id: null, titre: item.titre_traduit,
      statut: 'slug_reserve', traduit_le: null, silo: SILO_SLUG,
    });
  }
  return index;
}

/* ---------- PASSE 1 bis : taxonomie (silo + sous-cocons) ---------- */

// Sans elle, le lien montant vers le sous-hub — présent dans CHAQUE article
// et vérifié par le gating français — est délié à la traduction faute de
// cible connue. Constaté au premier test réel du 2026-08-18 : tous les
// articles traduits perdaient leur lien de remontée vers leur rubrique.
async function passeTaxonomie(index) {
  index.taxonomie = index.taxonomie || {};
  index.taxonomie[SILO_SLUG] = index.taxonomie[SILO_SLUG] || {};
  if (index.taxonomie[SILO_SLUG][LOCALE]) {
    console.log('[passe 1 bis] taxonomie déjà traduite, rien à payer.');
    return index;
  }

  const taxonomy = require(path.join(__dirname, '..', '..', 'frontend', 'monauto', 'data', 'taxonomy.json'));
  const silo = taxonomy.silos.find(s => s.slug === SILO_SLUG);
  if (!silo) throw new Error(`Silo "${SILO_SLUG}" absent de frontend/monauto/data/taxonomy.json`);

  console.log(`[passe 1 bis] traduction du silo et de ses ${silo.children.length} sous-rubriques...`);
  const req = prompts.buildTaxonomyRequest({
    locale: LOCALE,
    silo: { slug: silo.slug, name: silo.name, sousCocons: silo.children.map(c => ({ slug: c.slug, name: c.name })) },
  });
  const res = await mistralClient.callMistral({
    model: config.traduction.modele, system: req.system,
    messages: req.messages, schema: req.schema, maxTokens: 4000,
  });

  const sousCocons = {};
  for (const c of res.parsed.sous_cocons) sousCocons[c.slug_fr] = { slug: slugify(c.slug_traduit), nom: c.nom_traduit };
  index.taxonomie[SILO_SLUG][LOCALE] = {
    slug: slugify(res.parsed.silo_slug), nom: res.parsed.silo_nom, sous_cocons: sousCocons,
  };
  console.log(`[passe 1 bis] ${SILO_SLUG} -> ${index.taxonomie[SILO_SLUG][LOCALE].slug} ("${res.parsed.silo_nom}")`);
  for (const [fr, t] of Object.entries(sousCocons)) console.log(`[passe 1 bis]   ${fr} -> ${t.slug}`);
  return index;
}

/* ---------- Table de correspondance des chemins ---------- */

function buildPathMap(articles, index) {
  const map = new Map();
  const taxo = index.taxonomie[SILO_SLUG][LOCALE];

  // Hub du silo (chemin à 1 segment).
  map.set(`/${SILO_SLUG}`, `/${taxo.slug}`);
  // Sous-hubs (chemins à 2 segments) — cible du lien montant de chaque article.
  for (const [frSlug, t] of Object.entries(taxo.sous_cocons)) {
    map.set(`/${SILO_SLUG}/${frSlug}`, `/${taxo.slug}/${t.slug}`);
  }
  // Articles frères (chemins à 2 segments eux aussi, voir middleware.ts).
  for (const a of articles) {
    const t = i18n.getTranslation(index, a.slug, LOCALE);
    if (!t) continue;
    map.set(a.frPath, `/${taxo.slug}/${t.slug}`);
  }
  return map;
}

/* ---------- Collecte des pages hub / sous-hub ---------- */

// Les hubs et sous-hubs sont des PAGES WordPress hierarchiques (le sous-hub a
// le hub pour parent), pas des posts — d'ou une collecte et une insertion
// distinctes de celles des articles. Sans elles, le lien montant de chaque
// article traduit pointe vers une page inexistante : le maillage de la locale
// serait cosmetiquement correct et fonctionnellement mort.
async function collectSourcePages(index, articles) {
  const taxo = index.taxonomie[SILO_SLUG][LOCALE];
  // Un sous-hub n'est traduit que s'il contient au moins un article traduit.
  // Sans cette regle, un sous-cocon dont tous les articles sont exclus
  // produirait une page de rubrique VIDE, avec un lien montant depuis rien et
  // aucun lien descendant — une coquille indexable sans contenu.
  const sousCoconsUtiles = new Set(articles.map(a => a.row.sous_cocon));
  const nomParSlug = {};
  const taxonomy = require(path.join(__dirname, '..', '..', 'frontend', 'monauto', 'data', 'taxonomy.json'));
  const siloTx = taxonomy.silos.find(s => s.slug === SILO_SLUG);
  for (const c of (siloTx ? siloTx.children : [])) nomParSlug[c.slug] = c.name;

  const cibles = [
    { frSlug: SILO_SLUG, contentType: 'hub', traduit: { slug: taxo.slug, nom: taxo.nom } },
    ...Object.entries(taxo.sous_cocons)
      .filter(([frSlug]) => {
        const garde = sousCoconsUtiles.has(nomParSlug[frSlug]);
        if (!garde) console.log(`[collect] sous-hub "${frSlug}" ignore : aucun article traduisible dedans`);
        return garde;
      })
      .map(([frSlug, t]) => ({ frSlug, contentType: 'sous-hub', traduit: t })),
  ];

  const out = [];
  for (const cible of cibles) {
    const found = await wpFind('pages', cible.frSlug);
    if (!found) {
      console.warn(`[collect] page "${cible.frSlug}" absente de WordPress — ignoree.`);
      continue;
    }
    const p = await wpGet(`/pages/${found.id}?status=any&context=edit`);
    out.push({
      ...cible, wpId: found.id, parentFr: p.parent,
      source: {
        title: p.title.raw,
        content_gutenberg: p.content.raw,
        excerpt: p.excerpt.raw,
        meta_title: (p.acf && p.acf.meta_title) || '',
        meta_description: (p.acf && p.acf.meta_description) || '',
        faq: ((p.acf && p.acf.faq) || '').split('\n').filter(Boolean).map(l => {
          const [question, ...rest] = l.split(' | ');
          return { question, answer: rest.join(' | ') };
        }),
        sources: (p.acf && p.acf.sources) || '',
        featuredMedia: p.featured_media || 0,
      },
    });
  }
  // Hub d'abord : son id WordPress traduit sert de parent aux sous-hubs.
  return out.sort((a, b) => (a.contentType === 'hub' ? -1 : b.contentType === 'hub' ? 1 : 0));
}

/* ---------- PASSE 2 bis : pages ---------- */

async function passePages(pages, index, pathMap) {
  const prefix = i18n.urlPrefix(config, LOCALE);
  const taxo = index.taxonomie[SILO_SLUG][LOCALE];
  let hubIdTraduit = taxo.wp_id || null;
  let traduites = 0, bloquees = 0, erreurs = 0;

  for (const page of pages) {
    const dejaFait = page.contentType === 'hub' ? taxo.wp_id : (taxo.sous_cocons[page.frSlug] || {}).wp_id;
    if (dejaFait) {
      console.log(`[page] ${page.frSlug} : deja traduite (#${dejaFait}), ignoree.`);
      if (page.contentType === 'hub') hubIdTraduit = dejaFait;
      continue;
    }
    const tag = `[page] ${page.frSlug} -> ${page.traduit.slug}`;

    try {
      console.log(`${tag} : traduction...`);
      const req = prompts.buildContentRequest({
        locale: LOCALE, source: page.source, titreImpose: null,
      });
      const res = await sanitize.withRetry(() => mistralClient.callMistral({
        model: config.traduction.modele, system: req.system,
        messages: req.messages, schema: req.schema, maxTokens: config.traduction.max_tokens,
      }), { log: m => console.log(`${tag} : ${m}`) });
      const traduit = res.parsed;

      const blocs = sanitize.repairGutenbergBlocks(traduit.content_gutenberg);
      traduit.content_gutenberg = blocs.html;
      for (const r of blocs.repairs) console.log(`${tag}   bloc repare : ${r}`);
      for (const c of sanitize.clipMetaFields(traduit)) console.log(`${tag}   ${c}`);

      const remap = linkRemap.remapLinks({ html: traduit.content_gutenberg, pathMap, prefix });
      traduit.content_gutenberg = remap.html;
      console.log(`${tag} : ${remap.remapped.length} lien(s) remappe(s), ${remap.dropped.length} delie(s).`);
      for (const d of remap.dropped) console.log(`${tag}   delie : ${d}`);

      const gatingResult = gating.runGating({
        contentType: page.contentType, silo: SILO_SLUG, sousCocon: page.frSlug,
        content: {
          content_gutenberg: traduit.content_gutenberg, title: traduit.title,
          meta_title: traduit.meta_title, meta_description: traduit.meta_description,
          excerpt: traduit.excerpt,
          sources: page.source.sources.split('\n').filter(Boolean).map(label => ({ label, url: '' })),
          faq: traduit.faq, tags: ['a', 'b', 'c'],
        },
        clusterRow: null, trackingRows: [], maillageEntry: null,
        childLinksCount: remap.remapped.length, parentPublished: true,
        factsProvided: Array(20).fill({}), lang: LOCALE,
        lengthRange: sanitize.lengthRangeFromSource(page.source.content_gutenberg),
      });
      const instCheck = institutions.checkNoForeignInstitution(page.source.content_gutenberg, traduit);
      const echecs = gatingResult.failures.map(f => f.message);
      if (!instCheck.ok) {
        echecs.push('Institution etrangere substituee : '
          + instCheck.substitutions.map(s => `"${s.institution}" x${s.occurrences}`).join(', '));
      }
      const passe = gatingResult.passed && instCheck.ok;
      console.log(`${tag} : ${passe ? 'gating OK.' : 'gating KO — ' + echecs.join(' ; ')}`);
      if (!passe) bloquees++;

      if (DRY_RUN) { traduites++; continue; }

      const payload = {
        title: traduit.title, slug: page.traduit.slug,
        content: traduit.content_gutenberg, excerpt: traduit.excerpt,
        status: 'draft',
        // Voir le commentaire équivalent dans traduireArticles() : image à la
        // une jamais reprise jusqu'ici, même défaut sur les hubs/sous-hubs.
        featured_media: page.source.featuredMedia || undefined,
        acf: {
          tldr: traduit.excerpt, sources: page.source.sources,
          faq: traduit.faq.map(f => `${f.question} | ${f.answer}`).join('\n'),
          meta_title: traduit.meta_title, meta_description: traduit.meta_description,
        },
      };
      // Hierarchie preservee : le sous-hub traduit a pour parent le HUB
      // TRADUIT, jamais le hub francais (sinon l'arbre des pages melangerait
      // les langues et /en/... ne serait pas un sous-arbre coherent).
      if (page.contentType !== 'hub' && hubIdTraduit) payload.parent = hubIdTraduit;

      const created = await sanitize.withRetry(() => wp.createPage(payload), { log: m => console.log(`${tag} : ${m}`) });
      if (page.contentType === 'hub') {
        taxo.wp_id = created.id;
        hubIdTraduit = created.id;
      } else {
        taxo.sous_cocons[page.frSlug].wp_id = created.id;
      }
      taxo.sous_cocons[page.frSlug] && (taxo.sous_cocons[page.frSlug].statut = passe ? 'traduit' : 'a_valider');
      i18n.saveIndex(index);
      console.log(`${tag} : inseree en draft — WP page #${created.id}${payload.parent ? ` (parent #${payload.parent})` : ''}`);
      traduites++;
    } catch (e) {
      erreurs++;
      console.error(`${tag} : ECHEC — ${e.message}`);
    }
  }
  return { traduites, bloquees, erreurs };
}

/* ---------- PASSE 2 : contenu ---------- */

async function passeContenu(articles, index, pathMap) {
  const prefix = i18n.urlPrefix(config, LOCALE);
  let traduits = 0, bloques = 0, erreurs = 0;

  for (const [i, article] of articles.entries()) {
    const t = i18n.getTranslation(index, article.slug, LOCALE);
    if (!t) { console.warn(`[passe 2] pas de slug réservé pour "${article.slug}" — ignoré.`); continue; }
    if (t.statut === 'traduit' || t.wp_id) {
      console.log(`[${i + 1}/${articles.length}] ${article.slug} : déjà traduit (#${t.wp_id}), ignoré.`);
      continue;
    }
    const tag = `[${i + 1}/${articles.length}] ${article.slug} -> ${t.slug}`;

    try {
      console.log(`${tag} : traduction...`);
      const req = prompts.buildContentRequest({
        locale: LOCALE, source: article.source, titreImpose: t.titre,
      });
      const res = await sanitize.withRetry(() => mistralClient.callMistral({
        model: config.traduction.modele, system: req.system,
        messages: req.messages, schema: req.schema, maxTokens: config.traduction.max_tokens,
      }), { log: m => console.log(`${tag} : ${m}`) });
      const traduit = res.parsed;
      console.log(`${tag} : reçu (${res.usage.output_tokens} tokens de sortie).`);

      const blocs = sanitize.repairGutenbergBlocks(traduit.content_gutenberg);
      traduit.content_gutenberg = blocs.html;
      for (const r of blocs.repairs) console.log(`${tag}   bloc réparé : ${r}`);
      for (const c of sanitize.clipMetaFields(traduit)) console.log(`${tag}   ${c}`);

      const remap = linkRemap.remapLinks({ html: traduit.content_gutenberg, pathMap, prefix });
      traduit.content_gutenberg = remap.html;
      for (const r of remap.remapped) console.log(`${tag}   lien remappé : ${r}`);
      for (const d of remap.dropped) console.log(`${tag}   lien délié (pas encore traduit) : ${d}`);

      // Gating dans la langue cible. `maillageEntry` est volontairement omis :
      // les règles de maillage français ne s'appliquent pas à une locale dont
      // la table de liens vient d'être reconstruite ci-dessus (remapLinks est
      // la garantie équivalente). Les autres règles — longueur, champs SEO,
      // blocs Gutenberg bien formés, script étranger, tiret cadratin selon la
      // langue — restent toutes actives.
      const gatingResult = gating.runGating({
        contentType: 'article', silo: article.row.silo, sousCocon: article.row.sous_cocon,
        content: {
          content_gutenberg: traduit.content_gutenberg, title: traduit.title,
          meta_title: traduit.meta_title, meta_description: traduit.meta_description,
          excerpt: traduit.excerpt,
          sources: article.source.sources.split('\n').filter(Boolean).map(label => ({ label, url: '' })),
          faq: traduit.faq, tags: ['a', 'b', 'c'],
        },
        clusterRow: article.row, trackingRows: [], maillageEntry: null,
        childLinksCount: 0, parentPublished: true, factsProvided: Array(20).fill({}),
        lang: LOCALE,
        // Fidélité à la source plutôt que plancher absolu — voir lib/sanitize.js
        lengthRange: sanitize.lengthRangeFromSource(article.source.content_gutenberg),
      });
      // Substitution d'institution etrangere : le defaut le plus grave du
      // chantier (voir lib/institutions.js). Verifie en code parce que le
      // prompt seul ne suffit pas — constate le 2026-08-18.
      const instCheck = institutions.checkNoForeignInstitution(article.source.content_gutenberg, traduit);
      const echecs = gatingResult.failures.map(f => f.message);
      if (!instCheck.ok) {
        echecs.push('Institution etrangere substituee a une institution francaise : '
          + instCheck.substitutions.map(s => `"${s.institution}" x${s.occurrences}`).join(', '));
      }
      const passe = gatingResult.passed && instCheck.ok;
      if (!passe) {
        bloques++;
        console.log(`${tag} : gating KO — ${echecs.join(' ; ')}`);
      } else {
        console.log(`${tag} : gating OK.`);
      }

      if (DRY_RUN) { traduits++; continue; }

      const created = await sanitize.withRetry(() => wp.createPost({
        title: traduit.title,
        slug: t.slug,
        content: traduit.content_gutenberg,
        excerpt: traduit.excerpt,
        status: 'draft', // jamais publié ici — décision distincte
        // Image à la une jamais reprise jusqu'ici (2026-08-25) : `article.source`
        // ne la capturait pas au collect, silencieusement — aucun article traduit
        // n'a d'image à la une, sans erreur ni avertissement. Même image que la
        // source française, WordPress la sert déjà dans plusieurs tailles.
        featured_media: article.source.featuredMedia || undefined,
        acf: {
          tldr: traduit.excerpt,
          sources: article.source.sources,
          faq: traduit.faq.map(f => `${f.question} | ${f.answer}`).join('\n'),
          meta_title: traduit.meta_title,
          meta_description: traduit.meta_description,
        },
      }), { log: m => console.log(`${tag} : ${m}`) });
      i18n.recordTranslation(index, article.slug, LOCALE, {
        slug: t.slug, wp_id: created.id, titre: traduit.title,
        statut: passe ? 'traduit' : 'a_valider',
        traduit_le: new Date().toISOString().slice(0, 10), silo: SILO_SLUG,
      });
      i18n.saveIndex(index); // sauvegarde incrémentale : un kill ne perd jamais un article payé
      console.log(`${tag} : inséré en draft — WP #${created.id}`);
      traduits++;
    } catch (e) {
      erreurs++;
      console.error(`${tag} : ÉCHEC — ${e.message}`);
    }
  }
  return { traduits, bloques, erreurs };
}

/* ---------- Orchestration ---------- */

(async () => {
  if (!SILO_SLUG || !LOCALE) {
    console.error('Usage : --silo=<slug> --locale=<code>  (ou --pilote)');
    process.exit(1);
  }
  if (!config.locales[LOCALE]) {
    console.error(`Locale "${LOCALE}" absente de config/i18n.json.`);
    process.exit(1);
  }
  if (!i18n.isTranslatable(config, SILO_SLUG, LOCALE)) {
    console.error(`Le silo "${SILO_SLUG}" n'est pas déclaré traduisible en "${LOCALE}" dans config/i18n.json.\n`
      + "C'est une décision éditoriale, pas un défaut technique : voir `silos_traduisibles` et sa note.");
    process.exit(1);
  }

  const rows = trackingXlsx.readRows();
  const siloName = siloNameFromSlug(rows, SILO_SLUG);
  if (!siloName) { console.error(`Aucune ligne de tracking pour le silo "${SILO_SLUG}".`); process.exit(1); }

  console.log(`=== Traduction ${siloName} (${SILO_SLUG}) -> ${LOCALE}${DRY_RUN ? ' [dry-run]' : ''} ===\n`);

  let articles = await collectSourceArticles(rows, siloName);
  if (MAX) articles = articles.slice(0, MAX);
  console.log(`${articles.length} article(s) source récupéré(s) depuis WordPress.\n`);
  if (!articles.length) return;

  const index = i18n.loadIndex();
  await passeTaxonomie(index);
  await passeSlugs(articles, index);
  if (!DRY_RUN) i18n.saveIndex(index);

  const pathMap = buildPathMap(articles, index);
  console.log(`\n[maillage] ${pathMap.size} correspondance(s) de chemin construite(s).\n`);

  // Pages AVANT les articles : ce sont les cibles des liens montants. Les
  // traduire en second laisserait, en cas d'interruption, des articles dont
  // le lien de remontee pointe vers rien.
  const pages = await collectSourcePages(index, articles);
  const statsPages = await passePages(pages, index, pathMap);
  if (!DRY_RUN) i18n.saveIndex(index);

  const stats = await passeContenu(articles, index, pathMap);
  if (!DRY_RUN) i18n.saveIndex(index);

  console.log(`\n=== Pages — traduites : ${statsPages.traduites} | gating KO : ${statsPages.bloquees} | erreurs : ${statsPages.erreurs} ===`);
  console.log(`=== Articles — traduits : ${stats.traduits} | gating KO : ${stats.bloques} | erreurs : ${stats.erreurs} ===`);
  console.log(`Tout est en draft. Aucune publication : la mise en ligne est une étape distincte.`);
  if (DRY_RUN) console.log('(dry-run — rien inséré dans WordPress, index non sauvegardé)');
})().catch(e => { console.error(e); process.exit(1); });
