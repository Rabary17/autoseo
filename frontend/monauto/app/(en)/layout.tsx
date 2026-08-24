// Layout racine ANGLAIS (2026-08-21).
//
// Deuxième layout racine du site, via le groupe de routes `(en)` — voir
// app/(fr)/layout.tsx pour le pourquoi. Sa seule raison d'être est de servir
// `<html lang="en">` : Next.js n'autorise pas à redéfinir `<html>` dans un
// layout imbriqué.
//
// Volontairement SANS les composants Header/Footer/BottomNav français : leurs
// libellés sont en dur en français et leurs liens pointent vers /rubriques/,
// /archives/, /auteur/... Les réutiliser afficherait une navigation française
// autour d'un article anglais, et renverrait le lecteur hors de sa langue au
// premier clic. La navigation ci-dessous est construite depuis l'index des
// traductions, donc elle ne cite que des pages qui existent réellement en
// anglais.
import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { SITE_NAME, SITE_URL } from "@/lib/site";
import { silosFor } from "@/lib/i18n";
import "../monauto.css";

const LOCALE = "en";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: `${SITE_NAME} — Car and mobility guides`, template: `%s — ${SITE_NAME}` },
  description:
    "Practical guides on motorhomes, vans, commercial vehicles, fuel and cycling in France: rules, costs and buying advice.",
  icons: { icon: "/favicon.png", apple: "/apple-touch-icon.png" },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  openGraph: { siteName: SITE_NAME, locale: "en_GB", type: "website" },
  twitter: { card: "summary" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#E20500",
};

// Identique au layout français : le thème doit être appliqué avant le premier
// paint, sinon flash du thème clair avant hydratation.
const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem('monauto-theme');if(t!=='dark'&&t!=='light'){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}document.documentElement.setAttribute('data-theme',t);}catch(e){}})();`;

export default function EnRootLayout({ children }: { children: React.ReactNode }) {
  const silos = silosFor(LOCALE);
  return (
    <html lang="en">
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>
        <header className="site-header">
          <div className="wrap-wide">
            <Link href="/en/" className="brand">
              {SITE_NAME}
            </Link>
            <nav aria-label="Sections">
              <ul>
                {silos.map((s) => (
                  <li key={s.slug}>
                    <Link href={`/en/${s.slug}/`}>{s.nom}</Link>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
        </header>
        <main>{children}</main>
        <footer className="site-footer">
          <div className="wrap-wide">
            <p>
              {SITE_NAME} — English edition. Our full coverage is available{" "}
              {/* Lien vers la racine française : seule sortie assumée hors de la
                  locale, et elle est explicite pour le lecteur. */}
              <Link href="/">in French</Link>.
            </p>
            <p>
              <Link href="/mentions-legales/">Legal notice</Link>
              {" · "}
              <Link href="/confidentialite/">Privacy</Link>
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
