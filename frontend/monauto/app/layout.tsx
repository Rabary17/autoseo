import type { Metadata, Viewport } from "next";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import BottomNav from "@/components/BottomNav";
import { SITE_NAME, SITE_URL } from "@/lib/site";
import "./monauto.css";

const DEFAULT_DESCRIPTION =
  "Le média expert de l'auto et de la mobilité : entretien, pannes, marques, essais, démarches. Guides vérifiés, sourcés et tenus à jour par une rédaction identifiée.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: `${SITE_NAME} — Le média expert de l'auto et de la mobilité`, template: `%s — ${SITE_NAME}` },
  description: DEFAULT_DESCRIPTION,
  icons: { icon: "/favicon.svg" },
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
  themeColor: "#14171C",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>
        <Header />
        <main>{children}</main>
        <Footer />
        <BottomNav />
      </body>
    </html>
  );
}
