"use client";
import { useState } from "react";
import { useWidgetData } from "./useWidgetData";
import type { RoadtripEntry } from "./types";

// Explorateur road trip (moteur M7) : grille de pays cliquables -> péage/vignette/infos
// pratiques, à partir de data/factuel/roadtrips-destinations-*.json via
// public/widgets/roadtrips.json. Grille plutôt qu'une carte SVG : plus léger (pas d'asset
// image), aussi rapide d'usage, et accessible nativement (boutons, pas de zones cliquables
// sur image).
export default function RoadtripWidget() {
  const { data, loading } = useWidgetData<RoadtripEntry[]>("roadtrips.json");
  const [selected, setSelected] = useState<RoadtripEntry | null>(null);

  return (
    <div className="widget">
      <p className="widget__title">🗺️ Péages &amp; vignettes en Europe</p>
      <p className="widget__desc">Choisissez un pays pour connaître son système de péage avant de partir.</p>

      {loading && <p className="widget__empty">Chargement…</p>}

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
              {selected.amende && selected.amende !== "non applicable" && <p>⚠️ Amende : {selected.amende}</p>}
              {selected.particularites && <p>{selected.particularites}</p>}
            </div>
          )}
        </>
      )}
    </div>
  );
}
