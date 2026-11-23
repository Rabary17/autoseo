// Identité du site — reprise telle quelle de frontend/monauto/lib/site.ts
// (même marque, techcars.fr, migration WordPress → Markdown 2026-11-20).
// Repli sur l'hôte de production : sans SITE_URL, les canonical et le JSON-LD
// pointaient sur localhost:3000 dans le build statique.
export const SITE_URL = (process.env.SITE_URL ?? "https://techcars.fr").replace(/\/$/, "");
export const SITE_NAME = process.env.SITE_NAME ?? "techcars";
export const SITE_DESCRIPTION =
  "Le média expert de l'auto et de la mobilité : entretien, pannes, marques, essais, démarches. Guides vérifiés, sourcés et tenus à jour par une rédaction identifiée.";

export const SOCIAL_LINKS = [
  { label: "Facebook", url: "https://www.facebook.com/profile.php?id=100060243228966" },
  { label: "YouTube", url: "https://www.youtube.com/@techcarsFR" },
] as const;

// Identité légale réelle de l'entité éditrice (même donnée que
// frontend/monauto/lib/site.ts — organisation mère du réseau, voir CLAUDE.md).
export const SITE_LEGAL = {
  legalName: "ANMIRA Madagascar",
  streetAddress: "157F Mahatony",
  addressLocality: "Antananarivo",
  addressCountry: "Madagascar",
  contactEmail: "contact@techcars.fr",
} as const;
