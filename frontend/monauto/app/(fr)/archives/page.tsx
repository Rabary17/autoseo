import type { Metadata } from "next";
import Breadcrumb from "@/components/Breadcrumb";
import ArchiveArticleCard from "@/components/ArchiveArticleCard";
import ArchiveFilters from "@/components/ArchiveFilters";
import Pagination from "@/components/Pagination";
import { getPosts, getCategories, getAllTags } from "@/lib/wp";
import { pageMeta } from "@/lib/seo-meta";
import { SITE_NAME } from "@/lib/site";

const PER_PAGE = 30;

export const metadata: Metadata = pageMeta({
  title: "Toutes les archives",
  description: `Toutes les archives ${SITE_NAME} : parcourez l'ensemble de nos guides auto, filtrés par catégorie ou par tag.`,
  path: "/archives/",
});

// Filet de sécurité en plus de l'invalidation ciblée par /api/revalidate.
export const revalidate = 900;

type Props = { searchParams: Promise<{ page?: string; categorie?: string; tag?: string }> };

export default async function ArchivesPage({ searchParams }: Props) {
  const { page: pageParam, categorie, tag } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);

  const [categories, tags] = await Promise.all([
    getCategories().catch(() => []),
    getAllTags().catch(() => []),
  ]);

  const topLevel = categories.filter((c) => !c.parent);
  const categoryGroups = topLevel.map((parent) => ({
    name: parent.name,
    slug: parent.slug,
    children: categories.filter((c) => c.parent === parent.id).map((c) => ({ name: c.name, slug: c.slug })),
  }));

  let extra = "";
  if (categorie) {
    const parentMatch = topLevel.find((c) => c.slug === categorie);
    const childMatch = categories.find((c) => c.slug === categorie && c.parent);
    if (parentMatch) {
      const childIds = categories.filter((c) => c.parent === parentMatch.id).map((c) => c.id);
      extra += `&categories=${[parentMatch.id, ...childIds].join(",")}`;
    } else if (childMatch) {
      extra += `&categories=${childMatch.id}`;
    }
  }
  if (tag) {
    const tagMatch = tags.find((t) => t.slug === tag);
    if (tagMatch) extra += `&tags=${tagMatch.id}`;
  }

  const { posts, totalPages } = await getPosts(page, PER_PAGE, extra).catch((e) => {
    console.warn(`[archives] échec du fetch WP, fallback sur []: ${e}`);
    return { posts: [], total: 0, totalPages: 0 };
  });

  const queryParams: Record<string, string> = {};
  if (categorie) queryParams.categorie = categorie;
  if (tag) queryParams.tag = tag;

  return (
    <div className="wrap">
      <Breadcrumb items={[{ name: "Accueil", href: "/" }, { name: "Archives", href: "/archives/" }]} />

      <header className="section">
        <p className="eyebrow">Archives</p>
        <h1>Toutes les archives</h1>
        <p>Parcourez l&apos;ensemble de nos guides, filtrés par catégorie ou par tag.</p>
      </header>

      <ArchiveFilters categoryGroups={categoryGroups} tags={tags} selectedCategory={categorie} selectedTag={tag} />

      <section className="section">
        {posts.length > 0 ? (
          <>
            <div className="archive-grid">
              {posts.map((p) => (
                <ArchiveArticleCard key={p.id} post={p} />
              ))}
            </div>
            <Pagination currentPage={page} totalPages={totalPages} basePath="/archives/" queryParams={queryParams} />
          </>
        ) : (
          <p>Aucun article ne correspond à ces filtres.</p>
        )}
      </section>
    </div>
  );
}
