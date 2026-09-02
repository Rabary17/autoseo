import Link from "next/link";
import SocialLinks from "@/components/SocialLinks";

export default function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="footer">
      <div className="wrap">
        <div className="footer__cols">
          <div>
            {/* .footer a toujours un fond sombre (--brand, indépendant du thème
                clair/sombre) — toujours la variante logo-dark.png, jamais logo.png
                dont le mot "tech" en quasi-noir y serait invisible (2026-07-29). */}
            <img className="footer__brand" src="/logo-dark.png" alt="techcars" width={392} height={32} />
            <p style={{ color: "rgba(255,255,255,.7)", maxWidth: "38ch", margin: 0 }}>
              Le média expert de l&apos;auto et de la mobilité. Guides testés, sourcés et mis à
              jour par notre rédaction.
            </p>
            <SocialLinks />
          </div>
          <div>
            <h2>Le média</h2>
            <ul>
              <li>
                <Link href="/a-propos/">Qui sommes-nous ?</Link>
              </li>
              <li>
                <Link href="/faq/">FAQ</Link>
              </li>
              <li>
                <Link href="/contact/">Contact</Link>
              </li>
            </ul>
          </div>
          <div>
            <h2>Rubriques</h2>
            <ul>
              <li>
                <Link href="/categorie/entretien-revision/">Entretien &amp; révision</Link>
              </li>
              <li>
                <Link href="/rubriques/">Toutes les rubriques</Link>
              </li>
              <li>
                <Link href="/outils/">Nos outils gratuits</Link>
              </li>
            </ul>
          </div>
          <div>
            <h2>Légal</h2>
            <ul>
              <li>
                <Link href="/mentions-legales/">Mentions légales</Link>
              </li>
              <li>
                <Link href="/cgu/">Conditions d&apos;utilisation</Link>
              </li>
              <li>
                <Link href="/confidentialite/">Confidentialité</Link>
              </li>
              <li>
                <Link href="/cookies/">Cookies</Link>
              </li>
            </ul>
          </div>
        </div>
        <p className="footer__legal">
          © <span>{year}</span> techcars — Tous droits réservés.
        </p>
      </div>
    </footer>
  );
}
