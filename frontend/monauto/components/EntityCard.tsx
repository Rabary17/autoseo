import Link from "next/link";
import type { ReactNode } from "react";

// Card générique image + titre + métadonnées — un seul composant réutilisé
// par ArticleCard (liste d'articles) ET la grille de sous-hubs/hub (voir
// app/[slug]/page.tsx), pour ne jamais faire diverger le style des listings
// (demande explicite de l'utilisateur, 2026-07-22 : "réutilisabilité").
export default function EntityCard({
  href,
  title,
  eyebrow,
  image,
  meta,
}: {
  href: string;
  /** HTML autorisé (ex. title.rendered de WP) — rendu via dangerouslySetInnerHTML. */
  title: string;
  eyebrow?: string;
  image?: { url: string; width?: number; height?: number };
  meta?: ReactNode;
}) {
  return (
    <article className="card">
      {image && (
        <Link href={href} className="card__media" aria-hidden tabIndex={-1}>
          <img src={image.url} alt="" loading="lazy" width={image.width} height={image.height} />
        </Link>
      )}
      <div className="card__body">
        {eyebrow && <p className="card__cat">{eyebrow}</p>}
        <h3 className="card__title">
          <Link href={href} dangerouslySetInnerHTML={{ __html: title }} />
        </h3>
        {meta && <div className="card__meta">{meta}</div>}
      </div>
    </article>
  );
}
