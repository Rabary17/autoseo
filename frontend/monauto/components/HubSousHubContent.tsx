import Breadcrumb from "./Breadcrumb";
import JsonLd from "./JsonLd";
import EntityCard from "./EntityCard";
import SousCoconListItem from "./SousCoconListItem";
import FaqSection from "./FaqSection";
import ShareButtons from "./ShareButtons";
import { decodeEntities, getChildPages, getImageVariant, getPostsByCategory, parseFaq } from "@/lib/wp";
import { faqPageLd } from "@/lib/schema";
import { getSilo, getSousCocon } from "@/lib/taxonomy";
import type { WpPage, WpTerm } from "@/lib/types";

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
  term,
  parentTerm,
}: {
  page: WpPage;
  term: WpTerm;
  /** Catégorie parente (silo) — fournie uniquement pour un sous-hub. */
  parentTerm?: WpTerm | null;
}) {
  const isHub = !term.parent;
  const heroImage = getImageVariant(page._embedded?.["wp:featuredmedia"]?.[0], "monauto_hero");
  const faq = parseFaq(page.acf?.faq);

  const basePath = isHub ? `/categorie/${term.slug}/` : `/categorie/${parentTerm?.slug}/${term.slug}/`;

  type ChildCard = { href?: string; title: string; image?: ReturnType<typeof getImageVariant> };
  let children: ChildCard[] = [];
  // Sous-cocons du silo (hub uniquement) : liste COMPLÈTE attendue dans la
  // sidebar — même sans page WP publiée pour l'instant — voir STATE.md
  // 2026-07-26. Source de vérité : data/taxonomy.json (généré depuis
  // config/niches/.../niche.json + data/maillage/maillage.json, comptage réel
  // de clusters par sous-cocon), fusionné avec les pages WP déjà publiées
  // pour l'image/le titre/le lien réels.
  type SousCoconCard = { slug: string; name: string; href?: string; image?: string };
  let sousCoconCards: SousCoconCard[] = [];
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
      // Même principe que les sous-cocons d'un hub ci-dessus (2026-07-28) :
      // liste COMPLÈTE des articles prévus pour ce sous-cocon (data/maillage.json
      // via taxonomy.json, voir scripts/gen-taxonomy-articles.js), fusionnée
      // avec les articles WordPress déjà publiés pour l'image/le titre/le lien
      // réels — un article pas encore rédigé s'affiche quand même, en attente.
      const { posts } = await getPostsByCategory(term.id, 1);
      const byPostSlug = new Map(posts.map((p) => [p.slug, p]));
      const declaredArticles = parentTerm ? getSousCocon(parentTerm.slug, term.slug)?.articles ?? [] : [];
      children = declaredArticles.map((a) => {
        const p = byPostSlug.get(a.slug);
        return {
          // Les articles restent en URL plate pour l'instant (voir STATE.md,
          // point ouvert avant P5) — seuls hub/sous-hub sont imbriqués.
          href: p ? `/${p.slug}/` : undefined,
          title: p ? p.title.rendered : a.title,
          image: p ? getImageVariant(p._embedded?.["wp:featuredmedia"]?.[0], "monauto_card") : undefined,
        };
      });
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
                <img src={heroImage.url} alt="" width={heroImage.width} height={heroImage.height} />
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
              <div className="silo-grid">
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

        {!isHub && children.length > 0 && (
          <aside className="col-side" aria-label="Explorer">
            <section className="side-mod">
              <p className="side-mod__title">Articles de ce sous-cocon</p>
              <div className="stack">
                {children.map((c) => (
                  <EntityCard key={c.href ?? c.title} href={c.href} title={c.title} image={c.image} />
                ))}
              </div>
            </section>
          </aside>
        )}
      </div>

      {faq.length > 0 && <JsonLd data={faqPageLd(faq)} />}
    </div>
  );
}
