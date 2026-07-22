"use client";
import { useMemo, useState } from "react";
import { useWidgetData } from "./useWidgetData";
import type { PrixEntretienEntry } from "./types";

// Calculateur de prix d'entretien (moteur M1) : prestation × marque × modèle -> fourchette
// de prix réelle, à partir de data/factuel/entretien-croisement-prix-marques-*.json via
// public/widgets/prix-entretien.json. Silo naturel : Entretien & révision.
export default function CalculateurPrixWidget() {
  const { data, loading } = useWidgetData<PrixEntretienEntry[]>("prix-entretien.json");
  const [prestation, setPrestation] = useState("");
  const [marque, setMarque] = useState("");
  const [modele, setModele] = useState("");

  const prestations = useMemo(() => (data ? [...new Set(data.map((r) => r.prestation))].sort() : []), [data]);
  const marques = useMemo(
    () => (data ? [...new Set(data.filter((r) => r.prestation === prestation).map((r) => r.marque))].sort() : []),
    [data, prestation]
  );
  const modeles = useMemo(
    () =>
      data
        ? [...new Set(data.filter((r) => r.prestation === prestation && r.marque === marque).map((r) => r.modele))].sort()
        : [],
    [data, prestation, marque]
  );

  const result = data?.find((r) => r.prestation === prestation && r.marque === marque && r.modele === modele);

  return (
    <div className="widget">
      <p className="widget__title">🔧 Calculateur de prix d&apos;entretien</p>
      <p className="widget__desc">Prix réels relevés par prestation, marque et modèle.</p>

      {loading && <p className="widget__empty">Chargement…</p>}

      {data && (
        <>
          <div className="widget__row">
            <select
              aria-label="Prestation"
              value={prestation}
              onChange={(e) => {
                setPrestation(e.target.value);
                setMarque("");
                setModele("");
              }}
            >
              <option value="">Choisir une prestation</option>
              {prestations.map((p) => (
                <option key={p} value={p}>
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                </option>
              ))}
            </select>
          </div>
          <div className="widget__row widget__row--2">
            <select
              aria-label="Marque"
              value={marque}
              onChange={(e) => {
                setMarque(e.target.value);
                setModele("");
              }}
              disabled={!prestation}
            >
              <option value="">Marque</option>
              {marques.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
            <select aria-label="Modèle" value={modele} onChange={(e) => setModele(e.target.value)} disabled={!marque}>
              <option value="">Modèle</option>
              {modeles.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          {result && (
            <div className="widget__result">
              <h4>
                {result.prestation} — {result.marque} {result.modele}
              </h4>
              {result.prix_min != null && result.prix_max != null && (
                <p className="widget__price">
                  {result.prix_min}–{result.prix_max}€ TTC
                </p>
              )}
              {result.temps_mo && <p>Temps de main d&apos;œuvre : ~{result.temps_mo.replace(/\s*min\.?$/i, "")} min</p>}
              {result.motorisation && <p>Motorisation : {result.motorisation}</p>}
            </div>
          )}
        </>
      )}
    </div>
  );
}
