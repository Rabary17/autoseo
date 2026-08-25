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
import LangSwitch from "@/components/LangSwitch";
import { SITE_NAME, SITE_URL } from "@/lib/site";
import { silosFor } from "@/lib/i18n";
import { livePageSlugs } from "@/lib/i18n-live";
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

export default async function EnRootLayout({ children }: { children: React.ReactNode }) {
  const allSilos = silosFor(LOCALE);
  // Même bug que les listings /en/* corrigé le 25/08 (voir lib/i18n-live.ts) :
  // l'index marque "traduit", pas "publié" — sans ce filtre, le menu et le
  // pied de page de TOUTE page anglaise (y compris celles déjà réellement en
  // ligne) pointaient vers des hubs encore en draft. Constaté en production :
  // 5 des 6 sections du menu renvoyaient un vrai 404.
  const livePages = await livePageSlugs(allSilos.map((s) => s.slug));
  const silos = allSilos.filter((s) => livePages.has(s.slug));
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
            <LangSwitch />
            <ThemeToggle />
          </div>
        </header>

        <main>{children}</main>

        <footer className="footer">
          <div className="wrap">
            <div className="footer__cols">
              <div>
                <img className="footer__brand" src="/logo-dark.png" alt={SITE_NAME} width={392} height={32} />
                <p style={{ color: "rgba(255,255,255,.7)", maxWidth: "38ch", margin: 0 }}>
                  The independent guide to cars and mobility. Tested, sourced guides kept up to
                  date by our team.
                </p>
              </div>
              <div>
                <h2>The guide</h2>
                <ul>
                  {/* Pas encore de version anglaise de ces pages : on renvoie vers
                      les pages françaises plutôt que de ne rien afficher — même
                      choix déjà assumé plus bas pour les liens légaux. */}
                  <li>
                    <Link href="/a-propos/">About us</Link>
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
                <h2>Sections</h2>
                <ul>
                  {silos.map((s) => (
                    <li key={s.slug}>
                      <Link href={`/en/${s.slug}/`}>{s.nom}</Link>
                    </li>
                  ))}
                  <li>
                    <Link href="/en/">All sections</Link>
                  </li>
                </ul>
              </div>
              <div>
                <h2>Legal</h2>
                <ul>
                  <li>
                    <Link href="/mentions-legales/">Legal notice</Link>
                  </li>
                  <li>
                    <Link href="/cgu/">Terms of use</Link>
                  </li>
                  <li>
                    <Link href="/confidentialite/">Privacy</Link>
                  </li>
                  <li>
                    <Link href="/cookies/">Cookies</Link>
                  </li>
                </ul>
              </div>
            </div>
            <p className="footer__legal">
              © <span>{new Date().getFullYear()}</span> {SITE_NAME} — All rights reserved. Full
              coverage also available <Link href="/">in French</Link>.
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
