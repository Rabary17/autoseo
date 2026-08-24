import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect, unstable_rethrow } from "next/navigation";
import ArchiveArticleCard from "@/components/ArchiveArticleCard";
import Breadcrumb from "@/components/Breadcrumb";
import HubSousHubContent from "@/components/HubSousHubContent";
import JsonLd from "@/components/JsonLd";
import Pagination from "@/components/Pagination";
import { getChildCategories, getCategoryById, getPageBySlug, getPostsByCategory, getTermBySlug } from "@/lib/wp";
import { getSilo, SILOS } from "@/lib/taxonomy";
import { pageMeta, stripHtml, truncate } from "@/lib/seo-meta";
import { collectionPageLd } from "@/lib/schema";
import type { WpTerm } from "@/lib/types";
import SousCoconIcon from "@/components/SousCoconIcon";
import SiloCover from "@/components/SiloCover";

// Route imbriquée : 1 segment = silo (`/categorie/{silo}/`), 2 segments =
// sous-cocon (`/categorie/{silo}/{sous-cocon}/`) — voir STATE.md du jour.
// Avant ce correctif, un hub/sous-hub rédigé (page WP réelle avec contenu,
// ACF tldr/sources/faq) n'était JAMAIS rendu ici : cette route n'affichait
// qu'une vue générique (description statique + liste d'articles + sous-
// rubriques en pastilles), pendant que le vrai contenu vivait uniquement à
// l'URL plate `/{slug}/`. On garde cette vue générique en repli — un silo ou
// sous-cocon sans hub/sous-hub encore rédigé ne doit jamais 404 — mais on
// affiche le vrai contenu dès qu'une page WP correspondante existe.
export function generateStaticParams() {
  return SILOS.map((s) => ({ slug: [s.slug] }));
}

export const revalidate = 900;

type Props = { params: Promise<{ slug: string[] }>; searchParams: Promise<{ page?: string }> };

// Résout les segments d'URL en catégorie WP (silo ou sous-cocon), avec
// vérification de cohérence de la hiérarchie pour 2 segments.
// Dégradation gracieuse identique au reste du fichier (getPostsByCategory,
// getPageBySlug plus bas) : sans elle, un WP injoignable au moment du build
// (ex. CI sans WP_API_URL, ou WP en maintenance pendant un déploiement) fait
// planter tout l'export Next.js sur une ECONNREFUSED non rattrapée ici —
// alors que generateStaticParams/sitemap.ts, eux, retombent déjà sur []
// dans ce cas. `notFound()`/`redirect()` lancent leurs propres exceptions de
// contrôle de flux Next.js : `unstable_rethrow` les laisse remonter telles
// quelles, seul un vrai échec réseau/WP est traité ici comme "terme introuvable".
async function resolveTerm(slugParts: string[]): Promise<{ term: WpTerm; parentTerm: WpTerm | null } | null> {
  try {
    if (slugParts.length === 1) {
      const term = await getTermBySlug("categories", slugParts[0]);
      if (!term) return null;
      if (term.parent) {
        // Un sous-cocon accédé par son seul slug (ancien lien, favori...) :
        // on redirige vers la forme canonique à 2 segments plutôt que de
        // servir un doublon de contenu à deux URLs différentes.
        const parent = await getCategoryById(term.parent);
        if (parent) redirect(`/categorie/${parent.slug}/${term.slug}/`);
        return null;
      }
      return { term, parentTerm: null };
    }
    if (slugParts.length === 2) {
      const [siloSlug, subSlug] = slugParts;
      const term = await getTermBySlug("categories", subSlug);
      if (!term || !term.parent) return null;
      const parentTerm = await getCategoryById(term.parent);
      if (!parentTerm || parentTerm.slug !== siloSlug) return null; // hiérarchie incohérente
      return { term, parentTerm };
    }
    return null; // pas de nesting au-delà de silo/sous-cocon
  } catch (e) {
    unstable_rethrow(e);
    console.warn(`[categorie/${slugParts.join("/")}] échec du fetch WP (résolution du terme), fallback 404: ${e}`);
    return null;
  }
}

