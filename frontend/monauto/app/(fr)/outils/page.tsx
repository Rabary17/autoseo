import type { Metadata } from "next";
import Breadcrumb from "@/components/Breadcrumb";
import { WIDGETS } from "@/components/widgets";
import { pageMeta } from "@/lib/seo-meta";

export const metadata: Metadata = pageMeta({
  title: "Nos outils",
  description: "Comparateur de véhicules, calculateur de prix d'entretien, diagnostic de codes défaut, assistant carte grise et plus — des outils gratuits, pas seulement des articles.",
  path: "/outils/",
});

export default function OutilsPage() {
  return (
    <div className="wrap">
      <Breadcrumb items={[{ name: "Accueil", href: "/" }, { name: "Nos outils", href: "/outils/" }]} />

      <header className="section">
        <p className="eyebrow">Outils gratuits</p>
        <h1>Tout ce qu&apos;il faut pour décider, pas juste lire</h1>
        <p>
          Six outils construits à partir de nos données réelles (prix relevés, fiabilité par modèle, codes défaut,
          démarches administratives) — utilisables librement, sans compte.
        </p>
      </header>

      <div className="stack" style={{ gridTemplateColumns: "1fr" }}>
        {WIDGETS.map(({ slug, Component }) => (
          <div key={slug} id={slug}>
            <Component />
          </div>
        ))}
      </div>
    </div>
  );
}
