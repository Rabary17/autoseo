"use client";

import { useEffect, useState } from "react";

// Barre de progression de lecture — nouveau pattern (aucun précédent dans le
// projet avant le 2026-07-24, voir skills/design.md). JS minimal : un seul
// listener passif sur `scroll`, pas de librairie, cohérent avec la charte
// ("zéro dépendance JS lourde", voir skills/design.md section 3).
export default function ReadingProgress() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    function update() {
      const doc = document.documentElement;
      const scrollable = doc.scrollHeight - doc.clientHeight;
      setProgress(scrollable > 0 ? Math.min(1, Math.max(0, doc.scrollTop / scrollable)) : 0);
    }
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  return (
    <div className="reading-progress" role="presentation" aria-hidden="true">
      <div className="reading-progress__bar" style={{ transform: `scaleX(${progress})` }} />
    </div>
  );
}
