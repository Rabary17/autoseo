// Catégories du site — générées depuis les catégories RÉELLEMENT utilisées
// dans le contenu exporté de WordPress (data/migration/export/, 2026-11-20),
// pas depuis config/niches/auto-mobilite/niche.json seul (qui s'est révélé
// légèrement désynchronisé du contenu réellement publié — 4 catégories sur 25
// n'y figuraient pas). Le `section` ci-dessous reprend le silo de niche.json
// quand la correspondance est sûre ; "Actualités" reste une section à part
// (catégorie éditoriale réelle, pas un silo thématique) — à affiner en
// Phase 2 si la navigation doit grouper autrement.
export interface Category {
  slug: string;
  title: string;
  /** Silo parent (affichage/navigation) — voir note ci-dessus. */
  section: string;
}

export const CATEGORIES: Category[] = [
  { slug: "acheter-camping-car", title: "Acheter camping-car", section: "Camping-car & van" },
  { slug: "actualites", title: "Actualités", section: "Actualités" },
  { slug: "aides-a-l-achat", title: "Aides à l'achat", section: "Vélo & nouvelles mobilités" },
  { slug: "amenagement-equipement", title: "Aménagement & équipement", section: "Utilitaires & flottes pro" },
  { slug: "assurance-reglementation", title: "Assurance & réglementation", section: "Camping-car & van" },
  { slug: "autopartage-location-particuliers", title: "Autopartage & location particuliers", section: "Mobilité partagée & transports" },
  { slug: "boites-de-vitesses", title: "Boîtes de vitesses", section: "Entretien & révision" },
  { slug: "cession-achat", title: "Cession & achat", section: "Carte grise & démarches" },
  { slug: "changement-de-titulaire", title: "Changement de titulaire", section: "Carte grise & démarches" },
  { slug: "configurateurs-cout-de-possession", title: "Configurateurs & coût de possession", section: "Combien ça coûte vraiment" },
  { slug: "controle-technique", title: "Contrôle technique", section: "Carte grise & démarches" },
  { slug: "covoiturage", title: "Covoiturage", section: "Mobilité partagée & transports" },
  { slug: "duplicata-modifications", title: "Duplicata & modifications", section: "Carte grise & démarches" },
  { slug: "e85-conversions", title: "E85 & conversions", section: "Carburants & consommation" },
  { slug: "entretien-hivernage", title: "Entretien & hivernage", section: "Camping-car & van" },
  { slug: "f1-competition", title: "F1 & compétition", section: "Sport auto & passion" },
  { slug: "fiscalite-vehicule-pro", title: "Fiscalité véhicule pro", section: "Utilitaires & flottes pro" },
  { slug: "gpl-gnv-hydrogene", title: "GPL, GNV & hydrogène", section: "Carburants & consommation" },
  { slug: "immatriculation-import", title: "Immatriculation & import", section: "Carte grise & démarches" },
  { slug: "lld-gestion-de-flotte", title: "LLD & gestion de flotte", section: "Utilitaires & flottes pro" },
  { slug: "location-courte-longue-duree", title: "Location courte & longue durée", section: "Mobilité partagée & transports" },
  { slug: "malus-taxes", title: "Malus & taxes", section: "Carte grise & démarches" },
  { slug: "moteurs-hybrides", title: "Moteurs hybrides", section: "Électrique & hybride" },
  { slug: "moteurs-electriques", title: "Moteurs électriques", section: "Électrique & hybride" },
  { slug: "equipement-antivol", title: "Équipement & antivol", section: "Vélo & nouvelles mobilités" },
];

export function getCategory(slug: string | undefined): Category | undefined {
  return CATEGORIES.find((c) => c.slug === slug);
}

export function categoryUrl(category: Category) {
  return `/categorie/${category.slug}/`;
}
