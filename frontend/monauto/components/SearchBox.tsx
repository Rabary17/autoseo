"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

interface SearchResult {
  id: number;
  slug: string;
  title: string;
  cat?: string;
}

// Recherche instantanée débouncée (300ms) : appelle /api/search (proxy
// serveur vers WP, voir app/api/search/route.ts) plutôt que d'exposer WP_URL
// au navigateur. "Entrée" ou "voir tous les résultats" mène à /recherche/.
export default function SearchBox() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }

    setLoading(true);
    const timeout = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}`);
        const data = (await res.json()) as { results: SearchResult[] };
        setResults(data.results ?? []);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
        setOpen(true);
      }
    }, 300);

    return () => clearTimeout(timeout);
  }, [query]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("click", onClickOutside);
    return () => document.removeEventListener("click", onClickOutside);
  }, []);

  function goToResults(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = query.trim();
    if (trimmed.length < 2) return;
    setOpen(false);
    router.push(`/recherche/?q=${encodeURIComponent(trimmed)}`);
  }

  return (
    <div className="searchbox" ref={containerRef}>
      <form onSubmit={goToResults} role="search">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => query.trim().length >= 2 && setOpen(true)}
          placeholder="Rechercher…"
          aria-label="Rechercher un article"
        />
      </form>

      {open && (
        <div className="searchbox__panel">
          {loading && <p className="searchbox__hint">Recherche…</p>}
          {!loading && results.length === 0 && <p className="searchbox__hint">Aucun résultat.</p>}
          {!loading && results.length > 0 && (
            <ul>
              {results.map((r) => (
                <li key={r.id}>
                  <Link href={`/${r.slug}/`} onClick={() => setOpen(false)}>
                    {r.cat && <span className="searchbox__cat">{r.cat}</span>}
                    <span>{r.title}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <Link
            href={`/recherche/?q=${encodeURIComponent(query.trim())}`}
            className="searchbox__all"
            onClick={() => setOpen(false)}
          >
            Voir tous les résultats pour « {query.trim()} »
          </Link>
        </div>
      )}
    </div>
  );
}
