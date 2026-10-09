import type { Metadata } from "next";
import ArticleCard from "@/components/ArticleCard";
import Pagination from "@/components/Pagination";
import { getPosts } from "@/lib/wp";
import { pageMeta } from "@/lib/seo-meta";
import { SITE_NAME } from "@/lib/site";

const PER_PAGE = 12;

export const metadata: Metadata = pageMeta({
  title: "Blog",
  description: `Tous les articles de ${SITE_NAME} : guides techniques sur la motorisation, la sécurité, la transmission, l'autonomie et la réglementation automobile.`,
  path: "/blog/",
});

export const revalidate = 900;

type Props = { searchParams: Promise<{ page?: string }> };

export default async function BlogPage({ searchParams }: Props) {
  const page = Math.max(1, Number((await searchParams).page) || 1);
  const { posts, totalPages } = await getPosts(page, PER_PAGE).catch(() => ({
    posts: [],
    total: 0,
    totalPages: 0,
  }));

  return (
    <section className="hp-section blog-page">
      <div className="wrap">
        <p className="hp-eyebrow">Blog</p>
        <h1 className="blog-title">Tous les articles</h1>
        <p className="blog-lead">
          Guides techniques classés du plus récent au plus ancien. Page {page}
          {totalPages > 1 ? ` sur ${totalPages}` : ""}.
        </p>
        {posts.length > 0 ? (
          <div className="hp-grid">
            {posts.map((p) => (
              <ArticleCard key={p.id} post={p} />
            ))}
          </div>
        ) : (
          <p className="hp-empty">Aucun article pour le moment.</p>
        )}
        <div className="blog-pager">
          <Pagination currentPage={page} totalPages={totalPages} basePath="/blog/" />
        </div>
      </div>
    </section>
  );
}
