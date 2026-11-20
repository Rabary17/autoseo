import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getAllPosts, getPostBySlug, getAllHubs, getHubBySlug, resolveCoverImage, extraireFaq } from "@/lib/posts";
import { resolveAuthor, authorUrl } from "@/lib/authors";
import { getCategory } from "@/lib/categories";
import { articleSchema, faqSchema } from "@/lib/schema";
import JsonLd from "@/components/JsonLd";

export function generateStaticParams() {
  const slugsPosts = getAllPosts().map((p) => ({ slug: p.slug }));
  const slugsHubs = getAllHubs().map((h) => ({ slug: h.slug }));
  return [...slugsPosts, ...slugsHubs];
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (post) return { title: post.title, description: post.description };
  const hub = getHubBySlug(slug);
  if (hub) return { title: hub.title, description: hub.description };
  return {};
}

export default async function ItemPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (post) {
    const cover = resolveCoverImage(post);
    const author = post.author ? resolveAuthor(post.author) : undefined;
    const categorie = post.category ? getCategory(post.category) : undefined;
    const faq = extraireFaq(post.contentHtml);
    return (
      <article className="post-content">
        <JsonLd data={articleSchema(post)} />
        {faq.length > 0 ? <JsonLd data={faqSchema(faq)} /> : null}
        {categorie ? (
          <a className="tag" href={`/categorie/${categorie.slug}/`}>
            {categorie.title}
          </a>
        ) : null}
        <h1>{post.title}</h1>
        <p className="card-meta">
          {post.date}
          {author ? (
            <>
              {" · "}
              <a href={authorUrl(author)}>{author.name}</a>
            </>
          ) : null}
        </p>
        <img className="cover" src={cover.src} alt={cover.alt} />
        <div dangerouslySetInnerHTML={{ __html: post.contentHtml }} />
      </article>
    );
  }

  const hub = getHubBySlug(slug);
  if (hub) {
    const cover = resolveCoverImage({ ...hub, title: hub.title });
    return (
      <article className="post-content">
        <h1>{hub.title}</h1>
        <img className="cover" src={cover.src} alt={cover.alt} />
        <div dangerouslySetInnerHTML={{ __html: hub.contentHtml }} />
      </article>
    );
  }

  notFound();
}
