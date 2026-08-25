"use client";
// Sélecteur de langue dans le menu, FR <-> EN (2026-08-25, demande explicite
// de l'utilisateur). Composant client : c'est le seul moyen simple de
// connaître la page courante depuis Header/le layout EN, qui sont partagés
// par toutes les pages sans contexte de route.
//
// Résolution via l'index statique (lib/i18n.ts), pas de vérification du
// statut réel WordPress (contrairement aux listings /en/*, voir
// lib/i18n-live.ts) : ça resterait correct pour la quasi-totalité des cas
// (article/hub déjà en ligne des deux côtés), et dans le pire cas un lien
// pointe vers une traduction pas encore publiée -> 404 normal, pas une fuite
// de contenu ni une expérience cassée. Refaire cette vérification ici
// demanderait un aller-retour serveur à chaque rendu de page, pour un
// bénéfice marginal.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { translatedPathForSlug, frenchPathForLocalSlug } from "@/lib/i18n";

function lastSlug(pathname: string): string | null {
  const segments = pathname.split("/").filter(Boolean);
  return segments.length ? segments[segments.length - 1] : null;
}

export default function LangSwitch() {
  const pathname = usePathname() || "/";
  const isEn = pathname === "/en" || pathname.startsWith("/en/");

  if (isEn) {
    const segments = pathname.split("/").filter(Boolean); // ["en", ...]
    const slug = segments.length > 1 ? segments[segments.length - 1] : null;
    const target = slug ? frenchPathForLocalSlug(slug) : null;
    return (
      <Link className="chip" href={target ?? "/"} aria-label="Voir en français">
        FR
      </Link>
    );
  }

  const slug = lastSlug(pathname);
  const target = slug ? translatedPathForSlug(slug) : null;
  return (
    <Link className="chip" href={target ?? "/en/"} aria-label="Read in English">
      EN
    </Link>
  );
}
