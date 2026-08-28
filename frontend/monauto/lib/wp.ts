// Fetch WP REST API — appelé côté serveur uniquement (generateStaticParams /
// composants serveur / route handlers), jamais depuis le navigateur.
// ISR (next.config.ts) : chaque page est mise en cache jusqu'à invalidation
// ciblée via /api/revalidate (voir docs/architecture-headless.md).
import type { FaqItem, Source, WpImage, WpPage, WpPost, WpTerm, WpUser } from "./types";
import * as http from "node:http";
import * as https from "node:https";
import { cache } from "react";
import { unstable_cache } from "next/cache";
import { EXCLUDED_LOCALE_CATEGORIES, isTranslatedSlug } from "./i18n";

// Économiser les appels API WordPress (demande explicite de l'utilisateur,
// 2026-07-30) — deux mécanismes complémentaires, pas un seul :
// - `cache()` (React) déduplique DANS une même requête : generateMetadata()
//   et le composant de page appellent souvent getPostBySlug/getPageBySlug/etc.
//   avec le même argument — sans ça, chaque page article/hub payait 2 appels
//   WP identiques au lieu d'1. Ne persiste jamais entre deux requêtes.
// - `unstable_cache` (Next.js) persiste ENTRE requêtes, 15 min (comme le
//   `revalidate` déjà en place partout sur ce site) — réservé aux données
//   identiques quelle que soit la page (catégories, tags, auteurs, pages
//   statiques, tous les posts pour le sitemap) : sans ça, /archives/,
//   le header et chaque page catégorie refont chacun le même appel.
const REVALIDATE_SECONDS = 900;

// `fetch` global (patché par Next.js pour son Data Cache) ET même `undici`
// importé directement (Next patche le dispatcher global d'undici, pas
// seulement `globalThis.fetch`) provoquent des 502 systématiques sur
// l'hébergement WP de production — vérifié : un fetch/undici strictement
// identique réussit à tous les coups en dehors du process de build Next.js,
// et échoue à tous les coups depuis l'intérieur. On utilise donc le module
// `http(s)` natif de Node, complètement hors de portée de l'instrumentation
// de Next — voir docs/architecture-headless.md.
interface SimpleResponse {
  status: number;
  ok: boolean;
  json: () => Promise<unknown>;
  rawBody: string;
  headers: { get: (name: string) => string | null };
}

function rawGet(url: string): Promise<SimpleResponse> {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith("https:") ? https : http;
    const req = mod.get(url, { headers: { "User-Agent": "monauto-build/1.0" } }, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => {
        const status = res.statusCode ?? 0;
        const body = Buffer.concat(chunks).toString("utf-8");
        resolve({
          status,
          ok: status >= 200 && status < 300,
          json: async () => JSON.parse(body),
          rawBody: body,
          headers: {
            get: (name: string) => {
              const v = res.headers[name.toLowerCase()];
              return Array.isArray(v) ? (v[0] ?? null) : (v ?? null);
            },
          },
        });
      });
    });
    req.on("error", reject);
    req.setTimeout(6000, () => req.destroy(new Error(`timeout: ${url}`)));
  });
}

// Base = origine du site WP (pas le chemin /wp-json/wp/v2) : on interroge l'API
// via le format `?rest_route=/wp/v2/...` plutôt que le chemin `/wp-json/...`.
// Raison : certains hébergeurs (pare-feu type Wordfence, règles .htaccess de
// sécurité) bloquent spécifiquement le préfixe /wp-json/ alors que le
// paramètre rest_route= passe (c'est la même API WP, juste un autre point
// d'entrée natif du cœur WordPress) — voir docs/architecture-headless.md.
const WP_ORIGIN = (process.env.WP_API_URL ?? process.env.WP_URL ?? "http://thermotowel.local").replace(
  /\/wp-json\/wp\/v2\/?$/,
  ""
);

