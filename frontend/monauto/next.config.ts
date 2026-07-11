import type { NextConfig } from "next";

// Export 100% statique : pas de serveur Node en production, juste des
// fichiers HTML/CSS servis par un CDN — priorité absolue donnée à la vitesse
// (voir skills/design.md section 3 et skills/developpement.md section 3).
// Le site est reconstruit (npm run build) à chaque publication WordPress
// (déclenché manuellement ou via le webhook du mu-plugin, voir
// docs/architecture-headless.md).
const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: {
    unoptimized: true, // export statique : pas d'API d'optimisation d'image côté serveur
  },
};

export default nextConfig;
