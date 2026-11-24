import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";
import { CATEGORIES } from "@/lib/categories";
import { AUTHORS } from "@/lib/authors";
import { getAllPosts, getAllHubs } from "@/lib/posts";

// Export statique (output: "export") : la route doit être figée au build.
export const dynamic = "force-static";

// Sitemap des seules pages indexables en français, toutes en URL canoniques
// (slash final, cf. trailingSlash dans next.config.ts). Les rubriques sans
// article ne sont pas listées : elles affichent un message « bientôt » et ne
// doivent pas entrer dans l'index.
export default function sitemap(): MetadataRoute.Sitemap {
  const posts = getAllPosts().filter((p) => p.locale === "fr");
  const hubs = getAllHubs().filter((h) => h.locale === "fr");
  const rubriques = CATEGORIES.filter((c) => posts.some((p) => p.category === c.slug));

  return [
    { url: `${SITE_URL}/` },
    { url: `${SITE_URL}/blog/` },
    { url: `${SITE_URL}/rubriques/` },
    { url: `${SITE_URL}/a-propos/` },
    ...rubriques.map((c) => ({ url: `${SITE_URL}/categorie/${c.slug}/` })),
    ...AUTHORS.map((a) => ({ url: `${SITE_URL}/auteur/${a.slug}/` })),
    ...hubs.map((h) => ({
      url: `${SITE_URL}/${h.slug}/`,
      ...(h.date ? { lastModified: new Date(h.date) } : {}),
    })),
    ...posts.map((p) => {
      const modifie = p.updated || p.date;
      return {
        url: `${SITE_URL}/${p.slug}/`,
        ...(modifie ? { lastModified: new Date(modifie) } : {}),
      };
    }),
  ];
}
