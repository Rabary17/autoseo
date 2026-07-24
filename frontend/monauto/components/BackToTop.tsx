"use client";

import { useEffect, useState } from "react";

const SHOW_AFTER_PX = 600;

// Bouton retour en haut — nouveau pattern (aucun précédent dans le projet
// avant le 2026-07-24, voir skills/design.md). Apparaît seulement après un
// scroll significatif, jamais visible sur une page courte.
export default function BackToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    function update() {
      setVisible(document.documentElement.scrollTop > SHOW_AFTER_PX);
    }
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);

  function scrollToTop() {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
  }

  if (!visible) return null;

  return (
    <button
      type="button"
      className="back-to-top"
      onClick={scrollToTop}
      aria-label="Retour en haut de page"
    >
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 19V5" />
        <path d="M5 12l7-7 7 7" />
      </svg>
    </button>
  );
}
