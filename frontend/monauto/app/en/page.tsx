// Accueil anglais — /en (2026-08-21).
//
// Point d'entrée de la locale : sans lui, les rubriques traduites n'ont aucune
// page parente et le fil d'Ariane pointe vers du vide. Volontairement sobre :
// une liste de rubriques, pas une réplique de l'accueil française (qui
// s'appuie sur des widgets et des listings français).
import type { Metadata } from "next";
import Link from "next/link";
import { silosFor, articlesFor, pathForArticle } from "@/lib/i18n";
import { pageMeta } from "@/lib/seo-meta";
import { SITE_NAME } from "@/lib/site";

const LOCALE = "en";

export const revalidate = 3600;

export const metadata: Metadata = {
  ...pageMeta({
    title: `${SITE_NAME} — Car and mobility guides`,
    description:
      "Practical guides on motorhomes, vans, commercial vehicles, fuel and cycling in France: rules, costs and buying advice.",
    path: "/en/",
  }),
  openGraph: { locale: "en_GB", type: "website" },
};

export default function EnHomePage() {
  const silos = silosFor(LOCALE);
  const articles = articlesFor(LOCALE);

  return (
    <div className="wrap-wide">
      <h1>{SITE_NAME} in English</h1>
      <p>
        {articles.length} guides across {silos.length} sections, translated from our French coverage.
      </p>

      {silos.map((silo) => {
        const dedans = articles.filter((a) => a.siloFr === silo.siloFr);
        return (
          <section key={silo.slug} className="side-mod">
            <p className="side-mod__title">
              <Link href={`/en/${silo.slug}/`}>{silo.nom}</Link>
            </p>
            <ul>
              {dedans.slice(0, 6).map((a) => {
                const chemin = pathForArticle(a);
                return chemin ? (
                  <li key={a.slug}>
                    <Link href={chemin}>{a.titre}</Link>
                  </li>
                ) : null;
              })}
            </ul>
            {dedans.length > 6 && (
              <p>
                <Link href={`/en/${silo.slug}/`}>All {dedans.length} guides</Link>
              </p>
            )}
          </section>
        );
      })}
    </div>
  );
}
