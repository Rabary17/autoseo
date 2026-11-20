import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Card from "@/components/Card";
import { AUTHORS, getAuthor } from "@/lib/authors";
import { getPostsByAuthor, resolveCoverImage } from "@/lib/posts";
import { getCategory } from "@/lib/categories";
import { profilePageSchema } from "@/lib/schema";
import JsonLd from "@/components/JsonLd";

const dateFr = (d: string) => (d ? new Date(d).toLocaleDateString("fr-FR", { dateStyle: "long" }) : "");

export function generateStaticParams() {
  return AUTHORS.map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const author = getAuthor(slug);
  if (!author) return {};
  return { title: author.name, description: author.shortBio };
}

export default async function AuthorPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const author = getAuthor(slug);
  if (!author) notFound();
  const posts = getPostsByAuthor(author.slug);

  return (
    <div>
      <JsonLd data={profilePageSchema(author)} />
      <div className="author-hero">
        {author.image && <img className="avatar" src={author.image} alt={author.name} />}
        <div>
          <h1>{author.name}</h1>
          <p className="role">{author.role}</p>
        </div>
      </div>
      {author.bio.map((p, i) => (
        <p key={i} className="prose">
          {p}
        </p>
      ))}
      <div className="hp-section">
        <div className="hp-head">
          <h2>Articles de {author.name}</h2>
        </div>
        {posts.length > 0 ? (
          <div className="hp-grid">
            {posts.map((post) => {
              const cover = resolveCoverImage(post);
              const categorie = post.category ? getCategory(post.category) : undefined;
              return (
                <Card
                  key={post.slug}
                  href={`/${post.slug}/`}
                  title={post.title}
                  eyebrow={categorie?.title}
                  image={cover.src ? { src: cover.src, alt: cover.alt } : undefined}
                  meta={<time dateTime={post.date}>{dateFr(post.date)}</time>}
                />
              );
            })}
          </div>
        ) : (
          <p className="hp-empty">Aucun article publié pour l&apos;instant.</p>
        )}
      </div>
    </div>
  );
}
