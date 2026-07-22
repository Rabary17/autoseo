// Icônes de sous-cocons — SVG en ligne, pas une image téléchargée par sous-cocon (~100
// sous-cocons au total : une photo par sous-cocon serait lourde à maintenir et à charger).
// Résolution par MOT-CLÉ (nom du sous-cocon, insensible accents/casse) vers un petit jeu
// d'icônes trait (style cohérent, currentColor -> s'adapte au thème clair/sombre sans CSS
// dédié). Icône générique (clé à molette) en repli si aucun mot-clé ne correspond.
import type { SVGProps } from "react";

function stripAccents(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

const ICONS: Record<string, (props: SVGProps<SVGSVGElement>) => React.JSX.Element> = {
  vidange: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...p}>
      <path d="M12 3c3 3.5 5 6.5 5 9a5 5 0 1 1-10 0c0-2.5 2-5.5 5-9Z" />
    </svg>
  ),
  frein: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...p}>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="2.6" />
      <path d="M12 5.5v3M12 15.5v3M5.5 12h3M15.5 12h3" />
    </svg>
  ),
  moteur: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...p}>
      <rect x="3.5" y="9" width="13" height="8" rx="1.5" />
      <path d="M16.5 11h2.5a1.5 1.5 0 0 1 1.5 1.5v1a1.5 1.5 0 0 1-1.5 1.5H16.5M6.5 9V6.5h4V9M9 17v2" />
    </svg>
  ),
  batterie: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...p}>
      <rect x="3.5" y="7.5" width="15" height="10" rx="1.5" />
      <path d="M18.5 10.5h2v4h-2M8 10v4M8 12h3M13.5 10v4" />
    </svg>
  ),
  electrique: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...p}>
      <path d="M13 3 5 13.5h5.5L11 21l8-11h-5.5L13 3Z" strokeLinejoin="round" />
    </svg>
  ),
  clim: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...p}>
      <path d="M12 3v18M4.5 6.5l15 11M19.5 6.5l-15 11" />
    </svg>
  ),
  pneu: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...p}>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="4" strokeDasharray="1.6 1.8" />
    </svg>
  ),
  carrosserie: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...p}>
      <path d="M3.5 15.5 5 10a2 2 0 0 1 1.9-1.4h10.2A2 2 0 0 1 19 10l1.5 5.5M3.5 15.5v2a1 1 0 0 0 1 1H6a1 1 0 0 0 1-1v-1h10v1a1 1 0 0 0 1 1h1.5a1 1 0 0 0 1-1v-2M3.5 15.5h17" />
    </svg>
  ),
  document: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...p}>
      <path d="M6.5 3.5h8l4 4v13h-12v-17Z" strokeLinejoin="round" />
      <path d="M14.5 3.5v4h4M9 12h6M9 15.5h6" />
    </svg>
  ),
  assurance: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...p}>
      <path d="M12 3.5 5 6v6c0 4.5 3 7.5 7 8.5 4-1 7-4 7-8.5V6l-7-2.5Z" strokeLinejoin="round" />
      <path d="m9 12 2 2 4-4" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  ),
  permis: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...p}>
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <circle cx="8" cy="12" r="2" />
      <path d="M12.5 10h5M12.5 14h5" />
    </svg>
  ),
  moto: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...p}>
      <circle cx="5.5" cy="17" r="2.5" />
      <circle cx="18" cy="17" r="2.5" />
      <path d="M8 17h7.5l-2-6H10l-2.5-3.5M13.5 11l2-3h3" />
    </svg>
  ),
  velo: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...p}>
      <circle cx="5.5" cy="17" r="2.8" />
      <circle cx="18.5" cy="17" r="2.8" />
      <path d="M5.5 17 9.5 8h4l3 9M9.5 8H8M9.5 8l3.5 5h5.5" />
    </svg>
  ),
  voyage: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...p}>
      <path d="M12 3.5c3.5 0 6.5 3.5 6.5 7.5 0 5-6.5 9.5-6.5 9.5S5.5 16 5.5 11c0-4 3-7.5 6.5-7.5Z" strokeLinejoin="round" />
      <circle cx="12" cy="11" r="2.2" />
    </svg>
  ),
  carburant: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...p}>
      <path d="M5.5 20.5v-15a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v15M5.5 20.5h8M5.5 12h8M15.5 8.5l2 1.5v6a1.4 1.4 0 0 0 2.8 0V9L18 6.5" />
    </svg>
  ),
  comparatif: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...p}>
      <path d="M7 4v16M17 4v16M4 8h6M14 8h6M4 16h6M14 16h6" />
    </svg>
  ),
  prix: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...p}>
      <path d="M4 4h16M4 4v16M4 4l16 16M13 8.5h4M13 12h3" />
    </svg>
  ),
  fiabilite: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...p}>
      <path d="m12 3 2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.3 6.8 19l1-5.8-4.3-4.1 5.9-.9L12 3Z" strokeLinejoin="round" />
    </svg>
  ),
  outil: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...p}>
      <path d="M14.5 6.5a4 4 0 0 0-5.4 4.6L4 16.2V20h3.8l5.1-5.1a4 4 0 0 0 4.6-5.4l-2.7 2.7-2-.6-.6-2 2.7-2.7Z" strokeLinejoin="round" />
    </svg>
  ),
};

