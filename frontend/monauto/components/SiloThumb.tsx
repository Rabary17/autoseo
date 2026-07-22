"use client";
// Thumbnail de silo (petit format, grille d'accueil/rubriques) — image statique
// téléchargée une fois par scripts/fetch-silo-images.js (jamais régénérée à la volée,
// contrairement aux images d'articles/à la une qui restent éditables dans WordPress).
// Dégradation gracieuse : tant qu'une image n'a pas encore été téléchargée pour ce silo,
// l'élément se masque proprement plutôt que d'afficher une icône de lien cassé.
export default function SiloThumb({ slug, alt }: { slug: string; alt: string }) {
  return (
    <img
      src={`/silos/${slug}-thumb.jpg`}
      alt={alt}
      width={40}
      height={40}
      loading="lazy"
      style={{ width: 40, height: 40, borderRadius: 10, objectFit: "cover", flexShrink: 0 }}
      onError={(e) => {
        e.currentTarget.style.display = "none";
      }}
    />
  );
}