function buildWpUrl(path: string): string {
  const qIndex = path.indexOf("?");
  const resourcePath = qIndex === -1 ? path : path.slice(0, qIndex);
  const query = qIndex === -1 ? "" : path.slice(qIndex + 1);
  const restRoute = `/wp/v2${resourcePath}`;
  return `${WP_ORIGIN}/?rest_route=${restRoute}${query ? `&${query}` : ""}`;
}

export class WpNotFound extends Error {}

// Limiteur de concurrence : Next.js génère les pages du build dans plusieurs
// workers en parallèle, ce qui peut envoyer beaucoup de requêtes wp-json en
// même temps. Un serveur local (Local by Flywheel, PHP-FPM à faible
// concurrence) sature et referme des connexions au-delà d'un certain nombre
// de requêtes simultanées — une vraie instance WP de production tiendrait
// sans doute plus, mais cette limite ne coûte rien en prod (c'est juste du
// séquencement) et rend le build robuste partout.
const MAX_CONCURRENT = 2;
let active = 0;
const queue: Array<() => void> = [];

async function withConcurrencyLimit<T>(fn: () => Promise<T>): Promise<T> {
  if (active >= MAX_CONCURRENT) {
    await new Promise<void>((resolve) => queue.push(resolve));
  }
  active += 1;
  try {
    return await fn();
  } finally {
    active -= 1;
    queue.shift()?.();
  }
}

// Retry avec backoff court : sur l'hébergement actuel, une requête WP répond
// vite dans un sens comme dans l'autre (200 ou 502 en 1-2s, jamais un vrai
// timeout réseau) — un backoff long ne "répare" rien et ne fait que retarder
// le fallback gracieux (generateStaticParams / pages, voir app/[slug]/page.tsx)
// jusqu'à dépasser le timeout de build de Next.js (60s/page). 2 tentatives
// suffisent : la 3e chance n'aide pas plus qu'un fallback rapide.
async function wpFetch(path: string, retries = 2): Promise<SimpleResponse> {
  return withConcurrencyLimit(async () => {
    let lastErr: unknown;
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        if (process.env.DEBUG_WP_URLS === "1") console.log("[wp]", path);
        const res = await rawGet(buildWpUrl(path));
        if (res.status === 404) throw new WpNotFound(path);
        if (!res.ok) {
          throw new Error(`WP ${res.status} — ${path}`);
        }
        // Cet hébergement renvoie parfois un corps vide avec un statut 200
        // quand PHP-FPM sature (voir SAFE_EMBED_PAGE_SIZE/SAFE_PAGE_SIZE) —
        // sans ce contrôle, la boucle de retry ne se déclenche jamais et
        // l'échec ne surgit qu'au .json() de l'appelant, hors retry.
        if (res.rawBody.length === 0) throw new Error(`WP réponse vide (200) — ${path}`);
        return res;
      } catch (e) {
        if (e instanceof WpNotFound) throw e;
        lastErr = e;
        if (attempt < retries) await new Promise((r) => setTimeout(r, 500));
      }
    }
    throw lastErr;
  });
}

const wpJson = async <T>(path: string): Promise<T> => (await wpFetch(path)).json() as Promise<T>;

// WordPress encode les entités HTML dans les champs "texte brut" des
// taxonomies/utilisateurs (name, description) — contrairement à title.rendered
// / content.rendered qui sont destinés à dangerouslySetInnerHTML (le navigateur
// décode déjà les entités dans du HTML). Ici on décode pour un affichage en
// texte simple (ex. "Entretien &amp; révision" → "Entretien & révision").
const ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#039;": "'",
  "&nbsp;": " ",
  "&rsquo;": "’",
  "&lsquo;": "‘",
  "&rdquo;": "”",
  "&ldquo;": "“",
  "&hellip;": "…",
  "&mdash;": "—",
  "&ndash;": "–",
};
const ENTITY_PATTERN = new RegExp(Object.keys(ENTITIES).join("|"), "g");
// Exporté : réutilisé pour les meta description (title.rendered/content.rendered
// sont eux affichés via dangerouslySetInnerHTML, le navigateur décode déjà les
// entités dans du HTML — mais une meta description est un attribut texte brut,
// pas du HTML, donc il faut décoder ici pour éviter un double-encodage
// (ex. "d&rsquo;huile" → "d&amp;rsquo;huile" sinon).
export const decodeEntities = (s?: string) => (s ? s.replace(ENTITY_PATTERN, (m) => ENTITIES[m]) : (s ?? ""));

