import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo-meta";
import { SITE_NAME } from "@/lib/site";

export const metadata: Metadata = pageMeta({
  title: "Politique de confidentialité",
  description: `Comment ${SITE_NAME} collecte, utilise et protège vos données personnelles (formulaire de contact, newsletter, cookies).`,
  path: "/confidentialite/",
});

export default function ConfidentialitePage() {
  return (
    <div className="wrap">
      <article className="legal">
        <h1>Politique de confidentialité</h1>
        <p className="legal__updated">Dernière mise à jour : juillet 2026</p>

        <h2>1. Qui traite vos données ?</h2>
        <p>
          {SITE_NAME} traite un nombre limité de données personnelles, uniquement dans le cadre du
          formulaire de contact et de l&apos;inscription à la newsletter. Aucune donnée n&apos;est
          vendue ni cédée à des tiers à des fins commerciales.
        </p>

        <h2>2. Quelles données sont collectées ?</h2>
        <ul>
          <li>
            <strong>Formulaire de contact :</strong> nom, prénom, adresse e-mail, objet et contenu
            du message que vous rédigez.
          </li>
          <li>
            <strong>Newsletter :</strong> adresse e-mail uniquement.
          </li>
          <li>
            <strong>Navigation :</strong> selon vos choix de consentement, des cookies de mesure
            d&apos;audience anonymisés (voir notre <a href="/cookies/">politique de cookies</a>).
          </li>
        </ul>

        <h2>3. Pourquoi ces données sont-elles collectées ?</h2>
        <p>
          Les données du formulaire de contact servent exclusivement à traiter votre demande et à
          vous répondre par e-mail. Les données de newsletter servent à vous envoyer nos
          publications. Elles ne sont utilisées à aucune autre fin.
        </p>

        <h2>4. Combien de temps sont-elles conservées ?</h2>
        <p>
          Les messages envoyés via le formulaire de contact sont conservés le temps nécessaire au
          traitement de votre demande, puis supprimés. Les adresses e-mail de la newsletter sont
          conservées jusqu&apos;à votre désinscription.
        </p>

        <h2>5. Vos droits</h2>
        <p>
          Conformément au Règlement Général sur la Protection des Données (RGPD) et à la loi
          « Informatique et Libertés », vous disposez d&apos;un droit d&apos;accès, de rectification,
          d&apos;effacement et d&apos;opposition concernant vos données personnelles. Pour exercer ces
          droits, utilisez notre <a href="/contact/">formulaire de contact</a> en précisant
          l&apos;objet « Données personnelles ».
        </p>

        <h2>6. Hébergement et sécurité</h2>
        <p>
          Le site et les données qu&apos;il traite sont hébergés au sein de l&apos;Union Européenne
          (Infomaniak, Suisse — voir nos <a href="/mentions-legales/">mentions légales</a>), avec
          des mesures de sécurité raisonnables destinées à protéger vos données contre tout accès
          non autorisé.
        </p>

        <h2>7. Réclamation</h2>
        <p>
          Vous pouvez introduire une réclamation auprès de la CNIL (Commission Nationale de
          l&apos;Informatique et des Libertés) si vous estimez que vos droits ne sont pas respectés.
        </p>
      </article>
    </div>
  );
}
