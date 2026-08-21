#!/usr/bin/env node
// Verification de coherence du back traduit (2026-08-18).
//
// A lancer AVANT toute modification du frontend : le principe pose avec
// l'utilisateur est que le back WordPress doit etre complet et sans defaut
// avant qu'on touche au routage, qui est le seul geste risque du chantier.
//
// Ce script ne corrige rien. Il repond a une seule question : « si on branchait
// le front maintenant, qu'est-ce qui casserait ? »
//
// Les 6 controles, du plus grave au moins grave :
//   1. index <-> WordPress : chaque traduction referencee existe-t-elle vraiment ?
//   2. liens internes : chaque lien d'un contenu traduit pointe-t-il vers une
//      cible traduite qui EXISTE ? (le defaut qui produirait des 404 en masse)
//   3. hierarchie des pages : les sous-hubs traduits ont-ils pour parent le hub
//      TRADUIT, et pas le hub francais ?
//   4. gating : chaque contenu traduit passe-t-il encore les regles ?
//   5. collisions de slugs : un slug traduit entre-t-il en conflit avec un slug
//      francais existant ? (le francais n'a pas de prefixe d'URL : une collision
//      ferait litteralement disparaitre une page)
//   6. substitution d'institution etrangere : la traduction a-t-elle remplace
//      un organisme francais par un organisme d'un autre pays ? (defaut le plus
//      grave rencontre : « taxi conventionne CPAM » -> « NHS-approved taxi »,
//      qui attribue des regles francaises au systeme de sante britannique)
//   7. couverture : combien d'articles du silo restent non traduits ?
//
// Usage : node scripts/i18n/verify.js [--locale=en]
const wp = require('../autopublish/lib/wp-client');
const gating = require('../autopublish/lib/gating');
const trackingXlsx = require('../autopublish/lib/tracking-xlsx');
const i18n = require('./lib/i18n');
const linkRemap = require('./lib/link-remap');
const sanitize = require('./lib/sanitize');
const institutions = require('./lib/institutions');
const taxonomyData = require('../../frontend/monauto/data/taxonomy.json');

const arg = name => {
  const f = process.argv.find(a => a.startsWith(`--${name}=`));
  return f ? f.slice(name.length + 3) : null;
};
const config = i18n.loadConfig();
const LOCALE = arg('locale') || config.pilote.locale;
const PREFIX = i18n.urlPrefix(config, LOCALE);

const problemes = { graves: [], moyens: [], infos: [] };

// Un echec reseau transitoire faisait planter TOUTE la verification, avec un
// code de sortie 1 — indistinguable de « des defauts bloquants ont ete
// trouves » (constate le 2026-08-18 sur un ETIMEDOUT). Un garde-fou qui
// confond « le back est casse » et « je n'ai pas pu verifier » est pire
// qu'inutile : il autorise a passer outre par lassitude. Toute lecture WP
// retente donc, et un echec definitif est signale comme tel, jamais confondu
// avec un defaut de contenu.
let echecsTechniques = 0;

const wpGet = (path) => sanitize.withRetry(() => wp.request(path),
  { log: m => console.warn(`  [reseau] ${m}`) });
const wpFind = (type, slug) => sanitize.withRetry(() => wp.findBySlug(type, slug),
  { log: m => console.warn(`  [reseau] ${m}`) });

// La regle de longueur appliquee a une traduction doit mesurer la FIDELITE a la
// source, pas une quantite absolue : l'anglais pese ~89 % du francais (mesure
// sur 5 paires, 2026-08-18). Verify doit donc juger sur la meme regle que le
// pipeline (lib/sanitize.js), sinon il rejetterait des traductions completes.
async function lengthRangeFor(type, frSlug) {
  if (!frSlug) return null;
  try {
    const found = await wpFind(type, frSlug);
    if (!found) return null;
    const src = await wpGet(`/${type}/${found.id}?status=any&context=edit`);
    return sanitize.lengthRangeFromSource(src.content.raw);
  } catch { return null; }
}

