import Link from "next/link";
import type { ReactNode } from "react";

// Card générique image + titre + métadonnées — un seul composant réutilisé
// par ArticleCard (liste d'articles) ET la grille de sous-hubs/hub (voir
// app/[slug]/page.tsx), pour ne jamais faire diverger le style des listings
// (demande explicite de l'utilisateur, 2026-07-22 : "réutilisabilité").
// `href` optionnel (2026-07-28) : un article prévu mais pas encore publié
// s'affiche quand même (liste complète attendue, voir HubSousHubContent),
// mais sans lien et en style atténué (`.card--soon`, même principe que
// `.silo--soon` pour les sous-cocons pas encore rédigés).
export default function EntityCard({
  href,
  title,
  eyebrow,
  image,
  meta,
}: {
  href?: string;
  /** HTML autorisé (ex. title.rendered de WP) — rendu via dangerouslySetInnerHTML. */
  title: string;
  eyebrow?: string;
  image?: { url: string; width?: number; height?: number; alt?: string };
  meta?: ReactNode;
}) {
  const media = image && (
    <img src={image.url} alt={image.alt || ""} loading="lazy" width={image.width} height={image.height} />
  );
  return (
    <article className={`card${href ? "" : " card--soon"}`}>
      {image &&
        (href ? (
          <Link href={href} className="card__media" aria-hidden tabIndex={-1}>
            {media}
          </Link>
        ) : (
          <span className="card__media">{media}</span>
        ))}
      <div className="card__body">
        {eyebrow && <p className="card__cat">{eyebrow}</p>}
        <h3 className="card__title">
          {href ? (
            <Link href={href} dangerouslySetInnerHTML={{ __html: title }} />
          ) : (
            <span dangerouslySetInnerHTML={{ __html: title }} />
          )}
        </h3>
        <div className="card__meta">{href ? meta : "Bientôt disponible"}</div>
      </div>
    </article>
  );
}
