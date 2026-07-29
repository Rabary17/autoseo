#!/usr/bin/env node
// Reconstruit les `children` (sous-cocons) de chaque silo dans
// frontend/monauto/data/taxonomy.json directement depuis
// data/maillage/maillage.json (source de vérité réelle), et ajoute la liste
// COMPLÈTE des articles prévus par sous-cocon (slug + titre) — nécessaire
// pour que la sidebar d'un sous-hub affiche tous ses articles prévus
// (placeholder "en préparation" pour ceux pas encore publiés), même
// mécanisme que la liste de sous-cocons d'un hub (voir STATE.md 2026-07-26).
//
// Ne dérive plus les sous-cocons de config/niches/.../niche.json : constaté
// le 2026-07-28 que ce fichier n'a jamais été mis à jour au fil des ajouts de
// sous-cocons (STATE.md 2026-07-11 et suivants) — 13 sous-cocons réels
// (ex. "Technologies d'avenir & rétrofit") manquaient de taxonomy.json,
// donc invisibles dans la sidebar de leur hub. maillage.json reflète toujours
// la réalité du site généré, jamais le plan d'origine — plus de risque de
// désynchronisation.
//
// name/desc/articles (total) au niveau silo restent ceux déjà présents dans
// taxonomy.json (jamais dérivables d'un fichier source, rédigés à la main) —
// seuls les `children` sont entièrement reconstruits.
const fs = require('fs');
const path = require('path');

const MAILLAGE_PATH = path.join(__dirname, '..', 'data', 'maillage', 'maillage.json');
const TAXONOMY_PATH = path.join(__dirname, '..', 'frontend', 'monauto', 'data', 'taxonomy.json');

function lastSegment(url) {
  return url.split('/').filter(Boolean).pop();
}

function titleCase(motCle) {
  return motCle.charAt(0).toUpperCase() + motCle.slice(1);
}

function main() {
  const maillage = JSON.parse(fs.readFileSync(MAILLAGE_PATH, 'utf8'));
  const taxonomy = JSON.parse(fs.readFileSync(TAXONOMY_PATH, 'utf8'));

  let totalArticles = 0;
  let totalSousCocons = 0;

  for (const silo of taxonomy.silos) {
    const siloEntries = maillage.filter((e) => lastSegment(e.hub) === silo.slug);
    const sousHubUrls = [...new Set(siloEntries.map((e) => e.sous_hub))];

    silo.children = sousHubUrls.map((sousHubUrl) => {
      const slug = lastSegment(sousHubUrl);
      const entries = siloEntries.filter((e) => e.sous_hub === sousHubUrl);
      const name = entries[0]?.ancres?.entite_seule || slug;
      return {
        name,
        slug,
        count: entries.length,
        articles: entries.map((e) => ({
          slug: lastSegment(e.url),
          title: titleCase(e.mot_cle_principal),
        })),
      };
    });

    totalArticles += siloEntries.length;
    totalSousCocons += silo.children.length;
  }

  taxonomy.updated = new Date().toISOString().slice(0, 10);
  fs.writeFileSync(TAXONOMY_PATH, JSON.stringify(taxonomy, null, 2) + '\n', 'utf8');
  console.log(`Terminé. ${totalSousCocons} sous-cocons, ${totalArticles} articles répartis dessus.`);
}

main();