async function resolveCategoryPage(slugParts: string[]) {
  const resolved = await resolveTerm(slugParts);
  if (!resolved) return null;
  const { term, parentTerm } = resolved;
  // data/taxonomy.json ne connaît que les 19 silos (desc statique de repli) —
  // un sous-cocon n'y a jamais d'entrée dédiée, `desc` reste alors undefined.
  const silo = !term.parent ? getSilo(term.slug) : undefined;
  return {
    title: silo?.name ?? term.name,
    desc: silo?.desc ?? term.description,
    term,
    parentTerm,
  };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const resolved = await resolveCategoryPage(slug);
  if (!resolved) return {};
  const path = `/categorie/${slug.join("/")}/`;

  // Un hub/sous-hub rédigé (page WP réelle) a son propre titre/extrait/meta —
  // bien plus pertinents que le titre générique de la catégorie (voir
  // resolveCategoryPage ci-dessus, qui ne connaît que taxonomy.json/le terme
  // WP). Jusqu'au 2026-07-28, generateMetadata() ne vérifiait jamais cette
  // page réelle : un hub/sous-hub publié gardait un <title>/description
  // générique même une fois rédigé.
  const hubPage = await getPageBySlug(resolved.term.slug).catch(() => null);
  if (hubPage) {
    return pageMeta({
      title: hubPage.acf?.meta_title || hubPage.title.rendered,
      description:
        hubPage.acf?.meta_description || hubPage.acf?.tldr || truncate(stripHtml(hubPage.content.rendered), 155),
      path,
      keywords: hubPage.acf?.keywords,
    });
  }

  return pageMeta({ title: resolved.title, description: resolved.desc, path });
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const resolved = await resolveCategoryPage(slug);
  if (!resolved) notFound();
  const { title, desc, term, parentTerm } = resolved;
  const isSiloPage = !term.parent;

  // Le vrai contenu hub/sous-hub, s'il a été rédigé : une page WP dont le
  // slug correspond exactement à celui de la catégorie (même convention déjà
  // utilisée par app/[slug]/page.tsx pour détecter un hub/sous-hub).
  const page = Math.max(1, Number((await searchParams).page) || 1);

  const hubPage = await getPageBySlug(term.slug).catch(() => null);
  if (hubPage) {
    return <HubSousHubContent page={hubPage} pageNumber={page} term={term} parentTerm={parentTerm} />;
  }

  // Dégradation gracieuse identique à avant : silo/sous-cocon sans hub/sous-hub
  // rédigé -> vue générique (description + articles + sous-rubriques sœurs).
  const { posts, totalPages, siblings } = await (async () => {
    try {
      const [postsRes, siblingCats] = await Promise.all([
        getPostsByCategory(term.id, page, 30),
        getChildCategories(parentTerm ? parentTerm.id : term.id),
      ]);
      return { ...postsRes, siblings: siblingCats };
    } catch (e) {
      console.warn(`[categorie/${slug.join("/")}] échec du fetch WP, fallback sur []: ${e}`);
      return { posts: [], totalPages: 0, siblings: [] as WpTerm[] };
    }
  })();

  const basePath = `/categorie/${slug.join("/")}/`;
  const breadcrumbItems = [
    { name: "Accueil", href: "/" },
    ...(parentTerm ? [{ name: parentTerm.name, href: `/categorie/${parentTerm.slug}/` }] : []),
    { name: title, href: basePath },
  ];

  return (
    <div className="wrap">
      <Breadcrumb items={breadcrumbItems} />

      {isSiloPage && <SiloCover slug={term.slug} alt={title} />}

      <header className="section">
        <h1>{title}</h1>
        {desc && <p>{desc}</p>}
      </header>

      {siblings.length > 0 && (
        <section className="section">
          <div className="section__head">
            <h2>{parentTerm ? "Autres sous-rubriques" : "Sous-rubriques"}</h2>
          </div>
          <div className="tagcloud">
            {siblings.map((sc) =>
              sc.slug === term.slug ? (
                <strong key={sc.id} className="chip" aria-current="page" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <SousCoconIcon name={sc.name} /> {sc.name}
                </strong>
              ) : (
                <Link
                  key={sc.id}
                  href={parentTerm ? `/categorie/${parentTerm.slug}/${sc.slug}/` : `/categorie/${sc.slug}/`}
                  className="chip"
                  style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
                >
                  <SousCoconIcon name={sc.name} /> {sc.name}
                </Link>
              )
            )}
          </div>
        </section>
      )}

      <section className="section">
        <div className="section__head">
          <h2>Articles publiés</h2>
        </div>
        {posts.length > 0 ? (
          <>
            <div className="archive-grid">
              {posts.map((p) => (
                <ArchiveArticleCard key={p.id} post={p} />
              ))}
            </div>
            <Pagination currentPage={page} totalPages={totalPages} basePath={basePath} />
          </>
        ) : (
          <p>
            Aucun article publié pour l&apos;instant dans cette rubrique.{" "}
            <Link href="/rubriques/">Voir toutes les rubriques</Link>.
          </p>
        )}
      </section>

      <JsonLd
        data={collectionPageLd({
          title,
          description: desc,
          path: basePath,
          items: posts.map((p) => ({ name: p.title.rendered, href: `/${p.slug}/` })),
        })}
      />
    </div>
  );
}
