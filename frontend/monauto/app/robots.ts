import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

export const dynamic = "force-static";

// Ne jamais bloquer les crawlers IA légitimes (voir skills/geo.md section 5).
//
// Disallow sur ?_rsc= (2026-08-06, audit Search Console "Statistiques
// d'exploration" par type de fichier) : Next.js (App Router) émet des liens
// de prefetch client-side vers chaque page sous forme de payload React
// Server Components (`/page/?_rsc=<hash>`), que Googlebot crawle comme des
// ressources à part entière — confirmé via l'export GSC "Autre type de
// fichier" : 100% des 301 échantillons étaient des URLs `?_rsc=`, sur 56
// pages distinctes, expliquant à elles seules ~56% du budget de crawl total.
// Ce paramètre ne sert qu'à la navigation interne côté client (pas de
// contenu indexable propre) : le bloquer ne retire RIEN de l'index — Google
// continue de crawler/indexer l'URL réelle (sans `?_rsc=`) normalement, avec
// son HTML complet.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: "/*?_rsc=*" }],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
