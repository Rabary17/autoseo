import Link from "next/link";
import SearchBox from "@/components/SearchBox";
import ThemeToggle from "@/components/ThemeToggle";
import { SILOS } from "@/lib/taxonomy";

const NAV_SLUGS = ["entretien", "pannes-diagnostic", "essais-comparatifs", "electrique-hybride"];

export default function Header() {
  const navSilos = NAV_SLUGS.map((slug) => SILOS.find((s) => s.slug === slug)).filter(Boolean);

  return (
    <header className="appbar">
      <Link className="appbar__logo" href="/" aria-label="monauto — accueil">
        <img className="appbar__mark" src="/mark.svg" alt="" width={28} height={28} />
        <span className="appbar__word">
          monauto<span className="dot">.</span>
        </span>
      </Link>
      <nav className="appbar__nav" aria-label="Rubriques">
        {navSilos.map((s) => (
          <Link key={s!.slug} className="chip" href={`/categorie/${s!.slug}/`}>
            {s!.name.split(" ")[0]}
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
