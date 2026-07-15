import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import ArticleCard from "@/components/ArticleCard";
import Breadcrumb from "@/components/Breadcrumb";
import Pagination from "@/components/Pagination";
import { getPostsByCategory, getTermBySlug } from "@/lib/wp";
import { getSilo, SILOS } from "@/lib/taxonomy";
import { pageMeta } from "@/lib/seo-meta";

export function generateStaticParams() {
  return SILOS.map((s) => ({ slug: s.slug }));
}

// Filet de sécurité en plus de l'invalidation ciblée par /api/revalidate —
// voir app/page.tsx.
export const revalidate = 900;

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ page?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const silo = getSilo((await params).slug);
  if (!silo) return {};
  return pageMeta({ title: silo.name, description: silo.desc, path: `/categorie/${silo.slug}/` });
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const silo = getSilo(slug);
  if (!silo) notFound();

  const page = Math.max(1, Number((await searchParams).page) || 1);

  // Dégradation gracieuse (voir app/[slug]/page.tsx) : cette page est l'une
  // des 19 pré-générées au build — si WP est temporairement injoignable pour
  // CETTE page précise, on affiche un état vide plutôt que de faire échouer
  // tout le déploiement ; elle se régénérera correctement à la prochaine
  // revalidation (900s, voir plus haut) une fois WP disponible.
  const { posts, totalPages } = await (async () => {
    try {
      const term = await getTermBySlug("categories", slug);
      return term ? await getPostsByCategory(term.id, page) : { posts: [], totalPages: 0 };
    } catch (e) {
      console.warn(`[categorie/${slug}] échec du fetch WP, fallback sur []: ${e}`);
      return { posts: [], totalPages: 0 };
    }
  })();

  return (
    <div className="wrap">
      <Breadcrumb items={[{ name: "Accueil", href: "/" }, { name: silo.name, href: `/categorie/${silo.slug}/` }]} />

      <header className="section">
        <h1>{silo.name}</h1>
        <p>{silo.desc}</p>
      </header>

      {silo.children.length > 0 && (
        <section className="section">
          <div className="section__head">
            <h2>Sous-rubriques</h2>
          </div>
          <div className="tagcloud">
            {silo.children.map((child) => (
              <span key={child} className="chip">
                {child}
              </span>
            ))}
          </div>
        </section>
      )}

      <section className="section">
        <div className="section__head">
          <h2>Articles publiés</h2>
        </div>
        {posts.length > 0 ? (
          <>
            <div className="stack">
              {posts.map((p) => (
                <ArticleCard key={p.id} post={p} />
              ))}
            </div>
            <Pagination currentPage={page} totalPages={totalPages} basePath={`/categorie/${silo.slug}/`} />
          </>
        ) : (
          <p>
            Aucun article publié pour l&apos;instant dans cette rubrique.{" "}
            <Link href="/rubriques/">Voir toutes les rubriques</Link>.
          </p>
        )}
      </section>
    </div>
  );
}
