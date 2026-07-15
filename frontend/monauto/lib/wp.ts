// Fetch WP REST API — appelé côté serveur uniquement (generateStaticParams /
// composants serveur / route handlers), jamais depuis le navigateur.
// ISR (next.config.ts) : chaque page est mise en cache jusqu'à invalidation
// ciblée via /api/revalidate (voir docs/architecture-headless.md).
import type { FaqItem, Source, WpImage, WpPage, WpPost, WpTerm, WpUser } from "./types";
import * as http from "node:http";
import * as https from "node:https";

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
        const res = await rawGet(buildWpUrl(path));
        if (res.status === 404) throw new WpNotFound(path);
        if (!res.ok) {
          throw new Error(`WP ${res.status} — ${path}`);
        }
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

export async function getPosts(page = 1, perPage = 12, extra = "") {
  const res = await wpFetch(
    `/posts?_embed=1&status=publish&page=${page}&per_page=${perPage}${extra}`
  );
  const posts = ((await res.json()) as WpPost[]).map(decodeEmbeds);
  return {
    posts,
    total: Number(res.headers.get("X-WP-Total") ?? 0),
    totalPages: Number(res.headers.get("X-WP-TotalPages") ?? 0),
  };
}

// WP REST plafonne per_page à 100 — pour un sitemap ou generateStaticParams,
// il faut paginer plutôt que demander un per_page arbitrairement grand.
//
// Mise en cache mémoire (par process de build) : app/sitemap.ts, app/[slug]/page.tsx
// et app/auteur/[slug]/page.tsx appellent chacun getAllPosts() indépendamment.
// Sans cache, Next.js relance la même requête coûteuse (_embed=1, potentiellement
// plusieurs pages) en parallèle pour chacun — ce qui a fait planter (502) un
// hébergement mutualisé à faible capacité PHP-FPM/WAF. Un seul fetch est donc
// partagé entre tous les appelants d'un même build.
let allPostsCache: Promise<WpPost[]> | null = null;
export async function getAllPosts(): Promise<WpPost[]> {
  if (!allPostsCache) {
    allPostsCache = (async () => {
      const all: WpPost[] = [];
      let page = 1;
      while (true) {
        const { posts, totalPages } = await getPosts(page, 100);
        all.push(...posts);
        if (page >= totalPages) break;
        page += 1;
      }
      return all;
    })();
  }
  return allPostsCache;
}

export async function getPostBySlug(slug: string): Promise<WpPost | null> {
  const posts = await wpJson<WpPost[]>(
    `/posts?slug=${encodeURIComponent(slug)}&_embed=1&status=publish`
  );
  return posts[0] ? decodeEmbeds(posts[0]) : null;
}

export async function getPageBySlug(slug: string): Promise<WpPage | null> {
  const pages = await wpJson<WpPage[]>(
    `/pages?slug=${encodeURIComponent(slug)}&status=publish`
  );
  return pages[0] ?? null;
}

// Nécessaire pour generateStaticParams de app/[slug]/page.tsx : en export
// statique, dynamicParams est toujours false — toute page (WP "page", pas
// "post") absente de generateStaticParams renvoie une 500 au build.
export async function getAllPages(): Promise<WpPage[]> {
  return wpJson<WpPage[]>("/pages?per_page=100&status=publish");
}

/* ---------- Taxonomies & auteurs ---------- */

export const getCategories = async () =>
  (await wpJson<WpTerm[]>("/categories?per_page=100&hide_empty=false")).map(decodeTerm);

export async function getTermBySlug(
  tax: "categories" | "tags",
  slug: string
): Promise<WpTerm | null> {
  const terms = await wpJson<WpTerm[]>(`/${tax}?slug=${encodeURIComponent(slug)}`);
  return terms[0] ? decodeTerm(terms[0]) : null;
}

export async function getAuthorBySlug(slug: string): Promise<WpUser | null> {
  const users = await wpJson<WpUser[]>(`/users?slug=${encodeURIComponent(slug)}`);
  return users[0] ? decodeUser(users[0]) : null;
}

// Directement via /users (6 comptes auteur fixes) plutôt que de dériver la
// liste depuis getAllPosts() — évite un fetch coûteux (_embed=1, paginé) qui
// n'a de toute façon pas besoin de croître avec le nombre d'articles.
export async function getAllAuthors(): Promise<WpUser[]> {
  return (await wpJson<WpUser[]>("/users?per_page=100")).map(decodeUser);
}

export const getPostsByAuthor = (id: number, page = 1) =>
  getPosts(page, 12, `&author=${id}`);
export const getPostsByCategory = (id: number, page = 1) =>
  getPosts(page, 12, `&categories=${id}`);
export const getPostsByTag = (id: number, page = 1) =>
  getPosts(page, 12, `&tags=${id}`);

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
    const res = await wpFetch(`/pages?per_page=100&status=publish&page=${page}`);
    const pages = (await res.json()) as WpPage[];
    all.push(...pages);
    const totalPages = Number(res.headers.get("X-WP-TotalPages") ?? 0);
    if (page >= totalPages || pages.length === 0) break;
    page += 1;
  }
  return all;
}

// Tags réellement utilisés (hide_empty) — potentiellement > 100 à terme (2-5
// tags par article sur 10 000 articles), donc paginé comme getAllPosts.
export async function getAllTags(): Promise<WpTerm[]> {
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
}

/* ---------- Parsing des champs ACF texte (ACF Free : pas de Repeater) ---------- */

// "Libellé | URL" par ligne → [{ label, url }]
export function parseSources(raw?: string): Source[] {
  if (!raw) return [];
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [label, url] = line.split("|").map((s) => s.trim());
      return { label: label ?? line, url: url ?? "#" };
    });
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
  const variant = media.media_details?.sizes?.[size];
  if (variant) return { url: variant.source_url, width: variant.width, height: variant.height };
  return {
    url: media.source_url,
    width: media.media_details?.width ?? 1200,
    height: media.media_details?.height ?? 750,
  };
}
