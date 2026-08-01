import type { MetadataRoute } from "next";
import { getAllAuthors, getAllPagesFull, getAllPosts, getAllTags } from "@/lib/wp";
import { SILOS } from "@/lib/taxonomy";
import { SITE_URL } from "@/lib/site";

// ISR : le sitemap n'est plus figé au build (il n'y a plus de build unique
// avec output:"export") — régénéré au plus toutes les heures, ce qui suffit
// largement à un rythme de publication de quelques articles/jour. Voir
// skills/seo.md section 5 : sitemaps segmentés par silo, ≤ 2 000 URLs/sitemap.
// En dessous de ce volume (test + démarrage), un seul fichier suffit ; à
// segmenter par silo quand le nombre d'articles publiés le justifiera.
export const revalidate = 3600;

// WP renvoie `modified_gmt` en UTC mais sans indicateur de fuseau (ex.
// "2026-07-30T05:08:18") — passé tel quel, Google Search Console rejette la
// date ("Date non valide", format W3C Datetime non respecté). Le "Z" en fait
// une date UTC explicite, valide en ISO 8601.
function toLastModified(modifiedGmt: string): Date {
  return new Date(`${modifiedGmt}Z`);
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Dégradation gracieuse (inspiré de next-wp/lib/wordpress.ts, voir
  // app/[slug]/page.tsx) : un sitemap partiel (sans la ressource en échec)
  // plutôt qu'un déploiement bloqué si WP est temporairement injoignable — il
  // sera complété à la prochaine revalidation (max 1h, voir plus haut).
  const [posts, pages, authors, tags] = await Promise.all([
    getAllPosts().catch((e) => {
      console.warn(`[sitemap] échec du fetch getAllPosts, fallback sur []: ${e}`);
      return [];
    }),
    getAllPagesFull().catch((e) => {
      console.warn(`[sitemap] échec du fetch getAllPagesFull, fallback sur []: ${e}`);
      return [];
    }),
    getAllAuthors().catch((e) => {
      console.warn(`[sitemap] échec du fetch getAllAuthors, fallback sur []: ${e}`);
      return [];
    }),
    getAllTags().catch((e) => {
      console.warn(`[sitemap] échec du fetch getAllTags, fallback sur []: ${e}`);
      return [];
    }),
  ]);

  const staticUrls: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, changeFrequency: "daily", priority: 1 },
    { url: `${SITE_URL}/rubriques/`, changeFrequency: "weekly", priority: 0.8 },
  ];

  const categoryUrls: MetadataRoute.Sitemap = SILOS.map((s) => ({
    url: `${SITE_URL}/categorie/${s.slug}/`,
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  const tagUrls: MetadataRoute.Sitemap = tags.map((t) => ({
    url: `${SITE_URL}/tag/${t.slug}/`,
    changeFrequency: "weekly",
    priority: 0.4,
  }));

  const authorUrls: MetadataRoute.Sitemap = authors.map((a) => ({
    url: `${SITE_URL}/auteur/${a.slug}/`,
    changeFrequency: "monthly",
    priority: 0.5,
  }));

  // Toutes les pages WP statiques (pas seulement "à propos" en dur) — chaque
  // page publiée dans WP doit apparaître ici sans intervention manuelle.
  const pageUrls: MetadataRoute.Sitemap = pages.map((p) => ({
    url: `${SITE_URL}/${p.slug}/`,
    lastModified: toLastModified(p.modified_gmt),
    changeFrequency: "monthly",
    priority: 0.3,
  }));

  const postUrls: MetadataRoute.Sitemap = posts.map((p) => ({
    url: `${SITE_URL}/${p.slug}/`,
    lastModified: toLastModified(p.modified_gmt),
    changeFrequency: "monthly",
    priority: 0.6,
  }));

  return [...staticUrls, ...categoryUrls, ...tagUrls, ...authorUrls, ...pageUrls, ...postUrls];
}
