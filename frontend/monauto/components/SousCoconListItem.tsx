import Link from "next/link";

// Card sous-cocon pour la sidebar d'un hub — même forme visuelle que la grille
// "Nos domaines d'expertise" de l'accueil (.silo/.silo__main/.silo__desc,
// voir app/monauto.css et app/page.tsx), pour ne jamais faire diverger le style
// entre les deux listings (demande explicite de l'utilisateur, 2026-07-26).
// Un sous-cocon pas encore publié dans WordPress s'affiche quand même (liste
// complète attendue), mais sans lien et en style atténué (.silo--soon).
export default function SousCoconListItem({
  href,
  name,
  desc,
  imageUrl,
}: {
  href?: string;
  name: string;
  desc: string;
  imageUrl?: string;
}) {
  const content = (
    <>
      <span className="silo__main">
        {imageUrl && (
          <img
            src={imageUrl}
            alt=""
            width={40}
            height={40}
            loading="lazy"
            style={{ width: 40, height: 40, borderRadius: 10, objectFit: "cover", flexShrink: 0 }}
          />
        )}
        <span>
          <span className="silo__name">{name}</span>
          <span className="silo__desc" style={{ display: "block" }}>
            {desc}
          </span>
        </span>
      </span>
    </>
  );

  if (!href) {
    return <span className="silo silo--soon">{content}</span>;
  }
  return (
    <Link className="silo" href={href}>
      {content}
    </Link>
  );
}
