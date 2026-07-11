import Link from "next/link";
import type { WpPost } from "@/lib/types";

const dateFr = (d: string) => new Date(d).toLocaleDateString("fr-FR", { dateStyle: "long" });

export default function ArticleCard({ post }: { post: WpPost }) {
  const media = post._embedded?.["wp:featuredmedia"]?.[0];
  const cat = post._embedded?.["wp:term"]?.[0]?.[0];

  return (
    <article className="card">
      {media && (
        <Link href={`/${post.slug}/`} className="card__media" aria-hidden tabIndex={-1}>
          <img
            src={media.source_url}
            alt=""
            loading="lazy"
            width={media.media_details?.width ?? 800}
            height={media.media_details?.height ?? 500}
          />
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
