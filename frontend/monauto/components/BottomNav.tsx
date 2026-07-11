import Link from "next/link";

export default function BottomNav() {
  return (
    <nav className="bottomnav" aria-label="Navigation principale">
      <Link href="/">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V21h14V9.5" /></svg>
        Accueil
      </Link>
      <Link href="/rubriques/">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 6h16M4 12h16M4 18h10" /></svg>
        Rubriques
      </Link>
    </nav>
  );
}
