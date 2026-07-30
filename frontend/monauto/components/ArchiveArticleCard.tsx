import Link from "next/link";
import type { WpPost } from "@/lib/types";
import { getImageVariant, decodeEntities } from "@/lib/wp";

const dateFr = (d: string) => new Date(d).toLocaleDateString("fr-FR", { dateStyle: "long" });

// Card dédiée à /archives/ (2026-07-30, demande explicite de l'utilisateur) :
// catégorie posée SUR l'image (badge cliquable) plutôt qu'au-dessus du titre
// comme EntityCard — visuel distinct volontaire, jamais réutilisé ailleurs
// pour ne pas faire diverger les autres listings existants.
export default function ArchiveArticleCard({ post }: { post: WpPost }) {
  const media = post._embedded?.["wp:featuredmedia"]?.[0];
  const image = getImageVariant(media, "monauto_card");
  const terms = post._embedded?.["wp:term"]?.flat() ?? [];
  const category = terms.find((t) => t.taxonomy === "category");
  const author = post._embedded?.author?.[0];

  return (
    <article className="acard">
      <div className="acard__media">
        {image && <img src={image.url} alt="" loading="lazy" width={image.width} height={image.height} />}
        {category && (
          <Link href={`/categorie/${category.slug}/`} className="acard__badge">
            {category.name}
          </Link>
        )}
        <Link href={`/${post.slug}/`} className="acard__media-link" aria-hidden tabIndex={-1} />
      </div>
      <div className="acard__body">
        <h3 className="acard__title">
          <Link href={`/${post.slug}/`} dangerouslySetInnerHTML={{ __html: post.title.rendered }} />
        </h3>
        <p className="acard__meta">
          <time dateTime={post.date}>{dateFr(post.date)}</time>
          {author && (
            <>
              {" · "}
              <Link href={`/auteur/${author.slug}/`}>{decodeEntities(author.name)}</Link>
            </>
          )}
        </p>
      </div>
    </article>
  );
}
