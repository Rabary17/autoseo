import Link from "next/link";
import AuthorAvatar from "./AuthorAvatar";
import type { WpUser } from "@/lib/types";

// Bloc auteur en bas d'article (demande explicite de l'utilisateur,
// 2026-08-06) — avatar + bio + lien vers tous ses articles. Distinct de
// article__byline (en haut, juste le nom en lien) : ici on affiche la bio
// complète pour renforcer l'E-E-A-T (expertise/autorité/fiabilité de
// l'auteur), pas juste l'attribution.
export default function AuthorBio({ author }: { author: WpUser }) {
  return (
    <section className="author-box" aria-label="À propos de l'auteur">
      <AuthorAvatar slug={author.slug} alt="" size={64} />
      <div className="author-box__body">
        <p className="author-box__name">{author.name}</p>
        {author.acf?.job_title && <p className="author-box__role">{author.acf.job_title}</p>}
        {author.description && <p className="author-box__bio">{author.description}</p>}
        <Link href={`/auteur/${author.slug}/`} className="author-box__link">
          Voir tous ses articles
        </Link>
      </div>
    </section>
  );
}
