// Layout racine ANGLAIS (2026-08-21).
//
// Deuxième layout racine du site, via le groupe de routes `(en)` — voir
// app/(fr)/layout.tsx pour le pourquoi. Sa raison d'être est de servir
// `<html lang="en">` : Next.js n'autorise pas à redéfinir `<html>` dans un
// layout imbriqué.
//
// N'utilise PAS les composants Header/Footer/BottomNav français : leurs
// libellés sont en dur en français et leurs liens pointent vers /rubriques/,
// /archives/, /auteur/... Les réutiliser afficherait une navigation française
// autour d'un article anglais, et sortirait le lecteur de sa langue au premier
// clic.
//
// Reprend en revanche les CLASSES CSS RÉELLES de ces composants (`appbar`,
// `footer`, `chip`, `wrap`...). Première version corrigée le 2026-08-21 : elle
// inventait des noms (`site-header`, `brand`, `site-footer`) absents de
// monauto.css, et la page s'affichait donc sans aucune mise en forme — l'en-tête
// en liste à puces brute. Constaté en production sur techcars.fr/en.
import type { Metadata, Viewport } from "next";
import Link from "next/link";
import ThemeToggle from "@/components/ThemeToggle";
import { SITE_NAME, SITE_URL } from "@/lib/site";
import { silosFor } from "@/lib/i18n";
import "../monauto.css";

const LOCALE = "en";
// Même plafond que le menu français (Header.tsx) : au-delà, la barre déborde
// sur mobile.
const MAX_NAV_CHIPS = 4;

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
  const navSilos = silos.slice(0, MAX_NAV_CHIPS);

  return (
    <html lang="en">
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>
        <header className="appbar">
          <Link className="appbar__logo" href="/en/" aria-label={`${SITE_NAME} — home`}>
            {/* Même paire de logos que l'en-tête française : le mot "tech" du
                logo clair est quasi noir et devient invisible en thème sombre. */}
            <img
              className="appbar__brand appbar__brand--light"
              src="/logo.png"
              alt={SITE_NAME}
              width={343}
              height={28}
            />
            <img
              className="appbar__brand appbar__brand--dark"
              src="/logo-dark.png"
              alt=""
              aria-hidden="true"
              width={343}
              height={28}
            />
          </Link>
          <nav className="appbar__nav" aria-label="Sections">
            {navSilos.map((s) => (
              <Link key={s.slug} className="chip" href={`/en/${s.slug}/`}>
                {s.nom.split(" ")[0].replace("&", "")}
              </Link>
            ))}
            <Link className="chip" href="/en/">
              All sections
            </Link>
          </nav>
          <div className="appbar__actions">
            {/* Pas de SearchBox : la recherche interroge /recherche/, une route
                française qui exclut le contenu traduit (voir lib/wp.ts). Elle ne
                renverrait donc jamais de résultat anglais. */}
            <ThemeToggle />
          </div>
        </header>

        <main>{children}</main>

        <footer className="footer">
          <div className="wrap">
            <p className="footer__brand">{SITE_NAME} — English edition</p>
            <div className="footer__cols">
              <div>
                <p>Sections</p>
                <ul>
                  {silos.map((s) => (
                    <li key={s.slug}>
                      <Link href={`/en/${s.slug}/`}>{s.nom}</Link>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <p className="footer__legal">
              {/* Seule sortie assumée hors de la locale, et elle est explicite
                  pour le lecteur. */}
              Our full coverage is available <Link href="/">in French</Link>.{" · "}
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
