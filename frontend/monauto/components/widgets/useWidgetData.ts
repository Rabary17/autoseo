"use client";
import { useEffect, useState } from "react";

// Charge un fichier public/widgets/*.json une seule fois côté client (mis en cache par le
// navigateur comme n'importe quel asset statique — pas de revalidation, ces données ne
// changent qu'en relançant scripts/build-widget-data.py). État "loading" affiché brièvement
// le temps du fetch (fichiers de quelques dizaines à ~190 Ko).
export function useWidgetData<T>(file: string): { data: T | null; loading: boolean; error: boolean } {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/widgets/${file}`)
      .then((res) => {
        if (!res.ok) throw new Error(String(res.status));
        return res.json();
      })
      .then((json) => {
        if (!cancelled) setData(json as T);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [file]);

  return { data, loading, error };
}
