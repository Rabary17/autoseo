// Génération JSON-LD — un seul endroit, à partir des mêmes données que le
// rendu visible (jamais dupliqué/désynchronisé, voir skills/geo.md section 3
// et skills/developpement.md section 3 : "une seule source de vérité").
import type { FaqItem, Source, WpPost, WpUser } from "./types";
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
  // Requis par Google pour afficher le logo de la marque dans les résultats
  // enrichis / le Knowledge Panel. Format raster (PNG), pas SVG — recommandation
  // Google pour ce champ précis (voir docs/architecture-headless.md section 6).
  logo: {
    "@type": "ImageObject",
    url: `${SITE_URL}/logo.png`,
  },
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
        // ImageObject avec dimensions (pas juste une URL nue) : requis par
        // Google pour l'éligibilité aux images dans les résultats enrichis et
        // Discover — largeur ≥ 696px recommandée (dépend de l'image uploadée
        // dans WordPress, voir skills/wordpress-publication.md section 3).
        image: media
          ? {
              "@type": "ImageObject",
              url: media.source_url,
              width: media.media_details?.width,
              height: media.media_details?.height,
            }
          : undefined,
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

// Pages de silo/sous-cocon/tag : ce sont des pages de LISTING (catégories WP),
// pas des articles — CollectionPage + ItemList est le schéma recommandé par
// Google pour ce type de page (voir https://schema.org/CollectionPage), à ne
// pas confondre avec Article qui décrit un contenu éditorial unique avec
// auteur/date. Le BreadcrumbList est déjà émis séparément par le composant
// <Breadcrumb> (voir components/Breadcrumb.tsx) — pas dupliqué ici.
export function collectionPageLd({
  title,
  description,
  path,
  items,
}: {
  title: string;
  description?: string;
  path: string;
  items: { name: string; href: string }[];
}) {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        "@id": `${SITE_URL}${path}#webpage`,
        name: title,
        description,
        url: `${SITE_URL}${path}`,
        isPartOf: { "@id": `${SITE_URL}/#website` },
        ...(items.length > 0
          ? {
              mainEntity: {
                "@type": "ItemList",
                itemListElement: items.map((it, i) => ({
                  "@type": "ListItem",
                  position: i + 1,
                  url: `${SITE_URL}${it.href}`,
                  name: it.name,
                })),
              },
            }
          : {}),
      },
      organizationSchema(),
      websiteSchema(),
    ],
  };
}

export function personLd(author: WpUser) {
  return { "@context": "https://schema.org", ...personSchema(author) };
}

// Un seul bloc FAQPage par page, questions dans le même ordre que le texte
// visible (voir skills/geo.md section 3) — le composant appelant est
// responsable d'afficher exactement les mêmes questions/réponses.
export function faqPageLd(items: FaqItem[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  };
}