function decodeTerm(term: WpTerm): WpTerm {
  return { ...term, name: decodeEntities(term.name), description: decodeEntities(term.description) };
}

function decodeUser(user: WpUser): WpUser {
  return { ...user, name: decodeEntities(user.name), description: decodeEntities(user.description) };
}

function decodeEmbeds(post: WpPost): WpPost {
  return {
    ...post,
    _embedded: post._embedded && {
      ...post._embedded,
      author: post._embedded.author?.map(decodeUser),
      "wp:term": post._embedded["wp:term"]?.map((group) => group.map(decodeTerm)),
    },
  };
}

/* ---------- Articles ---------- */

// per_page=100 avec _embed=1 fait planter cet hébergement dès qu'il doit
// réellement embarquer plus d'une quinzaine de posts dans la réponse (PHP-FPM
// sature et renvoie un corps vide avec un statut 200 malgré tout — vérifié en
// direct : per_page<=15 passe systématiquement, >=16 échoue systématiquement,
// ce n'est pas un aléa réseau qu'un simple retry suffit à corriger). 10 reste
// une marge de sécurité confortable sous ce seuil mesuré. Tous les appelants
// (archives 30/page, sous-hub 30/page, accueil 16, etc.) veulent garder leur
// pagination "logique" inchangée : getPosts fenêtre donc en interne sur des
// requêtes WP de taille sûre et recolle les résultats, de façon transparente.
const SAFE_EMBED_PAGE_SIZE = 10;

// Exclusion des traductions de TOUTES les requêtes françaises (2026-08-21).
//
// Français et traductions partagent le même espace WordPress : sans cette
// exclusion, un article anglais publié apparaîtrait sur l'accueil, dans
// /archives/, /tag/*, /auteur/*, /recherche ET le sitemap français.
//
// L'exclusion est faite CÔTÉ REQUÊTE (`categories_exclude`), pas après coup :
// `getPosts` renvoie aussi `total` et `totalPages`, qui pilotent la pagination.
// Filtrer le résultat sans corriger les compteurs donnerait des pages
// incomplètes et une dernière page vide. Le marqueur est posé par
// scripts/i18n/tag-locale-category.js.
function exclusionTraductions(): string {
  const ids = Object.values(EXCLUDED_LOCALE_CATEGORIES);
  return ids.length ? `&categories_exclude=${ids.join(",")}` : "";
}

