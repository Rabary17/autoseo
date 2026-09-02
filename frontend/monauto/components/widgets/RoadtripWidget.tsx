"use client";
import { useState } from "react";
import { useWidgetData } from "./useWidgetData";
import type { RoadtripEntry, WidgetLocale } from "./types";

const STRINGS = {
  fr: {
    title: "🗺️ Péages & vignettes en Europe",
    desc: "Choisissez un pays pour connaître son système de péage avant de partir.",
    loading: "Chargement…",
    amende: (a: string) => `⚠️ Amende : ${a}`,
  },
  en: {
    title: "🗺️ Tolls & vignettes in Europe",
    desc: "Pick a country to check its toll system before you go.",
    loading: "Loading…",
    amende: (a: string) => `⚠️ Fine: ${a}`,
  },
} as const;

// "non applicable" est un marqueur technique recopié tel quel par
// scripts/i18n/translate-widgets.js (jamais traduit, dans les deux fichiers) —
// comparaison insensible à la casse par prudence.
const NON_APPLICABLE = "non applicable";

// Explorateur road trip (moteur M7) : grille de pays cliquables -> péage/vignette/infos
// pratiques, à partir de data/factuel/roadtrips-destinations-*.json via
// public/widgets/roadtrips.json (public/widgets/en/roadtrips.json pour l'anglais, voir
// scripts/i18n/translate-widgets.js). Grille plutôt qu'une carte SVG : plus léger (pas
// d'asset image), aussi rapide d'usage, et accessible nativement (boutons, pas de zones
// cliquables sur image).
export default function RoadtripWidget({ locale = "fr" }: { locale?: WidgetLocale } = {}) {
  const t = STRINGS[locale];
  const { data, loading } = useWidgetData<RoadtripEntry[]>(locale === "en" ? "en/roadtrips.json" : "roadtrips.json");
  const [selected, setSelected] = useState<RoadtripEntry | null>(null);

  return (
    <div className="widget">
      <p className="widget__title">{t.title}</p>
      <p className="widget__desc">{t.desc}</p>

      {loading && <p className="widget__empty">{t.loading}</p>}

      {data && (
        <>
          <div className="widget__grid">
            {data.map((c) => (
              <button key={c.pays} aria-current={selected?.pays === c.pays} onClick={() => setSelected(c)}>
                {c.pays}
              </button>
            ))}
          </div>

          {selected && (
            <div className="widget__result">
              <h4>{selected.pays}</h4>
              {selected.systeme_peage && <p>{selected.systeme_peage}</p>}
              {selected.prix && <p>💶 {selected.prix}</p>}
              {selected.amende && selected.amende.toLowerCase() !== NON_APPLICABLE && (
                <p>{t.amende(selected.amende)}</p>
              )}
              {selected.particularites && <p>{selected.particularites}</p>}
            </div>
          )}
        </>
      )}
    </div>
  );
}
