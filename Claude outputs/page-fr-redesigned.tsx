import type { Metadata } from "next";
import Link from "next/link";
import ArticleCard from "@/components/ArticleCard";
import JsonLd from "@/components/JsonLd";
import NewsletterForm from "@/components/NewsletterForm";
import { ComparateurWidget } from "@/components/widgets";
import { getPosts } from "@/lib/wp";
import { SILOS } from "@/lib/taxonomy";
import SiloThumb from "@/components/SiloThumb";
import { websiteSchema, organizationSchema } from "@/lib/schema";
import { pageMeta } from "@/lib/seo-meta";
import { SITE_NAME } from "@/lib/site";

export const metadata: Metadata = pageMeta({
  title: `${SITE_NAME} — Technologies automobiles et innovation mobilité`,
  description:
    "Motorisations, sécurité, transmission, autonomie et connectivité : explorez les technologies automobiles essentielles. Des guides techniques vérifiés par nos experts.",
  path: "/",
});

export const revalidate = 900;

export default async function HomePage() {
  const { posts } = await getPosts(1, 16).catch((e) => {
    console.warn(`[HomePage] échec du fetch WP, fallback sur []: ${e}`);
    return { posts: [], total: 0, totalPages: 0 };
  });

  return (
    <>
      {/* Hero Section — Blue Steel + Graphite Theme */}
      <section className="chero">
        <img
          className="chero__bg"
          src="/images/accueil-hero-1920.webp"
          srcSet="/images/accueil-hero-800.webp 800w, /images/accueil-hero-1920.webp 1920w"
          sizes="100vw"
          width={1920}
          height={1440}
          alt="Technologies automobiles — innovation et performance"
          fetchPriority="high"
        />
        <div className="chero__scrim" aria-hidden="true" />
        <div className="wrap">
          <p className="eyebrow">Technologie automobile · Ingénierie & Innovation</p>
          <h1 className="chero__title">Les technologies qui font rouler le monde.</h1>
          <p className="chero__sub">
            Motorisations, sécurité, transmission, autonomie et connectivité — explorez en profondeur les technologies automobiles essentielles. Des guides techniques sourcés et tenus à jour par nos experts.
          </p>
          <div className="chero__cta">
            <Link className="btn btn--primary" href="/rubriques/">
              Découvrir les catégories
            </Link>
          </div>
        </div>
      </section>

      <div className="wrap">
        {/* Featured Categories Section */}
        <section className="section">
          <div className="section__head">
            <h2>Cinq piliers de la technologie automobile</h2>
            <Link href="/rubriques/">Tout explorer</Link>
          </div>
          <div className="silo-grid">
            {SILOS.map((s) => (
              <Link
                key={s.slug}
                className="silo"
                href={`/categorie/${s.slug}/`}
              >
                <span className="silo__main">
                  <SiloThumb slug={s.slug} alt={`Icône ${s.name}`} />
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

        {/* Comparator Widget Section */}
        <section className="section">
          <div className="section__head">
            <h2>Comparez les technologies</h2>
            <Link href="/outils/">Tous nos outils</Link>
          </div>
          <p style={{ color: "var(--color-text-secondary)", marginTop: "-6px" }}>
            Comparez les caractéristiques techniques et les performances de différentes motorisations, systèmes de sécurité et technologies embarquées.
          </p>
          <ComparateurWidget />
        </section>

        {/* Latest Guides Section */}
        {posts.length > 0 && (
          <section className="section">
            <div className="section__head">
              <h2>Les derniers guides techniques</h2>
            </div>
            <div className="rail">
              {posts.map((p) => (
                <ArticleCard key={p.id} post={p} />
              ))}
            </div>
          </section>
        )}

        {/* Trust/Authority Section */}
        <section className="section section--accent">
          <div className="section__head">
            <h2>Pourquoi {SITE_NAME} pour la technologie automobile</h2>
          </div>
          <div className="trust-grid">
            <div className="trust">
              <h3>Expertise technique réelle</h3>
              <p>
                Contenus rédigés par des ingénieurs automobiles, mécaniciens et experts techniques, avec sources citées et datées.
              </p>
            </div>
            <div className="trust">
              <h3>Sources industrielles vérifiées</h3>
              <p>
                Données issues des constructeurs, brevets, normes ISO, datasheets techniques et publications académiques.
              </p>
            </div>
            <div className="trust">
              <h3>Rigueur et traçabilité</h3>
              <p>
                Spécifications techniques, chiffres clés et évolutions normatives révisés régulièrement et datés sur chaque article.
              </p>
            </div>
          </div>
        </section>

        {/* Newsletter Section */}
        <section className="nl-band">
          <h2>La newsletter {SITE_NAME}</h2>
          <p>Chaque semaine : nos derniers guides techniques, innovations et analyses en profondeur. Zéro spam.</p>
          <NewsletterForm />
        </section>
      </div>

      <JsonLd data={{ "@context": "https://schema.org", ...websiteSchema() }} />
      <JsonLd data={{ "@context": "https://schema.org", ...organizationSchema() }} />
    </>
  );
}
