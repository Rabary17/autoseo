// Rubrique traduite (hub) — /en/{silo} (2026-08-21).
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Breadcrumb from "@/components/Breadcrumb";
import { getPageBySlug, decodeEntities } from "@/lib/wp";
import { pageMeta, stripHtml, truncate } from "@/lib/seo-meta";
import { silosFor, siloBySlug, articlesFor, pathForArticle } from "@/lib/i18n";
import { livePostSlugs, livePageSlugs } from "@/lib/i18n-live";

const LOCALE = "en";

type Props = { params: Promise<{ silo: string }> };

export const revalidate = 3600;

export async function generateStaticParams() {
  return silosFor(LOCALE).map((s) => ({ silo: s.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { silo: siloSlug } = await params;
  const silo = siloBySlug(LOCALE, siloSlug);
  if (!silo) return {};
  const page = await getPageBySlug(siloSlug);
  if (!page) return {};
  return {
    ...pageMeta({
      title: decodeEntities(page.acf?.meta_title || page.title.rendered),
      description: page.acf?.meta_description || truncate(stripHtml(page.content.rendered), 155),
      path: `/en/${siloSlug}/`,
    }),
    openGraph: { locale: "en_GB", type: "website" },
  };
}

export default async function EnHubPage({ params }: Props) {
  const { silo: siloSlug } = await params;
  const silo = siloBySlug(LOCALE, siloSlug);
  if (!silo) notFound();

  const page = await getPageBySlug(siloSlug);
  if (!page) notFound();

  const candidats = articlesFor(LOCALE).filter((a) => a.siloFr === silo.siloFr);
  const [livePosts, livePages] = await Promise.all([
    livePostSlugs(candidats.map((a) => a.slug)),
    livePageSlugs(silo.sousCocons.map((sc) => sc.slug)),
  ]);
  const articles = candidats.filter((a) => livePosts.has(a.slug));
  const sousCocons = silo.sousCocons.filter((sc) => livePages.has(sc.slug));

  return (
    <div className="wrap-wide">
      <Breadcrumb
        items={[
          { name: "Home", href: "/en/" },
          { name: silo.nom, href: `/en/${siloSlug}/` },
        ]}
      />
      <h1 dangerouslySetInnerHTML={{ __html: page.title.rendered }} />
      <div className="entry" dangerouslySetInnerHTML={{ __html: page.content.rendered }} />

      {sousCocons.length > 0 && (
        <section className="side-mod">
          <p className="side-mod__title">Sections</p>
          <ul>
            {sousCocons.map((sc) => (
              <li key={sc.slug}>
                <Link href={`/en/${siloSlug}/${sc.slug}/`}>{sc.nom}</Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {articles.length > 0 && (
        <section className="side-mod">
          <p className="side-mod__title">All articles</p>
          <ul>
            {articles.map((a) => {
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