// Mis en cache via unstable_cache (2026-08-28) : cette fonction utilise le
// module `http(s)` natif, jamais `fetch()` (voir plus haut) — donc invisible
// pour le Data Cache de Next.js, qui n'instrumente que `fetch()`. Sans ça,
// une page qui lit `searchParams` (archives, recherche...) est rendue
// dynamiquement à CHAQUE requête (`Cache-Control: no-store` constaté en
// prod), et refaisait donc le fenêtrage WP en entier à chaque visite, y
// compris pour deux visiteurs consécutifs sur la même page — /archives/
// mesuré à 7-8s de chargement total. `unstable_cache` fonctionne
// indépendamment du rendu dynamique de la route : la DONNÉE est réutilisée
// pendant REVALIDATE_SECONDS même si la page elle-même est re-rendue à
// chaque fois. Même principe déjà en place pour getAllPosts/getAllPages/
// getCategories/getAllAuthors — jamais étendu à getPosts jusqu'ici, alors
// que c'est la fonction la plus visitée (accueil, archives, sous-hub,
// catégorie, auteur, tag, recherche).
export const getPosts = unstable_cache(async (page = 1, perPage = 12, extra = "") => {
  extra = `${extra}${exclusionTraductions()}`;
  const offset = (page - 1) * perPage;
  const firstWpPage = Math.floor(offset / SAFE_EMBED_PAGE_SIZE) + 1;
  const lastWpPage = Math.floor((offset + perPage - 1) / SAFE_EMBED_PAGE_SIZE) + 1;

  // Fenêtres demandées EN PARALLÈLE (2026-08-28), plus en séquence : le jeu de
  // pages WP à demander est connu d'avance, aucune fenêtre ne dépend du
  // résultat de la précédente pour savoir QUOI demander (contrairement à
  // getAllPosts/getAllPages, qui apprennent totalPages au fil de l'eau — pas
  // touchés ici). Toujours borné par le même limiteur de concurrence que le
  // reste de ce fichier (MAX_CONCURRENT), déjà éprouvé sûr sur cet
  // hébergement : ça ne change pas la pression sur PHP-FPM, juste le temps
  // d'attente perçu par le visiteur/Googlebot. Régression mesurée dans
  // l'export Search Console du 25/08 : temps de réponse moyen passé de
  // ~250ms à ~1200ms le jour même de l'introduction du fenêtrage séquentiel
  // (2026-08-05, commit 81ce6a5, nécessaire pour corriger un bug plus grave —
  // voir ce commit) — resté élevé depuis, jamais reparallélisé jusqu'ici.
  //
  // `lastWpPage` peut viser une fenêtre WP qui n'existe pas réellement (ex.
  // perPage=30 mais seulement 15 posts au total : lastWpPage=3 alors que la
  // page 2 est déjà la dernière) — la version séquentielle l'évitait via un
  // arrêt anticipé quand une fenêtre revenait plus courte que prévu, possible
  // uniquement parce qu'elle attendait le résultat d'une fenêtre avant de
  // décider de la suivante. En parallèle cette information n'existe pas
  // encore : `allSettled` tolère donc l'échec (page hors plage = 400 WP) de
  // toute fenêtre AU-DELÀ de la première comme "fin de la collection", mais
  // laisse remonter un échec réel de la première fenêtre (jamais silencieux).
  const wpPages = Array.from({ length: lastWpPage - firstWpPage + 1 }, (_, i) => firstWpPage + i);
  const outcomes = await Promise.allSettled(
    wpPages.map((wpPage) =>
      wpFetch(`/posts?_embed=1&status=publish&page=${wpPage}&per_page=${SAFE_EMBED_PAGE_SIZE}${extra}`)
    )
  );
  if (outcomes[0].status === "rejected") throw outcomes[0].reason;

  let total = 0;
  const collected: WpPost[] = [];
  for (const outcome of outcomes) {
    if (outcome.status === "rejected") continue; // fenêtre hors plage, fin de collection
    const batch = ((await outcome.value.json()) as WpPost[]).map(decodeEmbeds);
    total = Number(outcome.value.headers.get("X-WP-Total") ?? 0);
    collected.push(...batch);
  }

  const startInBatch = offset - (firstWpPage - 1) * SAFE_EMBED_PAGE_SIZE;
  return {
    posts: collected.slice(startInBatch, startInBatch + perPage),
    total,
    totalPages: Math.ceil(total / perPage),
  };
}, ["wp-posts"], { revalidate: REVALIDATE_SECONDS });

