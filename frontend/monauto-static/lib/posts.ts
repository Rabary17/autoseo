// Lecture des articles (content/posts/*.md) et pages hub/sous-hub
// (content/hubs/*.md) — gray-matter + marked, pas de CMS (migration
// WordPress → Markdown, 2026-11-20). Même contrat que techno-play.com /
// besthomeproject.com (lib/posts.ts), adapté pour un deuxième type de
// contenu (les hubs).
import fs from "fs";
import path from "path";
import matter from "gray-matter";
import { marked } from "marked";
import { getCategory } from "./categories";

const POSTS_DIR = path.join(process.cwd(), "content", "posts");
const HUBS_DIR = path.join(process.cwd(), "content", "hubs");

export type Post = {
  slug: string;
  title: string;
  description: string;
  date: string;
  author?: string;
  category?: string;
  image?: string;
  imageAlt?: string;
  wpId?: number;
  locale: "fr" | "en";
  contentHtml: string;
};

export type Hub = {
  slug: string;
  title: string;
  description: string;
  date: string;
  parentWpId?: number;
  parentSlug?: string;
  image?: string;
  imageAlt?: string;
  wpId?: number;
  locale: "fr" | "en";
  contentHtml: string;
};

function lireFichier<T extends Record<string, unknown>>(
  dossier: string,
  nomFichier: string,
  construire: (slug: string, data: matter.GrayMatterFile<string>["data"], contentHtml: string) => T
): T {
  const slug = nomFichier.replace(/\.md$/, "");
  const brut = fs.readFileSync(path.join(dossier, nomFichier), "utf8");
  const { data, content } = matter(brut);
  const contentHtml = marked.parse(content, { async: false }) as string;
  return construire(slug, data, contentHtml);
}

function versPost(slug: string, data: Record<string, unknown>, contentHtml: string): Post {
  return {
    slug,
    title: String(data.title ?? slug),
    description: String(data.description ?? ""),
    date: String(data.date ?? ""),
    author: data.author ? String(data.author) : undefined,
    category: data.category ? String(data.category) : undefined,
    image: data.image ? String(data.image) : undefined,
    imageAlt: data.imageAlt ? String(data.imageAlt) : undefined,
    wpId: data.wp_id ? Number(data.wp_id) : undefined,
    locale: data.wp_locale === "en" ? "en" : "fr",
    contentHtml,
  };
}

export function getAllPosts(): Post[] {
  if (!fs.existsSync(POSTS_DIR)) return [];
  return fs
    .readdirSync(POSTS_DIR)
    .filter((f) => f.endsWith(".md"))
    .map((f) => lireFichier(POSTS_DIR, f, versPost))
    .sort((a, b) => (a.date < b.date ? 1 : -1));
}

export function getPostBySlug(slug: string): Post | undefined {
  const fichier = path.join(POSTS_DIR, `${slug}.md`);
  if (!fs.existsSync(fichier)) return undefined;
  return lireFichier(POSTS_DIR, `${slug}.md`, versPost);
}

export function getPostsByAuthor(authorSlug: string): Post[] {
  return getAllPosts().filter((p) => p.author === authorSlug);
}

export function getPostsByCategory(categorySlug: string): Post[] {
  return getAllPosts().filter((p) => p.category === categorySlug);
}

// Les hubs référencent leur parent par l'ID WordPress (`parent:`), pas par
// slug — on résout une fois pour toutes via la table wp_id -> slug construite
// depuis tous les hubs déjà lus (hiérarchie native WordPress `parent`).
export function getAllHubs(): Hub[] {
  if (!fs.existsSync(HUBS_DIR)) return [];
  const bruts = fs.readdirSync(HUBS_DIR).filter((f) => f.endsWith(".md"));
  const partiels = bruts.map((f) =>
    lireFichier(HUBS_DIR, f, (slug, data, contentHtml): Omit<Hub, "parentSlug"> => ({
      slug,
      title: String(data.title ?? slug),
      description: String(data.description ?? ""),
      date: String(data.date ?? ""),
      parentWpId: data.parent ? Number(data.parent) : undefined,
      image: data.image ? String(data.image) : undefined,
      imageAlt: data.imageAlt ? String(data.imageAlt) : undefined,
      wpId: data.wp_id ? Number(data.wp_id) : undefined,
      locale: data.wp_locale === "en" ? "en" : "fr",
      contentHtml,
    }))
  );
  const slugParWpId = new Map(partiels.filter((h) => h.wpId).map((h) => [h.wpId, h.slug]));
  return partiels
    .map((h) => ({ ...h, parentSlug: h.parentWpId ? slugParWpId.get(h.parentWpId) : undefined }))
    .sort((a, b) => (a.date < b.date ? 1 : -1));
}

export function getHubBySlug(slug: string): Hub | undefined {
  return getAllHubs().find((h) => h.slug === slug);
}

export function getChildHubs(parentSlug: string): Hub[] {
  return getAllHubs().filter((h) => h.parentSlug === parentSlug);
}

/** Image à la une — absente (pas de repli générique) plutôt qu'une icône
 * d'image cassée pour les quelques articles sans média à la une. */
export function resolveCoverImage(item: { image?: string; imageAlt?: string; title: string }): {
  src?: string;
  alt: string;
} {
  if (item.image) return { src: item.image, alt: item.imageAlt || item.title };
  return { alt: item.title };
}

/** Extrait les FAQ "## Questions fréquentes" / "### Question" du HTML rendu —
 * même convention que techno-play.com/besthomeproject.com, pour le schema
 * FAQPage. */
export function extraireFaq(contentHtml: string): { question: string; answer: string }[] {
  const faq: { question: string; answer: string }[] = [];
  const sectionMatch = contentHtml.match(/<h2[^>]*>\s*Questions fréquentes\s*<\/h2>([\s\S]*)$/i);
  if (!sectionMatch) return faq;
  const bloc = sectionMatch[1];
  const questions = [...bloc.matchAll(/<h3[^>]*>(.*?)<\/h3>([\s\S]*?)(?=<h3[^>]*>|<h2[^>]*>|$)/gi)];
  for (const q of questions) {
    const question = q[1].replace(/<[^>]+>/g, "").trim();
    const answer = q[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    if (question && answer) faq.push({ question, answer });
  }
  return faq;
}
