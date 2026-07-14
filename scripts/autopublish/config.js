// Configuration centrale du pipeline autopublish — budgets, mapping
// modèle/type de contenu, images par défaut. Séparé de run.js pour que les
// ajustements de politique (budget hebdo, modèle par type) ne nécessitent pas
// de modifier l'orchestrateur.
const { PHASE_CAPACITY_PER_DAY } = require('./lib/scheduler');

module.exports = {
  // Budget de démarrage Phase 2 — confirmé par l'utilisateur ("~20
  // articles/semaine"), très en dessous du plafond de 15/jour
  // (skills/wordpress-publication.md section 6). À augmenter uniquement sur
  // décision explicite de l'utilisateur, jamais automatiquement.
  WEEKLY_BUDGET_PHASE2: 20,

  // Capacité/jour utilisée pour l'espacement des post_date (voir scheduler.js)
  // — distincte du budget hebdomadaire ci-dessus, qui limite combien de
  // pièces un run traite, pas la vitesse de publication elle-même.
  PHASE_CAPACITY_PER_DAY,

  // Répartition modèle par type de contenu (voir plan indexed-hugging-flurry
  // section 5, économie de tokens) : Sonnet 5 pour hub/sous-hub (structuration
  // de liens complexe) ; Haiku 4.5 pour les articles programmatiques courts
  // (gros volume, contenu templaté). Haiku 4.5 n'accepte ni
  // `thinking: adaptive` ni `output_config.effort` (erreur 400) — laisser
  // `thinking`/`effort` à `undefined` pour ce modèle (voir claude-client.js,
  // qui n'envoie ces champs que s'ils sont fournis).
  MODEL_BY_CONTENT_TYPE: {
    hub: { model: 'claude-sonnet-5', thinking: { type: 'adaptive' }, effort: 'high' },
    'sous-hub': { model: 'claude-sonnet-5', thinking: { type: 'adaptive' }, effort: 'high' },
    article: { model: 'claude-haiku-4-5', thinking: undefined, effort: undefined },
  },

  // Relecture obligatoire (voir review.js) : toujours Sonnet 5, jugement
  // qualité — quel que soit le type de contenu relu.
  REVIEW_MODEL: { model: 'claude-sonnet-5', thinking: { type: 'adaptive' }, effort: 'medium' },

  // Image par défaut par silo (media_id WordPress déjà uploadé), dernier
  // repli si les 3 API stock-photo (images.js) ne renvoient rien de
  // pertinent. Encore vide : à remplir une fois des visuels par défaut
  // uploadés dans WP pour chaque silo — tant que vide, un silo sans image
  // trouvée publie quand même sans image à la une (jamais de blocage du
  // gating pour absence d'image, voir plan).
  DEFAULT_IMAGE_MEDIA_ID_BY_SILO: {},

  // Slug du compte WordPress (rôle Author) associé à chaque persona — voir
  // skills/wordpress-publication.md section 4. Seul le compte de la persona A
  // (julien-fabre) a été créé à ce jour (scripts/seed-monauto-test-content.js
  // sur l'environnement de test) ; les 5 autres comptes (B à F) doivent être
  // créés dans wp-admin avant le premier run réel sur leurs silos respectifs
  // — run.js échoue explicitement si le compte est introuvable plutôt que de
  // publier sous un mauvais auteur.
  WP_AUTHOR_SLUG_BY_PERSONA: {
    A: 'julien-fabre',
    B: 'auteur-b',
    C: 'auteur-c',
    D: 'auteur-d',
    E: 'auteur-e',
    F: 'auteur-f',
  },

  // Ordre par défaut de traitement des silos en Phase 2 — reprend l'ordre
  // dans lequel le P1 (collecte mots-clés) a déjà été réalisé (voir STATE.md),
  // cohérent avec "Entretien & révision et Pannes & diagnostic en premier"
  // (skills/wordpress-publication.md section 6). Utilisé uniquement quand
  // `silo_en_cours` est vide dans l'état — sinon l'état persisté fait foi.
  SILO_ORDER_PHASE2: [
    'Entretien & révision',
    'Pannes & diagnostic',
    'Marques & modèles',
    'Essais & comparatifs',
    'Achat voiture neuve',
    'Électrique & hybride',
    'Pièces détachées & accessoires',
    'Carte grise & démarches',
    'Assurance auto',
    'Permis & conduite',
    'Moto & scooter',
    'Vélo & nouvelles mobilités',
    'Mobilité partagée & transports',
    'Carburants & consommation',
    'Camping-car & van',
    'Utilitaires & flottes pro',
    'Sport auto & passion',
    'Road trips & voyage auto',
    "Voiture d'occasion",
  ],

  // Quotas d'intention interleavés (voir seo.md section 3 et
  // wordpress-publication.md section 6) — approximatifs, appliqués au budget
  // hebdomadaire courant plutôt qu'en dur, pour rester valides si le budget change.
  INTENT_QUOTA: { Info: 0.65, Commercial: 0.25, Transactionnel: 0.10 },
};
