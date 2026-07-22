"use client";
import { useMemo, useState } from "react";
import { useWidgetData } from "./useWidgetData";
import type { DemarcheEntry } from "./types";

// Assistant démarche carte grise (moteur M6) : recherche libre dans les 29 démarches
// documentées, à partir de data/factuel/carte-grise-*demarche*.json via
// public/widgets/demarches.json.
export default function AssistantDemarcheWidget() {
  const { data, loading } = useWidgetData<DemarcheEntry[]>("demarches.json");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<DemarcheEntry | null>(null);

  const matches = useMemo(() => {
    if (!data) return [];
    const q = query.trim().toLowerCase();
    if (!q) return data.slice(0, 6);
    return data.filter((d) => d.demarche.toLowerCase().includes(q));
  }, [data, query]);

  return (
    <div className="widget">
      <p className="widget__title">📄 Assistant carte grise</p>
      <p className="widget__desc">Décrivez votre situation (achat, perte, déménagement…) pour trouver la bonne démarche.</p>

      {loading && <p className="widget__empty">Chargement…</p>}

      {data && (
        <>
          <div className="widget__row">
            <input
              type="text"
              placeholder="Ex. changement d'adresse, perte, succession…"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSelected(null);
              }}
              aria-label="Décrire votre situation"
            />
          </div>

          {!selected && matches.length > 0 && (
            <ul className="subnav">
              {matches.map((d) => (
                <li key={d.demarche}>
                  <button
                    onClick={() => setSelected(d)}
                    style={{ background: "none", border: 0, padding: "9px 0", cursor: "pointer", textAlign: "left", width: "100%" }}
                    className="widget__link-btn"
                  >
                    <span style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 14.5, color: "var(--ink)" }}>
                      {d.demarche.charAt(0).toUpperCase() + d.demarche.slice(1)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {!selected && query.trim() && matches.length === 0 && (
            <p className="widget__empty">Aucune démarche trouvée pour &quot;{query}&quot;.</p>
          )}

          {selected && (
            <div className="widget__result">
              <h4>{selected.demarche.charAt(0).toUpperCase() + selected.demarche.slice(1)}</h4>
              {selected.delai_legal && <p>⏱ Délai légal : {selected.delai_legal}</p>}
              {selected.cout && <p>💶 Coût : {selected.cout}</p>}
              {selected.documents && <p>📎 Documents : {selected.documents}</p>}
              <button className="btn btn--ghost" onClick={() => setSelected(null)} style={{ marginTop: 8 }}>
                ← Autre démarche
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
