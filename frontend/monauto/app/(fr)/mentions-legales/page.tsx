import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo-meta";
import { SITE_LEGAL, SITE_NAME, SITE_URL } from "@/lib/site";

export const metadata: Metadata = pageMeta({
  title: "Mentions légales",
  description: `Mentions légales du site ${SITE_NAME} : éditeur, hébergement, propriété intellectuelle et contact.`,
  path: "/mentions-legales/",
});

export default function MentionsLegalesPage() {
  return (
    <div className="wrap">
      <article className="legal">
        <h1>Mentions légales</h1>
        <p className="legal__updated">Dernière mise à jour : septembre 2026</p>

        <h2>Éditeur du site</h2>
        <p>
          Le site {SITE_NAME} ({SITE_URL}) est un média indépendant consacré à l&apos;automobile
          et à la mobilité, édité par <strong>{SITE_LEGAL.legalName}</strong>, dont le siège est
          situé au {SITE_LEGAL.streetAddress}, {SITE_LEGAL.addressLocality},{" "}
          {SITE_LEGAL.addressCountry}.
        </p>
        <p>
          Contact direct :{" "}
          <a href={`mailto:${SITE_LEGAL.contactEmail}`}>{SITE_LEGAL.contactEmail}</a>. Toute
          question, demande d&apos;information ou signalement peut aussi être adressé via notre{" "}
          <a href="/contact/">formulaire de contact</a>.
        </p>

        <h2>Directeur de la publication</h2>
        <p>
          La direction de la publication est assurée par {SITE_LEGAL.legalName}, joignable à
          l&apos;adresse ci-dessus ou par email à{" "}
          <a href={`mailto:${SITE_LEGAL.contactEmail}`}>{SITE_LEGAL.contactEmail}</a>.
        </p>

        <h2>Régie publicitaire</h2>
        <p>La régie publicitaire du site est assurée par {SITE_LEGAL.legalName}.</p>

        <h2>Hébergement</h2>
        <p>
          Le site est hébergé par Infomaniak Network SA, dont le siège social est situé rue
          Eugène-Marziano 25, 1227 Genève, Suisse.
        </p>

        <h2>Propriété intellectuelle</h2>
        <p>
          L&apos;ensemble des contenus présents sur {SITE_NAME} (textes, illustrations, mise en
          page, logo) est protégé au titre du droit d&apos;auteur. Toute reproduction, même
          partielle, est interdite sans autorisation préalable, sauf mention contraire ou usage
          strictement personnel et non commercial dans le respect de la législation en vigueur.
        </p>

        <h2>Crédits photographiques</h2>
        <p>
          Les photographies utilisées proviennent de banques d&apos;images libres de droits
          (Pexels, Unsplash, Pixabay) ou de la production éditoriale du site.
        </p>

        <h2>Responsabilité</h2>
        <p>
          Les informations diffusées sur {SITE_NAME} sont fournies à titre indicatif et ne
          sauraient engager la responsabilité de l&apos;éditeur en cas d&apos;erreur, d&apos;omission
          ou d&apos;usage inapproprié. Il appartient à chaque lecteur de vérifier les informations
          auprès d&apos;un professionnel qualifié avant toute intervention sur son véhicule.
        </p>

        <h2>Données personnelles</h2>
        <p>
          Le traitement des données personnelles collectées sur le site (formulaire de contact,
          newsletter, cookies) est détaillé dans notre{" "}
          <a href="/confidentialite/">politique de confidentialité</a>.
        </p>

        <h2>Droit applicable</h2>
        <p>Les présentes mentions légales sont soumises au droit français.</p>
      </article>
    </div>
  );
}
