const express = require('express');
const db = require('./db');
const ai = require('./ia');
const points = require('./points');
const achievements = require('./achievements');
const { optionalProfile, AVATARS } = require('./profiles');
const { wordPattern } = require('./seed');

const HUNT_OPTIONS = 4;
const BLANK = '______';

const router = express.Router();

const findReading = (id) => db.prepare('SELECT * FROM readings WHERE id = ?').get(id);
const modelKey = (url) => (/([\w-]+)\.glb$/i.exec(url) || [])[1];

// Attempt number: counted by the server with a profile, taken from the client otherwise
// (anonymous play earns nothing, so trusting it there is harmless).
function attemptFor(req, game, refId) {
  if (!req.profile) return Number.isInteger(req.body.attempt) && req.body.attempt >= 1 ? req.body.attempt : 1;
  const n = db
    .prepare('SELECT COUNT(*) AS n FROM game_plays WHERE profile_id = ? AND game = ? AND ref_id = ?')
    .get(req.profile.id, game, refId).n;
  return n + 1;
}

// Logs the play and adds the reward fields (with a profile only).
function finishPlay(req, result, { game, readingId, refId, kind, value }) {
  if (!req.profile) return result;
  db.prepare('INSERT INTO game_plays (profile_id, game, reading_id, ref_id, correct) VALUES (?, ?, ?, ?, ?)').run(
    req.profile.id,
    game,
    readingId,
    refId,
    result.correct ? 1 : 0
  );
  const earned = result.correct ? points.upgrade(req.profile.id, kind, readingId, value) : 0;
  return { ...result, ...achievements.reward(req.profile.id, earned) };
}

/* ---------- Glossary pairs ---------- */
// The definitions are public (GET /api/readings/:id), so the client checks each pair itself;
// the server only confirms the complete set before paying.
router.post('/readings/:id/games/glossary', optionalProfile, (req, res) => {
  const reading = findReading(req.params.id);
  if (!reading) return res.status(404).json({ error: 'Lectura no encontrada.' });
  const ids = db.prepare('SELECT id FROM glossary WHERE reading_id = ?').all(reading.id).map((r) => String(r.id));
  const matches = req.body && req.body.matches;
  if (!matches || typeof matches !== 'object' || Array.isArray(matches)) {
    return res.status(400).json({ error: 'Faltan las parejas.' });
  }
  const correct = ids.length > 0 && Object.keys(matches).length === ids.length && ids.every((id) => String(matches[id]) === id);
  res.json(
    finishPlay(req, { correct }, { game: 'glossary', readingId: reading.id, refId: reading.id, kind: 'glossary', value: points.POINTS.glossary })
  );
});

/* ---------- Order the story ---------- */
router.post('/readings/:id/games/order', async (req, res) => {
  const reading = findReading(req.params.id);
  if (!reading) return res.status(404).json({ error: 'Lectura no encontrada.' });
  const { origin, events } = await ai.generateStoryEvents(reading);
  // Shown order is shuffled; solution[i] is the shown index of the i-th event in the story.
  const shown = ai.shuffle(events.map((text, position) => ({ text, position })));
  const solution = events.map((_, position) => shown.findIndex((e) => e.position === position));
  const info = db
    .prepare('INSERT INTO story_orders (reading_id, events, solution, origin) VALUES (?, ?, ?, ?)')
    .run(reading.id, JSON.stringify(shown.map((e) => e.text)), JSON.stringify(solution), origin);
  res.status(201).json({
    id: Number(info.lastInsertRowid),
    origin,
    events: shown.map((e, i) => ({ id: i, text: e.text })),
  });
});

router.post('/games/order/:id', optionalProfile, (req, res) => {
  const round = db.prepare('SELECT * FROM story_orders WHERE id = ?').get(req.params.id);
  if (!round) return res.status(404).json({ error: 'Partida no encontrada. Empieza una nueva.' });
  const solution = JSON.parse(round.solution);
  const order = req.body && req.body.order;
  const valid =
    Array.isArray(order) &&
    order.length === solution.length &&
    new Set(order).size === order.length &&
    order.every((id) => Number.isInteger(id) && id >= 0 && id < solution.length);
  if (!valid) return res.status(400).json({ error: 'Ordena todos los sucesos antes de comprobar.' });

  const attempt = attemptFor(req, 'order', round.id);
  // Per-slot marks let the student fix only what is wrong, without revealing where things go.
  const positions = order.map((id, i) => id === solution[i]);
  const correct = positions.every(Boolean);
  res.json(
    finishPlay(
      req,
      { correct, positions, attempt },
      { game: 'order', readingId: round.reading_id, refId: round.id, kind: 'order', value: points.byAttempt(points.POINTS.order, attempt) }
    )
  );
});

/* ---------- AR hunt ---------- */
const findHuntScene = (readingId) =>
  db
    .prepare('SELECT * FROM ar_scenes WHERE reading_id = ? AND hunt_word IS NOT NULL AND hunt_paragraph IS NOT NULL LIMIT 1')
    .get(readingId);

router.get('/readings/:id/games/hunt', (req, res) => {
  const reading = findReading(req.params.id);
  const scene = reading && findHuntScene(reading.id);
  if (!scene) return res.status(404).json({ error: 'Este juego no está disponible para esta lectura.' });
  const paragraph = String(reading.text).split(/\n+/).filter(Boolean)[scene.hunt_paragraph] || '';
  const answer = modelKey(scene.model_url);
  const distractors = ai.shuffle(AVATARS.filter((key) => key !== answer)).slice(0, HUNT_OPTIONS - 1);
  res.json({
    fragment: paragraph.replace(wordPattern(scene.hunt_word, 'giu'), BLANK),
    options: ai.shuffle([answer, ...distractors]),
  });
});

router.post('/readings/:id/games/hunt', optionalProfile, (req, res) => {
  const reading = findReading(req.params.id);
  const scene = reading && findHuntScene(reading.id);
  if (!scene) return res.status(404).json({ error: 'Este juego no está disponible para esta lectura.' });
  const option = req.body && req.body.option;
  if (!AVATARS.includes(option)) return res.status(400).json({ error: 'Elige uno de los objetos.' });
  const attempt = attemptFor(req, 'hunt', reading.id);
  const correct = option === modelKey(scene.model_url);
  res.json(
    finishPlay(
      req,
      { correct, attempt },
      { game: 'hunt', readingId: reading.id, refId: reading.id, kind: 'hunt', value: points.byAttempt(points.POINTS.hunt, attempt) }
    )
  );
});

module.exports = router;
