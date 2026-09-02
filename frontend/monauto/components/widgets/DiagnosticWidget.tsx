"use client";
import { useMemo, useState } from "react";
import { useWidgetData } from "./useWidgetData";
import type { CodeEntry, VoyantEntry, WidgetLocale } from "./types";

const STRINGS = {
  fr: {
    title: "🩺 Diagnostic rapide",
    desc: "Un code défaut ou un voyant allumé ? Trouvez la cause en un clic.",
    loading: "Chargement…",
    tabCode: "Code défaut",
    tabVoyant: "Voyant allumé",
    placeholder: "Ex. P0420",
    ariaSearch: "Rechercher un code défaut",
    aucunCode: (q: string) => `Aucun code trouvé pour "${q}".`,
  },
  en: {
    title: "🩺 Quick diagnosis",
    desc: "A fault code or a warning light on? Find the cause in one click.",
    loading: "Loading…",
    tabCode: "Fault code",
    tabVoyant: "Warning light",
    placeholder: "E.g. P0420",
    ariaSearch: "Search a fault code",
    aucunCode: (q: string) => `No code found for "${q}".`,
  },
} as const;

// Diagnostic rapide (moteur M2) : code défaut OBD (recherche libre) ou voyant tableau de
// bord (grille cliquable) -> gravité + causes/action, à partir de
// data/factuel/codes-obd-*.json et pannes-*voyant*.json via public/widgets/codes-voyants.json
// (public/widgets/en/codes-voyants.json pour l'anglais, voir
// scripts/i18n/translate-widgets.js).
export default function DiagnosticWidget({ locale = "fr" }: { locale?: WidgetLocale } = {}) {
  const t = STRINGS[locale];
  const { data, loading } = useWidgetData<{ codes: CodeEntry[]; voyants: VoyantEntry[] }>(
    locale === "en" ? "en/codes-voyants.json" : "codes-voyants.json"
  );
  const [tab, setTab] = useState<"code" | "voyant">("code");
  const [query, setQuery] = useState("");
  const [voyant, setVoyant] = useState<VoyantEntry | null>(null);

  const codeMatches = useMemo(() => {
    if (!data || query.trim().length < 2) return [];
    const q = query.trim().toUpperCase();
    return data.codes.filter((c) => c.code.includes(q)).slice(0, 8);
  }, [data, query]);

  return (
    <div className="widget">
      <p className="widget__title">{t.title}</p>
      <p className="widget__desc">{t.desc}</p>

      <div className="widget__tabs" role="tablist">
        <button className="widget__tab" role="tab" aria-current={tab === "code"} onClick={() => setTab("code")}>
          {t.tabCode}
        </button>
        <button className="widget__tab" role="tab" aria-current={tab === "voyant"} onClick={() => setTab("voyant")}>
          {t.tabVoyant}
        </button>
      </div>

      {loading && <p className="widget__empty">{t.loading}</p>}

      {data && tab === "code" && (
        <>
          <div className="widget__row">
            <input
              type="text"
              placeholder={t.placeholder}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label={t.ariaSearch}
            />
          </div>
          {codeMatches.length > 0 && (
            <div style={{ display: "grid", gap: 8 }}>
              {codeMatches.map((c) => (
                <CodeResult key={c.code} entry={c} />
              ))}
            </div>
          )}
          {query.trim().length >= 2 && codeMatches.length === 0 && (
            <p className="widget__empty">{t.aucunCode(query)}</p>
          )}
        </>
      )}

      {data && tab === "voyant" && (
        <>
          <div className="widget__grid">
            {data.voyants.map((v) => (
              <button key={v.voyant} aria-current={voyant?.voyant === v.voyant} onClick={() => setVoyant(v)}>
                {v.voyant}
              </button>
            ))}
          </div>
          {voyant && (
            <div className="widget__result">
              {voyant.gravite && <span className="widget__badge">{voyant.gravite}</span>}
              <h4>{voyant.voyant}</h4>
              <p>{voyant.signification}</p>
              {voyant.action && <p>{voyant.action}</p>}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function CodeResult({ entry }: { entry: CodeEntry }) {
  return (
    <div className="widget__result">
      {entry.gravite && <span className="widget__badge">{entry.gravite}</span>}
      <h4>{entry.code}</h4>
      <p>{entry.libelle}</p>
      {entry.causes && <p>{entry.causes}</p>}
    </div>
  );
}
