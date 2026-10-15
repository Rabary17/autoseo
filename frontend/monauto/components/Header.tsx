import Link from "next/link";
import SearchBox from "@/components/SearchBox";
import ThemeToggle from "@/components/ThemeToggle";
import LangSwitch from "@/components/LangSwitch";

// Navigation principale : les cinq rubriques puis le blog, comme le menu de la maquette.
const NAV = [
  { href: "/categorie/motorisations/", label: "Motorisations" },
  { href: "/categorie/securite/", label: "Sécurité" },
  { href: "/categorie/transmission/", label: "Transmission" },
  { href: "/categorie/autonomie-connectivite/", label: "Autonomie" },
  { href: "/categorie/reglementation-technique/", label: "Réglementation" },
  { href: "/blog/", label: "Blog" },
];

export default function Header() {
  return (
    <header className="appbar">
      <Link className="appbar__logo" href="/" aria-label="techcars — accueil">
        {/* logo.png a le mot « tech » en quasi-noir : logo-dark.png reprend le même fichier, basculé par CSS. */}
        <img className="appbar__brand appbar__brand--light" src="/logo.png" alt="techcars" width={343} height={28} />
        <img className="appbar__brand appbar__brand--dark" src="/logo-dark.png" alt="" aria-hidden="true" width={343} height={28} />
      </Link>
      <nav className="appbar__nav" aria-label="Navigation principale">
        {NAV.map((l) => (
          <Link key={l.href} className="appbar__link" href={l.href}>
            {l.label}
          </Link>
        ))}
      </nav>
      <div className="appbar__actions">
        <SearchBox />
        <LangSwitch />
        <ThemeToggle />
      </div>
    </header>
  );
}
