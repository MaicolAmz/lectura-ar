const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const db = require('./db');
const ai = require('./ia');
const points = require('./points');

const app = express();

// Render sits behind a proxy; without this every client shares the proxy's IP for rate limiting.
app.set('trust proxy', 1);
app.disable('x-powered-by');

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        // model-viewer is loaded from jsDelivr and fetches Draco/KTX2 decoders from gstatic.
        scriptSrc: ["'self'", 'https://cdn.jsdelivr.net', 'https://www.gstatic.com'],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        imgSrc: ["'self'", 'data:', 'blob:'],
        connectSrc: ["'self'", 'blob:', 'data:', 'https://cdn.jsdelivr.net', 'https://www.gstatic.com'],
        workerSrc: ["'self'", 'blob:'],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
      },
    },
  })
);

// Same-origin by default (the frontend is served from here); set ALLOWED_ORIGIN to open it to another site.
const allowedOrigin = process.env.ALLOWED_ORIGIN;
if (allowedOrigin) {
  app.use(cors({ origin: allowedOrigin.split(',').map((o) => o.trim()) }));
}

app.use(express.json({ limit: '10kb' }));

// Generic cap for the whole API, plus a strict one on the routes that spend AI quota.
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  skip: () => process.env.RATE_LIMIT_DISABLED === '1',
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas solicitudes, intenta de nuevo en un momento.' },
});
const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  skip: () => process.env.RATE_LIMIT_DISABLED === '1',
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas solicitudes a la IA, espera un minuto.' },
});
const createProfileLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 20,
  skip: () => process.env.RATE_LIMIT_DISABLED === '1',
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados perfiles creados desde esta red, intenta más tarde.' },
});
app.use('/api', apiLimiter);
app.post('/api/profiles', createProfileLimiter);
app.post('/api/readings/:id/questions', aiLimiter);
app.post('/api/questions/:id/feedback', aiLimiter);

app.use(express.static(path.join(__dirname, '..', 'public')));

const { router: profilesRouter, optionalProfile } = require('./profiles');
app.use('/api/profiles', profilesRouter);

const GRADES = [8, 9, 10];
const MAX_ANSWER_LENGTH = 1500;

app.get('/api/grades', (req, res) => {
  res.json(GRADES.map((grade) => ({ grade, name: `${grade}.º de EGB` })));
});

app.get('/api/readings', (req, res) => {
  const grade = Number(req.query.grade);
  if (!GRADES.includes(grade)) {
    return res.status(400).json({ error: 'El curso debe ser 8, 9 o 10.' });
  }
  const rows = db
    .prepare('SELECT id, title, author, duration_min FROM readings WHERE grade = ? ORDER BY id')
    .all(grade);
  res.json(rows);
});

app.get('/api/readings/:id', (req, res) => {
  const reading = db.prepare('SELECT * FROM readings WHERE id = ?').get(req.params.id);
  if (!reading) return res.status(404).json({ error: 'Lectura no encontrada.' });
  reading.glossary = db
    .prepare('SELECT id, word, definition FROM glossary WHERE reading_id = ?')
    .all(reading.id);
  reading.ar_scenes = db
    .prepare('SELECT id, name, model_url, description, scale FROM ar_scenes WHERE reading_id = ?')
    .all(reading.id);
  res.json(reading);
});

app.post('/api/readings/:id/questions', async (req, res) => {
  const reading = db.prepare('SELECT * FROM readings WHERE id = ?').get(req.params.id);
  if (!reading) return res.status(404).json({ error: 'Lectura no encontrada.' });

  // Questions from earlier batches, so "repeat exercises" asks something new (HU-10).
  const previous = db
    .prepare('SELECT statement FROM questions WHERE reading_id = ? ORDER BY id DESC LIMIT 9')
    .all(reading.id)
    .map((row) => row.statement);

  let generated;
  try {
    generated = await ai.generateQuestions(reading, { previous });
  } catch (err) {
    console.error('AI generateQuestions failed:', err.message);
    return res.status(503).json({
      error: 'No pudimos generar las preguntas ahora mismo, puedes seguir leyendo.',
    });
  }

  const insert = db.prepare(
    `INSERT INTO questions (reading_id, batch, type, statement, base_hint, origin)
     VALUES (?, ?, ?, ?, ?, ?)`
  );
  const save = db.transaction(() =>
    generated.questions.map((q) => {
      const info = insert.run(reading.id, generated.batch, q.type, q.statement, q.base_hint, generated.origin);
      return { id: Number(info.lastInsertRowid), type: q.type, statement: q.statement, base_hint: q.base_hint };
    })
  );
  const questions = save();
  res.status(201).json({ batch: generated.batch, origin: generated.origin, questions });
});

app.post('/api/questions/:id/feedback', optionalProfile, async (req, res) => {
  const question = db.prepare('SELECT * FROM questions WHERE id = ?').get(req.params.id);
  if (!question) return res.status(404).json({ error: 'Pregunta no encontrada.' });

  const { answer, attempt } = req.body || {};
  if (typeof answer !== 'string' || answer.trim() === '') {
    return res.status(400).json({ error: 'La respuesta no puede estar vacía.' });
  }
  const text = answer.trim().slice(0, MAX_ANSWER_LENGTH);
  // With a profile the server counts attempts itself: the client's number scores points otherwise.
  const attemptNumber = req.profile
    ? points.previousAttempts(req.profile.id, question.id) + 1
    : Number.isInteger(attempt) && attempt >= 1
      ? attempt
      : 1;

  const reading = db.prepare('SELECT * FROM readings WHERE id = ?').get(question.reading_id);
  try {
    const result = await ai.giveFeedback({
      reading,
      question,
      answer: text,
      attempt: attemptNumber,
      student: req.profile && { nickname: req.profile.nickname },
    });
    if (req.profile) {
      db.prepare(
        'INSERT INTO answers (profile_id, question_id, attempt, answer, feedback, origin) VALUES (?, ?, ?, ?, ?, ?)'
      ).run(req.profile.id, question.id, attemptNumber, text, result.feedback, result.origin);
      result.points_earned = points.awardAnswer({
        profileId: req.profile.id,
        questionId: question.id,
        attempt: attemptNumber,
        origin: result.origin,
        answer: text,
        correct: result.correct,
      });
      result.total_points = points.totalPoints(req.profile.id);
    }
    res.json(result);
  } catch (err) {
    console.error('AI giveFeedback failed:', err.message);
    res.status(503).json({
      error: 'No pudimos darte retroalimentación ahora mismo, puedes seguir leyendo.',
    });
  }
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Malformed JSON and unexpected failures: never leak stack traces to clients.
app.use((err, req, res, next) => {
  if (err.type === 'entity.too.large') return res.status(413).json({ error: 'La solicitud es demasiado grande.' });
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'JSON inválido.' });
  console.error('Unhandled error:', err.message);
  res.status(500).json({ error: 'Error interno del servidor.' });
});

if (require.main === module) {
  const port = process.env.PORT || 3000;
  app.listen(port, () => console.log(`LecturaAR backend escuchando en http://localhost:${port}`));
}

module.exports = app;
