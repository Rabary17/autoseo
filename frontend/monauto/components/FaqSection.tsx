import type { FaqItem } from "@/lib/types";

// Titres dépliables/repliables (natif <details>/<summary>, sans JS) — un seul
// composant réutilisé par les articles ET les pages hub/sous-hub (voir
// app/[slug]/page.tsx) pour ne jamais faire diverger le rendu FAQ.
export default function FaqSection({ items }: { items: FaqItem[] }) {
  if (items.length === 0) return null;
  return (
    <section className="faq" aria-label="Questions fréquentes">
      <h2>Questions fréquentes</h2>
      {items.map((item) => (
        <details key={item.question}>
          <summary>{item.question}</summary>
          <p>{item.answer}</p>
        </details>
      ))}
    </section>
  );
}
