import type { TocItem } from "@/lib/toc";

// Placée après l'image à la une, avant le corps de l'article (demande
// explicite de l'utilisateur, 2026-08-06). Masquée si trop peu de titres pour
// être utile (une seule section ne justifie pas une table des matières).
export default function TableOfContents({ items }: { items: TocItem[] }) {
  if (items.length < 2) return null;

  return (
    <nav className="toc" aria-label="Table des matières">
      <p className="toc__title">Sommaire</p>
      <ol>
        {items.map((item) => (
          <li key={item.id} className={`toc__item toc__item--${item.level}`}>
            <a href={`#${item.id}`}>{item.text}</a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