function contentFields(p, type) {
  const acf = p.acf || {};
  return {
    content_gutenberg: p.content.raw, title: p.title.raw,
    meta_title: acf.meta_title || '', meta_description: acf.meta_description || '',
    excerpt: p.excerpt.raw,
    sources: (acf.sources || '').split('\n').filter(Boolean).map(label => ({ label, url: '' })),
    faq: (acf.faq || '').split('\n').filter(Boolean).map(l => {
      const [question, ...rest] = l.split(' | ');
      return { question, answer: rest.join(' | ') };
    }),
    tags: ['a', 'b', 'c'], _type: type,
  };
}

(async () => {
  const index = i18n.loadIndex();
  const rows = trackingXlsx.readRows();

  console.log(`=== Verification du back traduit — locale ${LOCALE} ===\n`);

  /* --- Inventaire WordPress, une seule fois --- */
  const posts = [];
  const pages = [];
  for (const status of ['publish', 'future', 'draft']) {
    let page = 1;
    for (;;) {
      const b = await wpGet(`/posts?status=${status}&per_page=100&page=${page}&_fields=id,slug,status`);
      if (!Array.isArray(b) || !b.length) break;
      posts.push(...b); if (b.length < 100) break; page++;
    }
  }
  let pg = 1;
  for (;;) {
    const b = await wpGet(`/pages?status=any&per_page=100&page=${pg}&_fields=id,slug,status,parent`);
    if (!Array.isArray(b) || !b.length) break;
    pages.push(...b); if (b.length < 100) break; pg++;
  }
  const postBySlug = new Map(posts.map(p => [p.slug, p]));
  const pageBySlug = new Map(pages.map(p => [p.slug, p]));
  console.log(`WordPress : ${posts.length} articles, ${pages.length} pages.\n`);

  /* --- 1. index <-> WordPress --- */
  // Les traductions d'articles reserves aux residents francais sont conservees
  // en draft mais ne seront jamais publiees (decision 2026-08-18) : elles ne
  // comptent donc NI comme cibles de lien valides, NI dans la couverture. Un
  // lien vers l'une d'elles est un lien mort et doit ressortir comme tel.
  const traductions = Object.entries(index.articles || {})
    .filter(([frSlug, byLocale]) => byLocale[LOCALE] && !i18n.raisonExclusion(frSlug))
    .map(([frSlug, byLocale]) => ({ frSlug, ...byLocale[LOCALE] }));
  const traductionsExclues = Object.entries(index.articles || {})
    .filter(([frSlug, byLocale]) => byLocale[LOCALE] && i18n.raisonExclusion(frSlug))
    .map(([frSlug, byLocale]) => ({ frSlug, ...byLocale[LOCALE] }));
  if (traductionsExclues.length) {
    problemes.infos.push(`${traductionsExclues.length} traduction(s) conservee(s) en draft mais exclue(s) de la publication (contenu reserve aux residents francais)`);
  }

  for (const t of traductions) {
    if (!t.wp_id) { problemes.graves.push(`index : "${t.slug}" n'a pas de wp_id (slug reserve mais jamais insere)`); continue; }
    const found = posts.find(p => p.id === t.wp_id);
    if (!found) problemes.graves.push(`index : wp_id #${t.wp_id} ("${t.slug}") reference dans l'index mais introuvable dans WordPress`);
    else if (found.slug !== t.slug) problemes.graves.push(`index : #${t.wp_id} a le slug WordPress "${found.slug}" mais "${t.slug}" dans l'index`);
  }

  /* --- Table des chemins traduits qui EXISTENT reellement --- */
  const cheminsValides = new Set();
  for (const [siloSlug, byLocale] of Object.entries(index.taxonomie || {})) {
    const taxo = byLocale[LOCALE];
    if (!taxo) continue;
    if (taxo.wp_id && pages.some(p => p.id === taxo.wp_id)) cheminsValides.add(`${PREFIX}/${taxo.slug}`);
    for (const t of Object.values(taxo.sous_cocons || {})) {
      if (t.wp_id && pages.some(p => p.id === t.wp_id)) cheminsValides.add(`${PREFIX}/${taxo.slug}/${t.slug}`);
    }
    for (const t of traductions) {
      if (postBySlug.has(t.slug)) cheminsValides.add(`${PREFIX}/${taxo.slug}/${t.slug}`);
    }
  }

  /* --- 2. liens internes des contenus traduits --- */
  async function verifierLiens(wpId, type, label) {
    let p;
    try {
      p = await wpGet(`/${type}/${wpId}?status=any&context=edit`);
    } catch (e) {
      echecsTechniques++;
      problemes.moyens.push(`${label} : liens NON verifies (echec reseau : ${e.message})`);
      return null;
    }
    const hrefs = [...new Set(linkRemap.extractHrefs(p.content.raw))].filter(h => h.startsWith('/'));
    for (const href of hrefs) {
      const normalise = href.replace(/\/$/, '');
      if (cheminsValides.has(normalise)) continue;
      if (!normalise.startsWith(PREFIX + '/')) {
        problemes.graves.push(`${label} : lien vers du contenu NON traduit "${href}" (cul-de-sac linguistique)`);
      } else {
        problemes.graves.push(`${label} : lien "${href}" ne correspond a aucune page/article traduit existant (404 a prevoir)`);
      }
    }
    return p;
  }

  /* --- 3/4. hierarchie + gating des pages --- */
  for (const [siloSlug, byLocale] of Object.entries(index.taxonomie || {})) {
    const taxo = byLocale[LOCALE];
    if (!taxo) continue;

    if (!taxo.wp_id) { problemes.graves.push(`taxonomie : le hub "${taxo.slug}" n'est pas traduit (aucun wp_id) — tous les liens montants du silo pointent vers rien`); }
    else {
      const p = await verifierLiens(taxo.wp_id, 'pages', `hub ${taxo.slug}`);
      if (!p) continue;
      const g = gating.runGating({
        contentType: 'hub', silo: siloSlug, sousCocon: null, content: contentFields(p, 'hub'),
        clusterRow: null, trackingRows: [], maillageEntry: null, childLinksCount: 1,
        parentPublished: true, factsProvided: Array(20).fill({}), lang: LOCALE,
        lengthRange: await lengthRangeFor('pages', siloSlug),
      });
      if (!g.passed) problemes.moyens.push(`hub ${taxo.slug} : gating KO — ${g.failures.map(f => f.message).join(' ; ')}`);
    }

    // Un sous-hub sans wp_id n'est pas forcement un defaut : depuis la regle
    // du 2026-08-18, un sous-cocon dont TOUS les articles sont exclus
    // (contenu reserve aux residents francais) est volontairement non traduit —
    // le traduire produirait une page de rubrique vide. Le distinguer d'un
    // vrai oubli est indispensable : un garde-fou qui signale 6 faux
    // bloquants finit par etre ignore en bloc.
    const nomParSlugSc = {};
    const siloTx = taxonomyData.silos.find(x => x.slug === siloSlug);
    for (const c of (siloTx ? siloTx.children : [])) nomParSlugSc[c.slug] = c.name;
    const sousCoconsAvecTraduction = new Set(
      traductions
        .map(t => rows.find(r => r.url_cible && r.url_cible.replace(/\/$/, '').endsWith('/' + t.frSlug)))
        .filter(Boolean)
        .map(r => r.sous_cocon)
    );

    for (const [frSlug, t] of Object.entries(taxo.sous_cocons || {})) {
      if (!t.wp_id) {
        const aDuContenu = sousCoconsAvecTraduction.has(nomParSlugSc[frSlug]);
        if (aDuContenu) {
          problemes.graves.push(`taxonomie : sous-hub "${t.slug}" (${frSlug}) non traduit alors qu'il contient des articles traduits`);
        } else {
          problemes.infos.push(`sous-hub "${frSlug}" volontairement non traduit : aucun article traduisible dedans`);
        }
        continue;
      }
      const wpPage = pages.find(p => p.id === t.wp_id);
      if (!wpPage) { problemes.graves.push(`taxonomie : sous-hub #${t.wp_id} introuvable dans WordPress`); continue; }
      if (taxo.wp_id && wpPage.parent !== taxo.wp_id) {
        problemes.graves.push(`hierarchie : sous-hub "${t.slug}" a pour parent #${wpPage.parent} au lieu du hub traduit #${taxo.wp_id}`);
      }
      const p = await verifierLiens(t.wp_id, 'pages', `sous-hub ${t.slug}`);
      if (!p) continue;
      const g = gating.runGating({
        contentType: 'sous-hub', silo: siloSlug, sousCocon: frSlug, content: contentFields(p, 'sous-hub'),
        clusterRow: null, trackingRows: [], maillageEntry: null, childLinksCount: 1,
        parentPublished: true, factsProvided: Array(20).fill({}), lang: LOCALE,
        lengthRange: await lengthRangeFor('pages', frSlug),
      });
      if (!g.passed) problemes.moyens.push(`sous-hub ${t.slug} : gating KO — ${g.failures.map(f => f.message).join(' ; ')}`);
    }
  }

  /* --- 4. gating des articles + liens --- */
  for (const t of traductions) {
    if (!t.wp_id || !posts.some(p => p.id === t.wp_id)) continue;
    const row = rows.find(r => r.url_cible && r.url_cible.replace(/\/$/, '').endsWith('/' + t.frSlug));
    const p = await verifierLiens(t.wp_id, 'posts', `article ${t.slug}`);
    if (!p) continue;
    if (!row) {
      problemes.moyens.push(`article ${t.slug} : aucune ligne de tracking pour la source "${t.frSlug}" — gating non verifiable`);
      continue;
    }
    const g = gating.runGating({
      // Un silo/sousCocon `null` fait planter checkSimilarity en aval
      // (similarity.js/slugifyPart appelle normalize() sur null). Constate en
      // test le 2026-08-18 : un article traduit dont la ligne de tracking est
      // introuvable faisait echouer TOUTE la verification, au lieu d'etre
      // simplement signale. Signale et ignore plutot que de tout interrompre.
      contentType: 'article', silo: row.silo, sousCocon: row.sous_cocon,
      content: contentFields(p, 'article'), clusterRow: row || null, trackingRows: [],
      maillageEntry: null, childLinksCount: 0, parentPublished: true,
      factsProvided: Array(20).fill({}), lang: LOCALE,
      lengthRange: await lengthRangeFor('posts', t.frSlug),
    });
    if (!g.passed) problemes.moyens.push(`article ${t.slug} : gating KO — ${g.failures.map(f => f.message).join(' ; ')}`);
  }

  /* --- 5. collisions de slugs avec le francais --- */
  // Le francais n'a PAS de prefixe d'URL (config/i18n.json) : un slug traduit
  // identique a un slug francais ne serait pas juste ambigu, il rendrait une
  // des deux pages inatteignable.
  const slugsFr = new Set(rows.filter(r => r.url_cible).map(r => r.url_cible.replace(/\/$/, '').split('/').pop()));
  for (const t of traductions) {
    if (slugsFr.has(t.slug)) problemes.graves.push(`collision : le slug traduit "${t.slug}" est deja un slug d'article francais`);
  }

  /* --- 6. substitution d'institution etrangere --- */
  // Verifie en code parce que le prompt seul ne suffit pas : constate le
  // 2026-08-18 sur un article, malgre une interdiction explicite dans le
  // prompt de traduction. Voir lib/institutions.js.
  async function verifierInstitutions(type, frSlug, wpId, label) {
    try {
      const src = await wpFind(type, frSlug);
      if (!src) return;
      const fr = await wpGet(`/${type}/${src.id}?status=any&context=edit`);
      const tr = await wpGet(`/${type}/${wpId}?status=any&context=edit`);
      const acf = tr.acf || {};
      const res = institutions.checkNoForeignInstitution(fr.content.raw, {
        content_gutenberg: tr.content.raw, title: tr.title.raw,
        meta_title: acf.meta_title || '', meta_description: acf.meta_description || '',
      });
      if (!res.ok) {
        problemes.graves.push(`${label} : institution etrangere substituee — `
          + res.substitutions.map(x => `"${x.institution}" x${x.occurrences}`).join(', ')
          + " (absente de la source : le contenu attribue des regles francaises a un organisme d'un autre pays)");
      }
    } catch (e) {
      // Un controle NON EFFECTUE n'est pas un defaut de qualite : il doit
      // compter comme echec technique, sinon le script sort en 0 alors qu'il
      // n'a pas tout verifie — la confusion meme que le code a 3 etats est
      // cense eliminer.
      echecsTechniques++;
      problemes.moyens.push(`${label} : controle des institutions NON EFFECTUE — ${e.message}`);
    }
  }

  for (const t of traductions) {
    if (t.wp_id && posts.some(p => p.id === t.wp_id)) {
      await verifierInstitutions('posts', t.frSlug, t.wp_id, `article ${t.slug}`);
    }
  }
  for (const [siloSlug, byLocale] of Object.entries(index.taxonomie || {})) {
    const taxo = byLocale[LOCALE];
    if (!taxo) continue;
    if (taxo.wp_id) await verifierInstitutions('pages', siloSlug, taxo.wp_id, `hub ${taxo.slug}`);
    for (const [frSlug, t] of Object.entries(taxo.sous_cocons || {})) {
      if (t.wp_id) await verifierInstitutions('pages', frSlug, t.wp_id, `sous-hub ${t.slug}`);
    }
  }

  /* --- 7. couverture --- */
  // Parcourt TOUS les silos declares traduisibles dans cette locale, pas
  // seulement le silo pilote : le controle etait initialement cable sur
  // `config.pilote.silo` et ignorait donc en silence tout silo traduit ensuite
  // (constate le 2026-08-18 apres la traduction de Mobilite partagee, absente
  // du rapport alors qu'elle venait d'etre faite). Un rapport partiel qui se
  // presente comme complet est pire qu'une absence de rapport.
  const siloNameBySlug = {};
  for (const r of rows) {
    if (r.url_cible) siloNameBySlug[r.url_cible.replace(/^\//, '').split('/')[0]] = r.silo;
  }
  for (const [siloSlug, locales] of Object.entries(config.silos_traduisibles || {})) {
    if (!locales.includes(LOCALE)) continue;
    const siloName = siloNameBySlug[siloSlug];
    if (!siloName) { problemes.infos.push(`couverture : silo "${siloSlug}" declare traduisible mais absent du tracking`); continue; }

    const publiables = rows.filter(r => r.silo === siloName && ['publié', 'programmé'].includes(r.statut) && r.url_cible
      && !i18n.raisonExclusion(r.url_cible.replace(/\/$/, '').split('/').pop()));
    const traduits = new Set(traductions.map(t => t.frSlug));
    const manquants = publiables.filter(r => !traduits.has(r.url_cible.replace(/\/$/, '').split('/').pop()));

    const taxo = (index.taxonomie[siloSlug] || {})[LOCALE];
    const pagesAttendues = taxo ? Object.keys(taxo.sous_cocons || {}).length + 1 : null;
    const pagesFaites = taxo
      ? (taxo.wp_id ? 1 : 0) + Object.values(taxo.sous_cocons || {}).filter(t => t.wp_id).length
      : 0;

    problemes.infos.push(
      `couverture ${siloName} : ${publiables.length - manquants.length}/${publiables.length} articles`
      + (pagesAttendues === null ? ', taxonomie NON traduite' : `, ${pagesFaites}/${pagesAttendues} pages`)
    );
    for (const m of manquants) problemes.infos.push(`  non traduit : ${m.url_cible.replace(/\/$/, '').split('/').pop()}`);
  }

  /* --- Rapport --- */
  const ligne = (t, arr) => { if (arr.length) { console.log(`${t} (${arr.length}) :`); for (const p of arr) console.log(`  ${p}`); console.log(''); } };
  ligne('BLOQUANT — a corriger avant de toucher au front', problemes.graves);
  ligne('A CORRIGER — qualite de contenu', problemes.moyens);
  ligne('INFORMATION', problemes.infos);

  if (echecsTechniques) {
    console.log(`ATTENTION : ${echecsTechniques} controle(s) n'ont PAS pu etre effectues (echecs reseau).`);
    console.log("La verification est INCOMPLETE — ne pas la lire comme un feu vert. Relancer.");
    process.exitCode = 2; // 0 = propre, 1 = defaut bloquant, 2 = verification incomplete
    return;
  }
  if (!problemes.graves.length && !problemes.moyens.length) {
    console.log('Back traduit coherent : aucun defaut bloquant, aucun defaut de contenu.');
    console.log('Le frontend peut etre modifie en toute securite.');
  } else if (!problemes.graves.length) {
    console.log('Aucun defaut BLOQUANT. Les defauts de contenu ci-dessus n\'empechent pas de brancher le front.');
  }
  process.exitCode = problemes.graves.length ? 1 : 0;
})().catch(e => { console.error(e); process.exit(1); });
