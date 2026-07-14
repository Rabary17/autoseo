// Lecture/écriture de data/autopublish-state.json — état minimal partagé entre
// les runs GitHub Actions (phase courante, silo en cours, budget hebdomadaire
// consommé). La logique de transition de phase reste une décision humaine
// (voir skills/wordpress-publication.md section 6) : ce module ne fait que
// persister l'état, jamais ne décide de changer de phase tout seul.
const fs = require('fs');
const path = require('path');

const STATE_PATH = path.join(__dirname, '..', '..', '..', 'data', 'autopublish-state.json');

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

function loadState() {
  if (!fs.existsSync(STATE_PATH)) return { ...DEFAULT_STATE };
  const raw = fs.readFileSync(STATE_PATH, 'utf8');
  return { ...DEFAULT_STATE, ...JSON.parse(raw) };
}

function saveState(state) {
  fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2) + '\n', 'utf8');
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

module.exports = { loadState, saveState, isoWeekKey, resetWeeklyBudgetIfNeeded, STATE_PATH };