// Mots-clés (accents/casse déjà normalisés à la comparaison) -> icône. Ordre = priorité
// (le premier mot-clé trouvé dans le nom du sous-cocon l'emporte).
const KEYWORD_MAP: [string, keyof typeof ICONS][] = [
  ["vidange", "vidange"], ["filtre", "vidange"], ["huile", "vidange"],
  ["frein", "frein"], ["plaquette", "frein"], ["disque", "frein"],
  ["distribution", "moteur"], ["courroie", "moteur"], ["embrayage", "moteur"],
  ["turbo", "moteur"], ["injecteur", "moteur"], ["culasse", "moteur"], ["boite", "moteur"], ["boîte", "moteur"],
  ["batterie", "batterie"], ["alternateur", "batterie"], ["demarreur", "batterie"], ["démarreur", "batterie"],
  ["electrique", "electrique"], ["électrique", "electrique"], ["hybride", "electrique"], ["recharge", "electrique"], ["autonomie", "electrique"],
  ["climatisation", "clim"], ["clim", "clim"],
  ["pneu", "pneu"], ["geometrie", "pneu"], ["géométrie", "pneu"], ["suspension", "pneu"], ["amortisseur", "pneu"],
  ["carrosserie", "carrosserie"], ["pare-brise", "carrosserie"], ["optique", "carrosserie"], ["phare", "carrosserie"],
  ["carte grise", "document"], ["immatriculation", "document"], ["demarche", "document"], ["démarche", "document"], ["duplicata", "document"], ["cession", "document"],
  ["assurance", "assurance"], ["garantie", "assurance"], ["sinistre", "assurance"],
  ["permis", "permis"], ["examen", "permis"], ["infraction", "permis"], ["point", "permis"],
  ["moto", "moto"], ["scooter", "moto"],
  ["velo", "velo"], ["vélo", "velo"], ["edpm", "velo"], ["trottinette", "velo"],
  ["road trip", "voyage"], ["voyage", "voyage"], ["peage", "voyage"], ["péage", "voyage"], ["vignette", "voyage"], ["itineraire", "voyage"],
  ["carburant", "carburant"], ["consommation", "carburant"], ["e85", "carburant"], ["gpl", "carburant"],
  ["comparatif", "comparatif"], ["duel", "comparatif"], ["versus", "comparatif"], ["segment", "comparatif"],
  ["prix", "prix"], ["cout", "prix"], ["coût", "prix"], ["tarif", "prix"], ["budget", "prix"],
  ["fiabilite", "fiabilite"], ["fiabilité", "fiabilite"], ["probleme", "fiabilite"], ["problème", "fiabilite"], ["panne", "fiabilite"], ["avis", "fiabilite"],
];

export function resolveSousCoconIcon(name: string): keyof typeof ICONS {
  const n = stripAccents(name);
  for (const [kw, icon] of KEYWORD_MAP) {
    if (n.includes(stripAccents(kw))) return icon;
  }
  return "outil";
}

export default function SousCoconIcon({ name, ...props }: { name: string } & SVGProps<SVGSVGElement>) {
  const Icon = ICONS[resolveSousCoconIcon(name)];
  return <Icon width={18} height={18} aria-hidden="true" {...props} />;
}
