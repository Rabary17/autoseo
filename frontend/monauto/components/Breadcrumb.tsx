import Link from "next/link";
import JsonLd from "./JsonLd";
import { breadcrumbLd, type Crumb } from "@/lib/schema";

export default function Breadcrumb({ items }: { items: Crumb[] }) {
  return (
    <nav className="breadcrumb" aria-label="Fil d'Ariane">
      <ol>
        {items.map((c, i) => (
          <li key={c.href}>
            {i < items.length - 1 ? (
              <Link href={c.href}>{c.name}</Link>
            ) : (
              <span aria-current="page">{c.name}</span>
            )}
          </li>
        ))}
      </ol>
      <JsonLd data={breadcrumbLd(items)} />
    </nav>
  );
}
