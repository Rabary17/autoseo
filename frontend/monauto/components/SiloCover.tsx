"use client";
// Image de couverture de silo (page catégorie/rubrique) — statique, recadrée mobile/desktop
// via aspect-ratio + object-fit (pas deux fichiers séparés : un seul crop assez large,
// recentré par CSS selon le viewport). Même logique de dégradation gracieuse que
// SiloThumb : masquée tant qu'aucune image n'a été téléchargée pour ce silo.
export default function SiloCover({ slug, alt }: { slug: string; alt: string }) {
  return (
    <div className="silo-cover">
      <img
        src={`/silos/${slug}-cover.webp`}
        alt={alt}
        loading="eager"
        onError={(e) => {
          e.currentTarget.closest(".silo-cover")?.classList.add("silo-cover--hidden");
        }}
      />
    </div>
  );
}
