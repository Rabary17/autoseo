import Breadcrumb from "./Breadcrumb";
import JsonLd from "./JsonLd";
import EntityCard from "./EntityCard";
import FaqSection from "./FaqSection";
import ShareButtons from "./ShareButtons";
import { decodeEntities, getChildPages, getImageVariant, getPostsByCategory, parseFaq } from "@/lib/wp";
import { faqPageLd } from "@/lib/schema";
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

  type ChildCard = { href: string; title: string; image?: ReturnType<typeof getImageVariant> };
  let children: ChildCard[] = [];
  try {
    if (isHub) {
      const childPages = await getChildPages(page.id);
      children = childPages.map((p) => ({
        href: `/categorie/${term.slug}/${p.slug}/`,
        title: p.title.rendered,
        image: getImageVariant(p._embedded?.["wp:featuredmedia"]?.[0], "monauto_card"),
      }));
    } else {
      const { posts } = await getPostsByCategory(term.id, 1);
      children = posts.map((p) => ({
        // Les articles restent en URL plate pour l'instant (voir STATE.md,
        // point ouvert avant P5) — seuls hub/sous-hub sont imbriqués.
        href: `/${p.slug}/`,
        title: p.title.rendered,
        image: getImageVariant(p._embedded?.["wp:featuredmedia"]?.[0], "monauto_card"),
      }));
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

        {children.length > 0 && (
          <aside className="col-side" aria-label="Explorer">
            <section className="side-mod">
              <p className="side-mod__title">{isHub ? "Sous-rubriques" : "Articles de ce sous-cocon"}</p>
              <div className="stack">
                {children.map((c) => (
                  <EntityCard
                    key={c.href}
                    href={c.href}
                    title={c.title}
                    image={c.image}
                    eyebrow={isHub ? "Sous-rubrique" : undefined}
                  />
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
