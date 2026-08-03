import { NextRequest, NextResponse } from "next/server";
import { getSilo, getSousCocon } from "@/lib/taxonomy";

// Corrige à la racine un bug de maillage interne trouvé le 2026-08-03 : le
// pipeline autopublish (scripts/autopublish/run.js) insère les liens internes
// tels que stockés dans data/maillage/maillage.json — un chemin "/silo/slug"
// à 2 segments, aussi bien pour un lien vers un SOUS-HUB que pour un lien
// LATÉRAL vers un autre ARTICLE. Mais côté frontend, ces deux cas ont des
// routes différentes :
//   - un sous-hub/hub vit sous /categorie/[...slug]/ (silo + sous-cocon)
//   - un article vit sous /[slug]/ (juste son propre slug, sans le silo)
// Un lien à 2 segments sans le préfixe /categorie/ ne correspond donc à
// AUCUNE route Next.js et tombe en 404 — sauf le hub seul (1 segment), qui
// fonctionne par coïncidence via /[slug]/ (le slug WP du hub == le slug du
// silo). Plutôt que de réécrire tout le contenu déjà publié (et corriger
// individuellement chaque futur article), une règle de réécriture d'URL
// (à la manière d'un rewrite WordPress) route silencieusement les deux
// formats vers la bonne page réelle, sans redirection visible ni changement
// d'URL affichée — comportement identique quelle que soit la source du lien
// (contenu déjà publié ou futur).
//
// Champ d'application volontairement étroit : seuls les chemins dont le
// PREMIER segment correspond à un slug de silo connu (SILOS, 19 au total)
// sont concernés — /auteur/x, /tag/x, /categorie/x, /api/x etc. gardent leur
// comportement normal, aucun slug de silo ne collisionnant avec ces routes.
export function middleware(request: NextRequest) {
  const segments = request.nextUrl.pathname.split("/").filter(Boolean);
  if (segments.length !== 2) return NextResponse.next();

  const [siloSlug, subSlug] = segments;
  if (!getSilo(siloSlug)) return NextResponse.next();

  const url = request.nextUrl.clone();
  url.pathname = getSousCocon(siloSlug, subSlug)
    ? `/categorie/${siloSlug}/${subSlug}/`
    : `/${subSlug}/`;
  return NextResponse.rewrite(url);
}

export const config = {
  // Exclut explicitement les segments système/techniques (fichiers statiques,
  // API, assets Next.js) — le filtre sur getSilo() ci-dessus suffirait seul,
  // mais ce matcher évite de faire tourner le middleware pour rien sur les
  // requêtes d'assets (images, _next/*, favicon...).
  matcher: ["/((?!api|_next/static|_next/image|favicon|images|silos|logo).*)"],
};
