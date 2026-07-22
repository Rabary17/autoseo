"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const STORAGE_KEY = "monauto-cookie-consent";

// Aucun cookie de mesure d'audience n'est posé avant un choix explicite —
// ce composant se contente d'afficher le bandeau et de mémoriser la réponse
// (voir app/cookies/page.tsx pour le détail des cookies concernés).
export default function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(STORAGE_KEY)) setVisible(true);
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
  }

  if (!visible) return null;

  return (
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
  );
}
