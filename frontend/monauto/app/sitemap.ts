import type { MetadataRoute } from "next";
import { getAllPosts, getPageBySlug } from "@/lib/wp";
import { SILOS } from "@/lib/taxonomy";
import { SITE_URL } from "@/lib/site";

// ISR : le sitemap n'est plus figé au build (il n'y a plus de build unique
// avec output:"export") — régénéré au plus toutes les heures, ce qui suffit
// largement à un rythme de publication de quelques articles/jour. Voir
// skills/seo.md section 5 : sitemaps segmentés par silo, ≤ 2 000 URLs/sitemap.
// En dessous de ce volume (test + démarrage), un seul fichier suffit ; à
// segmenter par silo quand le nombre d'articles publiés le justifiera.
export const revalidate = 3600;
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Dégradation gracieuse (inspiré de next-wp/lib/wordpress.ts, voir
  // app/[slug]/page.tsx) : un sitemap partiel (sans les articles) plutôt
  // qu'un déploiement bloqué si WP est temporairement injoignable — il sera
  // complété à la prochaine revalidation (max 1h, voir plus haut).
  const [posts, aPropos] = await Promise.all([
    getAllPosts().catch((e) => {
      console.warn(`[sitemap] échec du fetch getAllPosts, fallback sur []: ${e}`);
      return [];
    }),
    getPageBySlug("a-propos").catch(() => null),
  ]);

  const staticUrls: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, changeFrequency: "daily", priority: 1 },
    { url: `${SITE_URL}/rubriques/`, changeFrequency: "weekly", priority: 0.8 },
    ...(aPropos ? [{ url: `${SITE_URL}/a-propos/`, changeFrequency: "monthly" as const, priority: 0.3 }] : []),
  ];

  const categoryUrls: MetadataRoute.Sitemap = SILOS.map((s) => ({
    url: `${SITE_URL}/categorie/${s.slug}/`,
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  const postUrls: MetadataRoute.Sitemap = posts.map((p) => ({
    url: `${SITE_URL}/${p.slug}/`,
    lastModified: p.modified,
    changeFrequency: "monthly",
    priority: 0.6,
  }));

  return [...staticUrls, ...categoryUrls, ...postUrls];
}
