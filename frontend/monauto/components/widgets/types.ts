// Types des données servies statiquement par public/widgets/*.json — générées par
// scripts/build-widget-data.py à partir des bases factuelles P2 (data/factuel/*.json).
// Fichiers volontairement plats et compacts (voir le script) : chargés une fois côté
// client au montage du widget, jamais régénérés dynamiquement.
export interface ModeleEntry {
  marque: string;
  modele: string;
  segment: string | null;
  fiabilite: string | null;
  pannes: string | null;
}

export interface PrixEntretienEntry {
  prestation: string;
  marque: string;
  modele: string;
  motorisation: string | null;
  prix_min: number | null;
  prix_max: number | null;
  temps_mo: string | null;
}

export interface CodeEntry {
  code: string;
  libelle: string;
  gravite: string | null;
  causes: string;
}

export interface VoyantEntry {
  voyant: string;
  couleur: string | null;
  signification: string;
  gravite: string | null;
  action: string;
}

export interface DemarcheEntry {
  demarche: string;
  delai_legal: string;
  delai_traitement: string;
  cout: string;
  documents: string;
}

export interface RoadtripEntry {
  pays: string;
  systeme_peage: string;
  prix: string;
  vehicules_concernes: string;
  amende: string;
  particularites: string;
}
