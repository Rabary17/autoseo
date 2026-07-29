import Link from "next/link";
import { unstable_cache } from "next/cache";
import SearchBox from "@/components/SearchBox";
import ThemeToggle from "@/components/ThemeToggle";
import { SILOS } from "@/lib/taxonomy";
import { getCategories } from "@/lib/wp";

const MAX_NAV_CHIPS = 4;

// Comptes réels WP (pas data/taxonomy.json, qui reflète la cible planifiée à
// terme, voir lib/taxonomy.ts) — le menu principal ne doit mettre en avant que
// des rubriques qui ont vraiment du contenu publié au moment où le visiteur
// clique, pas l'architecture cible complète (2026-07-29). Mis en cache 15 min
// (comme le reste du site en ISR) pour ne pas interroger WP à chaque requête,
// vu que ce composant est rendu dans le layout racine.
const getCachedCategories = unstable_cache(() => getCategories(), ["header-nav-categories"], {
  revalidate: 900,
});

export default async function Header() {
  const categories = await getCachedCategories().catch(() => []);
  const countBySlug = new Map(categories.map((c) => [c.slug, c.count]));
  const navSilos = SILOS.filter((s) => (countBySlug.get(s.slug) ?? 0) > 0)
    .sort((a, b) => (countBySlug.get(b.slug) ?? 0) - (countBySlug.get(a.slug) ?? 0))
    .slice(0, MAX_NAV_CHIPS);

  return (
    <header className="appbar">
      <Link className="appbar__logo" href="/" aria-label="techcars — accueil">
        <img className="appbar__brand" src="/logo.png" alt="techcars" width={343} height={28} />
      </Link>
      <nav className="appbar__nav" aria-label="Rubriques">
        {navSilos.map((s) => (
          <Link key={s.slug} className="chip" href={`/categorie/${s.slug}/`}>
            {s.name.split(" ")[0]}
          </Link>
        ))}
        <Link className="chip" href="/rubriques/">
          Toutes les rubriques
        </Link>
      </nav>
      <div className="appbar__actions">
        <SearchBox />
        <ThemeToggle />
      </div>
    </header>
  );
}
