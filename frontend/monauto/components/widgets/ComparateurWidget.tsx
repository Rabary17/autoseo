"use client";
import { useMemo, useState } from "react";
import { useWidgetData } from "./useWidgetData";
import type { ModeleEntry, WidgetLocale } from "./types";

interface ComparateurStrings {
  title: string;
  desc: string;
  loading: string;
  vehicule1: string;
  vehicule2: string;
  marquePlaceholder: (label: string) => string;
  modelePlaceholder: (label: string) => string;
  modele: string;
  choisirMarqueDabord: string;
  nonClasse: string;
  segmentsDifferents: (a: string, b: string) => string;
}

const STRINGS: Record<WidgetLocale, ComparateurStrings> = {
  fr: {
    title: "🆚 Comparateur de véhicules",
    desc: "Choisissez deux modèles, n'importe lesquels — fiabilité et segment comparés instantanément.",
    loading: "Chargement…",
    vehicule1: "Véhicule 1",
    vehicule2: "Véhicule 2",
    marquePlaceholder: (label: string) => `${label} — marque`,
    modelePlaceholder: (label: string) => `${label} — modèle`,
    modele: "Modèle",
    choisirMarqueDabord: "Choisir une marque d'abord",
    nonClasse: "non classé",
    segmentsDifferents: (a: string, b: string) => `⚠️ Segments différents (${a} vs ${b}) — comparaison à prendre avec recul.`,
  },
  en: {
    title: "🆚 Vehicle comparator",
    desc: "Pick any two models — reliability and segment compared instantly.",
    loading: "Loading…",
    vehicule1: "Vehicle 1",
    vehicule2: "Vehicle 2",
    marquePlaceholder: (label: string) => `${label} — make`,
    modelePlaceholder: (label: string) => `${label} — model`,
    modele: "Model",
    choisirMarqueDabord: "Choose a make first",
    nonClasse: "unclassified",
    segmentsDifferents: (a: string, b: string) => `⚠️ Different segments (${a} vs ${b}) — compare with that in mind.`,
  },
} as const;

// Comparateur libre (moteur M5) : l'utilisateur choisit DEUX véhicules quelconques (pas
// seulement les paires déjà publiées en article) — la donnée brute (fiabilité, segment)
// vient de data/factuel/marques-modeles-fiabilite-*.json via public/widgets/modeles.json
// (public/widgets/en/modeles.json pour la version anglaise, voir
// scripts/i18n/translate-widgets.js).
export default function ComparateurWidget({ locale = "fr" }: { locale?: WidgetLocale } = {}) {
  const t = STRINGS[locale];
  const { data, loading } = useWidgetData<ModeleEntry[]>(locale === "en" ? "en/modeles.json" : "modeles.json");
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
      <p className="widget__title">{t.title}</p>
      <p className="widget__desc">{t.desc}</p>

      {loading && <p className="widget__empty">{t.loading}</p>}

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
              label={t.vehicule1}
              t={t}
            />
            <VehiculeSelect
              marques={marques}
              marque={marqueB}
              modele={modeleB}
              modeles={modelesFor(marqueB)}
              onMarque={(v) => { setMarqueB(v); setModeleB(""); }}
              onModele={setModeleB}
              label={t.vehicule2}
              t={t}
            />
          </div>

          {entryA && entryB && (
            <div className="widget__compare" style={{ marginTop: 12 }}>
              <ResultCard entry={entryA} other={entryB} t={t} />
              <ResultCard entry={entryB} other={entryA} t={t} />
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
  t,
}: {
  marques: string[];
  marque: string;
  modele: string;
  modeles: ModeleEntry[];
  onMarque: (v: string) => void;
  onModele: (v: string) => void;
  label: string;
  t: ComparateurStrings;
}) {
  return (
    <div>
      <div className="widget__row">
        <select aria-label={t.marquePlaceholder(label)} value={marque} onChange={(e) => onMarque(e.target.value)}>
          <option value="">{t.marquePlaceholder(label)}</option>
          {marques.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </div>
      <div className="widget__row">
        <select
          aria-label={t.modelePlaceholder(label)}
          value={modele}
          onChange={(e) => onModele(e.target.value)}
          disabled={!marque}
        >
          <option value="">{marque ? t.modele : t.choisirMarqueDabord}</option>
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

function ResultCard({ entry, other, t }: { entry: ModeleEntry; other: ModeleEntry; t: ComparateurStrings }) {
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
        <p style={{ fontStyle: "italic" }}>{t.segmentsDifferents(entry.segment ?? t.nonClasse, other.segment)}</p>
      )}
    </div>
  );
}
