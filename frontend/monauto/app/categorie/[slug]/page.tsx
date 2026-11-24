import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import Card from "@/components/Card";
import { getPostsByCategory, resolveCoverImage } from "@/lib/posts";
import { CATEGORIES, getCategory } from "@/lib/categories";
import { resolveAuthor, authorUrl } from "@/lib/authors";
import { pageMetadata } from "@/lib/seo";

const dateFr = (d: string) => (d ? new Date(d).toLocaleDateString("fr-FR", { dateStyle: "long" }) : "");

export function generateStaticParams() {
  return CATEGORIES.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const categorie = getCategory(slug);
  if (!categorie) return {};
  return pageMetadata({
    title: categorie.title,
    description: `${categorie.title} : les articles de la rubrique ${categorie.section} sur techcars.`,
    path: `/categorie/${categorie.slug}/`,
  });
}

export default async function CategoriePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const categorie = getCategory(slug);
  if (!categorie) notFound();
  const posts = getPostsByCategory(categorie.slug).filter((p) => p.locale === "fr");

  return (
    <div className="blog-page">
      <p className="eyebrow">{categorie.section}</p>
      <h1 className="blog-title">{categorie.title}</h1>
      {posts.length > 0 ? (
        <div className="hp-grid">
          {posts.map((post) => {
            const cover = resolveCoverImage(post);
            const author = post.author ? resolveAuthor(post.author) : undefined;
            return (
              <Card
                key={post.slug}
                href={`/${post.slug}/`}
                title={post.title}
                image={cover.src ? { src: cover.src, alt: cover.alt } : undefined}
                meta={
                  <>
                    <time dateTime={post.date}>{dateFr(post.date)}</time>
                    {author && (
                      <>
                        {" · "}
                        <Link href={authorUrl(author)}>{author.name}</Link>
                      </>
                    )}
                  </>
                }
              />
            );
          })}
        </div>
      ) : (
        <p className="hp-empty">Les prochains articles de cette rubrique arrivent bientôt.</p>
      )}
    </div>
  );
}
