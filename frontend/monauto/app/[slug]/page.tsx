import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import Breadcrumb from "@/components/Breadcrumb";
import JsonLd from "@/components/JsonLd";
import NewsletterForm from "@/components/NewsletterForm";
import FaqSection from "@/components/FaqSection";
import ShareButtons from "@/components/ShareButtons";
import {
  decodeEntities,
  getAllPages,
  getCategoryById,
  getChildCategories,
  getImageVariant,
  getPageBySlug,
  getPostBySlug,
  getTermBySlug,
  parseFaq,
  parseSources,
} from "@/lib/wp";
import { getSilo } from "@/lib/taxonomy";
import { articleSchema, faqPageLd } from "@/lib/schema";
import { pageMeta, stripHtml, truncate } from "@/lib/seo-meta";
import type { WpTerm } from "@/lib/types";
import { SILO_WIDGET } from "@/components/widgets";
import SousCoconIcon from "@/components/SousCoconIcon";
import AuthorAvatar from "@/components/AuthorAvatar";

// ISR : on ne pré-génère au build que les pages WP statiques (peu nombreuses,
// ex. "À propos") — PAS les articles. À 10 000 articles publiés en continu,
// énumérer tout le catalogue à chaque build serait coûteux et inutile : un
// article est généré à la demande dès sa première visite (dynamicParams reste
// activé par défaut hors export statique), puis mis en cache jusqu'à la
// prochaine invalidation ciblée via /api/revalidate (voir next.config.ts).
export async function generateStaticParams() {
  // Dégradation gracieuse (inspiré de next-wp/lib/wordpress.ts) : si WP est
  // injoignable au build, on ne pré-génère aucune page statique plutôt que de
  // faire planter tout le déploiement — chaque page WP sera simplement rendue
  // à la demande au premier accès (comportement ISR normal, voir plus haut).
  try {
    const pages = await getAllPages();
    return pages.map((p) => ({ slug: p.slug }));
  } catch (e) {
    console.warn(`[generateStaticParams /[slug]] échec du fetch WP, fallback sur []: ${e}`);
    return [];
  }
}

type Props = { params: Promise<{ slug: string }> };

const dateFr = (d: string) => new Date(d).toLocaleDateString("fr-FR", { dateStyle: "long" });

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  if (post) {
    // meta_title/meta_description (ACF, 2026-07-28) : distincts du H1/extrait,
    // rédigés spécifiquement pour le SERP (mot-clé en tête, incitation au
    // clic) — utilisés en priorité, repli sur H1/extrait si absents (contenu
    // plus ancien ou bloqué par le gating avant insertion).
    const description = truncate(
      post.acf?.meta_description || stripHtml(post.excerpt.rendered) || post.acf?.tldr || stripHtml(post.content.rendered),
      155
    );
    const media = post._embedded?.["wp:featuredmedia"]?.[0];
    const author = post._embedded?.author?.[0];
    return pageMeta({
      title: post.acf?.meta_title || post.title.rendered,
      description,
      path: `/${post.slug}/`,
      image: getImageVariant(media, "monauto_hero")?.url,
      type: "article",
      publishedTime: post.date,
      modifiedTime: post.modified,
      authorName: author?.name,
    });
  }
  const page = await getPageBySlug(slug);
  if (page) {
    return pageMeta({
      title: page.acf?.meta_title || page.title.rendered,
      description: page.acf?.meta_description || truncate(stripHtml(page.content.rendered), 155),
      path: `/${page.slug}/`,
    });
  }
  return {};
}

