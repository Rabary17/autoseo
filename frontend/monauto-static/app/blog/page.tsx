import type { Metadata } from "next";
import Link from "next/link";
import Card from "@/components/Card";
import { getAllPosts, resolveCoverImage } from "@/lib/posts";
import { getCategory } from "@/lib/categories";
import { resolveAuthor, authorUrl } from "@/lib/authors";
import { SITE_NAME } from "@/lib/site";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Blog : tous les articles auto et mobilité",
  description: `Tous les articles ${SITE_NAME} : entretien, pannes, marques, essais, démarches.`,
  path: "/blog/",
});

const dateFr = (d: string) => (d ? new Date(d).toLocaleDateString("fr-FR", { dateStyle: "long" }) : "");

export default function BlogPage() {
  const posts = getAllPosts().filter((p) => p.locale === "fr");
  return (
    <div className="blog-page">
      <h1 className="blog-title">Blog</h1>
      <p className="blog-lead">Tous nos articles, du plus récent au plus ancien.</p>
      <div className="hp-grid">
        {posts.map((post) => {
          const cover = resolveCoverImage(post);
          const categorie = post.category ? getCategory(post.category) : undefined;
          const author = post.author ? resolveAuthor(post.author) : undefined;
          return (
            <Card
              key={post.slug}
              href={`/${post.slug}/`}
              title={post.title}
              eyebrow={categorie?.title}
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
    </div>
  );
}
