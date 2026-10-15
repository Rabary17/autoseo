import Link from "next/link";
import type { WpPost } from "@/lib/types";
import { getImageVariant, decodeEntities } from "@/lib/wp";

const dateFr = (d: string) => new Date(d).toLocaleDateString("fr-FR", { dateStyle: "long" });

// Carte « derniers articles » de l’accueil : image, rubrique, titre, extrait,
// auteur et date (structure de la maquette techno-play.com).
export default function HomeArticleCard({ post }: { post: WpPost }) {
  const media = post._embedded?.["wp:featuredmedia"]?.[0];
  const image = getImageVariant(media, "monauto_card");
  const cat = post._embedded?.["wp:term"]?.[0]?.[0];
  const author = post._embedded?.author?.[0];
  const excerpt = decodeEntities(post.excerpt.rendered.replace(/<[^>]+>/g, "")).trim();

  return (
    <article className="card hp-article">
      {image && (
        <img
          className="hp-article__image"
          src={image.url}
          alt={image.alt || ""}
          width={image.width}
          height={image.height}
          loading="lazy"
        />
      )}
      <div className="hp-article__body">
        {cat && <span className="hp-tag">{decodeEntities(cat.name)}</span>}
        <h3>
          <Link href={`/${post.slug}/`} dangerouslySetInnerHTML={{ __html: post.title.rendered }} />
        </h3>
        {excerpt && <p className="hp-article__excerpt">{excerpt}</p>}
        <div className="hp-article__meta">
          {author && (
            <span>
              Par <Link href={`/auteur/${author.slug}/`}>{decodeEntities(author.name)}</Link>
            </span>
          )}
          {author && <span aria-hidden="true">·</span>}
          <time dateTime={post.date}>{dateFr(post.date)}</time>
        </div>
      </div>
    </article>
  );
}
