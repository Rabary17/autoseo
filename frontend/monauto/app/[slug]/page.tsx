import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { getAllPosts, getPostBySlug, getAllHubs, getHubBySlug, resolveCoverImage, extraireFaq } from "@/lib/posts";
import { resolveAuthor, authorUrl } from "@/lib/authors";
import { getCategory } from "@/lib/categories";
import { articleSchema, faqSchema } from "@/lib/schema";
import JsonLd from "@/components/JsonLd";
import { formatDate } from "@/lib/format";
import { pageMetadata } from "@/lib/seo";

export function generateStaticParams() {
  const slugsPosts = getAllPosts().map((p) => ({ slug: p.slug }));
  const slugsHubs = getAllHubs().map((h) => ({ slug: h.slug }));
  return [...slugsPosts, ...slugsHubs];
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (post)
    return pageMetadata({
      title: post.title,
      description: post.description,
      path: `/${post.slug}/`,
      type: "article",
      image: resolveCoverImage(post).src,
    });
  const hub = getHubBySlug(slug);
  if (hub)
    return pageMetadata({
      title: hub.title,
      description: hub.description,
      path: `/${hub.slug}/`,
      image: resolveCoverImage(hub).src,
    });
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
      <article>
        <JsonLd data={articleSchema(post)} />
        {faq.length > 0 ? <JsonLd data={faqSchema(faq)} /> : null}
        <div className="article__head">
          {categorie && (
            <Link className="eyebrow" href={`/categorie/${categorie.slug}/`}>
              {categorie.title}
            </Link>
          )}
          <h1 className="article__title">{post.title}</h1>
          <div className="article__byline">
            {author?.image && <img className="avatar" src={author.image} alt={author.name} />}
            <span>
              {author && <Link href={authorUrl(author)}>{author.name}</Link>}
              {author && post.date && <span aria-hidden="true"> · </span>}
              {post.date && <time dateTime={post.date}>{formatDate(post.date)}</time>}
              {post.updated && post.updated !== post.date && (
                <>
                  <span aria-hidden="true"> · </span>
                  mis à jour le <time dateTime={post.updated}>{formatDate(post.updated)}</time>
                </>
              )}
            </span>
          </div>
        </div>
        {cover.src && (
          <div className="article__hero">
            <img src={cover.src} alt={cover.alt} />
          </div>
        )}
        <div className="prose" dangerouslySetInnerHTML={{ __html: post.contentHtml }} />
        {author && (
          <div className="author-box">
            {author.image && <img className="avatar" src={author.image} alt={author.name} />}
            <div>
              <p className="author-box__name">{author.name}</p>
              <p className="author-box__role">{author.role}</p>
              <p className="author-box__bio">{author.shortBio}</p>
              <Link className="author-box__link" href={authorUrl(author)}>
                Voir tous ses articles
              </Link>
            </div>
          </div>
        )}
      </article>
    );
  }

  const hub = getHubBySlug(slug);
  if (hub) {
    const cover = resolveCoverImage(hub);
    return (
      <article>
        <div className="article__head">
          <h1 className="article__title">{hub.title}</h1>
        </div>
        {cover.src && (
          <div className="article__hero">
            <img src={cover.src} alt={cover.alt} />
          </div>
        )}
        <div className="prose prose--feature" dangerouslySetInnerHTML={{ __html: hub.contentHtml }} />
      </article>
    );
  }

  notFound();
}
