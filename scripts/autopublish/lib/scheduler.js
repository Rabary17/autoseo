// Calcul de post_date selon skills/wordpress-publication.md section 6 —
// 3 phases (0 : 10 pages/jour, 1 : pause, 2 : 1 article/jour), jamais
// avant la date du hub/sous-hub parent, heures réparties dans la journée
// plutôt que tout à minuit. Historique phase 2 : 15 -> 10/jour le 2026-07-28,
// 10 -> 5/jour le 2026-08-03, **5 -> 1/jour le 2026-08-26** (demande explicite
// de l'utilisateur — cadence réduite, régularité plutôt que volume tant que
// la performance de recherche est nulle depuis le 21/08, voir STATE.md du
// 2026-08-26).
const PHASE_CAPACITY_PER_DAY = { 0: 10, 2: 1 }; // phase 1 = pause, pas de file

const DAY_START_HOUR = 8;
const DAY_END_HOUR = 20;

function addDays(date, days) {
  const d = new Date(date.getTime());
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

// Dimanche (UTC) réservé aux actualités (2026-08-26, demande explicite de
// l'utilisateur) : aucun contenu silo/sous-cocon/article régulier ne doit y
// être daté — voir skills/wordpress-publication.md section 6.
function isSunday(date) {
  return date.getUTCDay() === 0;
}

// Répartit les créneaux du jour entre 8h et 20h plutôt qu'à minuit pile —
// signal de publication plus naturel (voir section 6).
function timeOfDayForSlot(slotIndexInDay, capacityPerDay) {
  const span = DAY_END_HOUR - DAY_START_HOUR;
  const fraction = capacityPerDay > 1 ? slotIndexInDay / (capacityPerDay - 1) : 0;
  const hour = DAY_START_HOUR + fraction * span;
  return { h: Math.floor(hour), m: Math.floor((hour - Math.floor(hour)) * 60) };
}

// `queue` : liste déjà triée par ordre de priorité (voir scheduler appelant
// dans run.js — hubs > sous-hubs > volume décroissant > quota d'intention
// étalé). Chaque item peut porter un `parentDate` (Date | ISOString | null) :
// la date calculée est décalée d'au moins 1 jour après si nécessaire.
//
// `startIndex` : position déjà atteinte dans la file avant ce run (voir
// state.items_scheduled_in_phase / items_scheduled_for_silo) — indispensable
// pour qu'un run hebdomadaire continue l'espacement des dates là où le
// précédent s'est arrêté, au lieu de recalculer depuis le jour 0 à chaque
// fois (ce qui écraserait les dates déjà attribuées la semaine précédente).
// Jour calendaire (minuit UTC) qui accueille le `i`-ième créneau de la file,
// en sautant le dimanche quand `skipSundays` est vrai — le dimanche n'a
// simplement aucune capacité pour ce type de contenu, comme une phase 1.
function dayForSlot(start, i, capacity, skipSundays) {
  let day = new Date(start.getTime());
  day.setUTCHours(0, 0, 0, 0);
  let remaining = i;
  while (true) {
    if (skipSundays && isSunday(day)) { day = addDays(day, 1); continue; }
    if (remaining < capacity) return day;
    remaining -= capacity;
    day = addDays(day, 1);
  }
}

function computeSchedule({ phase, phaseStartDate, queue, capacityOverride, startIndex = 0, skipSundays = true }) {
  const capacity = capacityOverride ?? PHASE_CAPACITY_PER_DAY[phase];
  if (!capacity) {
    throw new Error(`scheduler: aucune capacité de publication pour la phase ${phase} (pause ou phase inconnue).`);
  }
  const start = new Date(phaseStartDate);

  return queue.map((item, localIndex) => {
    const i = startIndex + localIndex;
    const slotInDay = i % capacity;
    const { h, m } = timeOfDayForSlot(slotInDay, capacity);

    const day = dayForSlot(start, i, capacity, skipSundays);
    let date = new Date(day.getTime());
    date.setUTCHours(h, m, 0, 0);

    if (item.parentDate) {
      const parent = new Date(item.parentDate);
      let minDay = addDays(parent, 1);
      minDay.setUTCHours(0, 0, 0, 0);
      while (skipSundays && isSunday(minDay)) minDay = addDays(minDay, 1);
      const minDate = new Date(minDay.getTime());
      minDate.setUTCHours(h, m, 0, 0);
      if (date < minDate) date = minDate;
    }

    return { ...item, post_date: date.toISOString() };
  });
}

module.exports = { computeSchedule, PHASE_CAPACITY_PER_DAY };
