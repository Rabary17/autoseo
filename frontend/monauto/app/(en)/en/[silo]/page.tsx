// Rubrique traduite (hub) — /en/{silo} (2026-08-21).
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Breadcrumb from "@/components/Breadcrumb";
import { getPageBySlug } from "@/lib/wp";
import { pageMeta, stripHtml, truncate } from "@/lib/seo-meta";
import { silosFor, siloBySlug, articlesFor, pathForArticle } from "@/lib/i18n";

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
      title: page.acf?.meta_title || page.title.rendered,
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

  const articles = articlesFor(LOCALE).filter((a) => a.siloFr === silo.siloFr);

  return (
    <div className="wrap-wide">
      <Breadcrumb
        items={[
          { name: "Home", href: "/en/" },
          { name: silo.nom, href: `/en/${siloSlug}/` },
        ]}
      />
      <h1>{page.title.rendered}</h1>
      <div className="entry" dangerouslySetInnerHTML={{ __html: page.content.rendered }} />

      {silo.sousCocons.length > 0 && (
        <section className="side-mod">
          <p className="side-mod__title">Sections</p>
          <ul>
            {silo.sousCocons.map((sc) => (
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
