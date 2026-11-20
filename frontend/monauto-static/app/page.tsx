import Link from "next/link";
import Card from "@/components/Card";
import { getAllPosts, resolveCoverImage } from "@/lib/posts";
import { getCategory } from "@/lib/categories";
import { resolveAuthor, authorUrl } from "@/lib/authors";

const dateFr = (d: string) => (d ? new Date(d).toLocaleDateString("fr-FR", { dateStyle: "long" }) : "");

export default function HomePage() {
  const posts = getAllPosts().filter((p) => p.locale === "fr");
  const derniers = posts.slice(0, 12);

  return (
    <>
      <section className="hp-hero">
        <div className="hp-hero__grid">
          <div className="hp-hero__text">
            <p className="hp-eyebrow">
              <span className="hp-dot" aria-hidden="true" />
              Auto &amp; mobilité
            </p>
            <h1>
              L&apos;auto et la mobilité, <span className="hp-accent">expliquées simplement</span>.
            </h1>
            <p className="hp-lead">
              Entretien, pannes, marques, essais, démarches : des guides vérifiés, sourcés et tenus à
              jour par une rédaction identifiée.
            </p>
            <div className="hp-actions">
              <a className="btn btn--primary" href="#derniers-articles">
                Lire les derniers articles
              </a>
            </div>
          </div>
          <div className="hp-hero__media">
            <img
              src="/images/accueil-hero-1920.webp"
              srcSet="/images/accueil-hero-800.webp 800w, /images/accueil-hero-1920.webp 1920w"
              sizes="(min-width: 900px) 45vw, 100vw"
              width={1920}
              height={1440}
              alt="Auto et mobilité"
              fetchPriority="high"
            />
          </div>
        </div>
      </section>

      <section className="hp-section" id="derniers-articles">
        <div className="hp-head">
          <h2>Derniers articles</h2>
        </div>
        {derniers.length > 0 ? (
          <div className="hp-grid">
            {derniers.map((post) => {
              const cover = resolveCoverImage(post);
              const categorie = post.category ? getCategory(post.category) : undefined;
              const author = post.author ? resolveAuthor(post.author) : undefined;
              return (
                <Card
                  key={post.slug}
                  href={`/${post.slug}/`}
                  title={post.title}
                  eyebrow={categorie?.title}
                  image={cover.src ? { src: cover.src, alt: cover.alt } : undefined}
                  meta={
                    <>
                      <time dateTime={post.date}>{dateFr(post.date)}</time>
                      {author && (
                        <>
                          {" · "}
                          <Link href={authorUrl(author)}>{author.name}</Link>
                        </>
                      )}
                    </>
                  }
                />
              );
            })}
          </div>
        ) : (
          <p className="hp-empty">Les prochains articles arrivent bientôt.</p>
        )}
      </section>

      <section className="hp-section">
        <div className="hp-head">
          <h2>Pourquoi techcars</h2>
        </div>
        <div className="hp-trust">
          <div>
            <h3>Expertise technique réelle</h3>
            <p>Contenus rédigés par des mécaniciens, essayeurs et spécialistes des démarches auto, avec sources citées et datées.</p>
          </div>
          <div>
            <h3>Sources vérifiées</h3>
            <p>Données issues des constructeurs, textes officiels et publications techniques, pas de contenu généré au hasard.</p>
          </div>
          <div>
            <h3>Rigueur et traçabilité</h3>
            <p>Chiffres, prix et démarches révisés régulièrement et datés sur chaque article.</p>
          </div>
        </div>
      </section>
    </>
  );
}
