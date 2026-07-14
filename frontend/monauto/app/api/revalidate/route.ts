import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";

// Appelé par le mu-plugin WordPress (monauto_send_revalidation, section 4 de
// monauto-headless.php — inspiré du plugin next-revalidate du projet de
// référence next-wp) à chaque événement de publication, dépublication, mise
// à la corbeille, changement de catégorie ou de profil auteur. Ne régénère
// QUE les chemins concernés (contrairement à un rebuild complet), calculés
// côté WordPress qui a déjà accès à toutes les infos du post/terme/auteur —
// voir docs/architecture-headless.md.
//
// Auth par secret partagé, envoyé en header (X-Webhook-Secret) plutôt qu'en
// query string pour éviter qu'il traîne dans des logs d'accès — un fallback
// en query param (?secret=) reste accepté pour les tests manuels (curl).
// Le secret doit être défini à la fois dans les variables d'env Vercel
// (REVALIDATE_SECRET) et dans les réglages WordPress (Réglages > Revalidation
// Next.js) — jamais commité en clair.
export async function POST(request: NextRequest) {
  const secret = request.headers.get("x-webhook-secret") ?? request.nextUrl.searchParams.get("secret");
  if (!process.env.REVALIDATE_SECRET || secret !== process.env.REVALIDATE_SECRET) {
    return NextResponse.json({ error: "secret invalide" }, { status: 401 });
  }

  let body: { paths?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  const paths = Array.isArray(body.paths) ? body.paths.filter((p): p is string => typeof p === "string") : [];
  if (paths.length === 0) {
    return NextResponse.json({ error: "paths manquant ou vide" }, { status: 400 });
  }

  for (const path of paths) revalidatePath(path);

  return NextResponse.json({ revalidated: paths });
}
