// Internationalisation côté frontend (2026-08-21).
//
// ============================ CONCEPTION ============================
// Le français N'A PAS de préfixe d'URL : les 94 articles déjà indexés gardent
// leur URL (`/vidange-guide/`), et les traductions vivent sous `/en/`.
//
// Conséquence contre-intuitive par rapport à la doc Next.js : le segment
// dynamique `[locale]` recommandé partout est IMPOSSIBLE ici.
// `app/[locale]/page.tsx` et `app/[slug]/page.tsx` seraient deux segments
// dynamiques frères au même niveau — Next.js ne peut pas les distinguer, et
// il faudrait préfixer le français aussi, donc casser toutes les URLs déjà
// indexées. D'où un sous-arbre LITTÉRAL `app/en/`, qui ne touche à aucune
// route existante.
//
// Deuxième conséquence, plus dangereuse : français et anglais partagent le même
// espace de noms WordPress. `getAllPosts()` renvoie TOUT sans distinction de
// langue. Sans filtrage, un article anglais publié apparaîtrait sur l'accueil
// française, dans /archives/, les pages auteur, les tags, la recherche et le
// sitemap français. C'est le rôle de `isTranslatedSlug` / `filterFrench`.
//
// Source de vérité : `data/i18n-index.json`, copié depuis `data/i18n/index.json`
// par `scripts/i18n/sync-frontend.js` à chaque lot de traduction. Lecture
// locale, aucun appel réseau pour construire les hreflang.
// ====================================================================
import indexData from "@/data/i18n-index.json";
import configData from "@/data/i18n-config.json";

interface TraductionArticle {
  slug: string;
  wp_id: number | null;
  titre: string;
  statut: string;
  traduit_le: string | null;
  /** Slug FRANÇAIS du silo d'appartenance — porté par l'index, jamais deviné. */
  silo?: string | null;
}
interface TraductionSousCocon {
  slug: string;
  nom: string;
  wp_id?: number | null;
  statut?: string;
}
interface TaxonomieLocale {
  slug: string;
  nom: string;
  wp_id?: number | null;
  sous_cocons: Record<string, TraductionSousCocon>;
}

const INDEX = indexData as {
  articles?: Record<string, Record<string, TraductionArticle>>;
  taxonomie?: Record<string, Record<string, TaxonomieLocale>>;
};
const CONFIG = configData as {
  defaut: string;
  locales: Record<string, { hreflang: string; nom: string; prefixe_url: string | null }>;
  hreflang_x_default: string;
  categories_marqueur?: Record<string, number>;
};

/**
 * Catégories WordPress qui marquent la langue d'un contenu, à exclure de toute
 * requête française (voir lib/wp.ts::exclusionTraductions et
 * scripts/i18n/tag-locale-category.js). Sert UNIQUEMENT au filtrage, jamais à
 * l'affichage : les listings traduits sont construits depuis l'index.
 */
export const EXCLUDED_LOCALE_CATEGORIES: Record<string, number> =
  CONFIG.categories_marqueur ?? {};

export const DEFAULT_LOCALE = CONFIG.defaut;

export function urlPrefix(locale: string): string {
  const p = CONFIG.locales[locale]?.prefixe_url;
  return p ? `/${p}` : "";
}
export function hreflangCode(locale: string): string {
  return CONFIG.locales[locale]?.hreflang ?? locale;
}
export function localeName(locale: string): string {
  return CONFIG.locales[locale]?.nom ?? locale;
}

/* ---------------- Ce qui est réellement servable ---------------- */

// Une traduction n'est servie que si elle est publiable. Deux cas l'excluent :
// `exclu_france_uniquement` (contenu réservé aux résidents français, conservé en
// brouillon mais jamais publié) et l'absence de `wp_id` (slug réservé, contenu
// jamais inséré).
function estServable(t: TraductionArticle | undefined): boolean {
  return !!t && !!t.wp_id && t.statut !== "exclu_france_uniquement";
}

