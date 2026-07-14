// Mapping silo → auteur → skill de rédaction dédié. Source de vérité du
// mapping : skills/wordpress-publication.md section 4 — à ne modifier qu'en
// même temps que ce fichier si le mapping change.
const path = require('path');

const SKILLS_DIR = path.join(__dirname, '..', '..', '..', 'skills', 'redaction');

const PERSONAS = {
  A: {
    nom: 'A — Mécanique & technique',
    silos: ['Entretien & révision', 'Pannes & diagnostic', 'Pièces détachées & accessoires'],
    skill: path.join(SKILLS_DIR, 'auteur-a.md'),
  },
  B: {
    nom: 'B — Marques, essais & sport auto',
    silos: ['Marques & modèles', 'Essais & comparatifs', 'Sport auto & passion'],
    skill: path.join(SKILLS_DIR, 'auteur-b.md'),
  },
  C: {
    nom: 'C — Achat & mobilité électrique',
    silos: ['Achat voiture neuve', "Voiture d'occasion", 'Électrique & hybride'],
    skill: path.join(SKILLS_DIR, 'auteur-c.md'),
  },
  D: {
    nom: 'D — Démarches, assurance & permis',
    silos: ['Carte grise & démarches', 'Assurance auto', 'Permis & conduite'],
    skill: path.join(SKILLS_DIR, 'auteur-d.md'),
  },
  E: {
    nom: 'E — Deux-roues & nouvelles mobilités',
    silos: ['Moto & scooter', 'Vélo & nouvelles mobilités', 'Mobilité partagée & transports'],
    skill: path.join(SKILLS_DIR, 'auteur-e.md'),
  },
  F: {
    nom: 'F — Usages spécifiques & voyage',
    silos: ['Carburants & consommation', 'Camping-car & van', 'Utilitaires & flottes pro', 'Road trips & voyage auto'],
    skill: path.join(SKILLS_DIR, 'auteur-f.md'),
  },
};

// Silos YMYL (voir skills/wordpress-publication.md section 4 et section 5,
// gating : source officielle citée obligatoire) — seul le persona D en
// couvre aujourd'hui, mais gardé en table plutôt qu'en dur dans gating.js.
const YMYL_SILOS = new Set(PERSONAS.D.silos);

const SILO_TO_PERSONA = {};
for (const [key, persona] of Object.entries(PERSONAS)) {
  for (const silo of persona.silos) SILO_TO_PERSONA[silo] = key;
}

function getPersonaKeyForSilo(silo) {
  const key = SILO_TO_PERSONA[silo];
  if (!key) throw new Error(`persona: aucun auteur mappé pour le silo "${silo}"`);
  return key;
}

function getPersonaForSilo(silo) {
  return PERSONAS[getPersonaKeyForSilo(silo)];
}

function isYmylSilo(silo) {
  return YMYL_SILOS.has(silo);
}

module.exports = { PERSONAS, getPersonaKeyForSilo, getPersonaForSilo, isYmylSilo, YMYL_SILOS };
