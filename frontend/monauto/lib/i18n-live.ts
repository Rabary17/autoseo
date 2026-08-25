// Filtre les listings publics /en/* sur le statut RÉEL de publication
// WordPress (2026-08-25).
//
// `data/i18n-index.json` marque `statut: "traduit"` dès qu'une traduction
// existe — pas quand elle est publiée. `lib/i18n.ts::articlesFor/silosFor`
// lisent uniquement cet index, donc listent aussi les traductions encore en
// `draft`. Sans ce filtre, une page /en/* affiche des liens vers du contenu
// pas encore en ligne : 404 réel constaté en production le 25/08 (59 des 60
// guides listés sur /en/ pointaient vers du contenu en draft).
//
// `getAllPosts`/`getAllPages` (lib/wp.ts) ne renvoient déjà QUE le contenu
// `status=publish` (comportement par défaut de l'API WP pour une requête non
// authentifiée, et explicite pour les pages) — et sont déjà mis en cache 15
// min via `unstable_cache`, donc ce filtre ne coûte aucun appel réseau
// supplémentaire par rapport à ce que le reste du site fait déjà.
//
// Fichier séparé de lib/i18n.ts (et non une fonction ajoutée dedans) pour
// éviter un cycle d'imports : lib/wp.ts importe déjà depuis lib/i18n.ts.
import { getAllPosts, getAllPages } from "./wp";

export async function publishedEnSlugs(): Promise<{ posts: Set<string>; pages: Set<string> }> {
  const [posts, pages] = await Promise.all([getAllPosts(), getAllPages()]);
  return {
    posts: new Set(posts.map((p) => p.slug)),
    pages: new Set(pages.map((p) => p.slug)),
  };
}