// WP REST plafonne per_page à 100 — pour un sitemap ou generateStaticParams,
// il faut paginer plutôt que demander un per_page arbitrairement grand.
//
// Mise en cache mémoire (par process de build) : app/sitemap.ts, app/[slug]/page.tsx
// et app/auteur/[slug]/page.tsx appellent chacun getAllPosts() indépendamment.
// Sans cache, Next.js relance la même requête coûteuse (_embed=1, potentiellement
// plusieurs pages) en parallèle pour chacun — ce qui a fait planter (502) un
// hébergement mutualisé à faible capacité PHP-FPM/WAF. `unstable_cache`
// persiste le résultat 15 min ENTRE requêtes (pas seulement pour la durée
// d'un build) — sitemap.ts, generateStaticParams et la page auteur en
// bénéficient tous les trois sans se marcher dessus. getPosts fenêtre déjà en
// interne sur du SAFE_EMBED_PAGE_SIZE ; demander directement cette taille ici
// évite un fenêtrage pour rien (offset toujours aligné).
export const getAllPosts = unstable_cache(
  async (): Promise<WpPost[]> => {
    const all: WpPost[] = [];
    let page = 1;
    while (true) {
      const { posts, totalPages } = await getPosts(page, SAFE_EMBED_PAGE_SIZE);
      all.push(...posts);
      if (page >= totalPages) break;
      page += 1;
    }
    return all;
  },
  ["wp-all-posts"],
  { revalidate: REVALIDATE_SECONDS }
);

// cache() (React) : generateMetadata() ET le composant de page appellent
// tous les deux getPostBySlug/getPageBySlug avec le même slug — sans ce
// wrapper, chaque page article/hub déclenchait 2 appels WP identiques.
export const getPostBySlug = cache(async (slug: string): Promise<WpPost | null> => {
  const posts = await wpJson<WpPost[]>(
    `/posts?slug=${encodeURIComponent(slug)}&_embed=1&status=publish`
  );
  return posts[0] ? decodeEmbeds(posts[0]) : null;
});

export const getPageBySlug = cache(async (slug: string): Promise<WpPage | null> => {
  const pages = await wpJson<WpPage[]>(
    `/pages?slug=${encodeURIComponent(slug)}&_embed=1&status=publish`
  );
  return pages[0] ?? null;
});

// Pages enfants d'une autre page (hiérarchie native WP `parent`) — sert à
// lister les sous-hubs d'un hub en cards avec image : contrairement aux
// articles, les pages hub/sous-hub ne portent pas la taxonomie `category`
// (voir mu-plugins/monauto-headless.php, non enregistrée pour ce post type),
// donc c'est `parent` qui fait foi ici, pas `categories`.
export async function getChildPages(parentId: number): Promise<WpPage[]> {
  return wpJson<WpPage[]>(`/pages?parent=${parentId}&per_page=100&_embed=1&status=publish&orderby=menu_order&order=asc`);
}

// per_page=100 (sans même _embed) fait déjà planter cet hébergement au-delà
// d'une trentaine de pages renvoyées (contenu hub/sous-hub volumineux) — voir
// SAFE_EMBED_PAGE_SIZE plus haut pour le même constat sur /posts. Le nombre
// de pages (137 à ce jour) dépasse de toute façon 100 : un seul appel per_page=100
// perdait déjà silencieusement les pages au-delà de la première page de
// résultats, en plus de planter — il faut paginer, pas juste réduire per_page.
const SAFE_PAGE_SIZE = 20;

// Nécessaire pour generateStaticParams de app/[slug]/page.tsx : en export
// statique, dynamicParams est toujours false — toute page (WP "page", pas
// "post") absente de generateStaticParams renvoie une 500 au build.
export const getAllPages = unstable_cache(
  async (): Promise<WpPage[]> => {
    const all: WpPage[] = [];
    let page = 1;
    while (true) {
      const res = await wpFetch(`/pages?per_page=${SAFE_PAGE_SIZE}&status=publish&page=${page}`);
      const pages = (await res.json()) as WpPage[];
      // Alimente generateStaticParams de /[slug]/ : sans ce filtrage, une page
      // de rubrique ANGLAISE serait pre-generee a `/motorhomes-campervans/`,
      // donc dans l'espace de noms francais et sans prefixe /en/. Les pages WP
      // n'ayant pas de categorie, l'exclusion se fait par slug via l'index.
      all.push(...pages.filter((pg) => !isTranslatedSlug(pg.slug)));
      const totalPages = Number(res.headers.get("X-WP-TotalPages") ?? 0);
      if (page >= totalPages || pages.length === 0) break;
      page += 1;
    }
    return all;
  },
  ["wp-all-pages"],
  { revalidate: REVALIDATE_SECONDS }
);

