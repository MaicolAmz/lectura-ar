const db = require('./db');
const points = require('./points');

// Students are in Ecuador (UTC-5 all year, no daylight saving): a day starts at local midnight,
// not at UTC midnight, or an answer at 8 p.m. would count for "tomorrow".
const UTC_OFFSET_MS = -5 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

const localDay = (date = new Date()) => new Date(date.getTime() + UTC_OFFSET_MS).toISOString().slice(0, 10);
const dayNumber = (day) => Math.round(Date.parse(`${day}T00:00:00Z`) / DAY_MS);

function recordActivity(profileId, date = new Date()) {
  db.prepare('INSERT OR IGNORE INTO activity_days (profile_id, day) VALUES (?, ?)').run(profileId, localDay(date));
}

// current: consecutive days ending today, or yesterday (the streak is still alive until tonight).
function streak(profileId, date = new Date()) {
  const days = db
    .prepare('SELECT day FROM activity_days WHERE profile_id = ? ORDER BY day')
    .all(profileId)
    .map((row) => dayNumber(row.day));
  let best = 0;
  let run = 0;
  for (let i = 0; i < days.length; i++) {
    run = i > 0 && days[i] === days[i - 1] + 1 ? run + 1 : 1;
    best = Math.max(best, run);
  }
  const today = dayNumber(localDay(date));
  const last = days[days.length - 1];
  const current = last === today || last === today - 1 ? run : 0;
  return { current, best };
}

// Ids are stored in the points ledger (kind 'badge'): never renumber or reuse them.
const BADGES = [
  { id: 1, emoji: '📖', name: 'Primera lectura', description: 'Completa tu primera lectura.', points: 5, test: (s) => s.readings >= 1 },
  { id: 2, emoji: '📚', name: 'Lector constante', description: 'Completa 5 lecturas.', points: 15, test: (s) => s.readings >= 5 },
  { id: 3, emoji: '🎯', name: 'Buen ojo', description: 'Gana puntos en 10 preguntas.', points: 10, test: (s) => s.questions >= 10 },
  { id: 4, emoji: '⚡', name: 'A la primera', description: 'Acierta 5 preguntas escritas al primer intento.', points: 15, test: (s) => s.firstTry >= 5 },
  { id: 5, emoji: '🔥', name: 'Racha de 3 días', description: 'Practica 3 días seguidos.', points: 10, test: (s) => s.bestStreak >= 3 },
  { id: 6, emoji: '🌟', name: 'Racha de 7 días', description: 'Practica 7 días seguidos.', points: 25, test: (s) => s.bestStreak >= 7 },
  { id: 7, emoji: '🔤', name: 'Diccionario', description: 'Completa las parejas del glosario en 3 lecturas.', points: 10, test: (s) => s.glossary >= 3 },
  { id: 8, emoji: '🧩', name: 'Cronista', description: 'Ordena la historia de 3 lecturas.', points: 10, test: (s) => s.order >= 3 },
  { id: 9, emoji: '🔍', name: 'Explorador', description: 'Encuentra el objeto AR de 3 lecturas.', points: 10, test: (s) => s.hunt >= 3 },
];

// Counted from the ledger, which survives re-seeding (answers and reading_progress do not).
function stats(profileId) {
  const counts = Object.fromEntries(
    db
      .prepare("SELECT kind, COUNT(*) AS n FROM points WHERE profile_id = ? AND kind != 'badge' GROUP BY kind")
      .all(profileId)
      .map((row) => [row.kind, row.n])
  );
  const firstTry = db
    .prepare("SELECT COUNT(*) AS n FROM points WHERE profile_id = ? AND kind = 'question' AND points = ?")
    .get(profileId, points.POINTS.correct[0]).n;
  return {
    readings: counts.reading || 0,
    questions: counts.question || 0,
    glossary: counts.glossary || 0,
    order: counts.order || 0,
    hunt: counts.hunt || 0,
    firstTry,
    bestStreak: streak(profileId).best,
  };
}

const publicBadge = ({ id, emoji, name, description, points: value }) => ({ id, emoji, name, description, points: value });

// Awards every badge whose goal is now met; returns only the new ones.
function checkBadges(profileId) {
  const owned = new Set(
    db.prepare("SELECT ref_id FROM points WHERE profile_id = ? AND kind = 'badge'").all(profileId).map((r) => r.ref_id)
  );
  const pending = BADGES.filter((b) => !owned.has(b.id));
  if (pending.length === 0) return [];
  const s = stats(profileId);
  return pending.filter((b) => b.test(s) && points.upgrade(profileId, 'badge', b.id, b.points) > 0).map(publicBadge);
}

function badgeList(profileId) {
  const earned = new Map(
    db
      .prepare("SELECT ref_id, created_at FROM points WHERE profile_id = ? AND kind = 'badge'")
      .all(profileId)
      .map((r) => [r.ref_id, r.created_at])
  );
  return BADGES.map((b) => ({ ...publicBadge(b), earned: earned.has(b.id), earned_at: earned.get(b.id) || null }));
}

// The common tail of every scoring response. points_earned is the action alone; each new
// badge carries its own points (both are already in total_points).
function reward(profileId, earned) {
  recordActivity(profileId);
  const badges = checkBadges(profileId);
  return { points_earned: earned, badges_earned: badges, total_points: points.totalPoints(profileId) };
}

module.exports = { BADGES, localDay, recordActivity, streak, checkBadges, badgeList, reward };
