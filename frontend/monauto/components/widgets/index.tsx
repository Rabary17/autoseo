import type { ComponentType } from "react";
import ComparateurWidget from "./ComparateurWidget";
import CalculateurPrixWidget from "./CalculateurPrixWidget";
import DiagnosticWidget from "./DiagnosticWidget";
import MonVehiculeWidget from "./MonVehiculeWidget";
import AssistantDemarcheWidget from "./AssistantDemarcheWidget";
import RoadtripWidget from "./RoadtripWidget";
import type { WidgetLocale } from "./types";

export {
  ComparateurWidget,
  CalculateurPrixWidget,
  DiagnosticWidget,
  MonVehiculeWidget,
  AssistantDemarcheWidget,
  RoadtripWidget,
};

export interface WidgetMeta {
  slug: string;
  title: string;
  Component: ComponentType<{ locale?: WidgetLocale }>;
}

export const WIDGETS: WidgetMeta[] = [
  { slug: "comparateur", title: "Comparateur de véhicules", Component: ComparateurWidget },
  { slug: "prix-entretien", title: "Calculateur de prix d'entretien", Component: CalculateurPrixWidget },
  { slug: "diagnostic", title: "Diagnostic rapide (codes & voyants)", Component: DiagnosticWidget },
  { slug: "mon-vehicule", title: "Mon véhicule", Component: MonVehiculeWidget },
  { slug: "carte-grise", title: "Assistant carte grise", Component: AssistantDemarcheWidget },
  { slug: "road-trip", title: "Péages & vignettes en Europe", Component: RoadtripWidget },
];

// Version anglaise de /outils/ (voir app/(en)/en/tools/page.tsx) — "carte
// grise" volontairement ABSENT : démarches administratives 100% françaises
// (SIV, ANTS), sans équivalent pour un lecteur anglophone hors France — même
// logique que config/i18n.json (silos_traduisibles n'inclut pas
// "carte-grise-demarches"). Chaque Component reçoit locale="en" par l'appelant.
export const EN_TOOLS: WidgetMeta[] = [
  { slug: "comparateur", title: "Vehicle comparator", Component: ComparateurWidget },
  { slug: "prix-entretien", title: "Maintenance cost calculator", Component: CalculateurPrixWidget },
  { slug: "diagnostic", title: "Quick diagnosis (codes & warning lights)", Component: DiagnosticWidget },
  { slug: "mon-vehicule", title: "My vehicle", Component: MonVehiculeWidget },
  { slug: "road-trip", title: "Tolls & vignettes in Europe", Component: RoadtripWidget },
];

// Widget mis en avant dans la sidebar de chaque silo (slugs = hub_slug réel WordPress, voir
// config/niches/auto-mobilite/niche.json — PAS les anciens slugs de data/taxonomy.json,
// corrigés le 2026-07-21 pour correspondre). Un seul widget par silo, le plus pertinent pour
// ce contenu ; les 6 restent aussi consultables ensemble sur /outils/.
export const SILO_WIDGET: Record<string, ComponentType> = {
  "entretien-revision": CalculateurPrixWidget,
  "pannes-diagnostic": DiagnosticWidget,
  "marques-modeles": MonVehiculeWidget,
  "pieces-detachees-accessoires": CalculateurPrixWidget,
  "essais-comparatifs": ComparateurWidget,
  "sport-auto-passion": ComparateurWidget,
  "achat-voiture-neuve": ComparateurWidget,
  "voiture-d-occasion": ComparateurWidget,
  "electrique-hybride": MonVehiculeWidget,
  "carte-grise-demarches": AssistantDemarcheWidget,
  "assurance-auto": AssistantDemarcheWidget,
  "permis-conduite": AssistantDemarcheWidget,
  "moto-scooter": MonVehiculeWidget,
  "velo-nouvelles-mobilites": MonVehiculeWidget,
  "mobilite-partagee-transports": AssistantDemarcheWidget,
  "carburants-consommation": CalculateurPrixWidget,
  "camping-car-van": ComparateurWidget,
  "utilitaires-flottes-pro": CalculateurPrixWidget,
  "road-trips-voyage-auto": RoadtripWidget,
};
