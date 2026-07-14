// Variables NEXT_PUBLIC_* : seules celles-ci sont envoyées au navigateur
// (inlinées au build). Tout le reste de lib/wp.ts (WP_API_URL) reste
// côté serveur/build uniquement — voir skills/developpement.md section 4
// ("aucune clé/URL interne exposée au client sans raison").
// Ici : uniquement l'URL racine WordPress, nécessaire pour que le
// formulaire newsletter (Client Component) puisse poster directement à
// l'API REST publique — aucune donnée sensible.
export const WP_SITE_URL = (process.env.NEXT_PUBLIC_WP_SITE_URL ?? "http://thermotowel.local").replace(/\/$/, "");
