// Source de vérité de la navigation du cocon (19 silos) — voir
// frontend/monauto-kit/README.md et skills/seo.md section 1. Distincte des
// catégories WordPress : celles-ci ne comptent aujourd'hui que ce qui a
// vraiment été publié, alors que la nav/l'accueil doivent refléter
// l'architecture cible complète du site.
import taxonomy from "@/data/taxonomy.json";

export interface PlannedArticle {
  slug: string;
  title: string;
}

export interface SousCocon {
  slug: string;
  name: string;
  count: number;
  /** Liste complète des articles prévus (voir scripts/gen-taxonomy-articles.js) — publiés ou non. */
  articles: PlannedArticle[];
}

export interface Silo {
  slug: string;
  name: string;
  desc: string;
  articles: number;
  children: SousCocon[];
}

export const SILOS: Silo[] = taxonomy.silos;

export function getSilo(slug: string): Silo | undefined {
  return SILOS.find((s) => s.slug === slug);
}

export function getSousCocon(siloSlug: string, sousCoconSlug: string): SousCocon | undefined {
  return getSilo(siloSlug)?.children.find((c) => c.slug === sousCoconSlug);
}
