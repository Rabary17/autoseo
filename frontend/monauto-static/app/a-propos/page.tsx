import type { Metadata } from "next";
import Link from "next/link";
import { SITE_NAME, SITE_DESCRIPTION, SITE_LEGAL, SOCIAL_LINKS } from "@/lib/site";
import { pageMetadata } from "@/lib/seo";
import { AUTHORS, DEFAULT_AUTHOR_SLUG, getAuthor, authorUrl, type Author } from "@/lib/authors";

export const metadata: Metadata = pageMetadata({
  title: "À propos",
  description: `${SITE_NAME}, le média expert de l'auto et de la mobilité : pour qui, comment on écrit, qui édite le site.`,
  path: "/a-propos/",
});

// Page E-E-A-T centrale (qui publie, pourquoi, selon quels principes) —
// référencée par `publishingPrinciples` dans le JSON-LD (lib/schema.ts).
export default function AboutPage() {
  const editor = getAuthor(DEFAULT_AUTHOR_SLUG) as Author;
  const team = AUTHORS.filter((a) => a.slug !== DEFAULT_AUTHOR_SLUG);

  return (
    <div className="prose">
      <h1>À propos de {SITE_NAME}</h1>
      <p>{SITE_DESCRIPTION}</p>

      <h2>La rédaction</h2>
      <p>
        Aux commandes de la ligne éditoriale : {editor.name}, {editor.role.toLowerCase()} de {SITE_NAME}. Son
        parcours complet est sur <Link href={authorUrl(editor)}>sa page auteur</Link>.
      </p>
      <p>
        Autour de lui, chaque sujet est confié à la personne dont c&apos;est la spécialité : {" "}
        {team.map((author, i) => (
          <span key={author.slug}>
            {i > 0 && (i === team.length - 1 ? " et " : ", ")}
            <Link href={authorUrl(author)}>{author.name}</Link> ({author.role.toLowerCase()})
          </span>
        ))}
        .
      </p>

      <h2 id="editeur">Qui édite {SITE_NAME} ?</h2>
      <p>
        {SITE_NAME} est édité par {SITE_LEGAL.legalName}, {SITE_LEGAL.addressLocality}, {SITE_LEGAL.addressCountry}.
        Contact : <a href={`mailto:${SITE_LEGAL.contactEmail}`}>{SITE_LEGAL.contactEmail}</a>.
      </p>
      {SOCIAL_LINKS.length > 0 && (
        <p>
          Tu peux aussi suivre {SITE_NAME} sur{" "}
          {SOCIAL_LINKS.map((social, i) => (
            <span key={social.url}>
              {i > 0 && (i === SOCIAL_LINKS.length - 1 ? " et " : ", ")}
              <a href={social.url} target="_blank" rel="noreferrer me">
                {social.label}
              </a>
            </span>
          ))}
          .
        </p>
      )}
    </div>
  );
}
