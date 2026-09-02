"use client";
import { useMemo, useState } from "react";
import { useWidgetData } from "./useWidgetData";
import type { PrixEntretienEntry, WidgetLocale } from "./types";

const STRINGS = {
  fr: {
    title: "🔧 Calculateur de prix d'entretien",
    desc: "Prix réels relevés par prestation, marque et modèle.",
    loading: "Chargement…",
    prestationLabel: "Prestation",
    choisirPrestation: "Choisir une prestation",
    marque: "Marque",
    modele: "Modèle",
    prixTTC: (min: number, max: number) => `${min}–${max}€ TTC`,
    tempsMo: (n: string) => `Temps de main d'œuvre : ~${n} min`,
    motorisation: (m: string) => `Motorisation : ${m}`,
  },
  en: {
    title: "🔧 Maintenance cost calculator",
    desc: "Real prices by service, make and model.",
    loading: "Loading…",
    prestationLabel: "Service",
    choisirPrestation: "Choose a service",
    marque: "Make",
    modele: "Model",
    // Prix français réels (données du marché FR), jamais convertis — voir
    // scripts/i18n/translate-widgets.js. Le symbole reste €, "TTC" (taxe
    // française) devient "incl. VAT" pour rester compréhensible.
    prixTTC: (min: number, max: number) => `${min}–${max}€ incl. VAT`,
    tempsMo: (n: string) => `Labour time: ~${n} min`,
    motorisation: (m: string) => `Engine: ${m}`,
  },
} as const;

// Calculateur de prix d'entretien (moteur M1) : prestation × marque × modèle -> fourchette
// de prix réelle, à partir de data/factuel/entretien-croisement-prix-marques-*.json via
// public/widgets/prix-entretien.json (public/widgets/en/prix-entretien.json pour l'anglais,
// voir scripts/i18n/translate-widgets.js). Silo naturel : Entretien & révision.
export default function CalculateurPrixWidget({ locale = "fr" }: { locale?: WidgetLocale } = {}) {
  const t = STRINGS[locale];
  const { data, loading } = useWidgetData<PrixEntretienEntry[]>(
    locale === "en" ? "en/prix-entretien.json" : "prix-entretien.json"
  );
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
      <p className="widget__title">{t.title}</p>
      <p className="widget__desc">{t.desc}</p>

      {loading && <p className="widget__empty">{t.loading}</p>}

      {data && (
        <>
          <div className="widget__row">
            <select
              aria-label={t.prestationLabel}
              value={prestation}
              onChange={(e) => {
                setPrestation(e.target.value);
                setMarque("");
                setModele("");
              }}
            >
              <option value="">{t.choisirPrestation}</option>
              {prestations.map((p) => (
                <option key={p} value={p}>
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                </option>
              ))}
            </select>
          </div>
          <div className="widget__row widget__row--2">
            <select
              aria-label={t.marque}
              value={marque}
              onChange={(e) => {
                setMarque(e.target.value);
                setModele("");
              }}
              disabled={!prestation}
            >
              <option value="">{t.marque}</option>
              {marques.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
            <select aria-label={t.modele} value={modele} onChange={(e) => setModele(e.target.value)} disabled={!marque}>
              <option value="">{t.modele}</option>
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
                <p className="widget__price">{t.prixTTC(result.prix_min, result.prix_max)}</p>
              )}
              {result.temps_mo && <p>{t.tempsMo(result.temps_mo.replace(/\s*min\.?$/i, ""))}</p>}
              {result.motorisation && <p>{t.motorisation(result.motorisation)}</p>}
            </div>
          )}
        </>
      )}
    </div>
  );
}