/* ---------- Taxonomies & auteurs ---------- */

// Identiques quelle que soit la page qui les demande (header, /archives/,
// sidebar hub, pages catégorie...) — unstable_cache leur évite de refaire le
// même appel WP à chaque page/requête différente.
export const getCategories = unstable_cache(
  async () => (await wpJson<WpTerm[]>("/categories?per_page=100&hide_empty=false")).map(decodeTerm),
  ["wp-all-categories"],
  { revalidate: REVALIDATE_SECONDS }
);

export const getTermBySlug = cache(
  async (tax: "categories" | "tags", slug: string): Promise<WpTerm | null> => {
    const terms = await wpJson<WpTerm[]>(`/${tax}?slug=${encodeURIComponent(slug)}`);
    return terms[0] ? decodeTerm(terms[0]) : null;
  }
);

export const getCategoryById = cache(async (id: number): Promise<WpTerm | null> => {
  try {
    const term = await wpJson<WpTerm>(`/categories/${id}`);
    return decodeTerm(term);
  } catch {
    return null;
  }
});

// Sous-cocons d'un silo = catégories enfants (parent=id) — hiérarchie réelle
// créée à la publication par resolveCategoryId() (scripts/autopublish/run.js),
// jamais exploitée côté frontend jusqu'ici (voir app/[slug]/page.tsx et
// app/categorie/[slug]/page.tsx : le module "sous-rubriques" n'affichait que
// du texte statique tiré de data/taxonomy.json). hide_empty=false pour lister
// aussi les sous-cocons sans encore aucun article publié.
export async function getChildCategories(parentId: number): Promise<WpTerm[]> {
  return (
    await wpJson<WpTerm[]>(`/categories?parent=${parentId}&per_page=100&hide_empty=false`)
  ).map(decodeTerm);
}

export const getAuthorBySlug = cache(async (slug: string): Promise<WpUser | null> => {
  const users = await wpJson<WpUser[]>(`/users?slug=${encodeURIComponent(slug)}`);
  return users[0] ? decodeUser(users[0]) : null;
});

// Directement via /users (6 comptes auteur fixes) plutôt que de dériver la
// liste depuis getAllPosts() — évite un fetch coûteux (_embed=1, paginé) qui
// n'a de toute façon pas besoin de croître avec le nombre d'articles.
export const getAllAuthors = unstable_cache(
  async (): Promise<WpUser[]> => (await wpJson<WpUser[]>("/users?per_page=100")).map(decodeUser),
  ["wp-all-authors"],
  { revalidate: REVALIDATE_SECONDS }
);

export const getPostsByAuthor = (id: number, page = 1) =>
  getPosts(page, 12, `&author=${id}`);
export const getPostsByCategory = (id: number, page = 1, perPage = 12) =>
  getPosts(page, perPage, `&categories=${id}`);
export const getPostsByTag = (id: number, page = 1, perPage = 12) =>
  getPosts(page, perPage, `&tags=${id}`);

// Recherche plein texte WP native (paramètre core `search`) — même forme de
// retour (posts/total/totalPages) que getPosts, réutilisable telle quelle par
// la page de résultats ET par la route API de recherche instantanée.
export const searchPosts = (query: string, page = 1, perPage = 10) =>
  getPosts(page, perPage, `&search=${encodeURIComponent(query)}`);

