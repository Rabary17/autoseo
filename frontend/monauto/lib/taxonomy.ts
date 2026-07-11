// Source de vérité de la navigation du cocon (19 silos) — voir
// frontend/monauto-kit/README.md et skills/seo.md section 1. Distincte des
// catégories WordPress : celles-ci ne comptent aujourd'hui que ce qui a
// vraiment été publié, alors que la nav/l'accueil doivent refléter
// l'architecture cible complète du site.
import taxonomy from "@/data/taxonomy.json";

export interface Silo {
  slug: string;
  name: string;
  desc: string;
  articles: number;
  children: string[];
}

export const SILOS: Silo[] = taxonomy.silos;

export function getSilo(slug: string): Silo | undefined {
  return SILOS.find((s) => s.slug === slug);
}
