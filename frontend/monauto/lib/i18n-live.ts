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
// ATTENTION, piège déjà tombé dedans une fois : `getAllPosts()`/`getAllPages()`
// (lib/wp.ts) sont volontairement FRANÇAIS-EXCLUSIF (categories_exclude pour
// les posts, `!isTranslatedSlug` pour les pages — servent generateStaticParams
// et les listings FR) donc les réutiliser ici filtrait TOUT le contenu anglais,
// y compris celui déjà publié. On vérifie donc par slug avec
// `getPostBySlug`/`getPageBySlug`, qui sont neutres vis-à-vis de la langue
// (juste `status=publish`, déjà utilisés tels quels par les pages EN
// elles-mêmes) — un peu plus de requêtes, mais dédupliquées par requête via
// `cache()` et bornées par le limiteur de concurrence déjà en place.
import { getPostBySlug, getPageBySlug } from "./wp";

export async function livePostSlugs(slugs: string[]): Promise<Set<string>> {
  const uniq = [...new Set(slugs)];
  const found = await Promise.all(uniq.map(async (s) => ((await getPostBySlug(s)) ? s : null)));
  return new Set(found.filter((s): s is string => s !== null));
}

export async function livePageSlugs(slugs: string[]): Promise<Set<string>> {
  const uniq = [...new Set(slugs)];
  const found = await Promise.all(uniq.map(async (s) => ((await getPageBySlug(s)) ? s : null)));
  return new Set(found.filter((s): s is string => s !== null));
}