// Toutes les pages, potentiellement > 100 (per_page max de WP REST) — même
// pattern de pagination que getAllPosts, nécessaire pour un sitemap complet
// et fiable même quand le nombre de pages statiques grandit.
export async function getAllPagesFull(): Promise<WpPage[]> {
  const all: WpPage[] = [];
  let page = 1;
  while (true) {
    const res = await wpFetch(`/pages?per_page=${SAFE_PAGE_SIZE}&status=publish&page=${page}`);
    const pages = (await res.json()) as WpPage[];
    // Les PAGES WordPress n'ont pas de catégorie : l'exclusion par
    // `categories_exclude` ne s'y applique pas. On filtre donc par slug, via
    // l'index des traductions — sinon les hubs/sous-hubs anglais entreraient
    // dans le sitemap français.
    all.push(...pages.filter((pg) => !isTranslatedSlug(pg.slug)));
    const totalPages = Number(res.headers.get("X-WP-TotalPages") ?? 0);
    if (page >= totalPages || pages.length === 0) break;
    page += 1;
  }
  return all;
}

// Tags réellement utilisés (hide_empty) — potentiellement > 100 à terme (2-5
// tags par article sur 10 000 articles), donc paginé comme getAllPosts.
// Mis en cache (2026-08-28, même raison que getPosts juste au-dessus) :
// jamais caché jusqu'ici alors qu'/archives/ l'appelle à chaque visite.
export const getAllTags = unstable_cache(async (): Promise<WpTerm[]> => {
  const all: WpTerm[] = [];
  let page = 1;
  while (true) {
    const res = await wpFetch(`/tags?per_page=100&hide_empty=true&page=${page}`);
    const terms = ((await res.json()) as WpTerm[]).map(decodeTerm);
    all.push(...terms);
    const totalPages = Number(res.headers.get("X-WP-TotalPages") ?? 0);
    if (page >= totalPages || terms.length === 0) break;
    page += 1;
  }
  return all;
}, ["wp-all-tags"], { revalidate: REVALIDATE_SECONDS });

/* ---------- Parsing des champs ACF texte (ACF Free : pas de Repeater) ---------- */

// Un nom de source par ligne → [{ label }]. Ces sources ne sont jamais
// vérifiées indépendamment, donc jamais transformées en lien cliquable
// (décision du 2026-08-03) — seul le nom est affiché, jamais d'URL. Tolère
// l'ancien format "Libellé | URL" (posts publiés avant ce changement) en ne
// gardant que la partie avant le "|", pour ne pas afficher l'URL brute en
// texte sur les articles déjà en ligne.
export function parseSources(raw?: string): Source[] {
  if (!raw) return [];
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => ({ label: line.split("|")[0].trim() }));
}

// Une URL par ligne → string[]
export function parseSameAs(raw?: string): string[] {
  if (!raw) return [];
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

// "Question ? | Réponse." par ligne → [{ question, answer }]
export function parseFaq(raw?: string): FaqItem[] {
  if (!raw) return [];
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [question, answer] = line.split("|").map((s) => s.trim());
      return { question: question ?? line, answer: answer ?? "" };
    })
    .filter((item) => item.answer);
}

/* ---------- Sélection de la bonne taille d'image ---------- */

// WordPress ne génère une taille custom que si l'original est assez grand
// pour la couvrir (jamais d'agrandissement) — repli sur "full" sinon, qui
// reste alors la meilleure taille disponible. Voir
// wp-content/mu-plugins/monauto-headless.php section 0 pour les tailles
// enregistrées (monauto_card, monauto_hero) et docs/architecture-headless.md
// section 9 pour le détail des mesures ayant fixé ces dimensions.
export function getImageVariant(media: WpImage | undefined, size: "monauto_card" | "monauto_hero") {
  if (!media) return undefined;
  const alt = media.alt_text || "";
  const variant = media.media_details?.sizes?.[size];
  if (variant) return { url: variant.source_url, width: variant.width, height: variant.height, alt };
  return {
    url: media.source_url,
    width: media.media_details?.width ?? 1200,
    height: media.media_details?.height ?? 750,
    alt,
  };
}
