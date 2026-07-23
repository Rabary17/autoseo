import { SITE_URL } from "@/lib/site";

// Boutons de partage Facebook/X/LinkedIn — demande explicite de l'utilisateur,
// 2026-07-22, sur articles ET pages (hub/sous-hub). Simples liens d'intention
// de partage (aucun SDK tiers, aucun script chargé, aucun cookie/tracking) :
// composant serveur, réutilisable partout où on a une URL + un titre.
const NETWORKS = [
  {
    key: "facebook",
    label: "Partager sur Facebook",
    href: (url: string) => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M13.5 21v-7.6h2.6l.4-3h-3v-1.9c0-.87.24-1.46 1.5-1.46h1.6V4.35c-.28-.04-1.23-.12-2.34-.12-2.32 0-3.9 1.4-3.9 4V10.4H7.4v3h2.3V21h3.8Z" />
      </svg>
    ),
  },
  {
    key: "x",
    label: "Partager sur X",
    href: (url: string, title: string) =>
      `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`,
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="m4 4 6.6 8.7L4.3 20h2l5.4-6.1L16.3 20H20l-6.9-9.1L19.4 4h-2l-4.9 5.5L8.3 4H4Z" />
      </svg>
    ),
  },
  {
    key: "linkedin",
    label: "Partager sur LinkedIn",
    href: (url: string) => `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M6.9 8.9H3.6V20h3.3V8.9ZM5.25 4c-1.13 0-1.87.75-1.87 1.73 0 .96.72 1.73 1.83 1.73h.02c1.15 0 1.87-.77 1.87-1.73C7.08 4.75 6.38 4 5.25 4ZM20.4 20h-3.3v-5.9c0-1.4-.5-2.36-1.76-2.36-.96 0-1.53.65-1.78 1.27-.09.22-.11.53-.11.84V20H10.1s.04-10.1 0-11.1h3.3v1.58c.44-.68 1.22-1.64 2.98-1.64 2.17 0 3.8 1.42 3.8 4.47V20Z" />
      </svg>
    ),
  },
] as const;

export default function ShareButtons({ path, title }: { path: string; title: string }) {
  const url = `${SITE_URL}${path}`;
  return (
    <div className="share" aria-label="Partager">
      {NETWORKS.map((n) => (
        <a
          key={n.key}
          className="share__btn"
          href={n.href(url, title)}
          target="_blank"
          rel="noopener noreferrer nofollow"
          aria-label={n.label}
          title={n.label}
        >
          {n.icon}
        </a>
      ))}
    </div>
  );
}
