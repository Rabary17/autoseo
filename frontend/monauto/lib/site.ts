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
