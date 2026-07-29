import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import ArticleCard from "@/components/ArticleCard";
import Breadcrumb from "@/components/Breadcrumb";
import JsonLd from "@/components/JsonLd";
import Pagination from "@/components/Pagination";
import { getPostsByTag, getTermBySlug } from "@/lib/wp";
import { pageMeta } from "@/lib/seo-meta";
import { collectionPageLd } from "@/lib/schema";
import { SITE_NAME } from "@/lib/site";

// Pas de generateStaticParams : les tags sont des entités transversales
// (marque, modèle, code, prestation — voir skills/wordpress-publication.md
// section 2), potentiellement nombreux et non listés statiquement comme les
// 19 silos. Rendu à la demande (ISR, dynamicParams par défaut) au premier accès.
export const revalidate = 900;

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ page?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const term = await getTermBySlug("tags", (await params).slug).catch(() => null);
  if (!term) return {};
  return pageMeta({
    title: term.name,
    description: term.description || `Tous les articles ${SITE_NAME} sur ${term.name}.`,
    path: `/tag/${term.slug}/`,
  });
}

export default async function TagPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const page = Math.max(1, Number((await searchParams).page) || 1);

  // Dégradation gracieuse (voir app/[slug]/page.tsx) : un tag temporairement
  // injoignable affiche un état vide plutôt que de faire échouer la page.
  const { term, posts, totalPages } = await (async () => {
    try {
      const term = await getTermBySlug("tags", slug);
      if (!term) return { term: null, posts: [], totalPages: 0 };
      const { posts, totalPages } = await getPostsByTag(term.id, page);
      return { term, posts, totalPages };
    } catch (e) {
      console.warn(`[tag/${slug}] échec du fetch WP, fallback sur []: ${e}`);
      return { term: null, posts: [], totalPages: 0 };
    }
  })();

  if (!term) notFound();

  const breadcrumbItems = [{ name: "Accueil", href: "/" }, { name: term.name, href: `/tag/${term.slug}/` }];

  return (
    <div className="wrap">
      <Breadcrumb items={breadcrumbItems} />

      <header className="section">
        <p className="eyebrow">Sujet</p>
        <h1>{term.name}</h1>
        {term.description && <p>{term.description}</p>}
      </header>

      <section className="section">
        <div className="section__head">
          <h2>Articles</h2>
        </div>
        {posts.length > 0 ? (
          <>
            <div className="stack">
              {posts.map((p) => (
                <ArticleCard key={p.id} post={p} />
              ))}
            </div>
            <Pagination currentPage={page} totalPages={totalPages} basePath={`/tag/${term.slug}/`} />
          </>
        ) : (
          <p>
            Aucun article publié pour l&apos;instant sur ce sujet.{" "}
            <Link href="/rubriques/">Voir toutes les rubriques</Link>.
          </p>
        )}
      </section>

      <JsonLd
        data={collectionPageLd({
          title: term.name,
          description: term.description,
          path: `/tag/${term.slug}/`,
          items: posts.map((p) => ({ name: p.title.rendered, href: `/${p.slug}/` })),
        })}
      />
    </div>
  );
}
