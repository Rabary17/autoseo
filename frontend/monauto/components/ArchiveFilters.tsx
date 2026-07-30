"use client";

// Formulaire GET natif : chaque <select> soumet au changement (pas besoin de
// gérer l'état ni le clic sur un bouton) — reconstruit l'URL /archives/ avec
// les filtres choisis, `page` retiré volontairement pour repartir de la page 1
// à chaque changement de filtre.
export default function ArchiveFilters({
  categoryGroups,
  tags,
  selectedCategory,
  selectedTag,
}: {
  categoryGroups: { name: string; slug: string; children: { name: string; slug: string }[] }[];
  tags: { name: string; slug: string }[];
  selectedCategory?: string;
  selectedTag?: string;
}) {
  function submitOnChange(e: React.ChangeEvent<HTMLSelectElement>) {
    e.currentTarget.form?.requestSubmit();
  }

  return (
    <form action="/archives/" method="GET" className="archive-filters">
      <div className="archive-filters__field">
        <label htmlFor="archive-categorie">Catégorie</label>
        <select id="archive-categorie" name="categorie" defaultValue={selectedCategory ?? ""} onChange={submitOnChange}>
          <option value="">Toutes les catégories</option>
          {categoryGroups.map((g) => (
            <optgroup key={g.slug} label={g.name}>
              <option value={g.slug}>{g.name}</option>
              {g.children.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {"— " + c.name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      <div className="archive-filters__field">
        <label htmlFor="archive-tag">Tag</label>
        <select id="archive-tag" name="tag" defaultValue={selectedTag ?? ""} onChange={submitOnChange}>
          <option value="">Tous les tags</option>
          {tags.map((t) => (
            <option key={t.slug} value={t.slug}>
              {t.name}
            </option>
          ))}
        </select>
      </div>

      <noscript>
        <button type="submit" className="btn btn--primary">
          Filtrer
        </button>
      </noscript>
    </form>
  );
}
