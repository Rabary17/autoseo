import type { ReactNode } from "react";
import { SITE_SOCIAL_LINKS } from "@/lib/site";

// Icônes des comptes sociaux de MARQUE (footer FR + EN, voir lib/site.ts).
// rel="me" en plus de noopener : signale ces liens comme une preuve
// d'identité vérifiable (même profil, réutilisable si un Knowledge Panel ou
// un vérificateur d'identité IndieWeb les consulte un jour), sans coût ni
// dépendance supplémentaire.
const ICONS: Record<string, ReactNode> = {
  facebook: (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M13.5 21v-7.6h2.6l.4-3h-3v-1.9c0-.87.24-1.46 1.5-1.46h1.6V4.35c-.28-.04-1.23-.12-2.34-.12-2.32 0-3.9 1.4-3.9 4V10.4H7.4v3h2.3V21h3.8Z" />
    </svg>
  ),
  youtube: (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M21.6 7.6a2.7 2.7 0 0 0-1.9-1.9C18 5.2 12 5.2 12 5.2s-6 0-7.7.5a2.7 2.7 0 0 0-1.9 1.9A28 28 0 0 0 2 12a28 28 0 0 0 .4 4.4 2.7 2.7 0 0 0 1.9 1.9c1.7.5 7.7.5 7.7.5s6 0 7.7-.5a2.7 2.7 0 0 0 1.9-1.9A28 28 0 0 0 22 12a28 28 0 0 0-.4-4.4ZM10 15.2V8.8L15.7 12 10 15.2Z" />
    </svg>
  ),
};

export default function SocialLinks() {
  return (
    <div className="footer__social" aria-label="Réseaux sociaux techcars">
      {SITE_SOCIAL_LINKS.map((s) => (
        <a
          key={s.key}
          href={s.url}
          target="_blank"
          rel="noopener noreferrer me"
          aria-label={s.label}
          title={s.label}
        >
          {ICONS[s.key]}
        </a>
      ))}
    </div>
  );
}
