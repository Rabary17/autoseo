import type { Metadata } from "next";
import Link from "next/link";
import { CATEGORIES, categoryUrl } from "@/lib/categories";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Toutes les rubriques",
  description: "Toutes les rubriques du site, groupées par thème.",
  path: "/rubriques/",
});

export default function RubriquesPage() {
  const sections = new Map<string, typeof CATEGORIES>();
  for (const c of CATEGORIES) {
    if (!sections.has(c.section)) sections.set(c.section, []);
    sections.get(c.section)!.push(c);
  }

  return (
    <div className="blog-page">
      <h1 className="blog-title">Toutes les rubriques</h1>
      {[...sections.entries()].map(([section, categories]) => (
        <section key={section} className="hp-section">
          <div className="hp-head">
            <h2>{section}</h2>
          </div>
          <div className="hp-topics">
            {categories.map((c) => (
              <Link key={c.slug} className="hp-topic" href={categoryUrl(c)}>
                <span className="hp-topic__name">{c.title}</span>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
