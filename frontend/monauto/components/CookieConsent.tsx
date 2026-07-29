"use client";

import Link from "next/link";
import Script from "next/script";
import { useEffect, useState } from "react";
import { GA_MEASUREMENT_ID, GTM_ID } from "@/lib/analytics";

const STORAGE_KEY = "monauto-cookie-consent";

// Aucun cookie de mesure d'audience n'est posé avant un choix explicite —
// GA4/GTM (2026-07-29) ne se chargent donc que depuis CE composant, jamais
// depuis app/layout.tsx, et seulement quand `analyticsAllowed` est vrai
// (accepté maintenant, ou déjà accepté lors d'une visite précédente) —
// voir app/cookies/page.tsx pour le détail des cookies concernés.
export default function CookieConsent() {
  const [visible, setVisible] = useState(false);
  const [analyticsAllowed, setAnalyticsAllowed] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) setVisible(true);
      else if (stored === "accepted") setAnalyticsAllowed(true);
    } catch {
      // stockage indisponible : on ne peut pas mémoriser le choix, on
      // n'affiche donc pas de bandeau plutôt que de le montrer à l'infini.
    }
  }, []);

  function choose(value: "accepted" | "refused") {
    try {
      localStorage.setItem(STORAGE_KEY, value);
    } catch {
      // idem : rien à mémoriser, on masque juste le bandeau pour la session.
    }
    setVisible(false);
    if (value === "accepted") setAnalyticsAllowed(true);
  }

  return (
    <>
      {analyticsAllowed && (
        <>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`} strategy="afterInteractive" />
          <Script id="ga4-init" strategy="afterInteractive">
            {`window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', '${GA_MEASUREMENT_ID}');`}
          </Script>
          <Script id="gtm-init" strategy="afterInteractive">
            {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
              new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
              j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
              'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
              })(window,document,'script','dataLayer','${GTM_ID}');`}
          </Script>
        </>
      )}

      {visible && (
        <div className="cookie-banner" role="dialog" aria-label="Consentement aux cookies">
          <div className="wrap cookie-banner__inner">
            <p className="cookie-banner__text">
              Nous utilisons des cookies essentiels au fonctionnement du site et, avec votre accord,
              des cookies de mesure d&apos;audience anonymisés. En savoir plus dans notre{" "}
              <Link href="/cookies/">politique de cookies</Link>.
            </p>
            <div className="cookie-banner__actions">
              <button className="btn btn--ghost" onClick={() => choose("refused")}>
                Refuser
              </button>
              <button className="btn btn--primary" onClick={() => choose("accepted")}>
                Accepter
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
