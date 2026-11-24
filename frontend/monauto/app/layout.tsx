import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import JsonLd from "@/components/JsonLd";
import { homepageSchema } from "@/lib/schema";
import { SITE_NAME, SITE_URL, SITE_DESCRIPTION, SOCIAL_LINKS } from "@/lib/site";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: `${SITE_NAME} — Le média expert de l'auto et de la mobilité`, template: `%s — ${SITE_NAME}` },
  description: SITE_DESCRIPTION,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const year = new Date().getFullYear();
  return (
    <html lang="fr">
      <body>
        <JsonLd data={homepageSchema()} />
        <header className="appbar">
          <Link className="appbar__logo" href="/" aria-label={`${SITE_NAME} — accueil`}>
            <img className="appbar__brand" src="/logo.png" alt={SITE_NAME} width={343} height={28} />
          </Link>
          <nav className="appbar__nav" aria-label="Navigation principale">
            <Link className="chip" href="/blog/">
              Blog
            </Link>
            <Link className="chip" href="/rubriques/">
              Rubriques
            </Link>
          </nav>
        </header>
        <main className="wrap" style={{ paddingTop: 20 }}>
          {children}
        </main>
        <footer className="footer">
          <div className="wrap">
            <div className="footer__cols">
              <div>
                <img className="footer__brand" src="/logo-dark.png" alt={SITE_NAME} width={392} height={32} />
                <p style={{ color: "rgba(255,255,255,.7)", maxWidth: "38ch", margin: "0 0 14px" }}>{SITE_DESCRIPTION}</p>
                {SOCIAL_LINKS.length > 0 && (
                  <div className="footer__social">
                    {SOCIAL_LINKS.map((s) => (
                      <a key={s.label} href={s.url} target="_blank" rel="noopener noreferrer" aria-label={s.label}>
                        {s.label[0]}
                      </a>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <h2>Le média</h2>
                <ul>
                  <li>
                    <Link href="/blog/">Blog</Link>
                  </li>
                  <li>
                    <Link href="/rubriques/">Toutes les rubriques</Link>
                  </li>
                  <li>
                    <Link href="/a-propos/">À propos</Link>
                  </li>
                </ul>
              </div>
            </div>
            <p className="footer__legal">
              © {year} {SITE_NAME} — Tous droits réservés.
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
