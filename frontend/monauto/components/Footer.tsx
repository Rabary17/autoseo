import Link from "next/link";

export default function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="footer">
      <div className="wrap">
        <p className="footer__brand">
          monauto<span className="dot">.</span>
        </p>
        <p style={{ color: "rgba(255,255,255,.7)", maxWidth: "38ch", margin: 0 }}>
          Le média expert de l&apos;auto et de la mobilité. Guides testés, sourcés et mis à jour
          par notre rédaction.
        </p>
        <div className="footer__cols">
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
                <Link href="/categorie/entretien/">Entretien &amp; révision</Link>
              </li>
              <li>
                <Link href="/rubriques/">Toutes les rubriques</Link>
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
          © <span>{year}</span> monauto — Tous droits réservés.
        </p>
      </div>
    </footer>
  );
}
