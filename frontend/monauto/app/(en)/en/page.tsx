// Accueil anglais — /en (2026-08-21, restructuré le 2026-08-25 pour la parité
// visuelle avec l'accueil française, demande explicite de l'utilisateur).
//
// Point d'entrée de la locale : sans lui, les rubriques traduites n'ont aucune
// page parente et le fil d'Ariane pointe vers du vide.
//
// Reprend la structure de app/(fr)/page.tsx (hero, grille de rubriques, bloc
// de confiance) et ses classes CSS réelles (`chero`, `silo-grid`,
// `trust-grid`...) — voir ce fichier pour le modèle. Volontairement PAS
// repris : le rail « derniers guides » (nécessiterait une carte d'article
// dédiée EN, `ArticleCard` construit des liens FR en dur — `/${slug}/`,
// `/auteur/${slug}/`, aucun équivalent anglais) et le bandeau newsletter
// (cible Zoho pensée pour un lectorat français, pas tranché pour l'anglais).
// Les deux restent au même endroit dans le code français si on veut les
// ajouter plus tard.
import type { Metadata } from "next";
import Link from "next/link";
import SiloThumb from "@/components/SiloThumb";
import { silosFor } from "@/lib/i18n";
import { livePageSlugs } from "@/lib/i18n-live";
import { pageMeta } from "@/lib/seo-meta";
import { SITE_NAME } from "@/lib/site";

const LOCALE = "en";

export const revalidate = 3600;

export const metadata: Metadata = {
  ...pageMeta({
    // Sans le nom du site : le `template` du layout racine l'ajoute deja
    // (`%s — techcars`). L'inclure ici produisait « techcars — Car and
    // mobility guides — techcars ».
    title: "Car and mobility guides",
    description:
      "Practical guides on motorhomes, vans, commercial vehicles, fuel and cycling in France: rules, costs and buying advice.",
    path: "/en/",
  }),
  openGraph: { locale: "en_GB", type: "website" },
};

export default async function EnHomePage() {
  const allSilos = silosFor(LOCALE);
  const livePages = await livePageSlugs(allSilos.map((s) => s.slug));
  const silos = allSilos.filter((s) => livePages.has(s.slug));

  return (
    <>
      <section className="chero">
        {/* Même photo que l'accueil française (marque commune) : pas de raison
            visuelle d'en changer pour la version anglaise. */}
        <img
          className="chero__bg"
          src="/images/accueil-hero-1920.webp"
          srcSet="/images/accueil-hero-800.webp 800w, /images/accueil-hero-1920.webp 1920w"
          sizes="100vw"
          width={1920}
          height={1440}
          alt="Orange Porsche 911 seen from the rear three-quarter angle under a blue sky"
          fetchPriority="high"
        />
        <div className="chero__scrim" aria-hidden="true" />
        <div className="wrap">
          <p className="eyebrow">Independent media · Cars &amp; mobility</p>
          <h1 className="chero__title">Cars, explained, tested and compared.</h1>
          <p className="chero__sub">
            Maintenance, breakdowns, reliability, reviews and paperwork — expert-verified guides,
            sourced and kept up to date. Everything you need to maintain and choose your vehicle
            with confidence.
          </p>
          <div className="chero__cta">
            <Link className="btn btn--primary" href="#sections">
              Explore sections
            </Link>
          </div>
        </div>
      </section>

      <div className="wrap">
        <section className="section" id="sections">
          <div className="section__head">
            <h2>{SITE_NAME} in English</h2>
          </div>
          <div className="silo-grid">
            {silos.map((silo) => (
              <Link key={silo.slug} className="silo" href={`/en/${silo.slug}/`}>
                <span className="silo__main">
                  {/* Vignette partagée avec le français : même image, indexée par
                      le slug FRANÇAIS (seul slug pour lequel un fichier existe,
                      voir scripts/fetch-silo-images.js), pas le slug traduit. */}
                  <SiloThumb slug={silo.siloFr} alt={`${silo.nom} icon`} />
                  <span>
                    <span className="silo__name">{silo.nom}</span>
                  </span>
                </span>
              </Link>
            ))}
          </div>
        </section>

        <section className="section">
          <div className="section__head">
            <h2>Why {SITE_NAME}</h2>
          </div>
          <div className="trust-grid">
            <div className="trust">
              <h3>Real expertise</h3>
              <p>
                Content written and reviewed by mechanics and motoring journalists, signed and
                linked to an expert profile.
              </p>
            </div>
            <div className="trust">
              <h3>Verifiable sources</h3>
              <p>
                Data from manufacturers, France&apos;s road-safety authority and
                service-public.fr, cited and dated in every article.
              </p>
            </div>
            <div className="trust">
              <h3>Always up to date</h3>
              <p>Rates, intervals and thresholds reviewed every year; the last-updated date is shown on every page.</p>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
