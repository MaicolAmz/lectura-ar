const db = require('./db');

const POINTS = {
  answered: 3,
  // Correct answer by attempt number (counted by the server, never trusted from the client).
  correct: [10, 5, 2],
  readingCompleted: 20,
  // Multiple choice is easier than writing: worth less, and nothing for a wrong pick.
  choiceCorrect: [5, 2],
  // Games pay once per reading; a later, better result upgrades the earlier one.
  glossary: 8,
  order: [15, 8, 4],
  hunt: [8, 3],
};
// Shorter answers get a canned "too short" reply and earn nothing, so "no sé" cannot farm points.
const MIN_ANSWER_LENGTH = 15;

// Value for attempt N of a scale; attempts past the end keep the last value.
const byAttempt = (scale, attempt) => scale[Math.min(attempt, scale.length) - 1];

const totalPoints = (profileId) =>
  db.prepare('SELECT COALESCE(SUM(points), 0) AS total FROM points WHERE profile_id = ?').get(profileId).total;

// Real attempts this profile already made on the question (short answers and refusals do not count).
const previousAttempts = (profileId, questionId) =>
  db
    .prepare(
      `SELECT COUNT(*) AS n FROM answers
       WHERE profile_id = ? AND question_id = ? AND origin IN ('ai', 'fallback') AND length(answer) >= ?`
    )
    .get(profileId, questionId, MIN_ANSWER_LENGTH).n;

const questionPoints = ({ correct, attempt }) => (correct ? byAttempt(POINTS.correct, attempt) : POINTS.answered);

const previousChoices = (profileId, questionId) =>
  db
    .prepare("SELECT COUNT(*) AS n FROM answers WHERE profile_id = ? AND question_id = ? AND origin = 'choice'")
    .get(profileId, questionId).n;

// Returns how many points were added. An item keeps its best score: a better result
// upgrades the row instead of adding up (e.g. a question answered both written and by choice).
function upgrade(profileId, kind, refId, value) {
  if (value <= 0) return 0;
  const award = db.transaction(() => {
    const before = db
      .prepare('SELECT points FROM points WHERE profile_id = ? AND kind = ? AND ref_id = ?')
      .get(profileId, kind, refId);
    const current = before ? before.points : 0;
    if (value <= current) return 0;
    db.prepare(
      `INSERT INTO points (profile_id, kind, ref_id, points) VALUES (?, ?, ?, ?)
       ON CONFLICT (profile_id, kind, ref_id) DO UPDATE SET points = excluded.points`
    ).run(profileId, kind, refId, value);
    return value - current;
  });
  return award();
}

function awardAnswer({ profileId, questionId, attempt, origin, answer, correct }) {
  if (!['ai', 'fallback'].includes(origin) || answer.length < MIN_ANSWER_LENGTH) return 0;
  return upgrade(profileId, 'question', questionId, questionPoints({ correct: Boolean(correct), attempt }));
}

function awardChoice({ profileId, questionId, attempt, correct }) {
  const value = correct ? POINTS.choiceCorrect[attempt - 1] || 0 : 0;
  return upgrade(profileId, 'question', questionId, value);
}

function awardReading(profileId, readingId) {
  return upgrade(profileId, 'reading', readingId, POINTS.readingCompleted);
}

module.exports = {
  POINTS,
  MIN_ANSWER_LENGTH,
  byAttempt,
  totalPoints,
  previousAttempts,
  previousChoices,
  upgrade,
  awardAnswer,
  awardChoice,
  awardReading,
};
