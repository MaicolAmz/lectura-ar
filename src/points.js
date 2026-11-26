const db = require('./db');

const POINTS = {
  answered: 3,
  // Correct answer by attempt number (counted by the server, never trusted from the client).
  correct: [10, 5, 2],
  readingCompleted: 20,
};
// Shorter answers get a canned "too short" reply and earn nothing, so "no sé" cannot farm points.
const MIN_ANSWER_LENGTH = 15;

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

const questionPoints = ({ correct, attempt }) =>
  correct ? POINTS.correct[Math.min(attempt, POINTS.correct.length) - 1] : POINTS.answered;

// Returns how many points this answer added. A question keeps its best score: answering it
// (+3) and later getting it right upgrades the row to the correct value instead of adding up.
function awardAnswer({ profileId, questionId, attempt, origin, answer, correct }) {
  if (!['ai', 'fallback'].includes(origin) || answer.length < MIN_ANSWER_LENGTH) return 0;
  const value = questionPoints({ correct: Boolean(correct), attempt });
  const award = db.transaction(() => {
    const before = db
      .prepare("SELECT points FROM points WHERE profile_id = ? AND kind = 'question' AND ref_id = ?")
      .get(profileId, questionId);
    const current = before ? before.points : 0;
    if (value <= current) return 0;
    db.prepare(
      `INSERT INTO points (profile_id, kind, ref_id, points) VALUES (?, 'question', ?, ?)
       ON CONFLICT (profile_id, kind, ref_id) DO UPDATE SET points = excluded.points`
    ).run(profileId, questionId, value);
    return value - current;
  });
  return award();
}

function awardReading(profileId, readingId) {
  const info = db
    .prepare("INSERT OR IGNORE INTO points (profile_id, kind, ref_id, points) VALUES (?, 'reading', ?, ?)")
    .run(profileId, readingId, POINTS.readingCompleted);
  return info.changes === 1 ? POINTS.readingCompleted : 0;
}

module.exports = { POINTS, totalPoints, previousAttempts, awardAnswer, awardReading };
