import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import ArticleCard from "@/components/ArticleCard";
import Breadcrumb from "@/components/Breadcrumb";
import JsonLd from "@/components/JsonLd";
import Pagination from "@/components/Pagination";
import { getChildCategories, getCategoryById, getPostsByCategory, getTermBySlug } from "@/lib/wp";
import { getSilo, SILOS } from "@/lib/taxonomy";
import { pageMeta } from "@/lib/seo-meta";
import { collectionPageLd } from "@/lib/schema";
import type { WpTerm } from "@/lib/types";
import SousCoconIcon from "@/components/SousCoconIcon";
import SiloCover from "@/components/SiloCover";

export function generateStaticParams() {
  return SILOS.map((s) => ({ slug: s.slug }));
}

// Filet de sécurité en plus de l'invalidation ciblée par /api/revalidate —
// voir app/page.tsx.
export const revalidate = 900;

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ page?: string }> };

// Une catégorie de silo (dans data/taxonomy.json, statique) OU une catégorie
// de sous-cocon (uniquement en base WP, pas dans taxonomy.json) — cette page
// gère les deux depuis 2026-07-21 : avant, un slug de sous-cocon 404ait (les
// liens ajoutés dans la sidebar de app/[slug]/page.tsx y mènent désormais).
async function resolveCategoryPage(slug: string) {
  const silo = getSilo(slug);
  if (silo) return { title: silo.name, desc: silo.desc, breadcrumbParent: null as WpTerm | null };

  const term = await getTermBySlug("categories", slug);
  if (!term) return null;
  const parent = term.parent ? await getCategoryById(term.parent) : null;
  return { title: term.name, desc: term.description, breadcrumbParent: parent, term };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const resolved = await resolveCategoryPage(slug);
  if (!resolved) return {};
  return pageMeta({ title: resolved.title, description: resolved.desc, path: `/categorie/${slug}/` });
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const resolved = await resolveCategoryPage(slug);
  if (!resolved) notFound();
  const { title, desc, breadcrumbParent } = resolved;
  const isSiloPage = !!getSilo(slug); // couverture uniquement sur les 19 pages silo, pas les sous-cocons

  const page = Math.max(1, Number((await searchParams).page) || 1);

  // Dégradation gracieuse (voir app/[slug]/page.tsx) : cette page est l'une
  // des 19 pré-générées au build (silos) — les sous-cocons sont rendus à la
  // demande (ISR). Si WP est temporairement injoignable, on affiche un état
  // vide plutôt que de faire échouer tout le déploiement ; elle se régénérera
  // correctement à la prochaine revalidation (900s, voir plus haut) une fois
  // WP disponible.
  const { posts, totalPages, siblings } = await (async () => {
    try {
      const term = "term" in resolved && resolved.term ? resolved.term : await getTermBySlug("categories", slug);
      if (!term) return { posts: [], totalPages: 0, siblings: [] as WpTerm[] };
      const [postsRes, siblingCats] = await Promise.all([
        getPostsByCategory(term.id, page),
        getChildCategories(breadcrumbParent ? breadcrumbParent.id : term.id),
      ]);
      return { ...postsRes, siblings: siblingCats };
    } catch (e) {
      console.warn(`[categorie/${slug}] échec du fetch WP, fallback sur []: ${e}`);
      return { posts: [], totalPages: 0, siblings: [] as WpTerm[] };
    }
  })();

  const breadcrumbItems = [
    { name: "Accueil", href: "/" },
    ...(breadcrumbParent ? [{ name: breadcrumbParent.name, href: `/categorie/${breadcrumbParent.slug}/` }] : []),
    { name: title, href: `/categorie/${slug}/` },
  ];

  return (
    <div className="wrap">
      <Breadcrumb items={breadcrumbItems} />

      {isSiloPage && <SiloCover slug={slug} alt={title} />}

      <header className="section">
        <h1>{title}</h1>
        {desc && <p>{desc}</p>}
      </header>

      {siblings.length > 0 && (
        <section className="section">
          <div className="section__head">
            <h2>{breadcrumbParent ? "Autres sous-rubriques" : "Sous-rubriques"}</h2>
          </div>
          <div className="tagcloud">
            {siblings.map((sc) =>
              sc.slug === slug ? (
                <strong key={sc.id} className="chip" aria-current="page" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <SousCoconIcon name={sc.name} /> {sc.name}
                </strong>
              ) : (
                <Link key={sc.id} href={`/categorie/${sc.slug}/`} className="chip" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <SousCoconIcon name={sc.name} /> {sc.name}
                </Link>
              )
            )}
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
            <Pagination currentPage={page} totalPages={totalPages} basePath={`/categorie/${slug}/`} />
          </>
        ) : (
          <p>
            Aucun article publié pour l&apos;instant dans cette rubrique.{" "}
            <Link href="/rubriques/">Voir toutes les rubriques</Link>.
          </p>
        )}
      </section>

      <JsonLd
        data={collectionPageLd({
          title,
          description: desc,
          path: `/categorie/${slug}/`,
          items: posts.map((p) => ({ name: p.title.rendered, href: `/${p.slug}/` })),
        })}
      />
    </div>
  );
}
