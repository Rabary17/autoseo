import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo-meta";
import { SITE_NAME, SITE_URL } from "@/lib/site";

export const metadata: Metadata = pageMeta({
  title: "Conditions générales d'utilisation",
  description: `Conditions générales d'utilisation du site ${SITE_NAME} : accès au site, contenus, responsabilité et propriété intellectuelle.`,
  path: "/cgu/",
});

export default function CGUPage() {
  return (
    <div className="wrap">
      <article className="legal">
        <h1>Conditions générales d&apos;utilisation</h1>
        <p className="legal__updated">Dernière mise à jour : juillet 2026</p>

        <h2>1. Objet</h2>
        <p>
          Les présentes conditions générales d&apos;utilisation (CGU) ont pour objet de définir les
          modalités et conditions d&apos;accès et d&apos;utilisation du site {SITE_NAME} ({SITE_URL}),
          ainsi que de définir les droits et obligations des utilisateurs. Le fait de naviguer sur
          le site implique l&apos;acceptation pleine et entière des présentes CGU.
        </p>

        <h2>2. Accès au site</h2>
        <p>
          Le site est accessible gratuitement, depuis n&apos;importe où, à tout utilisateur disposant
          d&apos;un accès à Internet. Tous les frais afférents à cet accès (matériel informatique,
          connexion) sont à la charge de l&apos;utilisateur. L&apos;éditeur se réserve le droit de
          modifier, suspendre ou interrompre l&apos;accès au site, sans préavis, notamment pour des
          raisons de maintenance.
        </p>

        <h2>3. Contenus du site</h2>
        <p>
          Les contenus publiés (articles, guides, comparatifs, illustrations) sont fournis à titre
          purement informatif. Ils ne se substituent en aucun cas à l&apos;avis d&apos;un professionnel
          qualifié (garagiste, concessionnaire, expert automobile). L&apos;éditeur s&apos;efforce de
          maintenir ces contenus à jour et exacts, sans garantir leur exhaustivité ni leur
          adéquation à une situation particulière.
        </p>

        <h2>4. Propriété intellectuelle</h2>
        <p>
          L&apos;ensemble des éléments du site (textes, mises en page, visuels, marques) est protégé
          par le droit de la propriété intellectuelle. Toute reproduction ou représentation, totale
          ou partielle, sans autorisation préalable est interdite et constitutive d&apos;une
          contrefaçon.
        </p>

        <h2>5. Liens vers des sites tiers</h2>
        <p>
          Le site peut contenir des liens hypertextes vers des sites tiers. L&apos;éditeur
          n&apos;exerce aucun contrôle sur ces sites et décline toute responsabilité quant à leur
          contenu.
        </p>

        <h2>6. Responsabilité</h2>
        <p>
          L&apos;éditeur ne saurait être tenu responsable des dommages directs ou indirects résultant
          de l&apos;accès ou de l&apos;utilisation du site, y compris l&apos;inaccessibilité, les pertes
          de données, ou tout dommage lié à l&apos;utilisation des informations qui y figurent.
        </p>

        <h2>7. Données personnelles et cookies</h2>
        <p>
          Le traitement des données personnelles et l&apos;usage des cookies sont décrits
          respectivement dans notre <a href="/confidentialite/">politique de confidentialité</a>{" "}
          et notre <a href="/cookies/">politique de cookies</a>.
        </p>

        <h2>8. Modification des CGU</h2>
        <p>
          L&apos;éditeur se réserve le droit de modifier les présentes CGU à tout moment. Les
          utilisateurs sont invités à les consulter régulièrement.
        </p>

        <h2>9. Droit applicable</h2>
        <p>Les présentes CGU sont soumises au droit français.</p>
      </article>
    </div>
  );
}
