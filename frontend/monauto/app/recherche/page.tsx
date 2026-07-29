import type { Metadata } from "next";
import ArticleCard from "@/components/ArticleCard";
import Breadcrumb from "@/components/Breadcrumb";
import Pagination from "@/components/Pagination";
import { searchPosts } from "@/lib/wp";
import { pageMeta } from "@/lib/seo-meta";
import { SITE_NAME } from "@/lib/site";

// Jamais indexée : une page de résultats de recherche interne n'a pas sa
// place dans Google (contenu dupliqué avec les vraies pages d'articles).
export const metadata: Metadata = {
  ...pageMeta({ title: "Recherche", description: `Recherche sur ${SITE_NAME}.`, path: "/recherche/" }),
  robots: { index: false, follow: true },
};

type Props = { searchParams: Promise<{ q?: string; page?: string }> };

export default async function SearchPage({ searchParams }: Props) {
  const { q, page: pageParam } = await searchParams;
  const query = (q ?? "").trim();
  const page = Math.max(1, Number(pageParam) || 1);

  const { posts, total, totalPages } = query
    ? await searchPosts(query, page, 10).catch((e) => {
        console.warn(`[recherche] échec du fetch WP pour "${query}": ${e}`);
        return { posts: [], total: 0, totalPages: 0 };
      })
    : { posts: [], total: 0, totalPages: 0 };

  return (
    <div className="wrap">
      <Breadcrumb items={[{ name: "Accueil", href: "/" }, { name: "Recherche", href: "/recherche/" }]} />

      <header className="section">
        <p className="eyebrow">Recherche</p>
        <h1>{query ? `Résultats pour « ${query} »` : "Rechercher un guide"}</h1>
        {query && <p>{total} résultat{total > 1 ? "s" : ""}.</p>}
      </header>

      <section className="section">
        {!query && <p>Utilisez la barre de recherche en haut de page pour trouver un guide.</p>}

        {query && posts.length === 0 && (
          <p>Aucun résultat pour « {query} ». Essayez un autre mot-clé, ou explorez nos <a href="/rubriques/">rubriques</a>.</p>
        )}

        {posts.length > 0 && (
          <>
            <div className="stack">
              {posts.map((p) => (
                <ArticleCard key={p.id} post={p} />
              ))}
            </div>
            <Pagination currentPage={page} totalPages={totalPages} basePath="/recherche/" queryParams={{ q: query }} />
          </>
        )}
      </section>
    </div>
  );
}
