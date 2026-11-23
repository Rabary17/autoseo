// Date ISO "AAAA-MM-JJ" → « 2 octobre 2026 ». Fuseau UTC forcé : la date
// du frontmatter est une date calendaire, elle ne doit pas glisser d'un
// jour selon le fuseau de la machine qui lance le build. Même contrat que
// techno-play.com / besthomeproject.com (lib/format.ts).
export function formatDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(d);
}
