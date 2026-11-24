import Link from "next/link";
import type { ReactNode } from "react";

// Card réutilisée pour les listings (accueil, page auteur, enfants de hub) —
// même markup/classes que frontend/monauto/components/EntityCard.tsx (façon
// techno-play) pour un rendu identique entre les deux sites. Pas d'<img> du
// tout quand aucune couverture n'existe (plutôt qu'un fichier de repli
// générique) : évite toute icône d'image cassée pour les quelques articles
// sans média à la une.
export default function Card({
  href,
  title,
  eyebrow,
  image,
  meta,
}: {
  href: string;
  title: string;
  eyebrow?: string;
  image?: { src: string; alt: string };
  meta?: ReactNode;
}) {
  return (
    <article className="card">
      {image && (
        <Link href={href} className="card__media" aria-hidden tabIndex={-1}>
          <img src={image.src} alt={image.alt} loading="lazy" />
        </Link>
      )}
      <div className="card__body">
        {eyebrow && <p className="card__cat">{eyebrow}</p>}
        <h3 className="card__title">
          <Link href={href}>{title}</Link>
        </h3>
        {meta && <div className="card__meta">{meta}</div>}
      </div>
    </article>
  );
}
