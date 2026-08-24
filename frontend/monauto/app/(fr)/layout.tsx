import type { Metadata, Viewport } from "next";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import BottomNav from "@/components/BottomNav";
import CookieConsent from "@/components/CookieConsent";
import ReadingProgress from "@/components/ReadingProgress";
import BackToTop from "@/components/BackToTop";
import { SITE_NAME, SITE_URL } from "@/lib/site";
import "../monauto.css";

const DEFAULT_DESCRIPTION =
  "Le média expert de l'auto et de la mobilité : entretien, pannes, marques, essais, démarches. Guides vérifiés, sourcés et tenus à jour par une rédaction identifiée.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: `${SITE_NAME} — Le média expert de l'auto et de la mobilité`, template: `%s — ${SITE_NAME}` },
  description: DEFAULT_DESCRIPTION,
  icons: { icon: "/favicon.png", apple: "/apple-touch-icon.png" },
  // max-image-preview:large — sans ça Google limite la taille des images dans
  // les résultats de recherche ET exclut de fait le site des cartes Google
  // Discover (qui exigent des images pleine largeur). Valeur par défaut de
  // Google si absente : "standard", trop restrictive pour Discover.
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
  openGraph: {
    siteName: SITE_NAME,
    locale: "fr_FR",
    type: "website",
  },
  twitter: {
    card: "summary",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#E20500",
};

// Anti-FOUC : posé en tête de <head>, avant tout CSS/hydratation, pour que
// data-theme soit déjà correct au premier paint (sinon flash du thème clair
// par défaut avant que React ne s'hydrate). Lit la préférence mémorisée, sinon
// prefers-color-scheme système. Voir components/ThemeToggle.tsx pour la bascule.
const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem('monauto-theme');if(t!=='dark'&&t!=='light'){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}document.documentElement.setAttribute('data-theme',t);}catch(e){}})();`;

// Layout racine FRANÇAIS. Depuis le 2026-08-21 le site a DEUX layouts racines,
// un par langue, via des groupes de routes `(fr)` et `(en)`. Les parenthèses
// sont invisibles dans l'URL : aucune adresse ne change.
//
// Pourquoi cette structure : Next.js n'autorise pas à redéfinir `<html>` dans un
// layout imbriqué. Servir `<html lang="en">` sur les pages traduites exigeait
// donc soit un segment dynamique `[locale]` (impossible ici, le français n'a pas
// de préfixe — voir lib/i18n.ts), soit deux layouts racines. C'est la seule
// façon correcte de déclarer la langue, et publier de l'anglais annoncé comme
// français serait un défaut réel, pour le référencement comme pour les lecteurs
// d'écran.
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>
        <ReadingProgress />
        <Header />
        <main>{children}</main>
        <Footer />
        <BottomNav />
        <BackToTop />
        <CookieConsent />
      </body>
    </html>
  );
}
