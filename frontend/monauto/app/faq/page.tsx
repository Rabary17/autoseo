import Link from "next/link";
import type { Metadata } from "next";
import JsonLd from "@/components/JsonLd";
import { faqPageLd } from "@/lib/schema";
import { pageMeta } from "@/lib/seo-meta";
import { SITE_NAME } from "@/lib/site";

export const metadata: Metadata = pageMeta({
  title: "FAQ",
  description: `Réponses aux questions les plus fréquentes sur ${SITE_NAME} : nos contenus, nos sources, notre équipe, la newsletter et vos données.`,
  path: "/faq/",
});

const FAQ_ITEMS = [
  {
    question: "Qui rédige les articles de monauto ?",
    answer:
      "Chaque article est rédigé par un contributeur rattaché à un domaine précis (mécanique, achat de véhicule, mobilité électrique, démarches administratives, deux-roues, road trips). Retrouvez leur profil sur la page de chaque rubrique.",
  },
  {
    question: "Sur quelles sources s'appuient vos articles ?",
    answer:
      "Nous nous appuyons sur des sources officielles (constructeurs, textes réglementaires, données publiques) et sur l'expérience terrain de nos contributeurs. Les sources sont citées en bas de chaque article lorsque c'est pertinent.",
  },
  {
    question: "À quelle fréquence les articles sont-ils mis à jour ?",
    answer:
      "Nos guides sont revus régulièrement pour rester exacts, en particulier lorsqu'une réglementation, un prix ou une caractéristique technique évolue. La date de dernière mise à jour figure en tête de chaque article.",
  },
  {
    question: "J'ai repéré une erreur dans un article, comment vous prévenir ?",
    answer:
      "Merci de nous le signaler via notre formulaire de contact en indiquant l'URL de l'article concerné et la nature de l'erreur. Nous vérifions et corrigeons dans les meilleurs délais.",
  },
  {
    question: "monauto est-il rémunéré par des marques ou constructeurs ?",
    answer:
      "Non. Nous ne percevons aucune rémunération pour orienter nos recommandations. Si un lien venait à générer une commission (lien affilié), cela serait explicitement indiqué dans l'article concerné.",
  },
  {
    question: "Comment s'inscrire ou se désinscrire de la newsletter ?",
    answer:
      "L'inscription se fait via le formulaire présent sur le site. Chaque e-mail envoyé contient un lien de désinscription en un clic.",
  },
  {
    question: "Comment sont utilisées mes données personnelles ?",
    answer:
      "Nous ne collectons que les données strictement nécessaires au traitement de votre demande de contact ou de votre inscription à la newsletter. Le détail est disponible dans notre politique de confidentialité.",
  },
  {
    question: "Puis-je reproduire un article ou une image du site ?",
    answer:
      "Les contenus sont protégés par le droit d'auteur. Toute reprise, même partielle, nécessite notre accord préalable — contactez-nous pour en faire la demande.",
  },
];

export default function FaqPage() {
  return (
    <div className="wrap">
      <JsonLd data={faqPageLd(FAQ_ITEMS)} />
      <article className="legal">
        <h1>Foire aux questions</h1>
        <p className="legal__updated">Dernière mise à jour : juillet 2026</p>

        <section className="faq" aria-label="Questions fréquentes">
          {FAQ_ITEMS.map((item) => (
            <details key={item.question}>
              <summary>{item.question}</summary>
              <p>{item.answer}</p>
            </details>
          ))}
        </section>

        <p style={{ marginTop: 24 }}>
          Vous ne trouvez pas de réponse à votre question ?{" "}
          <Link href="/contact/">Contactez-nous</Link>.
        </p>
      </article>
    </div>
  );
}
