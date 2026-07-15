import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ArticleCard from "@/components/ArticleCard";
import Breadcrumb from "@/components/Breadcrumb";
import JsonLd from "@/components/JsonLd";
import Pagination from "@/components/Pagination";
import { getAllAuthors, getAuthorBySlug, getPostsByAuthor } from "@/lib/wp";
import { personLd } from "@/lib/schema";
import { pageMeta } from "@/lib/seo-meta";

// Les 6 comptes auteur sont fixes et peu nombreux — un fetch direct sur
// /users est largement suffisant, pas besoin de dériver depuis getAllPosts()
// (voir next.config.ts pour le contexte ISR).
export async function generateStaticParams() {
  // Dégradation gracieuse (inspiré de next-wp/lib/wordpress.ts) — voir
  // app/[slug]/page.tsx pour le raisonnement complet.
  try {
    const authors = await getAllAuthors();
    return authors.map((a) => ({ slug: a.slug }));
  } catch (e) {
    console.warn(`[generateStaticParams /auteur/[slug]] échec du fetch WP, fallback sur []: ${e}`);
    return [];
  }
}

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ page?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const author = await getAuthorBySlug((await params).slug);
  if (!author) return {};
  return pageMeta({
    title: author.name,
    description: author.acf?.job_title ?? author.description,
    path: `/auteur/${author.slug}/`,
  });
}

export default async function AuthorPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const author = await getAuthorBySlug(slug);
  if (!author) notFound();
  const page = Math.max(1, Number((await searchParams).page) || 1);
  const { posts, totalPages } = await getPostsByAuthor(author.id, page);

  return (
    <div className="wrap">
      <Breadcrumb items={[{ name: "Accueil", href: "/" }, { name: author.name, href: `/auteur/${author.slug}/` }]} />

      <header className="article__head">
        <h1>{author.name}</h1>
        {author.acf?.job_title && <p className="eyebrow">{author.acf.job_title}</p>}
        <p>{author.description}</p>
      </header>

      <section className="section" aria-label="Articles de cet auteur">
        <div className="section__head">
          <h2>Ses articles</h2>
        </div>
        <div className="stack">
          {posts.map((p) => (
            <ArticleCard key={p.id} post={p} />
          ))}
        </div>
        <Pagination currentPage={page} totalPages={totalPages} basePath={`/auteur/${author.slug}/`} />
      </section>

      <JsonLd data={personLd(author)} />
    </div>
  );
}
