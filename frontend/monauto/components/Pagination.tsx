import Link from "next/link";

interface Props {
  currentPage: number;
  totalPages: number;
  /** Chemin de base avec slash final, ex. "/categorie/entretien/" */
  basePath: string;
  /** Paramètres à conserver d'une page à l'autre (ex. { q: "vidange" } sur /recherche/) */
  queryParams?: Record<string, string>;
}

// Pagination server-side simple : ?page=N sur l'URL de la liste. Fenêtre de
// pages autour de la courante + première/dernière — jamais une liste de tous
// les numéros (poserait problème dès plusieurs centaines de pages à 10 000
// articles/silo).
export default function Pagination({ currentPage, totalPages, basePath, queryParams }: Props) {
  if (totalPages <= 1) return null;

  const pageHref = (p: number) => {
    const params = new URLSearchParams(queryParams);
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };
  const prev = currentPage > 1 ? currentPage - 1 : null;
  const next = currentPage < totalPages ? currentPage + 1 : null;

  const windowSize = 2;
  const pages = new Set<number>([1, totalPages]);
  for (let p = currentPage - windowSize; p <= currentPage + windowSize; p++) {
    if (p >= 1 && p <= totalPages) pages.add(p);
  }
  const sorted = [...pages].sort((a, b) => a - b);

  return (
    <nav className="pagination" aria-label="Pagination">
      {prev ? (
        <Link href={pageHref(prev)} rel="prev">
          Précédent
        </Link>
      ) : (
        <span aria-disabled="true">Précédent</span>
      )}

      <span className="pagination__pages">
        {sorted.map((p, i) => (
          <span key={p} style={{ display: "flex", alignItems: "center" }}>
            {i > 0 && sorted[i - 1] !== p - 1 && <span className="pagination__ellipsis">…</span>}
            {p === currentPage ? (
              <span aria-current="page">{p}</span>
            ) : (
              <Link href={pageHref(p)}>{p}</Link>
            )}
          </span>
        ))}
      </span>

      {next ? (
        <Link href={pageHref(next)} rel="next">
          Suivant
        </Link>
      ) : (
        <span aria-disabled="true">Suivant</span>
      )}
    </nav>
  );
}
