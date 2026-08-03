// Configuration centrale du pipeline autopublish — budgets, mapping
// modèle/type de contenu, images par défaut. Séparé de run.js pour que les
// ajustements de politique (budget hebdo, modèle par type) ne nécessitent pas
// de modifier l'orchestrateur.
const { PHASE_CAPACITY_PER_DAY } = require('./lib/scheduler');
const maillage = require('./lib/maillage');

// Silos triés par nombre total d'articles CROISSANT (le plus petit cocon
// d'abord) — demande explicite de l'utilisateur le 2026-07-28, pour valider
// le pipeline articles sur des cocons complets et peu coûteux avant de
// passer aux plus gros (Entretien & révision 314, Marques & modèles 463).
// Calculé depuis data/maillage/maillage.json (source réelle) plutôt qu'une
// liste figée à la main — évite la même désynchronisation que celle trouvée
// le 2026-07-28 sur config/niches/.../niche.json (resté périmé au fil des
// ajouts de sous-cocons, voir STATE.md).
function computeSiloOrderAscendingByArticleCount() {
  const counts = new Map();
  for (const entry of maillage.loadMaillage()) {
    counts.set(entry.silo, (counts.get(entry.silo) || 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => a[1] - b[1]).map(([silo]) => silo);
}

module.exports = {
  // Budget hebdomadaire Phase 2 — 10 articles/jour (voir scheduler.js et
  // skills/wordpress-publication.md section 6, abaissé de 15 à 10/jour le
  // 2026-07-28 sur demande explicite de l'utilisateur). Remplace l'ancien
  // budget de démarrage prudent (20/semaine) : à ce stade, le pipeline
  // articles est validé (test-e2e + backfill meta), plus besoin d'un rythme
  // artificiellement réduit.
  WEEKLY_BUDGET_PHASE2: 70,

  // Capacité/jour utilisée pour l'espacement des post_date (voir scheduler.js)
  // — distincte du budget hebdomadaire ci-dessus, qui limite combien de
  // pièces un run traite, pas la vitesse de publication elle-même.
  PHASE_CAPACITY_PER_DAY,

  // Répartition modèle par type de contenu (migré vers l'API Mistral le
  // 2026-07-27, demande explicite de l'utilisateur — voir STATE.md).
  // `article` passé de mistral-small à mistral-large le 2026-07-30 (demande
  // explicite de l'utilisateur après le constat du 2026-07-30 : 0/22 articles
  // publiables sur "Carte grise & démarches", hallucination de sources
  // officielles YMYL persistant même avec mistral-medium — le modèle le plus
  // puissant disponible reste la seule variable non encore testée). Coût par
  // article nettement plus élevé, mais nouvelle politique explicite : tout
  // insérer en draft quel que soit le gating (déjà le comportement de run.js),
  // correction/QC manuelle article par article ensuite, publication seulement
  // à une date programmée décidée après coup — jamais automatique.
  MODEL_BY_CONTENT_TYPE: {
    hub: { model: 'mistral-large-latest' },
    'sous-hub': { model: 'mistral-large-latest' },
    article: { model: 'mistral-large-latest' },
  },

  // Relecture obligatoire (voir review.js) — repassée à mistral-large-latest
  // partout le 2026-07-30 (même demande explicite que MODEL_BY_CONTENT_TYPE
  // ci-dessus : le modèle le plus performant disponible, coût secondaire tant
  // que le taux d'échec au gating n'est pas d'abord réduit).
  REVIEW_MODEL_BY_CONTENT_TYPE: {
    hub: { model: 'mistral-large-latest' },
    'sous-hub': { model: 'mistral-large-latest' },
    article: { model: 'mistral-large-latest' },
  },

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
  // Noms de plume complétés le 2026-07-21 (voir persona.js) — seule julien-fabre existait
  // jusque-là comme compte WP réel ; les comptes B-F restent à créer (scripts/autopublish/
  // create-missing-authors.js) une fois WordPress à nouveau joignable.
  WP_AUTHOR_SLUG_BY_PERSONA: {
    A: 'julien-fabre',
    B: 'thomas-lefevre',
    C: 'camille-roussel',
    D: 'sophie-andrieu',
    E: 'karim-belaid',
    F: 'nathalie-moreau',
  },

  // Ordre de traitement des silos en Phase 2 — du plus petit au plus gros
  // cocon (voir computeSiloOrderAscendingByArticleCount ci-dessus). Utilisé
  // uniquement quand `silo_en_cours` est vide dans l'état — sinon l'état
  // persisté fait foi.
  SILO_ORDER_PHASE2: computeSiloOrderAscendingByArticleCount(),

  // Quotas d'intention interleavés (voir seo.md section 3 et
  // wordpress-publication.md section 6) — approximatifs, appliqués au budget
  // hebdomadaire courant plutôt qu'en dur, pour rester valides si le budget change.
  INTENT_QUOTA: { Info: 0.65, Commercial: 0.25, Transactionnel: 0.10 },

  // Destinataire du rapport quotidien (voir daily-report.js + .github/workflows/daily-report.yml).
  // Ce n'est pas une donnée sensible — laissé en clair ici plutôt qu'en secret.
  DAILY_REPORT_RECIPIENT: 'andrianina.rabarivelo@gmail.com',
};
