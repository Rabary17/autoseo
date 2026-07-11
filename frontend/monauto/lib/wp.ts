// Fetch WP REST API — appelé UNIQUEMENT au build (generateStaticParams /
// composants serveur exécutés à `next build`), jamais depuis le navigateur.
// Export 100% statique (next.config.ts) : pas de revalidation runtime, un
// nouveau `npm run build` republie le site à chaque modification WordPress
// (voir docs/architecture-headless.md).
import type { Source, WpPage, WpPost, WpTerm, WpUser } from "./types";

const WP = process.env.WP_API_URL ?? "http://thermotowel.local/wp-json/wp/v2";

export class WpNotFound extends Error {}

async function wpFetch(path: string): Promise<Response> {
  const res = await fetch(WP + path);
  if (res.status === 404) throw new WpNotFound(path);
  if (!res.ok) throw new Error(`WP ${res.status} — ${path}`);
  return res;
}

const wpJson = async <T>(path: string): Promise<T> => (await wpFetch(path)).json();

/* ---------- Articles ---------- */

export async function getPosts(page = 1, perPage = 12, extra = "") {
  const res = await wpFetch(
    `/posts?_embed=1&status=publish&page=${page}&per_page=${perPage}${extra}`
  );
  return {
    posts: (await res.json()) as WpPost[],
    total: Number(res.headers.get("X-WP-Total") ?? 0),
    totalPages: Number(res.headers.get("X-WP-TotalPages") ?? 0),
  };
}

export async function getPostBySlug(slug: string): Promise<WpPost | null> {
  const posts = await wpJson<WpPost[]>(
    `/posts?slug=${encodeURIComponent(slug)}&_embed=1&status=publish`
  );
  return posts[0] ?? null;
}

export async function getPageBySlug(slug: string): Promise<WpPage | null> {
  const pages = await wpJson<WpPage[]>(
    `/pages?slug=${encodeURIComponent(slug)}&status=publish`
  );
  return pages[0] ?? null;
}

/* ---------- Taxonomies & auteurs ---------- */

export const getCategories = () =>
  wpJson<WpTerm[]>("/categories?per_page=100&hide_empty=false");

export async function getTermBySlug(
  tax: "categories" | "tags",
  slug: string
): Promise<WpTerm | null> {
  const terms = await wpJson<WpTerm[]>(`/${tax}?slug=${encodeURIComponent(slug)}`);
  return terms[0] ?? null;
}

export async function getAuthorBySlug(slug: string): Promise<WpUser | null> {
  const users = await wpJson<WpUser[]>(`/users?slug=${encodeURIComponent(slug)}`);
  return users[0] ?? null;
}

export const getPostsByAuthor = (id: number, page = 1) =>
  getPosts(page, 12, `&author=${id}`);
export const getPostsByCategory = (id: number, page = 1) =>
  getPosts(page, 12, `&categories=${id}`);
export const getPostsByTag = (id: number, page = 1) =>
  getPosts(page, 12, `&tags=${id}`);

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
