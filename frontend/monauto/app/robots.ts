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
//
// Disallow sur /tag/ (2026-08-26, audit Search Console "Statistiques
// d'exploration par objectif" du 2026-08-25) : 152 des 772 requêtes sur la
// période (~20%, 2e poste après les articles) ciblaient des pages tag, TOUTES
// déjà `noindex` et retirées du sitemap (voir STATE.md du 2026-07-30) — un
// retrait du sitemap n'empêche pas Google de recrawler des URLs qu'il connaît
// déjà par les liens internes (chaque article en lie plusieurs dans "Sujets
// liés"). Contrairement à ?_rsc=, cette fois c'est du vrai gaspillage de
// budget de crawl sur des pages qui ne seront de toute façon jamais indexées
// — les bloquer ne retire donc rien non plus.
//
// Ce qui N'EST PAS bloqué malgré un volume comparable dans le même audit
// (mentions légales, à-propos, FAQ, contact — ~150 requêtes) : ces pages
// restent index­ables et hors sitemap déjà, et sont au cœur du chantier EEAT
// du 2026-08-25 (voir docs/feuille-de-route-eeat-industrialisation.md) —
// les bloquer les désindexerait, contrairement aux tags qui n'ont jamais eu
// vocation à l'être. Ne pas bloquer non plus l'accueil, les pages catégorie
// ni /rubriques/ : ce sont les pages qui permettent à Google de découvrir les
// articles, le seul contenu qui compte vraiment — les bloquer irait contre
// l'objectif recherché (voir skills/seo.md section 8).
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/*?_rsc=*", "/tag/*"] }],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
