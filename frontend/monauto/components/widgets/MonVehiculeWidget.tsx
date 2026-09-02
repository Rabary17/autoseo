"use client";
import { useEffect, useMemo, useState } from "react";
import { useWidgetData } from "./useWidgetData";
import type { ModeleEntry, WidgetLocale } from "./types";

const STORAGE_KEY = "monauto:mon-vehicule";

const STRINGS = {
  fr: {
    title: "🚗 Mon véhicule",
    desc: "Enregistrez votre véhicule pour retrouver ses infos en un coup d'œil.",
    loading: "Chargement…",
    marque: "Marque",
    modele: "Modèle",
    enregistrer: "Enregistrer",
    changerVehicule: "Changer de véhicule",
  },
  en: {
    title: "🚗 My vehicle",
    desc: "Save your vehicle to see its info at a glance.",
    loading: "Loading…",
    marque: "Make",
    modele: "Model",
    enregistrer: "Save",
    changerVehicule: "Change vehicle",
  },
} as const;

// "Mon véhicule" (moteur M3) : sélection persistée (localStorage — jamais de cookie/tracking
// tiers) réutilisable par d'autres composants du site (ex. mise en avant future d'un
// paragraphe "spécifique à votre véhicule" dans les articles génériques). Ici : sélection +
// rappel de la fiche fiabilité/pannes courantes. Même dataset traduit que ComparateurWidget
// (public/widgets/en/modeles.json), voir scripts/i18n/translate-widgets.js.
export default function MonVehiculeWidget({ locale = "fr" }: { locale?: WidgetLocale } = {}) {
  const t = STRINGS[locale];
  const { data, loading } = useWidgetData<ModeleEntry[]>(locale === "en" ? "en/modeles.json" : "modeles.json");
  const [marque, setMarque] = useState("");
  const [modele, setModele] = useState("");
  const [saved, setSaved] = useState<{ marque: string; modele: string } | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setSaved(JSON.parse(raw));
    } catch {
      // localStorage indisponible (navigation privée stricte, etc.) — dégrade sans erreur
    }
  }, []);

  const marques = useMemo(() => (data ? [...new Set(data.map((m) => m.marque))].sort() : []), [data]);
  const modeles = useMemo(
    () => (data ? data.filter((m) => m.marque === marque).sort((a, b) => a.modele.localeCompare(b.modele)) : []),
    [data, marque]
  );

  const entry = data?.find((m) => (saved ? m.marque === saved.marque && m.modele === saved.modele : false));

  function save() {
    if (!marque || !modele) return;
    const value = { marque, modele };
    setSaved(value);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    } catch {
      // pas grave si la persistance échoue — l'affichage immédiat fonctionne quand même
    }
  }

  function reset() {
    setSaved(null);
    setMarque("");
    setModele("");
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // idem
    }
  }

  return (
    <div className="widget">
      <p className="widget__title">{t.title}</p>
      <p className="widget__desc">{t.desc}</p>

      {loading && <p className="widget__empty">{t.loading}</p>}

      {data && !saved && (
        <>
          <div className="widget__row widget__row--2">
            <select
              aria-label={t.marque}
              value={marque}
              onChange={(e) => {
                setMarque(e.target.value);
                setModele("");
              }}
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
                <option key={m.modele} value={m.modele}>
                  {m.modele}
                </option>
              ))}
            </select>
          </div>
          <button className="btn btn--primary" onClick={save} disabled={!marque || !modele} style={{ width: "100%" }}>
            {t.enregistrer}
          </button>
        </>
      )}

      {saved && (
        <div className="widget__result">
          {entry?.segment && <span className="widget__badge">{entry.segment}</span>}
          <h4>
            {saved.marque} {saved.modele}
          </h4>
          {entry?.fiabilite && <p>{entry.fiabilite}</p>}
          {entry?.pannes && <p>{entry.pannes}</p>}
          <button className="btn btn--ghost" onClick={reset} style={{ marginTop: 8 }}>
            {t.changerVehicule}
          </button>
        </div>
      )}
    </div>
  );
}
