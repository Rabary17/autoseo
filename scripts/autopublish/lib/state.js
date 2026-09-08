// État d'exécution du pipeline — désormais persisté dans Firestore
// (niches/{nicheId}/state/pipeline) plutôt que data/autopublish-state.json,
// voir plan MVP SaaS interne. La logique de transition de phase reste une
// décision humaine (voir skills/wordpress-publication.md section 6) : ce
// module ne fait que persister l'état, jamais ne décide de changer de phase
// tout seul.
//
// Seuls 2 appelants (run.js, daily-report.js) — migration directe en async,
// contrairement à niche.json (des dizaines d'appelants synchrones, voir
// niche-firestore-sync.js pour cette approche différente).
const nichePaths = require('./niche-paths');
const { getDb } = require('../../lib_js/firestore-client');

const DEFAULT_STATE = {
  phase: 0,
  silo_en_cours: null,
  phase_start_date: null,
  // Compteur de position dans la file de la phase 0 (hubs+sous-hubs
  // confondus, capacité commune de 10/jour — voir scheduler.js) : permet de
  // reprendre l'espacement des dates là où le run précédent s'est arrêté.
  items_scheduled_in_phase: 0,
  budget_semaine: 20,
  budget_consomme: 0,
  semaine_debut: null,
  // Phase 2 uniquement : date de démarrage et compteur de position propres
  // au silo en cours — remis à zéro à chaque changement de silo_en_cours.
  silo_start_date: null,
  items_scheduled_for_silo: 0,
  derniere_execution: null,
};

function stateDocRef() {
  return getDb().collection('niches').doc(nichePaths.NICHE_ID).collection('state').doc('pipeline');
}

async function loadState() {
  const snap = await stateDocRef().get();
  if (!snap.exists) return { ...DEFAULT_STATE };
  return { ...DEFAULT_STATE, ...snap.data() };
}

async function saveState(state) {
  await stateDocRef().set(state);
}

// Réinitialise le compteur hebdomadaire si la semaine ISO a changé depuis la
// dernière exécution — évite de porter le calcul de semaine ISO dans run.js.
function isoWeekKey(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

function resetWeeklyBudgetIfNeeded(state, now = new Date()) {
  const currentWeek = isoWeekKey(now);
  if (state.semaine_debut !== currentWeek) {
    state.semaine_debut = currentWeek;
    state.budget_consomme = 0;
  }
  return state;
}

module.exports = { loadState, saveState, isoWeekKey, resetWeeklyBudgetIfNeeded };
