import Breadcrumb from "./Breadcrumb";
import JsonLd from "./JsonLd";
import ArchiveArticleCard from "./ArchiveArticleCard";
import Pagination from "./Pagination";
import SousCoconListItem from "./SousCoconListItem";
import FaqSection from "./FaqSection";
import ShareButtons from "./ShareButtons";
import { getChildPages, getImageVariant, getPostsByCategory, decodeEntities, parseFaq } from "@/lib/wp";
import { faqPageLd } from "@/lib/schema";
import { getSilo } from "@/lib/taxonomy";
import type { WpPage, WpTerm } from "@/lib/types";

const ARTICLES_PER_PAGE = 30;

// Rendu partagé des pages hub (silo) et sous-hub (sous-cocon) — extrait de
// l'ancien `HubSousHubView` (qui vivait dans app/[slug]/page.tsx) pour être
// réutilisé par la route canonique imbriquée app/categorie/[...slug]/page.tsx
// (voir STATE.md du jour). Mise en page à 2 colonnes comme un article
// (`.layout`/`.col-main`/`.col-side`, classes déjà existantes) : les enfants
// (sous-hubs pour un hub, articles pour un sous-hub) sont présentés en cards
// illustrées dans la colonne latérale plutôt qu'en pleine largeur sous le
// corps — demande explicite de l'utilisateur (2026-07-24), qui évite aussi
// au corps de texte d'avoir à caser un lien par enfant (voir style-anti-ia.md).
export default async function HubSousHubContent({
  page,
  pageNumber = 1,
  term,
  parentTerm,
}: {
  page: WpPage;
  /** Page de pagination (?page=N) pour la liste d'articles d'un sous-hub. */
  pageNumber?: number;
  term: WpTerm;
  /** Catégorie parente (silo) — fournie uniquement pour un sous-hub. */
  parentTerm?: WpTerm | null;
}) {
  const isHub = !term.parent;
  const heroImage = getImageVariant(page._embedded?.["wp:featuredmedia"]?.[0], "monauto_hero");
  const faq = parseFaq(page.acf?.faq);

  const basePath = isHub ? `/categorie/${term.slug}/` : `/categorie/${parentTerm?.slug}/${term.slug}/`;

  // Sous-cocons du silo (hub uniquement) : liste COMPLÈTE attendue dans la
  // sidebar — même sans page WP publiée pour l'instant — voir STATE.md
  // 2026-07-26. Source de vérité : data/taxonomy.json (généré depuis
  // config/niches/.../niche.json + data/maillage/maillage.json, comptage réel
  // de clusters par sous-cocon), fusionné avec les pages WP déjà publiées
  // pour l'image/le titre/le lien réels.
  type SousCoconCard = { slug: string; name: string; href?: string; image?: string };
  let sousCoconCards: SousCoconCard[] = [];
  // Articles réels du sous-hub (hors hub) — même présentation que /archives/
  // (grille 5/ligne, 30/page, pagination), demande explicite de l'utilisateur
  // (2026-07-30) : remplace l'ancienne liste "complète attendue" mêlant
  // articles publiés et non rédigés dans la sidebar (col-side, trop étroite
  // pour 5 colonnes) — un sous-hub liste désormais uniquement les vrais
  // articles publiés, comme n'importe quelle autre liste d'articles du site.
  let articles: Awaited<ReturnType<typeof getPostsByCategory>>["posts"] = [];
  let articlesTotalPages = 0;
  try {
    if (isHub) {
      const childPages = await getChildPages(page.id);
      const byPageSlug = new Map(childPages.map((p) => [p.slug, p]));
      const declared = getSilo(term.slug)?.children ?? [];
      sousCoconCards = declared.map((sc) => {
        const p = byPageSlug.get(sc.slug);
        const image = p ? getImageVariant(p._embedded?.["wp:featuredmedia"]?.[0], "monauto_card") : undefined;
        return {
          slug: sc.slug,
          name: p ? decodeEntities(p.title.rendered) : sc.name,
          href: p ? `/categorie/${term.slug}/${p.slug}/` : undefined,
          image: image?.url,
        };
      });
    } else {
      const { posts, totalPages } = await getPostsByCategory(term.id, pageNumber, ARTICLES_PER_PAGE);
      articles = posts;
      articlesTotalPages = totalPages;
    }
  } catch (e) {
    console.warn(`[HubSousHubContent] échec du fetch des enfants pour "${term.slug}" : ${e} — module masqué.`);
  }

  return (
    <div className="wrap-wide">
      <Breadcrumb
        items={[
          { name: "Accueil", href: "/" },
          ...(parentTerm ? [{ name: parentTerm.name, href: `/categorie/${parentTerm.slug}/` }] : []),
          { name: page.title.rendered, href: basePath },
        ]}
      />

      <div className="layout">
        <div className="col-main">
          <article className="article">
            <header className="article__head">
              <p className="eyebrow">{isHub ? "Rubrique" : "Sous-rubrique"}</p>
              <h1 className="article__title" dangerouslySetInnerHTML={{ __html: page.title.rendered }} />
              <ShareButtons path={basePath} title={decodeEntities(page.title.rendered)} />
            </header>

            {heroImage && (
              <figure className="article__hero">
                <img src={heroImage.url} alt={heroImage.alt || ""} width={heroImage.width} height={heroImage.height} />
              </figure>
            )}

            <div className="prose prose--feature" dangerouslySetInnerHTML={{ __html: page.content.rendered }} />

            <FaqSection items={faq} />
          </article>
        </div>

        {isHub && sousCoconCards.length > 0 && (
          <aside className="col-side" aria-label="Explorer">
            <section className="side-mod">
              <p className="side-mod__title">Sous-rubriques</p>
              <div className="silo-grid silo-grid--list">
                {sousCoconCards.map((sc) => (
                  <SousCoconListItem
                    key={sc.slug}
                    href={sc.href}
                    name={sc.name}
                    desc={sc.href ? "Voir les guides" : "Contenu en préparation"}
                    imageUrl={sc.image}
                  />
                ))}
              </div>
            </section>
          </aside>
        )}

      </div>

      {!isHub && (
        <section className="section">
          <div className="section__head">
            <h2>Articles</h2>
          </div>
          {articles.length > 0 ? (
            <>
              <div className="archive-grid">
                {articles.map((a) => (
                  <ArchiveArticleCard key={a.id} post={a} />
                ))}
              </div>
              <Pagination currentPage={pageNumber} totalPages={articlesTotalPages} basePath={basePath} />
            </>
          ) : (
            <p>Aucun article publié pour l&apos;instant dans cette sous-rubrique.</p>
          )}
        </section>
      )}

      {faq.length > 0 && <JsonLd data={faqPageLd(faq)} />}
    </div>
  );
}
