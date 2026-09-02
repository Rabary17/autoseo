import Link from "next/link";
import SearchBox from "@/components/SearchBox";
import ThemeToggle from "@/components/ThemeToggle";
import LangSwitch from "@/components/LangSwitch";
import { SILOS } from "@/lib/taxonomy";
import { getCategories } from "@/lib/wp";

const MAX_NAV_CHIPS = 4;

// Comptes réels WP (pas data/taxonomy.json, qui reflète la cible planifiée à
// terme, voir lib/taxonomy.ts) — le menu principal ne doit mettre en avant que
// des rubriques qui ont vraiment du contenu publié au moment où le visiteur
// clique, pas l'architecture cible complète (2026-07-29). `getCategories` est
// déjà mise en cache 15 min au niveau de lib/wp.ts (2026-07-30, partagée avec
// /archives/ et les pages catégorie) — pas besoin d'un cache dédié ici.
export default async function Header() {
  const categories = await getCategories().catch(() => []);
  const countBySlug = new Map(categories.map((c) => [c.slug, c.count]));
  const navSilos = SILOS.filter((s) => (countBySlug.get(s.slug) ?? 0) > 0)
    .sort((a, b) => (countBySlug.get(b.slug) ?? 0) - (countBySlug.get(a.slug) ?? 0))
    .slice(0, MAX_NAV_CHIPS);

  return (
    <header className="appbar">
      <Link className="appbar__logo" href="/" aria-label="techcars — accueil">
        {/* logo.png a le mot "tech" en quasi-noir, invisible sur le fond sombre
            du thème dark (--paper devient #1A1D23) — logo-dark.png reprend le
            même fichier avec ce texte reclairci, basculé par CSS (2026-07-29). */}
        <img className="appbar__brand appbar__brand--light" src="/logo.png" alt="techcars" width={343} height={28} />
        <img
          className="appbar__brand appbar__brand--dark"
          src="/logo-dark.png"
          alt=""
          aria-hidden="true"
          width={343}
          height={28}
        />
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
        <Link className="chip" href="/archives/">
          Tous les articles
        </Link>
        <Link className="chip" href="/outils/">
          Nos outils
        </Link>
      </nav>
      <div className="appbar__actions">
        <SearchBox />
        <LangSwitch />
        <ThemeToggle />
      </div>
    </header>
  );
}
