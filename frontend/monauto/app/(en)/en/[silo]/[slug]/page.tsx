// Article ou sous-rubrique traduits (2026-08-21).
//
// URL : /en/{silo}/{slug}, où {slug} est SOIT un sous-hub, SOIT un article —
// exactement l'ambiguïté que middleware.ts résout côté français. Ici elle est
// tranchée par l'index des traductions (data/i18n-index.json), pas par un
// appel WordPress : l'index sait déjà quels slugs sont des sous-cocons.
//
// Pas de réutilisation de `ArticleView` (app/[slug]/page.tsx) : cette vue est
// fortement couplée au français — fil d'Ariane en dur, résolution des
// catégories WordPress, liens vers les tags français, newsletter française. La
// réutiliser produirait une page à habillage français avec un corps anglais, et
// des liens internes qui sortent le lecteur de sa langue.
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Breadcrumb from "@/components/Breadcrumb";
import JsonLd from "@/components/JsonLd";
import FaqSection from "@/components/FaqSection";
import TableOfContents from "@/components/TableOfContents";
import { getPostBySlug, getPageBySlug, parseSources, parseFaq, getImageVariant, decodeEntities } from "@/lib/wp";
import { buildToc } from "@/lib/toc";
import { pageMeta, stripHtml, truncate } from "@/lib/seo-meta";
import { SITE_URL } from "@/lib/site";
import { articleSchema, faqPageLd } from "@/lib/schema";
import {
  articleTraduit,
  siloBySlug,
  sousCoconTraduit,
  articlesFor,
  alternatesForArticle,
  pathForArticle,
} from "@/lib/i18n";
import { livePostSlugs, livePageSlugs } from "@/lib/i18n-live";

const LOCALE = "en";

type Props = { params: Promise<{ silo: string; slug: string }> };

export const revalidate = 3600;

export async function generateStaticParams() {
  // Articles uniquement : les sous-hubs restent rendus à la demande (moins de
  // 25 pages, et `dynamicParams` est actif par défaut). Tous connus de
  // l'index, donc aucun appel réseau au build.
  const params: { silo: string; slug: string }[] = [];
  for (const s of articlesFor(LOCALE)) {
    const chemin = pathForArticle(s);
    if (!chemin) continue;
    const segments = chemin.split("/").filter(Boolean); // ["en", silo, slug]
    params.push({ silo: segments[1], slug: segments[2] });
  }
  return params;
}

/** Résout le slug : sous-rubrique, article, ou rien. */
function resolve(siloSlug: string, slug: string) {
  const silo = siloBySlug(LOCALE, siloSlug);
  if (!silo) return null;
  const sc = sousCoconTraduit(LOCALE, siloSlug, slug);
  if (sc) return { kind: "sous-hub" as const, silo, sc };
  const art = articleTraduit(LOCALE, slug);
  // L'article doit appartenir à CE silo : sans ce contrôle, le même article
  // serait servi sous n'importe quel silo traduit, créant autant d'URLs
  // dupliquées que de silos.
  if (art && art.siloFr === silo.siloFr) return { kind: "article" as const, silo, art };
  return null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { silo: siloSlug, slug } = await params;
  const r = resolve(siloSlug, slug);
  if (!r) return {};

  if (r.kind === "sous-hub") {
    const page = await getPageBySlug(slug);
    if (!page) return {};
    return pageMeta({
      title: decodeEntities(page.acf?.meta_title || page.title.rendered),
      description: page.acf?.meta_description || truncate(stripHtml(page.content.rendered), 155),
      path: `/en/${siloSlug}/${slug}/`,
    });
  }

  const post = await getPostBySlug(slug);
  if (!post) return {};
  const media = post._embedded?.["wp:featuredmedia"]?.[0];
  const alt = alternatesForArticle(r.art.frSlug, SITE_URL, LOCALE);
  return {
    ...pageMeta({
      title: decodeEntities(post.acf?.meta_title || post.title.rendered),
      description: truncate(
        post.acf?.meta_description || stripHtml(post.excerpt.rendered) || stripHtml(post.content.rendered),
        155
      ),
      path: `/en/${siloSlug}/${slug}/`,
      image: getImageVariant(media, "monauto_hero")?.url,
      type: "article",
      publishedTime: post.date,
      modifiedTime: post.modified,
    }),
    // hreflang : lie la traduction à sa source française et vice-versa. Sans
    // ces balises, Google traite les deux versions comme du contenu concurrent
    // plutôt que comme deux langues d'une même page.
    alternates: { canonical: alt.canonical, languages: alt.languages },
    openGraph: { locale: "en_GB", type: "article" },
  };
}

const dateEn = (d: string) => new Date(d).toLocaleDateString("en-GB", { dateStyle: "long" });

