const crypto = require('crypto');
const express = require('express');
const db = require('./db');

const GRADES = [8, 9, 10];
const AVATARS = ['fox', 'bird', 'fish', 'tree', 'lantern', 'canoe', 'volcano', 'stone', 'mangrove'];
const NICKNAME_MIN = 2;
const NICKNAME_MAX = 20;

// Only the hash is stored: a leaked database cannot be used to impersonate a profile.
const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

const publicProfile = (row) => ({
  id: row.id,
  nickname: row.nickname,
  avatar: row.avatar,
  grade: row.grade,
  created_at: row.created_at,
});

// Returns a cleaned object, or { error }. With `partial`, absent fields are skipped (PATCH).
function validate(body, { partial }) {
  const input = body || {};
  const out = {};
  const has = (key) => input[key] !== undefined;

  if (!partial || has('nickname')) {
    // Collapse whitespace so "  Ana   María " and "Ana María" are the same nickname.
    const nickname = typeof input.nickname === 'string' ? input.nickname.trim().replace(/\s+/g, ' ') : '';
    if (nickname.length < NICKNAME_MIN || nickname.length > NICKNAME_MAX) {
      return { error: `El apodo debe tener entre ${NICKNAME_MIN} y ${NICKNAME_MAX} caracteres.` };
    }
    out.nickname = nickname;
  }
  if (!partial || has('avatar')) {
    if (!AVATARS.includes(input.avatar)) return { error: `El avatar debe ser uno de: ${AVATARS.join(', ')}.` };
    out.avatar = input.avatar;
  }
  if (!partial || has('grade')) {
    if (!GRADES.includes(input.grade)) return { error: 'El curso debe ser 8, 9 o 10.' };
    out.grade = input.grade;
  }
  if (partial && Object.keys(out).length === 0) return { error: 'No hay nada que actualizar.' };
  return { value: out };
}

function findProfile(req) {
  const match = /^Bearer (.+)$/.exec(req.get('authorization') || '');
  const profile = match && db.prepare('SELECT * FROM profiles WHERE token_hash = ?').get(hashToken(match[1].trim()));
  if (profile) db.prepare("UPDATE profiles SET last_seen = datetime('now') WHERE id = ?").run(profile.id);
  return profile || null;
}

function requireProfile(req, res, next) {
  req.profile = findProfile(req);
  if (!req.profile) return res.status(401).json({ error: 'Perfil no reconocido. Crea uno nuevo.' });
  next();
}

// Anonymous use stays allowed: a missing or stale token just means "nothing is saved".
function optionalProfile(req, res, next) {
  req.profile = findProfile(req);
  next();
}

const router = express.Router();

router.get('/avatars', (req, res) => res.json(AVATARS));

router.post('/', (req, res) => {
  const { value, error } = validate(req.body, { partial: false });
  if (error) return res.status(400).json({ error });

  // The token is shown once, here; the client keeps it (e.g. localStorage) as the "login".
  const token = crypto.randomBytes(32).toString('hex');
  const info = db
    .prepare('INSERT INTO profiles (token_hash, nickname, avatar, grade) VALUES (?, ?, ?, ?)')
    .run(hashToken(token), value.nickname, value.avatar, value.grade);
  const row = db.prepare('SELECT * FROM profiles WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json({ profile: publicProfile(row), token });
});

router.get('/me', requireProfile, (req, res) => res.json(publicProfile(req.profile)));

router.patch('/me', requireProfile, (req, res) => {
  const { value, error } = validate(req.body, { partial: true });
  if (error) return res.status(400).json({ error });

  const next = { ...req.profile, ...value };
  db.prepare('UPDATE profiles SET nickname = ?, avatar = ?, grade = ? WHERE id = ?').run(
    next.nickname,
    next.avatar,
    next.grade,
    req.profile.id
  );
  res.json(publicProfile(next));
});

router.delete('/me', requireProfile, (req, res) => {
  db.prepare('DELETE FROM profiles WHERE id = ?').run(req.profile.id);
  res.status(204).end();
});

router.post('/me/readings/:id/complete', requireProfile, (req, res) => {
  const reading = db.prepare('SELECT id FROM readings WHERE id = ?').get(req.params.id);
  if (!reading) return res.status(404).json({ error: 'Lectura no encontrada.' });
  // Idempotent: completing twice keeps the first completion date.
  db.prepare('INSERT OR IGNORE INTO reading_progress (profile_id, reading_id) VALUES (?, ?)').run(
    req.profile.id,
    reading.id
  );
  res.status(204).end();
});

router.get('/me/progress', requireProfile, (req, res) => {
  const readings = db
    .prepare(
      `SELECT r.id AS reading_id, r.title, r.grade,
              rp.completed_at IS NOT NULL AS completed,
              rp.completed_at,
              COUNT(DISTINCT a.question_id) AS questions_answered,
              COUNT(a.id) AS attempts,
              MAX(a.created_at) AS last_activity
       FROM readings r
       LEFT JOIN reading_progress rp ON rp.reading_id = r.id AND rp.profile_id = @id
       LEFT JOIN questions q ON q.reading_id = r.id
       LEFT JOIN answers a ON a.question_id = q.id AND a.profile_id = @id
       GROUP BY r.id
       HAVING completed = 1 OR attempts > 0
       ORDER BY r.id`
    )
    .all({ id: req.profile.id })
    .map((row) => ({ ...row, completed: Boolean(row.completed) }));

  res.json({
    completed_readings: readings.filter((r) => r.completed).length,
    total_attempts: readings.reduce((sum, r) => sum + r.attempts, 0),
    readings,
  });
});

module.exports = { router, optionalProfile };
