import type { Metadata } from "next";
import Link from "next/link";
import ArticleCard from "@/components/ArticleCard";
import JsonLd from "@/components/JsonLd";
import NewsletterForm from "@/components/NewsletterForm";
import { getPosts } from "@/lib/wp";
import { SILOS } from "@/lib/taxonomy";
import SiloThumb from "@/components/SiloThumb";
import { websiteSchema, organizationSchema } from "@/lib/schema";
import { pageMeta } from "@/lib/seo-meta";
import { SITE_NAME } from "@/lib/site";

export const metadata: Metadata = pageMeta({
  title: `${SITE_NAME} — Le média expert de l'auto et de la mobilité`,
  description:
    "Entretien, pannes, fiabilité, essais et démarches : des guides auto vérifiés par nos experts, sourcés et tenus à jour. 19 rubriques, une rédaction identifiée.",
  path: "/",
});

// Filet de sécurité en plus de l'invalidation ciblée par /api/revalidate (le
// nouvel article publié n'est pas forcément le seul changement — un article
// dépublié/modifié ailleurs doit aussi finir par se refléter ici).
export const revalidate = 900;

export default async function HomePage() {
  // Dégradation gracieuse (voir app/[slug]/page.tsx) : l'accueil doit rester
  // déployable même si WP est temporairement injoignable au build.
  const { posts } = await getPosts(1, 6).catch((e) => {
    console.warn(`[HomePage] échec du fetch WP, fallback sur []: ${e}`);
    return { posts: [], total: 0, totalPages: 0 };
  });

  return (
    <>
      <section className="chero">
        {/* Photo libre de droits (licence Unsplash, aucune attribution requise) —
            unsplash.com/photos/Aqt08E8JzEc, recadrée sur la voiture depuis l'original
            portrait. Pré-optimisée en WebP à 2 largeurs (800/1920) via scripts sharp
            locaux, pas de service d'optimisation à la volée (voir
            docs/architecture-headless.md section 3.3 — même raison de coût que le
            choix WordPress+Imagify). */}
        <img
          className="chero__bg"
          src="/images/accueil-hero-1920.webp"
          srcSet="/images/accueil-hero-800.webp 800w, /images/accueil-hero-1920.webp 1920w"
          sizes="100vw"
          width={1920}
          height={1440}
          alt="Porsche 911 orange vue de trois quarts arrière sous un ciel bleu"
          fetchPriority="high"
        />
        <div className="chero__scrim" aria-hidden="true" />
        <div className="wrap">
          <p className="eyebrow">Média indépendant · Auto &amp; mobilité</p>
          <h1 className="chero__title">L&apos;auto expliquée, testée et comparée.</h1>
          <p className="chero__sub">
            Entretien, pannes, fiabilité, essais et démarches — des guides vérifiés par nos
            experts, sourcés et tenus à jour. Pour entretenir et choisir votre véhicule en
            confiance.
          </p>
          <div className="chero__cta">
            <Link className="btn btn--primary" href="/rubriques/">
              Explorer les rubriques
            </Link>
          </div>
        </div>
      </section>

      <div className="wrap">
        <section className="section">
          <div className="section__head">
            <h2>Nos domaines d&apos;expertise</h2>
            <Link href="/rubriques/">Tout voir</Link>
          </div>
          <div className="silo-grid">
            {SILOS.map((s) => (
              <Link key={s.slug} className="silo" href={`/categorie/${s.slug}/`}>
                <span className="silo__main">
                  <SiloThumb slug={s.slug} alt="" />
                  <span>
                    <span className="silo__name">{s.name}</span>
                    <span className="silo__desc" style={{ display: "block" }}>
                      {s.desc}
                    </span>
                  </span>
                </span>
              </Link>
            ))}
          </div>
        </section>

        {posts.length > 0 && (
          <section className="section">
            <div className="section__head">
              <h2>Les derniers guides</h2>
            </div>
            <div className="rail">
              {posts.map((p) => (
                <ArticleCard key={p.id} post={p} />
              ))}
            </div>
          </section>
        )}

        <section className="section">
          <div className="section__head">
            <h2>Pourquoi {SITE_NAME}</h2>
          </div>
          <div className="trust-grid">
            <div className="trust">
              <h3>Une expertise réelle</h3>
              <p>
                Contenus rédigés et relus par des mécaniciens et journalistes auto, signés et
                rattachés à une page d&apos;expert.
              </p>
            </div>
            <div className="trust">
              <h3>Des sources vérifiables</h3>
              <p>
                Données issues des constructeurs, de la Sécurité routière et de
                service-public.fr, citées et datées dans chaque article.
              </p>
            </div>
            <div className="trust">
              <h3>Toujours à jour</h3>
              <p>
                Tarifs, périodicités et barèmes révisés chaque année ; la date de mise à jour
                est affichée sur chaque page.
              </p>
            </div>
          </div>
        </section>

        <section className="nl-band">
          <h2>La newsletter {SITE_NAME}</h2>
          <p>Chaque semaine : nos nouveaux guides, essais et conseils d&apos;entretien. Zéro spam.</p>
          <NewsletterForm />
        </section>
      </div>

      <JsonLd data={{ "@context": "https://schema.org", ...websiteSchema() }} />
      <JsonLd data={{ "@context": "https://schema.org", ...organizationSchema() }} />
    </>
  );
}
