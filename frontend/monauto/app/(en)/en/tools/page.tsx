import type { Metadata } from "next";
import Breadcrumb from "@/components/Breadcrumb";
import { EN_TOOLS } from "@/components/widgets";
import { pageMeta } from "@/lib/seo-meta";

// Version anglaise de /outils/ (voir ce fichier pour le modèle). Volontairement
// SANS l'assistant carte grise : voir components/widgets/index.tsx (EN_TOOLS).
// URL "/en/tools/" (mot anglais, pas une translittération de "outils") pour
// rester cohérent avec le reste des URLs anglaises du site (/en/<silo-en>/...).
export const metadata: Metadata = pageMeta({
  title: "Our tools",
  description:
    "Vehicle comparator, maintenance cost calculator, fault code diagnosis and more — free tools, not just articles.",
  path: "/en/tools/",
});

export default function ToolsPage() {
  return (
    <div className="wrap">
      <Breadcrumb items={[{ name: "Home", href: "/en/" }, { name: "Our tools", href: "/en/tools/" }]} />

      <header className="section">
        <p className="eyebrow">Free tools</p>
        <h1>Everything you need to decide, not just read</h1>
        <p>
          Five tools built from our real data (prices, reliability by model, fault codes) — free to
          use, no account needed.
        </p>
      </header>

      <div className="stack" style={{ gridTemplateColumns: "1fr" }}>
        {EN_TOOLS.map(({ slug, Component }) => (
          <div key={slug} id={slug}>
            <Component locale="en" />
          </div>
        ))}
      </div>
    </div>
  );
}
