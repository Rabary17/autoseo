import Link from "next/link";
import type { Metadata } from "next";
import { SILOS } from "@/lib/taxonomy";
import { pageMeta } from "@/lib/seo-meta";
import { SITE_NAME } from "@/lib/site";

export const metadata: Metadata = pageMeta({
  title: "Toutes les rubriques",
  description: `Les 19 rubriques du guide auto & mobilité ${SITE_NAME} : entretien, pannes, marques, essais, démarches, électrique et plus.`,
  path: "/rubriques/",
});

export default function RubriquesPage() {
  return (
    <div className="wrap">
      <section className="section">
        <div className="section__head">
          <h1>Toutes les rubriques</h1>
        </div>
        <div className="silo-grid">
          {SILOS.map((s) => (
            <Link key={s.slug} className="silo" href={`/categorie/${s.slug}/`}>
              <span>
                <span className="silo__name">{s.name}</span>
                <span className="silo__desc" style={{ display: "block" }}>
                  {s.desc}
                </span>
              </span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
