import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Breadcrumb from "@/components/Breadcrumb";
import JsonLd from "@/components/JsonLd";
import NewsletterForm from "@/components/NewsletterForm";
import { decodeEntities, getAllPages, getImageVariant, getPageBySlug, getPostBySlug, parseFaq, parseSources } from "@/lib/wp";
import { getSilo } from "@/lib/taxonomy";
import { articleSchema, faqPageLd } from "@/lib/schema";
import { pageMeta } from "@/lib/seo-meta";

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

const stripHtml = (html: string) => decodeEntities(html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
const truncate = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  if (post) {
    const description = truncate(
      stripHtml(post.excerpt.rendered) || post.acf?.tldr || stripHtml(post.content.rendered),
      155
    );
    const media = post._embedded?.["wp:featuredmedia"]?.[0];
    const author = post._embedded?.author?.[0];
    return pageMeta({
      title: post.title.rendered,
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
      title: page.title.rendered,
      description: truncate(stripHtml(page.content.rendered), 155),
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
  if (page) return <StaticPageView page={page} />;

  notFound();
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
  const silo = cat ? getSilo(cat.slug) : undefined;

  return (
    <div className="wrap-wide">
      <Breadcrumb
        items={[
          { name: "Accueil", href: "/" },
          ...(cat ? [{ name: cat.name, href: `/categorie/${cat.slug}/` }] : []),
          { name: post.title.rendered, href: `/${post.slug}/` },
        ]}
      />

      <div className="layout">
        <div className="col-main">
          <article className="article">
            <header className="article__head">
              <h1 className="article__title" dangerouslySetInnerHTML={{ __html: post.title.rendered }} />
              <div className="article__byline">
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

            {faq.length > 0 && (
              <section className="faq" aria-label="Questions fréquentes">
                <h2>Questions fréquentes</h2>
                {faq.map((item) => (
                  <details key={item.question}>
                    <summary>{item.question}</summary>
                    <p>{item.answer}</p>
                  </details>
                ))}
              </section>
            )}

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
          {silo && silo.children.length > 0 && (
            <section className="side-mod">
              <p className="side-mod__title">Dans la rubrique {silo.name}</p>
              <ul className="subnav">
                {silo.children.map((child) => (
                  <li key={child}>
                    <span>{child}</span>
                  </li>
                ))}
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
