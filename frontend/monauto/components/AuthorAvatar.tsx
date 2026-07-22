"use client";
// Avatar auteur — image statique (mains/geste, jamais de visage visible : décision
// explicite de l'utilisateur le 2026-07-21, voir scripts/fetch-author-avatars.js) servie
// depuis public/authors/{slug}.jpg. Dégradation gracieuse : masqué si pas encore
// téléchargé pour ce slug (ex. un nouveau persona pas encore traité par le script).
export default function AuthorAvatar({
  slug,
  alt,
  size = 36,
}: {
  slug: string;
  alt: string;
  size?: number;
}) {
  return (
    <img
      src={`/authors/${slug}.webp`}
      alt={alt}
      width={size}
      height={size}
      className="avatar"
      style={{ width: size, height: size }}
      onError={(e) => {
        e.currentTarget.style.display = "none";
      }}
    />
  );
}
