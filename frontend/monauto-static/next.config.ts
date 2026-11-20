import type { NextConfig } from "next";

// Export 100% statique — plus de backend WordPress (migration 2026-11-20,
// voir scripts/migration/). Contrairement à frontend/monauto (ISR, pensé
// pour 10 000+ articles avec rebuild ciblé par page), ce site reste à
// l'échelle de techno-play.com/besthomeproject.com pour l'instant : un
// rebuild complet reste rapide et simple à ce volume (338 pages).
const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: {
    unoptimized: true, // l'optimiseur d'image Next.js ne fonctionne pas en export statique
  },
};

export default nextConfig;