export default async function CatchAllPage({ params }: Props) {
  const { slug } = await params;

  const post = await getPostBySlug(slug);
  if (post) return <ArticleView post={post} />;

  const page = await getPageBySlug(slug);
  if (page) {
    // Un hub/sous-hub est une page WP dont le slug correspond exactement à
    // une catégorie (silo ou sous-cocon, voir resolveCategoryId dans
    // scripts/autopublish/run.js) — une page WP "normale" (à-propos, contact)
    // n'a jamais de catégorie du même slug. Son contenu réel se rend
    // désormais à l'URL imbriquée canonique (voir STATE.md du jour,
    // app/categorie/[...slug]/page.tsx) : on redirige au lieu de le rendre
    // ici, pour n'avoir qu'une seule URL indexable par page.
    const term = await getTermBySlug("categories", slug).catch(() => null);
    if (term) {
      const parentTerm = term.parent ? await getCategoryById(term.parent).catch(() => null) : null;
      const canonical = parentTerm ? `/categorie/${parentTerm.slug}/${term.slug}/` : `/categorie/${term.slug}/`;
      redirect(canonical);
    }
    return <StaticPageView page={page} />;
  }

  notFound();
}

// Résout la navigation réelle de la sidebar à partir de la catégorie WP de
// l'article (le sous-cocon). Deux cas : l'article a un parent (cas normal,
// sous-cocon réel) -> on remonte au silo et on liste ses vrais frères ; sinon
// (article exceptionnellement classé directement dans le silo) -> on liste les
// enfants du silo lui-même. Dégradation gracieuse : un échec réseau ne fait
// jamais échouer le rendu de l'article, juste disparaître ce module.
async function resolveSidebarNav(cat: WpTerm | undefined): Promise<{
  silo?: ReturnType<typeof getSilo>;
  siloSlug?: string;
  sousCocons: WpTerm[];
  currentId?: number;
}> {
  if (!cat) return { sousCocons: [] };
  try {
    if (cat.parent) {
      const [parentTerm, siblings] = await Promise.all([
        getCategoryById(cat.parent),
        getChildCategories(cat.parent),
      ]);
      return {
        silo: parentTerm ? getSilo(parentTerm.slug) : undefined,
        // Slug WP brut, indépendant de data/taxonomy.json — c'est celui-ci qui indexe
        // components/widgets/index.tsx (SILO_WIDGET), pas silo?.slug (qui peut être
        // undefined si le silo manque encore de la taxonomie statique).
        siloSlug: parentTerm?.slug,
        sousCocons: siblings,
        currentId: cat.id,
      };
    }
    const children = await getChildCategories(cat.id);
    return { silo: getSilo(cat.slug), siloSlug: cat.slug, sousCocons: children, currentId: undefined };
  } catch (e) {
    console.warn(`[resolveSidebarNav] échec du fetch WP, module masqué: ${e}`);
    return { sousCocons: [] };
  }
}

