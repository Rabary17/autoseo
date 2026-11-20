import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { AUTHORS, getAuthor } from "@/lib/authors";
import { getPostsByAuthor, resolveCoverImage } from "@/lib/posts";
import { profilePageSchema } from "@/lib/schema";
import JsonLd from "@/components/JsonLd";

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
      {author.image ? <img src={author.image} alt={author.name} width={96} height={96} style={{ borderRadius: "50%" }} /> : null}
      <h1>{author.name}</h1>
      <p>{author.role}</p>
      {author.bio.map((p, i) => (
        <p key={i}>{p}</p>
      ))}
      <h2>Articles de {author.name}</h2>
      <div className="card-grid">
        {posts.map((post) => {
          const cover = resolveCoverImage(post);
          return (
            <a key={post.slug} className="card" href={`/${post.slug}/`}>
              <img src={cover.src} alt={cover.alt} loading="lazy" />
              <div className="card-body">
                <p className="card-title">{post.title}</p>
                <p className="card-meta">{post.date}</p>
              </div>
            </a>
          );
        })}
      </div>
    </div>
  );
}
