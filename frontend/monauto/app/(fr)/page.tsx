import type { Metadata } from "next";
import Link from "next/link";
import ArticleCard from "@/components/ArticleCard";
import JsonLd from "@/components/JsonLd";
import NewsletterForm from "@/components/NewsletterForm";
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
const HORS_SCOPE = /vélo|velo|trottinette|titulaire|duplicata|carte grise|configurateur|coût de possession|assurance|camping/i;

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
    .slice(0, 6);

  return (
    <>
      <section className="hp-hero">
        <div className="wrap hp-hero__grid">
          <div className="hp-hero__text">
            <p className="hp-eyebrow">
              <span className="hp-dot" aria-hidden="true" />
              Technologie automobile · Ingénierie & innovation
            </p>
            <h1>
              Les technologies qui font <span className="hp-accent">rouler</span> le monde.
            </h1>
            <p className="hp-lead">
              Motorisations, sécurité, transmission, autonomie et connectivité : explore en profondeur
              les technologies automobiles essentielles, avec des guides techniques sourcés et tenus à
              jour par nos experts.
            </p>
            <div className="hp-actions">
              <Link className="btn btn--primary" href="/blog/">
                Lire le blog
              </Link>
              <a className="btn btn--ghost" href="#sujets">
                Choisir une rubrique
              </a>
            </div>
            <ul className="hp-proof">
              <li>Sources citées et datées</li>
              <li>Rédaction spécialisée en ingénierie</li>
              <li>Gratuit, sans inscription</li>
            </ul>
          </div>
          <div className="hp-hero__media">
            <img
              src="/images/accueil-hero-1920.webp"
              srcSet="/images/accueil-hero-800.webp 800w, /images/accueil-hero-1920.webp 1920w"
              sizes="(min-width: 900px) 45vw, 100vw"
              width={1920}
              height={1440}
              alt="Technologies automobiles : innovation et performance"
              fetchPriority="high"
            />
          </div>
        </div>
      </section>

      <section className="hp-section" id="sujets">
        <div className="wrap">
          <div className="hp-head">
            <h2>Choisis ta rubrique</h2>
            <Link href="/rubriques/">Toutes les rubriques</Link>
          </div>
          <div className="hp-topics">
            {SILOS.map((s) => (
              <Link key={s.slug} className="hp-topic" href={`/categorie/${s.slug}/`}>
                <span className="hp-topic__name">{s.name}</span>
                <span className="hp-topic__desc">{s.desc}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="hp-section">
        <div className="wrap">
          <div className="hp-head">
            <h2>Derniers articles</h2>
            <Link href="/blog/">Tous les articles</Link>
          </div>
          {posts.length > 0 ? (
            <div className="hp-grid">
              {posts.map((p) => (
                <ArticleCard key={p.id} post={p} />
              ))}
            </div>
          ) : (
            <p className="hp-empty">Les prochains articles arrivent bientôt.</p>
          )}
        </div>
      </section>

      <section className="hp-section">
        <div className="wrap">
          <div className="hp-head">
            <h2>Pourquoi techcars</h2>
          </div>
          <div className="hp-trust">
            <div>
              <h3>Expertise technique réelle</h3>
              <p>Contenus rédigés par des ingénieurs automobiles, mécaniciens et experts techniques, avec sources citées et datées.</p>
            </div>
            <div>
              <h3>Sources industrielles vérifiées</h3>
              <p>Données issues des constructeurs, brevets, normes ISO, datasheets techniques et publications académiques.</p>
            </div>
            <div>
              <h3>Rigueur et traçabilité</h3>
              <p>Spécifications techniques, chiffres clés et évolutions normatives révisés régulièrement et datés sur chaque article.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="hp-section">
        <div className="wrap">
          <div className="hp-nl">
            <h2>La newsletter techcars</h2>
            <p>Chaque semaine : nos derniers guides techniques, innovations et analyses en profondeur. Zéro spam.</p>
            <NewsletterForm />
          </div>
        </div>
      </section>

      <div className="hp-section" aria-hidden="true" />

      <JsonLd data={{ "@context": "https://schema.org", ...websiteSchema() }} />
      <JsonLd data={{ "@context": "https://schema.org", ...organizationSchema() }} />
    </>
  );
}
