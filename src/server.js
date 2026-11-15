const path = require('path');
const express = require('express');
const cors = require('cors');
const db = require('./db');
const ai = require('./ia');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

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

app.post('/api/questions/:id/feedback', async (req, res) => {
  const question = db.prepare('SELECT * FROM questions WHERE id = ?').get(req.params.id);
  if (!question) return res.status(404).json({ error: 'Pregunta no encontrada.' });

  const { answer, attempt } = req.body || {};
  if (typeof answer !== 'string' || answer.trim() === '') {
    return res.status(400).json({ error: 'La respuesta no puede estar vacía.' });
  }
  const text = answer.trim().slice(0, MAX_ANSWER_LENGTH);
  const attemptNumber = Number.isInteger(attempt) && attempt >= 1 ? attempt : 1;

  const reading = db.prepare('SELECT * FROM readings WHERE id = ?').get(question.reading_id);
  try {
    const result = await ai.giveFeedback({ reading, question, answer: text, attempt: attemptNumber });
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

if (require.main === module) {
  const port = process.env.PORT || 3000;
  app.listen(port, () => console.log(`LecturaAR backend escuchando en http://localhost:${port}`));
}

module.exports = app;
