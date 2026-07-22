"use client";
import { useMemo, useState } from "react";
import { useWidgetData } from "./useWidgetData";
import type { ModeleEntry } from "./types";

// Comparateur libre (moteur M5) : l'utilisateur choisit DEUX véhicules quelconques (pas
// seulement les paires déjà publiées en article) — la donnée brute (fiabilité, segment)
// vient de data/factuel/marques-modeles-fiabilite-*.json via public/widgets/modeles.json.
export default function ComparateurWidget() {
  const { data, loading } = useWidgetData<ModeleEntry[]>("modeles.json");
  const [marqueA, setMarqueA] = useState("");
  const [modeleA, setModeleA] = useState("");
  const [marqueB, setMarqueB] = useState("");
  const [modeleB, setModeleB] = useState("");

  const marques = useMemo(() => (data ? [...new Set(data.map((m) => m.marque))].sort() : []), [data]);
  const modelesFor = (marque: string) =>
    (data ?? []).filter((m) => m.marque === marque).sort((a, b) => a.modele.localeCompare(b.modele));

  const entryA = data?.find((m) => m.marque === marqueA && m.modele === modeleA);
  const entryB = data?.find((m) => m.marque === marqueB && m.modele === modeleB);

  return (
    <div className="widget">
      <p className="widget__title">🆚 Comparateur de véhicules</p>
      <p className="widget__desc">Choisissez deux modèles, n&apos;importe lesquels — fiabilité et segment comparés instantanément.</p>

      {loading && <p className="widget__empty">Chargement…</p>}

      {data && (
        <>
          <div className="widget__compare">
            <VehiculeSelect
              marques={marques}
              marque={marqueA}
              modele={modeleA}
              modeles={modelesFor(marqueA)}
              onMarque={(v) => { setMarqueA(v); setModeleA(""); }}
              onModele={setModeleA}
              label="Véhicule 1"
            />
            <VehiculeSelect
              marques={marques}
              marque={marqueB}
              modele={modeleB}
              modeles={modelesFor(marqueB)}
              onMarque={(v) => { setMarqueB(v); setModeleB(""); }}
              onModele={setModeleB}
              label="Véhicule 2"
            />
          </div>

          {entryA && entryB && (
            <div className="widget__compare" style={{ marginTop: 12 }}>
              <ResultCard entry={entryA} other={entryB} />
              <ResultCard entry={entryB} other={entryA} />
            </div>
          )}
        </>
      )}
    </div>
  );
}

function VehiculeSelect({
  marques,
  marque,
  modele,
  modeles,
  onMarque,
  onModele,
  label,
}: {
  marques: string[];
  marque: string;
  modele: string;
  modeles: ModeleEntry[];
  onMarque: (v: string) => void;
  onModele: (v: string) => void;
  label: string;
}) {
  return (
    <div>
      <div className="widget__row">
        <select aria-label={`${label} — marque`} value={marque} onChange={(e) => onMarque(e.target.value)}>
          <option value="">{label} — marque</option>
          {marques.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </div>
      <div className="widget__row">
        <select
          aria-label={`${label} — modèle`}
          value={modele}
          onChange={(e) => onModele(e.target.value)}
          disabled={!marque}
        >
          <option value="">{marque ? "Modèle" : "Choisir une marque d'abord"}</option>
          {modeles.map((m) => (
            <option key={m.modele} value={m.modele}>
              {m.modele}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

function ResultCard({ entry, other }: { entry: ModeleEntry; other: ModeleEntry }) {
  const sameSegment = entry.segment && entry.segment === other.segment;
  return (
    <div className="widget__result">
      {entry.segment && (
        <span className={`widget__badge ${sameSegment ? "" : "widget__badge--warn"}`}>{entry.segment}</span>
      )}
      <h4>
        {entry.marque} {entry.modele}
      </h4>
      {entry.fiabilite && <p>{entry.fiabilite}</p>}
      {entry.pannes && <p>{entry.pannes}</p>}
      {!sameSegment && other.segment && (
        <p style={{ fontStyle: "italic" }}>
          ⚠️ Segments différents ({entry.segment ?? "non classé"} vs {other.segment}) — comparaison à prendre avec
          recul.
        </p>
      )}
    </div>
  );
}
