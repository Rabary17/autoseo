export const SITE_URL = (process.env.SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
export const SITE_NAME = process.env.SITE_NAME ?? "techcars";

// Comptes sociaux réels de la MARQUE techcars (jamais une persona auteur —
// voir docs/feuille-de-route-eeat-industrialisation.md section 0). Source
// unique de vérité, consommée par le schema Organization.sameAs
// (lib/schema.ts) et par les icônes du footer (components/SocialLinks.tsx).
export const SITE_SOCIAL_LINKS = [
  { key: "facebook", label: "Facebook", url: "https://www.facebook.com/profile.php?id=100060243228966" },
  { key: "youtube", label: "YouTube", url: "https://www.youtube.com/@techcarsFR" },
] as const;

// Identité légale réelle de l'entité éditrice, fournie par l'utilisateur le
// 2026-09-02 pour résoudre la Priorité 1 du chantier EEAT (anonymat total en
// mentions légales, voir docs/feuille-de-route-eeat-industrialisation.md
// section 1) — jusque-là le blocage le plus important sur le score EEAT.
// Réutilisée par mentions-legales/page.tsx ET par le schema Organization
// (lib/schema.ts), pour ne jamais désynchroniser les deux. `legalName` et
// l'adresse sont ceux de l'organisation MÈRE (à dupliquer tels quels pour
// chaque nouveau site du réseau, voir CLAUDE.md) — seul `contactEmail` est
// spécifique à ce domaine.
export const SITE_LEGAL = {
  legalName: "ANMIRA Madagascar",
  streetAddress: "157F Mahatony",
  addressLocality: "Antananarivo",
  addressCountry: "Madagascar",
  contactEmail: "contact@techcars.fr",
} as const;
