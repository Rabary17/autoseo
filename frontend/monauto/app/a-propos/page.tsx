import Link from "next/link";
import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo-meta";
import { SITE_NAME } from "@/lib/site";

export const metadata: Metadata = pageMeta({
  title: "Qui sommes-nous ?",
  description: `Découvrez la mission, la ligne éditoriale et l'équipe derrière ${SITE_NAME}, le média expert de l'auto et de la mobilité.`,
  path: "/a-propos/",
});

export default function AProposPage() {
  return (
    <div className="wrap">
      <article className="legal">
        <h1>Qui sommes-nous ?</h1>
        <p className="legal__updated">Dernière mise à jour : juillet 2026</p>

        <h2>Notre mission</h2>
        <p>
          {SITE_NAME} est un média indépendant dédié à l&apos;automobile et à la mobilité. Notre
          objectif : rendre l&apos;entretien, le choix et l&apos;usage d&apos;un véhicule plus simples,
          grâce à des guides clairs, vérifiés et régulièrement mis à jour — de la vidange au
          diagnostic de panne, en passant par les démarches administratives et les comparatifs de
          modèles.
        </p>

        <h2>Notre ligne éditoriale</h2>
        <p>
          Chaque article est rédigé pour répondre à une question concrète que se pose un
          conducteur ou une conductrice, avec un langage accessible, sans jargon inutile. Nous
          citons nos sources (constructeurs, textes réglementaires, données officielles) et
          indiquons la date de dernière vérification de chaque contenu. Nous ne vendons aucun
          produit ni service sur le site : notre seule mission est d&apos;informer.
        </p>

        <h2>Notre équipe</h2>
        <p>
          La rédaction de {SITE_NAME} réunit plusieurs contributeurs spécialisés, chacun rattaché
          à un domaine précis (mécanique, achat de véhicule, mobilité électrique, démarches
          administratives, deux-roues, road trips). Retrouvez leur profil et leurs articles sur
          la page de chaque <Link href="/rubriques/">rubrique</Link>.
        </p>

        <h2>Indépendance</h2>
        <p>
          {SITE_NAME} ne perçoit aucune rémunération de constructeurs ou d&apos;équipementiers pour
          orienter ses recommandations. Si un lien vers un partenaire venait à générer une
          commission, cela serait explicitement indiqué dans l&apos;article concerné.
        </p>

        <h2>Une question, une remarque ?</h2>
        <p>
          Vous avez repéré une erreur, une information à mettre à jour, ou souhaitez simplement
          échanger avec nous ? Passez par notre <Link href="/contact/">formulaire de contact</Link>.
        </p>
      </article>
    </div>
  );
}
