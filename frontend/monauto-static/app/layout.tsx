import type { Metadata } from "next";
import "./globals.css";
import JsonLd from "@/components/JsonLd";
import { homepageSchema } from "@/lib/schema";
import { SITE_NAME, SITE_URL, SITE_DESCRIPTION } from "@/lib/site";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: `${SITE_NAME} — Le média expert de l'auto et de la mobilité`, template: `%s — ${SITE_NAME}` },
  description: SITE_DESCRIPTION,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>
        <JsonLd data={homepageSchema()} />
        <header className="site-header">
          <div className="container">
            <a className="site-logo" href="/">
              {SITE_NAME}
            </a>
          </div>
        </header>
        <main className="container">{children}</main>
        <footer>
          <div className="container">
            © {new Date().getFullYear()} {SITE_NAME}
          </div>
        </footer>
      </body>
    </html>
  );
}
