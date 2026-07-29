import type { NextConfig } from "next";

// ISR (Incremental Static Regeneration) sur Vercel, PAS d'export statique.
// Décision du 2026-07-14 (remplace le choix SSG pur du 2026-07-11) : à
// l'échelle de 10 000 articles publiés en continu (5/jour, des années durant),
// un rebuild complet à chaque publication est inutilement coûteux/lent, et
// même un rebuild quotidien régénère toujours TOUTES les pages pour rien.
// Avec l'ISR, chaque page article/auteur est générée à la demande au premier
// accès puis mise en cache indéfiniment ; seule la régénération ciblée d'UNE
// page précise est déclenchée (via /api/revalidate, appelé par le mu-plugin
// WordPress à la publication — voir docs/architecture-headless.md).
// Reste 100% gratuit sur le plan Vercel Hobby (l'ISR fait partie du forfait).
const nextConfig: NextConfig = {
  trailingSlash: true,
  images: {
    unoptimized: true, // pas encore branché sur l'optimiseur d'image Vercel — à réévaluer plus tard
  },
  // 301 des URLs de l'ancien site "Tech'Cars" (agence auto à Laval, domaine
  // racheté) trouvées via Wayback Machine (CDX API, 2026-07-29) — préserve le
  // jus de lien des 143 domaines référents vers les rubriques les plus proches
  // thématiquement. /contact existe déjà à l'identique (géré par trailingSlash).
  async redirects() {
    return [
      { source: "/vehicule-d-occasion", destination: "/categorie/voiture-d-occasion/", permanent: true },
      { source: "/service-carte-grise", destination: "/categorie/carte-grise-demarches/", permanent: true },
      {
        source: "/location",
        destination: "/categorie/mobilite-partagee-transports/location-courte-longue-duree/",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
