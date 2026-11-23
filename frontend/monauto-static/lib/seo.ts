import type { Metadata } from "next";
import { SITE_NAME, SITE_URL } from "./site";

type Options = {
  /** Titre de la page, sans le suffixe « — techcars » (ajouté par le gabarit du layout). */
  title: string;
  description: string;
  /** Chemin de la page avec slash final, ex. "/blog/". */
  path: string;
  type?: "website" | "article";
  /** Image à la une : chemin relatif (/images/…) ou URL absolue. */
  image?: string;
};

const absolu = (src: string) => (/^https?:\/\//.test(src) ? src : `${SITE_URL}${src}`);

/**
 * Métadonnées d'une page : canonical absolue et Open Graph complet.
 * Sans cela, les pages n'avaient ni canonical ni og:title/og:description.
 */
export function pageMetadata({ title, description, path, type = "website", image }: Options): Metadata {
  const url = `${SITE_URL}${path}`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title: `${title} — ${SITE_NAME}`,
      description,
      url,
      siteName: SITE_NAME,
      locale: "fr_FR",
      type,
      ...(image ? { images: [absolu(image)] } : {}),
    },
  };
}
