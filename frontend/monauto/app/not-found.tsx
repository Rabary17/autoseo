import Link from "next/link";
import type { Metadata } from "next";

// Next.js sert cette page avec un vrai code HTTP 404 (pas un simple contenu
// "page introuvable" avec un statut 200) — important pour Google, qui sinon
// indexerait des pages fantômes ("soft 404").
export const metadata: Metadata = {
  title: "Page introuvable",
  robots: { index: false, follow: true },
};

export default function NotFound() {
  return (
    <div className="wrap">
      <section className="section" style={{ textAlign: "center", padding: "48px 0" }}>
        <p className="eyebrow">Erreur 404</p>
        <h1>Cette page n&apos;existe pas (ou plus)</h1>
        <p style={{ color: "var(--muted)", maxWidth: "48ch", margin: "0 auto 24px" }}>
          Le contenu que vous cherchez a peut-être été déplacé ou dépublié.
          Essayez de le retrouver depuis l&apos;accueil ou les rubriques.
        </p>
        <div className="chero__cta" style={{ justifyContent: "center" }}>
          <Link className="btn btn--primary" href="/">
            Retour à l&apos;accueil
          </Link>
          <Link className="btn btn--ghost" href="/rubriques/">
            Toutes les rubriques
          </Link>
        </div>
      </section>
    </div>
  );
}