export interface ArticleTraduit {
  locale: string;
  frSlug: string;
  slug: string;
  titre: string;
  siloFr: string;
}

/** slug traduit -> métadonnées */
const PAR_SLUG_TRADUIT = new Map<string, ArticleTraduit>();
/** frSlug -> locale -> métadonnées */
const PAR_SLUG_FR = new Map<string, Map<string, ArticleTraduit>>();

for (const [frSlug, byLocale] of Object.entries(INDEX.articles ?? {})) {
  for (const [locale, t] of Object.entries(byLocale)) {
    if (!estServable(t) || !t.silo) continue;
    const entry: ArticleTraduit = {
      locale,
      frSlug,
      slug: t.slug,
      titre: t.titre,
      siloFr: t.silo,
    };
    if (!PAR_SLUG_FR.has(frSlug)) PAR_SLUG_FR.set(frSlug, new Map());
    PAR_SLUG_FR.get(frSlug)!.set(locale, entry);
    PAR_SLUG_TRADUIT.set(t.slug, entry);
  }
}

/** Locales réellement servies : celles qui ont au moins un contenu servable. */
export const SERVED_LOCALES = [...new Set([...PAR_SLUG_TRADUIT.values()].map((t) => t.locale))];

/* ---------------- Taxonomie traduite ---------------- */

export interface SiloTraduit {
  siloFr: string;
  slug: string;
  nom: string;
  sousCocons: { frSlug: string; slug: string; nom: string }[];
}

const TAXONOMIE_PAR_LOCALE = new Map<string, SiloTraduit[]>();
for (const [siloFr, byLoc] of Object.entries(INDEX.taxonomie ?? {})) {
  for (const [locale, taxo] of Object.entries(byLoc)) {
    if (!taxo?.wp_id) continue; // hub non inséré : le silo n'est pas servable
    if (!TAXONOMIE_PAR_LOCALE.has(locale)) TAXONOMIE_PAR_LOCALE.set(locale, []);
    TAXONOMIE_PAR_LOCALE.get(locale)!.push({
      siloFr,
      slug: taxo.slug,
      nom: taxo.nom,
      sousCocons: Object.entries(taxo.sous_cocons ?? {})
        .filter(([, sc]) => !!sc.wp_id)
        .map(([frSlug, sc]) => ({ frSlug, slug: sc.slug, nom: sc.nom })),
    });
  }
}

export function silosFor(locale: string): SiloTraduit[] {
  return TAXONOMIE_PAR_LOCALE.get(locale) ?? [];
}
export function siloBySlug(locale: string, slug: string): SiloTraduit | null {
  return silosFor(locale).find((s) => s.slug === slug) ?? null;
}
/** Slug traduit du silo dont la source française est `siloFr`. */
function siloSlugFromFr(locale: string, siloFr: string): string | null {
  return silosFor(locale).find((s) => s.siloFr === siloFr)?.slug ?? null;
}

/* ---------------- Résolution d'un chemin traduit ---------------- */

/** Le slug est-il un sous-cocon traduit de ce silo ? */
export function sousCoconTraduit(locale: string, siloSlug: string, slug: string) {
  return siloBySlug(locale, siloSlug)?.sousCocons.find((sc) => sc.slug === slug) ?? null;
}

/** Le slug est-il un article traduit servable dans cette locale ? */
export function articleTraduit(locale: string, slug: string): ArticleTraduit | null {
  const t = PAR_SLUG_TRADUIT.get(slug);
  return t && t.locale === locale ? t : null;
}

/** Tous les articles servables d'une locale (generateStaticParams, sitemap). */
export function articlesFor(locale: string): ArticleTraduit[] {
  return [...PAR_SLUG_TRADUIT.values()].filter((t) => t.locale === locale);
}

