// Construction cohérente des métadonnées (canonical, Open Graph, Twitter
// Card) sur toutes les pages — un seul endroit pour ne pas en oublier une
// (voir audit SEO du 2026-07-11). Toujours dérivé des mêmes données que le
// contenu visible et le JSON-LD (lib/schema.ts), jamais une info différente.
import type { Metadata } from "next";
import { SITE_NAME, SITE_URL } from "./site";

interface PageMetaInput {
  title: string;
  description: string;
  /** Chemin absolu depuis la racine, avec slash final (ex. "/vidange-guide/") */
  path: string;
  /** URL d'image absolue pour og:image/twitter:image (image à la une si dispo) */
  image?: string;
  type?: "website" | "article";
  publishedTime?: string;
  modifiedTime?: string;
  authorName?: string;
}

export function pageMeta({
  title,
  description,
  path,
  image,
  type = "website",
  publishedTime,
  modifiedTime,
  authorName,
}: PageMetaInput): Metadata {
  const url = `${SITE_URL}${path}`;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      siteName: SITE_NAME,
      locale: "fr_FR",
      type,
      ...(type === "article" ? { publishedTime, modifiedTime, authors: authorName ? [authorName] : undefined } : {}),
      ...(image ? { images: [{ url: image }] } : {}),
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title,
      description,
      ...(image ? { images: [image] } : {}),
    },
  };
}
