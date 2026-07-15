"use client";

import { useEffect, useState } from "react";

type Theme = "light" | "dark";

// La bascule elle-même ne fait que lire/écrire l'attribut data-theme déjà
// posé par le script anti-FOUC dans app/layout.tsx (voir ce fichier) — cette
// répétition volontaire (lire le DOM plutôt qu'un state initial deviné) évite
// tout risque de désaccord serveur/client à l'hydratation.
export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    const current = document.documentElement.getAttribute("data-theme");
    setTheme(current === "dark" ? "dark" : "light");
  }, []);

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem("monauto-theme", next);
    } catch {
      // stockage indisponible (navigation privée, quota) — la bascule reste
      // fonctionnelle pour la session en cours, juste non mémorisée.
    }
  }

  // Avant montage (SSR / premier rendu client), on ne connaît pas encore le
  // thème réel — un bouton neutre évite tout décalage de mise en page plutôt
  // que de deviner une icône potentiellement fausse.
  if (!theme) return <button className="icon-btn" aria-label="Changer de thème" disabled />;

  return (
    <button
      className="icon-btn"
      onClick={toggle}
      aria-label={theme === "dark" ? "Passer au thème clair" : "Passer au thème sombre"}
    >
      {theme === "dark" ? (
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
          <path d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 1020.354 15.354z" />
        </svg>
      )}
    </button>
  );
}