/** Chemin public d'un article traduit, avec slash final. */
export function pathForArticle(t: ArticleTraduit): string | null {
  const silo = siloSlugFromFr(t.locale, t.siloFr);
  if (!silo) return null;
  return `${urlPrefix(t.locale)}/${silo}/${t.slug}/`;
}

/* ---------------- Filtrage du contenu non francophone ---------------- */

// Volontairement PLUS LARGE que ce qui est servable : un article anglais exclu
// de la publication reste un article anglais. S'il finissait publié par erreur,
// il ne doit surtout pas apparaître dans les listings français.
const TOUS_SLUGS_NON_FR = new Set<string>();
for (const byLocale of Object.values(INDEX.articles ?? {})) {
  for (const t of Object.values(byLocale)) if (t?.slug) TOUS_SLUGS_NON_FR.add(t.slug);
}
for (const byLoc of Object.values(INDEX.taxonomie ?? {})) {
  for (const taxo of Object.values(byLoc)) {
    if (taxo.slug) TOUS_SLUGS_NON_FR.add(taxo.slug);
    for (const sc of Object.values(taxo.sous_cocons ?? {})) {
      if (sc.slug) TOUS_SLUGS_NON_FR.add(sc.slug);
    }
  }
}

/** Ce slug appartient-il à une traduction (article ou page de rubrique) ? */
export function isTranslatedSlug(slug: string): boolean {
  return TOUS_SLUGS_NON_FR.has(slug);
}

/**
 * Retire tout contenu non francophone. À appliquer PARTOUT où une liste
 * d'articles WordPress alimente une surface FRANÇAISE : accueil, /archives/,
 * /tag/*, /auteur/*, /recherche, sitemap, generateStaticParams.
 */
export function filterFrench<T extends { slug: string }>(items: T[]): T[] {
  return items.filter((i) => !isTranslatedSlug(i.slug));
}

/* ---------------- hreflang ---------------- */

export interface AlternateLinks {
  canonical: string;
  languages: Record<string, string>;
}

/**
 * `alternates` d'un article, utilisable depuis les deux côtés : on passe
 * toujours le slug de la SOURCE française, qui est la clé de l'index.
 *
 * `x-default` pointe le français : langue d'origine, la plus complète, marché
 * principal du site (voir config/i18n.json).
 */
export function alternatesForArticle(
  frSlug: string,
  siteUrl: string,
  localeCourante: string = DEFAULT_LOCALE
): AlternateLinks {
  const urlFr = `${siteUrl}/${frSlug}/`;
  const languages: Record<string, string> = {
    [hreflangCode(DEFAULT_LOCALE)]: urlFr,
    "x-default": urlFr,
  };
  let canonical = urlFr;

  for (const t of (PAR_SLUG_FR.get(frSlug) ?? new Map<string, ArticleTraduit>()).values()) {
    const chemin = pathForArticle(t);
    if (!chemin) continue;
    languages[hreflangCode(t.locale)] = `${siteUrl}${chemin}`;
    if (t.locale === localeCourante) canonical = `${siteUrl}${chemin}`;
  }
  return { canonical, languages };
}

/** `alternates` d'une page de rubrique (hub ou sous-hub). */
export function alternatesForTaxonomy(
  cheminFr: string,
  siteUrl: string,
  localeCourante: string = DEFAULT_LOCALE,
  cheminsParLocale: Record<string, string> = {}
): AlternateLinks {
  const urlFr = `${siteUrl}${cheminFr}`;
  const languages: Record<string, string> = {
    [hreflangCode(DEFAULT_LOCALE)]: urlFr,
    "x-default": urlFr,
  };
  let canonical = urlFr;
  for (const [locale, chemin] of Object.entries(cheminsParLocale)) {
    languages[hreflangCode(locale)] = `${siteUrl}${chemin}`;
    if (locale === localeCourante) canonical = `${siteUrl}${chemin}`;
  }
  return { canonical, languages };
}

export { PAR_SLUG_FR, PAR_SLUG_TRADUIT };
