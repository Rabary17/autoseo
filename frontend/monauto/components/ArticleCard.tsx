import Link from "next/link";
import type { WpPost } from "@/lib/types";
import { getImageVariant, decodeEntities } from "@/lib/wp";
import EntityCard from "./EntityCard";

const dateFr = (d: string) => new Date(d).toLocaleDateString("fr-FR", { dateStyle: "long" });

export default function ArticleCard({ post }: { post: WpPost }) {
  const media = post._embedded?.["wp:featuredmedia"]?.[0];
  const image = getImageVariant(media, "monauto_card");
  const cat = post._embedded?.["wp:term"]?.[0]?.[0];
  const author = post._embedded?.author?.[0];

  return (
    <EntityCard
      href={`/${post.slug}/`}
      title={post.title.rendered}
      eyebrow={cat?.name}
      image={image}
      meta={
        <>
          <time dateTime={post.date}>{dateFr(post.date)}</time>
          {author && (
            <>
              {" · "}
              <Link href={`/auteur/${author.slug}/`}>{decodeEntities(author.name)}</Link>
            </>
          )}
        </>
      }
    />
  );
}
