import type { Metadata } from "next";
import Link from "next/link";
import ArticleCard from "@/components/ArticleCard";
import JsonLd from "@/components/JsonLd";
import NewsletterForm from "@/components/NewsletterForm";
import { ComparateurWidget } from "@/components/widgets";
import { getPosts } from "@/lib/wp";
import { SILOS } from "@/lib/taxonomy";
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

// Périmètre accueil (charter 2026-10-02) : technologie automobile uniquement.
// Exclut vélo/trottinette, démarches carte grise, tarifs et comparatifs de services.
const HORS_SCOPE = /vélo|velo|trottinette|titulaire|duplicata|carte grise|configurateur|coût de possession|assurance|camping|trottinette/i;

export default async function HomePage() {
  const { posts: fetched } = await getPosts(1, 30).catch((e) => {
    console.warn(`[HomePage] échec du fetch WP, fallback sur []: ${e}`);
    return { posts: [], total: 0, totalPages: 0 };
  });

  const posts = fetched
    .filter((p) => {
      const cat = p._embedded?.["wp:term"]?.[0]?.[0]?.name ?? "";
      return !HORS_SCOPE.test(`${cat} ${p.title.rendered}`);
    })
    .slice(0, 12);

  return (
    <>
      {/* Hero Section — Blue Steel + Graphite Theme */}
      <section className="chero" style={{
        backgroundColor: "#2E5090",
        backgroundImage: "linear-gradient(135deg, #2E5090 0%, #1F3A5F 100%)"
      }}>
        <img
          className="chero__bg"
          src="/images/accueil-hero-1920.webp"
          srcSet="/images/accueil-hero-800.webp 800w, /images/accueil-hero-1920.webp 1920w"
          sizes="100vw"
          width={1920}
          height={1440}
          alt="Technologies automobiles — innovation et performance"
          fetchPriority="high"
          style={{ opacity: 0.15 }}
        />
        <div className="chero__scrim" style={{ background: "rgba(46, 80, 144, 0.85)" }} aria-hidden="true" />
        <div className="wrap">
          <p className="eyebrow" style={{ color: "#E8EAED" }}>Technologie automobile · Ingénierie & Innovation</p>
          <h1 className="chero__title" style={{ color: "#FFFFFF" }}>Les technologies qui font rouler le monde.</h1>
          <p className="chero__sub" style={{ color: "#B8C5D6" }}>
            Motorisations, sécurité, transmission, autonomie et connectivité — explorez en profondeur les technologies automobiles essentielles. Des guides techniques sourcés et tenus à jour par nos experts.
          </p>
          <div className="chero__cta">
            <Link className="btn btn--primary" href="/rubriques/" style={{ backgroundColor: "#3A3F47", borderColor: "#3A3F47" }}>
              Découvrir les catégories
            </Link>
          </div>
        </div>
      </section>

      <div className="wrap">
        {/* Featured Categories Section */}
        <section className="section">
          <div className="section__head">
            <h2 style={{ color: "#1F3A5F" }}>Cinq piliers de la technologie automobile</h2>
            <Link href="/rubriques/" style={{ color: "#2E5090" }}>Tout explorer</Link>
          </div>
          <div className="silo-grid">
            {SILOS.map((s) => (
              <Link
                key={s.slug}
                className="silo"
                href={`/categorie/${s.slug}/`}
                style={{
                  borderLeft: "4px solid #2E5090",
                  backgroundColor: "#F8F9FB"
                }}
              >
                <span className="silo__main">
                  <span>
                    <span className="silo__name" style={{ color: "#1F3A5F", fontWeight: 600 }}>{s.name}</span>
                    <span className="silo__desc" style={{ display: "block", color: "#3A3F47" }}>
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
            <h2 style={{ color: "#1F3A5F" }}>Comparez les technologies</h2>
            <Link href="/outils/" style={{ color: "#2E5090" }}>Tous nos outils</Link>
          </div>
          <p style={{ color: "#4A5063", marginTop: "-6px" }}>
            Comparez les caractéristiques techniques et les performances de différentes motorisations, systèmes de sécurité et technologies embarquées.
          </p>
          <ComparateurWidget />
        </section>

        {/* Latest Guides Section */}
        {posts.length > 0 && (
          <section className="section">
            <div className="section__head">
              <h2 style={{ color: "#1F3A5F" }}>Les derniers guides techniques</h2>
            </div>
            <div className="rail">
              {posts.map((p) => (
                <ArticleCard key={p.id} post={p} />
              ))}
            </div>
          </section>
        )}

        {/* Trust/Authority Section */}
        <section className="section" style={{ backgroundColor: "#F8F9FB", padding: "40px 20px", borderRadius: "8px", borderLeft: "4px solid #2E5090" }}>
          <div className="section__head">
            <h2 style={{ color: "#1F3A5F" }}>Pourquoi {SITE_NAME} pour la technologie automobile</h2>
          </div>
          <div className="trust-grid">
            <div className="trust">
              <h3 style={{ color: "#2E5090" }}>Expertise technique réelle</h3>
              <p>
                Contenus rédigés par des ingénieurs automobiles, mécaniciens et experts techniques, avec sources citées et datées.
              </p>
            </div>
            <div className="trust">
              <h3 style={{ color: "#2E5090" }}>Sources industrielles vérifiées</h3>
              <p>
                Données issues des constructeurs, brevets, normes ISO, datasheets techniques et publications académiques.
              </p>
            </div>
            <div className="trust">
              <h3 style={{ color: "#2E5090" }}>Rigueur et traçabilité</h3>
              <p>
                Spécifications techniques, chiffres clés et évolutions normatives révisés régulièrement et datés sur chaque article.
              </p>
            </div>
          </div>
        </section>

        {/* Newsletter Section */}
        <section className="nl-band" style={{ backgroundColor: "#2E5090", color: "#FFFFFF" }}>
          <h2>La newsletter {SITE_NAME}</h2>
          <p>Chaque semaine : nos derniers guides techniques, innovations et analyses en profondeur. Zéro spam.</p>
          <NewsletterForm />
        </section>
      </div>
    </>
  );
}
