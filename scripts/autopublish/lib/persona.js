// Mapping silo → auteur → skill de rédaction dédié. Source de vérité du
// mapping : skills/wordpress-publication.md section 4 — à ne modifier qu'en
// même temps que ce fichier si le mapping change.
const path = require('path');

const SKILLS_DIR = path.join(__dirname, '..', '..', '..', 'skills', 'redaction');

// Noms de plume, genre/âge (pour le choix de l'avatar, voir scripts/fetch-author-avatars.js)
// et bio courte — complétés le 2026-07-21 (seule la persona A avait un nom réel jusque-là,
// "Julien Fabre", voir STATE.md 2026-07-17). intitule_role ne prétend JAMAIS une
// certification non vérifiable (D reste "spécialiste démarches", jamais "juriste" — voir
// STATE.md 2026-07-17, décision explicite).
const PERSONAS = {
  A: {
    nom: 'Julien Fabre',
    genre: 'H', age: 41,
    intitule_role: 'Mécanicien & rédacteur technique',
    bio: "Mécanicien pendant douze ans en atelier indépendant avant de se consacrer à l'écriture technique. Julien traduit les diagnostics en explications concrètes — combien ça coûte, peut-on le faire soi-même, jusqu'où attendre avant que ça casse pour de bon.",
    silos: ['Entretien & révision', 'Pannes & diagnostic', 'Pièces détachées & accessoires'],
    skill: path.join(SKILLS_DIR, 'auteur-a.md'),
  },
  B: {
    nom: 'Thomas Lefèvre',
    genre: 'H', age: 33,
    intitule_role: 'Essayeur automobile & passionné de sport auto',
    bio: "Ancien pilote amateur en circuit, Thomas essaie et compare les modèles avec un œil de conducteur exigeant plutôt que de commercial. Il aime les chiffres qui ne mentent pas : consommation réelle, fiabilité constatée, valeur de revente.",
    silos: ['Marques & modèles', 'Essais & comparatifs', 'Sport auto & passion'],
    skill: path.join(SKILLS_DIR, 'auteur-b.md'),
  },
  C: {
    nom: 'Camille Roussel',
    genre: 'F', age: 34,
    intitule_role: 'Conseillère achat & spécialiste mobilité électrique',
    bio: "Camille accompagne les lecteurs dans leurs décisions d'achat — neuf, occasion ou électrique — avec un objectif simple : éviter les regrets à 10 000 km. Elle suit de près l'évolution des aides, de l'autonomie réelle et des coûts cachés de l'électrique.",
    silos: ['Achat voiture neuve', "Voiture d'occasion", 'Électrique & hybride'],
    skill: path.join(SKILLS_DIR, 'auteur-c.md'),
  },
  D: {
    nom: 'Sophie Andrieu',
    genre: 'F', age: 46,
    intitule_role: 'Spécialiste démarches administratives auto',
    bio: "Sophie décortique les démarches (carte grise, assurance, permis) pour qu'elles prennent le moins de temps possible — délais réels, documents à ne pas oublier, pièges à éviter. Elle n'est pas juriste et le dit clairement quand une situation dépasse le cadre d'un guide pratique.",
    silos: ['Carte grise & démarches', 'Assurance auto', 'Permis & conduite'],
    skill: path.join(SKILLS_DIR, 'auteur-d.md'),
  },
  E: {
    nom: 'Karim Belaïd',
    genre: 'H', age: 29,
    intitule_role: 'Spécialiste deux-roues & mobilités urbaines',
    bio: "Karim roule en scooter, moto et vélo électrique selon les trajets — et écrit avec ce mélange d'usages en tête plutôt qu'un seul mode de transport. Sujet de prédilection : ce qui marche vraiment en ville au quotidien, pas en brochure.",
    silos: ['Moto & scooter', 'Vélo & nouvelles mobilités', 'Mobilité partagée & transports'],
    skill: path.join(SKILLS_DIR, 'auteur-e.md'),
  },
  F: {
    nom: 'Nathalie Moreau',
    genre: 'F', age: 39,
    intitule_role: 'Spécialiste voyage & usages auto spécifiques',
    bio: "Nathalie a parcouru une bonne partie de l'Europe en camping-car et carbure aux itinéraires bien préparés. Elle couvre aussi les usages moins grand public — utilitaires, flottes pro, consommation — avec le même souci du détail pratique.",
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
