import Link from "next/link";
import type { WpPost } from "@/lib/types";
import { getImageVariant } from "@/lib/wp";

const dateFr = (d: string) => new Date(d).toLocaleDateString("fr-FR", { dateStyle: "long" });

export default function ArticleCard({ post }: { post: WpPost }) {
  const media = post._embedded?.["wp:featuredmedia"]?.[0];
  const image = getImageVariant(media, "monauto_card");
  const cat = post._embedded?.["wp:term"]?.[0]?.[0];

  return (
    <article className="card">
      {image && (
        <Link href={`/${post.slug}/`} className="card__media" aria-hidden tabIndex={-1}>
          <img src={image.url} alt="" loading="lazy" width={image.width} height={image.height} />
        </Link>
      )}
      <div className="card__body">
        {cat && <p className="card__cat">{cat.name}</p>}
        <h3 className="card__title">
          <Link
            href={`/${post.slug}/`}
            dangerouslySetInnerHTML={{ __html: post.title.rendered }}
          />
        </h3>
        <div className="card__meta">
          <time dateTime={post.date}>{dateFr(post.date)}</time>
        </div>
      </div>
    </article>
  );
}