export default async function EnPage({ params }: Props) {
  const { silo: siloSlug, slug } = await params;
  const r = resolve(siloSlug, slug);
  if (!r) notFound();

  /* ---------- Sous-rubrique ---------- */
  if (r.kind === "sous-hub") {
    const page = await getPageBySlug(slug);
    if (!page) notFound();
    // Enfants listés depuis l'INDEX, pas depuis les catégories WordPress : les
    // articles traduits ne portent que la catégorie marqueur de langue (voir
    // scripts/i18n/tag-locale-category.js), la hiérarchie éditoriale vit dans
    // l'index.
    const candidats = articlesFor(LOCALE).filter((a) => a.siloFr === r.silo.siloFr);
    const livePosts = await livePostSlugs(candidats.map((a) => a.slug));
    const enfants = candidats.filter((a) => livePosts.has(a.slug));
    return (
      <div className="wrap-wide">
        <Breadcrumb
          items={[
            { name: "Home", href: "/en/" },
            { name: r.silo.nom, href: `/en/${r.silo.slug}/` },
            { name: r.sc.nom, href: `/en/${siloSlug}/${slug}/` },
          ]}
        />
        <h1 dangerouslySetInnerHTML={{ __html: page.title.rendered }} />
        <div className="entry" dangerouslySetInnerHTML={{ __html: page.content.rendered }} />
        {enfants.length > 0 && (
          <section className="side-mod">
            <p className="side-mod__title">In this section</p>
            <ul>
              {enfants.map((a) => {
                const chemin = pathForArticle(a);
                return chemin ? (
                  <li key={a.slug}>
                    <Link href={chemin}>{a.titre}</Link>
                  </li>
                ) : null;
              })}
            </ul>
          </section>
        )}
      </div>
    );
  }

  /* ---------- Article ---------- */
  const post = await getPostBySlug(slug);
  if (!post) notFound();

  const media = post._embedded?.["wp:featuredmedia"]?.[0];
  const hero = getImageVariant(media, "monauto_hero");
  const author = post._embedded?.author?.[0];
  const tags = post._embedded?.["wp:term"]?.[1] ?? [];
  const sources = parseSources(post.acf?.sources);
  const faq = parseFaq(post.acf?.faq);
  const { toc, html: contenu } = buildToc(post.content.rendered);

  // Barre latérale (2026-08-25, demande explicite de l'utilisateur — même
  // structure que ArticleView côté français, app/(fr)/[slug]/page.tsx) :
  // "sous-rubriques" = les sous-cocons du silo réellement publiés (pas de
  // notion de sous-cocon par article côté anglais, contrairement au français
  // où la catégorie WP EST le sous-cocon — donc pas de mise en avant du sous-
  // cocon courant possible ici, contrairement au FR). Widget de silo et
  // encart newsletter volontairement absents : le premier est un outil
  // interactif écrit pour un contenu français, le second cible une liste
  // Zoho pensée pour un lectorat français — aucun des deux n'a d'équivalent
  // anglais tranché.
  const livePages = await livePageSlugs(r.silo.sousCocons.map((sc) => sc.slug));
  const sousCocons = r.silo.sousCocons.filter((sc) => livePages.has(sc.slug));

  return (
    <div className="wrap-wide">
      <Breadcrumb
        items={[
          { name: "Home", href: "/en/" },
          { name: r.silo.nom, href: `/en/${r.silo.slug}/` },
          { name: decodeEntities(post.title.rendered), href: `/en/${siloSlug}/${slug}/` },
        ]}
      />

      <div className="layout">
        <div className="col-main">
          <article className="article">
            <header className="article__head">
              <h1 className="article__title" dangerouslySetInnerHTML={{ __html: post.title.rendered }} />
              <div className="article__byline">
                <span>
                  {author?.name ? `${author.name} · ` : ""}
                  Published <time dateTime={post.date}>{dateEn(post.date)}</time>
                  {new Date(post.modified).getTime() - new Date(post.date).getTime() > 48 * 3600 * 1000 && (
                    <>
                      {" "}
                      · Updated <time dateTime={post.modified}>{dateEn(post.modified)}</time>
                    </>
                  )}
                </span>
              </div>
            </header>

            {hero && (
              <figure className="article__hero">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={hero.url} alt={media?.alt_text || decodeEntities(post.title.rendered)} width={hero.width} height={hero.height} />
              </figure>
            )}

            {post.acf?.tldr && (
              <aside className="tldr" aria-label="Key takeaways">
                <h2>Key takeaways</h2>
                <p>{post.acf.tldr}</p>
              </aside>
            )}

            <TableOfContents items={toc} />

            <div className="prose" dangerouslySetInnerHTML={{ __html: contenu }} />

            <FaqSection items={faq} />

            {sources.length > 0 && (
              <footer className="sources">
                <h2>Sources</h2>
                <ol>
                  {sources.map((s, i) => (
                    <li key={i}>{s.label}</li>
                  ))}
                </ol>
              </footer>
            )}
          </article>
        </div>

        <aside className="col-side" aria-label="Explore">
          {sousCocons.length > 0 && (
            <section className="side-mod">
              <p className="side-mod__title">
                <Link href={`/en/${r.silo.slug}/`}>More in {r.silo.nom}</Link>
              </p>
              <ul className="subnav">
                {sousCocons.map((sc) => (
                  <li key={sc.slug}>
                    <Link href={`/en/${siloSlug}/${sc.slug}/`}>{sc.nom}</Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {tags.length > 0 && (
            <section className="side-mod">
              <p className="side-mod__title">Related topics</p>
              <div className="tagcloud">
                {tags.map((t) => (
                  <span key={t.slug} className="chip">
                    {t.name}
                  </span>
                ))}
              </div>
            </section>
          )}
        </aside>
      </div>

      <JsonLd data={articleSchema(post, sources)} />
      {faq.length > 0 && <JsonLd data={faqPageLd(faq)} />}
    </div>
  );
}
