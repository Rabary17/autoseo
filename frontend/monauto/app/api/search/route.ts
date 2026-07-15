import { NextRequest, NextResponse } from "next/server";
import { decodeEntities, searchPosts } from "@/lib/wp";

// Recherche instantanée (barre de recherche debouncée côté client, voir
// components/SearchBox.tsx). Route serveur plutôt qu'un appel direct à WP
// depuis le navigateur : WP_URL/format `?rest_route=` restent des détails
// d'implémentation côté serveur (voir lib/wp.ts), jamais exposés au client.
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json({ results: [] });

  try {
    const { posts } = await searchPosts(q, 1, 8);
    const results = posts.map((p) => ({
      id: p.id,
      slug: p.slug,
      title: decodeEntities(p.title.rendered.replace(/<[^>]+>/g, "")),
      cat: p._embedded?.["wp:term"]?.[0]?.[0]?.name,
    }));
    return NextResponse.json({ results });
  } catch (e) {
    console.warn(`[api/search] échec du fetch WP pour "${q}": ${e}`);
    // 200 volontaire : un souci WP ne doit pas faire planter le champ de
    // recherche côté client, juste renvoyer "aucun résultat pour l'instant".
    return NextResponse.json({ results: [], error: "wp_unreachable" });
  }
}