async function ArticleView({ post }: { post: Awaited<ReturnType<typeof getPostBySlug>> }) {
  if (!post) return null;
  const author = post._embedded?.author?.[0];
  const media = post._embedded?.["wp:featuredmedia"]?.[0];
  const heroImage = getImageVariant(media, "monauto_hero");
  const cat = post._embedded?.["wp:term"]?.[0]?.[0];
  const tags = post._embedded?.["wp:term"]?.[1] ?? [];
  const sources = parseSources(post.acf?.sources);
  const faq = parseFaq(post.acf?.faq);

  // La catégorie assignée à l'article EST le sous-cocon (voir resolveCategoryId
  // dans scripts/autopublish/run.js : parent = silo, sousTerm = catégorie de
  // l'article) — pas le silo lui-même. On remonte au silo via cat.parent pour
  // retrouver son nom/desc dans data/taxonomy.json, et on liste les VRAIS
  // sous-cocons (catégories enfants du même parent) au lieu du texte statique
  // affiché jusqu'ici.
  const { silo, siloSlug, sousCocons, currentId } = await resolveSidebarNav(cat);
  const SiloWidget = siloSlug ? SILO_WIDGET[siloSlug] : undefined;

  return (
    <div className="wrap-wide">
      <Breadcrumb
        items={[
          { name: "Accueil", href: "/" },
          ...(cat
            ? [{ name: cat.name, href: siloSlug ? `/categorie/${siloSlug}/${cat.slug}/` : `/categorie/${cat.slug}/` }]
            : []),
          { name: post.title.rendered, href: `/${post.slug}/` },
        ]}
      />

      <div className="layout">
        <div className="col-main">
          <article className="article">
            <header className="article__head">
              <h1 className="article__title" dangerouslySetInnerHTML={{ __html: post.title.rendered }} />
              <div className="article__byline">
                {author && <AuthorAvatar slug={author.slug} alt="" />}
                <span>
                  {author && (
                    <>
                      Par <a href={`/auteur/${author.slug}/`} rel="author">{author.name}</a> ·{" "}
                    </>
                  )}
                  Publié le <time dateTime={post.date}>{dateFr(post.date)}</time>
                  {post.modified !== post.date && (
                    <>
                      {" "}
                      · Mis à jour le <time dateTime={post.modified}>{dateFr(post.modified)}</time>
                    </>
                  )}
                </span>
              </div>
              <ShareButtons path={`/${post.slug}/`} title={decodeEntities(post.title.rendered)} />
            </header>

            {heroImage && (
              <figure className="article__hero">
                <img
                  src={heroImage.url}
                  alt={media?.alt_text || ""}
                  width={heroImage.width}
                  height={heroImage.height}
                />
              </figure>
            )}

            {post.acf?.tldr && (
              <aside className="tldr" aria-label="L'essentiel">
                <h2>L&apos;essentiel</h2>
                <p>{post.acf.tldr}</p>
              </aside>
            )}

            <div className="prose" dangerouslySetInnerHTML={{ __html: post.content.rendered }} />

            <FaqSection items={faq} />

            {sources.length > 0 && (
              <footer className="sources">
                <h2>Sources</h2>
                <ol>
                  {sources.map((s) => (
                    <li key={s.url}>
                      <a href={s.url} rel="external noopener">
                        {s.label}
                      </a>
                    </li>
                  ))}
                </ol>
              </footer>
            )}
          </article>
        </div>

        <aside className="col-side" aria-label="Explorer">
          {SiloWidget && <SiloWidget />}

          {sousCocons.length > 0 && (
            <section className="side-mod">
              <p className="side-mod__title">
                {silo ? (
                  <Link href={`/categorie/${silo.slug}/`}>Dans la rubrique {silo.name}</Link>
                ) : (
                  "Sous-rubriques"
                )}
              </p>
              <ul className="subnav">
                {sousCocons.map((sc) =>
                  sc.id === currentId ? (
                    <li key={sc.id}>
                      <strong aria-current="page" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <SousCoconIcon name={sc.name} /> {sc.name}
                      </strong>
                    </li>
                  ) : (
                    <li key={sc.id}>
                      <Link
                        href={siloSlug ? `/categorie/${siloSlug}/${sc.slug}/` : `/categorie/${sc.slug}/`}
                        style={{ display: "flex", alignItems: "center", gap: 8 }}
                      >
                        <SousCoconIcon name={sc.name} /> {sc.name}
                      </Link>
                    </li>
                  )
                )}
              </ul>
            </section>
          )}

          {tags.length > 0 && (
            <section className="side-mod">
              <p className="side-mod__title">Sujets liés</p>
              <div className="tagcloud">
                {tags.map((t) => (
                  <Link key={t.slug} className="chip" href={`/tag/${t.slug}/`}>
                    {t.name}
                  </Link>
                ))}
              </div>
            </section>
          )}

          <section className="side-cta">
            <p className="side-cta__title">La newsletter monauto</p>
            <p className="side-cta__sub">Chaque semaine, nos essais et conseils auto. Zéro spam.</p>
            <NewsletterForm />
          </section>
        </aside>
      </div>

      <JsonLd data={articleSchema(post, sources)} />
      {faq.length > 0 && <JsonLd data={faqPageLd(faq)} />}
    </div>
  );
}

function StaticPageView({ page }: { page: NonNullable<Awaited<ReturnType<typeof getPageBySlug>>> }) {
  return (
    <div className="wrap">
      <Breadcrumb items={[{ name: "Accueil", href: "/" }, { name: page.title.rendered, href: `/${page.slug}/` }]} />
      <article className="article">
        <header className="article__head">
          <h1 className="article__title" dangerouslySetInnerHTML={{ __html: page.title.rendered }} />
        </header>
        <div className="prose" dangerouslySetInnerHTML={{ __html: page.content.rendered }} />
      </article>
    </div>
  );
}
