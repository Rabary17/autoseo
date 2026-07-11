// Génération JSON-LD — un seul endroit, à partir des mêmes données que le
// rendu visible (jamais dupliqué/désynchronisé, voir skills/geo.md section 3
// et skills/developpement.md section 3 : "une seule source de vérité").
import type { Source, WpPost, WpUser } from "./types";
import { SITE_NAME, SITE_URL } from "./site";

export interface Crumb {
  name: string;
  href: string;
}

export const organizationSchema = () => ({
  "@type": "Organization",
  "@id": `${SITE_URL}/#organization`,
  name: SITE_NAME,
  url: SITE_URL,
});

export const websiteSchema = () => ({
  "@type": "WebSite",
  "@id": `${SITE_URL}/#website`,
  url: SITE_URL,
  name: SITE_NAME,
});

export const breadcrumbSchema = (items: Crumb[]) => ({
  "@type": "BreadcrumbList",
  itemListElement: items.map((c, i) => ({
    "@type": "ListItem",
    position: i + 1,
    name: c.name,
    item: `${SITE_URL}${c.href}`,
  })),
});

export const personSchema = (author: WpUser) => ({
  "@type": "Person",
  "@id": `${SITE_URL}/auteur/${author.slug}#person`,
  name: author.name,
  description: author.description,
  url: `${SITE_URL}/auteur/${author.slug}`,
  jobTitle: author.acf?.job_title,
  sameAs: (author.acf?.same_as ?? "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean),
});

export function articleSchema(post: WpPost, sources: Source[]) {
  const author = post._embedded?.author?.[0];
  const media = post._embedded?.["wp:featuredmedia"]?.[0];
  const cat = post._embedded?.["wp:term"]?.[0]?.[0];

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Article",
        "@id": `${SITE_URL}/${post.slug}#article`,
        headline: post.title.rendered,
        datePublished: post.date,
        dateModified: post.modified,
        mainEntityOfPage: `${SITE_URL}/${post.slug}`,
        image: media?.source_url,
        articleSection: cat?.name,
        author: author
          ? { "@type": "Person", name: author.name, url: `${SITE_URL}/auteur/${author.slug}` }
          : undefined,
        citation: sources.map((s) => s.url),
        publisher: { "@id": `${SITE_URL}/#organization` },
      },
      organizationSchema(),
      websiteSchema(),
    ],
  };
}

export function breadcrumbLd(items: Crumb[]) {
  return { "@context": "https://schema.org", ...breadcrumbSchema(items) };
}

export function personLd(author: WpUser) {
  return { "@context": "https://schema.org", ...personSchema(author) };
}
