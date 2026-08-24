import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { submitToIndexNow } from "@/lib/indexnow";
import { SITE_URL } from "@/lib/site";
import { translatedPathForSlug, localeListingPathsForSlug } from "@/lib/i18n";

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

  // Traduction des chemins reçus (2026-08-21).
  //
  // Le mu-plugin WordPress ne connaît que les URLs FRANÇAISES : pour un article
  // il envoie `/{slug}/`, `/`, `/categorie/...`, `/auteur/...` (voir
  // wordpress/mu-plugins/monauto-headless.php::monauto_paths_for_post). Pour un
  // contenu traduit, `/{slug}/` ne correspond à RIEN — c'est même une URL que
  // /[slug]/ met volontairement en 404 (verrou de langue).
  //
  // On corrige ICI plutôt que dans le mu-plugin : la correspondance slug ->
  // chemin traduit vit dans l'index i18n, côté Next.js. Le faire côté WordPress
  // supposerait d'y dupliquer cet index et de le maintenir synchronisé, pour un
  // résultat identique.
  //
  // Sans cette traduction, chaque publication programmée d'une traduction
  // sortirait en 404 jusqu'à expiration du cache ISR (une heure).
  const resolved: string[] = [];
  for (const path of paths) {
    const slug = path.replace(/^\/|\/$/g, "");
    const traduit = slug ? translatedPathForSlug(slug) : null;
    if (traduit) {
      resolved.push(traduit);
      // La page d'accueil de la locale et sa rubrique listent l'article : elles
      // doivent être régénérées aussi, sinon le nouvel article n'apparaît nulle
      // part avant l'expiration de leur propre cache.
      for (const p of localeListingPathsForSlug(slug)) resolved.push(p);
    } else {
      resolved.push(path);
    }
  }

  const uniques = [...new Set(resolved)];
  for (const path of uniques) revalidatePath(path);

  // IndexNow (Bing + moteurs partenaires) : ce endpoint est déjà appelé à
  // chaque publication/dépublication/mise à jour WP, quelle que soit la
  // source (édition manuelle, script de QC, ou passage automatique de WP de
  // "future" à "publish") — point d'intégration unique, pas de logique à
  // dupliquer côté WordPress. Jamais bloquant : une erreur ne doit pas faire
  // échouer la revalidation elle-même (voir submitToIndexNow).
  // Attendu (pas fire-and-forget) : sur le runtime serverless de Vercel, une
  // promesse non attendue peut être tuée dès que la réponse part avant
  // d'avoir eu le temps de s'exécuter.
  const urls = uniques.map((p) => `${SITE_URL}${p}`);
  await submitToIndexNow(urls, SITE_URL);

  return NextResponse.json({ revalidated: uniques });
}
