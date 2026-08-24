import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo-meta";
import { SITE_NAME } from "@/lib/site";

export const metadata: Metadata = pageMeta({
  title: "Politique de cookies",
  description: `Quels cookies utilise ${SITE_NAME}, à quoi servent-ils et comment gérer votre consentement.`,
  path: "/cookies/",
});

export default function CookiesPage() {
  return (
    <div className="wrap">
      <article className="legal">
        <h1>Politique de cookies</h1>
        <p className="legal__updated">Dernière mise à jour : juillet 2026</p>

        <h2>1. Qu&apos;est-ce qu&apos;un cookie ?</h2>
        <p>
          Un cookie est un petit fichier texte déposé sur votre appareil lors de la visite d&apos;un
          site, permettant de mémoriser des informations (préférences, mesure d&apos;audience) pour
          les visites suivantes.
        </p>

        <h2>2. Les cookies utilisés sur {SITE_NAME}</h2>
        <ul>
          <li>
            <strong>Cookies essentiels</strong> — nécessaires au fonctionnement du site (mémorisation
            de votre thème clair/sombre, de votre choix de consentement aux cookies). Ils ne
            nécessitent pas votre accord et ne peuvent pas être désactivés.
          </li>
          <li>
            <strong>Cookies de mesure d&apos;audience</strong> — déposés uniquement avec votre
            consentement, ils nous permettent de comprendre quelles pages sont consultées afin
            d&apos;améliorer le site. Ces données sont agrégées et ne permettent pas de vous
            identifier personnellement.
          </li>
        </ul>
        <p>Aucun cookie publicitaire ni de traçage à des fins commerciales n&apos;est utilisé.</p>

        <h2>3. Gérer votre consentement</h2>
        <p>
          Lors de votre première visite, un bandeau vous permet d&apos;accepter ou de refuser les
          cookies de mesure d&apos;audience. Vous pouvez modifier ce choix à tout moment en effaçant
          les cookies de votre navigateur, ce qui réaffichera le bandeau de consentement.
        </p>

        <h2>4. Durée de conservation</h2>
        <p>
          Le cookie mémorisant votre choix de consentement est conservé 6 mois. Passé ce délai, le
          bandeau de consentement vous sera à nouveau présenté.
        </p>

        <h2>5. Plus d&apos;informations</h2>
        <p>
          Pour toute question relative à l&apos;usage des cookies ou à vos données personnelles,
          consultez notre <a href="/confidentialite/">politique de confidentialité</a> ou
          contactez-nous via notre <a href="/contact/">formulaire de contact</a>.
        </p>
      </article>
    </div>
  );
}
