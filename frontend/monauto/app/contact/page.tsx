import type { Metadata } from "next";
import ContactForm from "@/components/ContactForm";
import { pageMeta } from "@/lib/seo-meta";
import { SITE_NAME } from "@/lib/site";

export const metadata: Metadata = pageMeta({
  title: "Contact",
  description: `Une question, une remarque ou une erreur à signaler ? Contactez l'équipe de ${SITE_NAME} via notre formulaire.`,
  path: "/contact/",
});

export default function ContactPage() {
  return (
    <div className="wrap">
      <article className="legal">
        <h1>Contact</h1>
        <p>
          Une question sur un article, une erreur à signaler, une suggestion de sujet ? Écrivez-nous
          via le formulaire ci-dessous, nous vous répondrons par e-mail dans les meilleurs délais.
        </p>
        <ContactForm />
      </article>
    </div>
  );
}
