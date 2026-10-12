import Link from "next/link";
import SocialLinks from "@/components/SocialLinks";
import { SILOS } from "@/lib/taxonomy";

// Pied de page en quatre blocs (marque, rubriques, le média, informations), comme la maquette.
export default function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="footer">
      <div className="wrap">
        <div className="footer-grid">
          <div>
            <Link className="footer__logo" href="/" aria-label="techcars — accueil">
              <img className="footer__brand footer__brand--light" src="/logo.png" alt="techcars" width={392} height={32} />
              <img className="footer__brand footer__brand--dark" src="/logo-dark.png" alt="" aria-hidden="true" width={392} height={32} />
            </Link>
            <p className="footer-tagline">
              Le média expert de l’auto et de la mobilité. Guides testés, sourcés et mis à jour par notre rédaction.
            </p>
            <SocialLinks />
          </div>
          <nav aria-label="Rubriques">
            <h2 className="footer-heading">Rubriques</h2>
            <ul className="footer-links">
              {SILOS.map((s) => (
                <li key={s.slug}>
                  <Link href={`/categorie/${s.slug}/`}>{s.name}</Link>
                </li>
              ))}
            </ul>
          </nav>
          <nav aria-label="Le média">
            <h2 className="footer-heading">Le média</h2>
            <ul className="footer-links">
              <li>
                <Link href="/a-propos/">Qui sommes-nous ?</Link>
              </li>
              <li>
                <Link href="/faq/">FAQ</Link>
              </li>
              <li>
                <Link href="/contact/">Contact</Link>
              </li>
              <li>
                <Link href="/blog/">Blog</Link>
              </li>
            </ul>
          </nav>
          <nav aria-label="Informations légales">
            <h2 className="footer-heading">Informations</h2>
            <ul className="footer-links">
              <li>
                <Link href="/mentions-legales/">Mentions légales</Link>
              </li>
              <li>
                <Link href="/cgu/">Conditions d’utilisation</Link>
              </li>
              <li>
                <Link href="/confidentialite/">Confidentialité</Link>
              </li>
              <li>
                <Link href="/cookies/">Cookies</Link>
              </li>
            </ul>
          </nav>
        </div>
        <p className="footer-bottom">© {year} techcars — Tous droits réservés. Photos d’illustration : Pexels.</p>
      </div>
    </footer>
  );
}
