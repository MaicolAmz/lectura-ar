const path = require('path');
const express = require('express');
const cors = require('cors');
const db = require('./db');
const ia = require('./ia');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

const CURSOS = [8, 9, 10];
const MAX_RESPUESTA = 1500;

app.get('/api/cursos', (req, res) => {
  res.json(CURSOS.map((curso) => ({ curso, nombre: `${curso}.º de EGB` })));
});

app.get('/api/lecturas', (req, res) => {
  const curso = Number(req.query.curso);
  if (!CURSOS.includes(curso)) {
    return res.status(400).json({ error: 'El curso debe ser 8, 9 o 10.' });
  }
  const rows = db
    .prepare('SELECT id, titulo, autor, duracion_min FROM lecturas WHERE curso = ? ORDER BY id')
    .all(curso);
  res.json(rows);
});

app.get('/api/lecturas/:id', (req, res) => {
  const lectura = db.prepare('SELECT * FROM lecturas WHERE id = ?').get(req.params.id);
  if (!lectura) return res.status(404).json({ error: 'Lectura no encontrada.' });
  lectura.glosario = db
    .prepare('SELECT id, palabra, definicion FROM glosario WHERE lectura_id = ?')
    .all(lectura.id);
  lectura.escenas_ar = db
    .prepare('SELECT id, nombre, modelo_url, descripcion, escala FROM escenas_ar WHERE lectura_id = ?')
    .all(lectura.id);
  res.json(lectura);
});

app.post('/api/lecturas/:id/preguntas', async (req, res) => {
  const lectura = db.prepare('SELECT * FROM lecturas WHERE id = ?').get(req.params.id);
  if (!lectura) return res.status(404).json({ error: 'Lectura no encontrada.' });

  let generado;
  try {
    generado = await ia.generarPreguntas(lectura);
  } catch (err) {
    console.error('IA generarPreguntas falló:', err.message);
    return res.status(503).json({
      error: 'No pudimos generar las preguntas ahora mismo, puedes seguir leyendo.',
    });
  }

  const insert = db.prepare(
    `INSERT INTO preguntas (lectura_id, lote, tipo, enunciado, pista_base, origen)
     VALUES (?, ?, ?, ?, ?, ?)`
  );
  const guardar = db.transaction(() =>
    generado.preguntas.map((p) => {
      const info = insert.run(lectura.id, generado.lote, p.tipo, p.enunciado, p.pista_base, generado.origen);
      return { id: Number(info.lastInsertRowid), tipo: p.tipo, enunciado: p.enunciado, pista_base: p.pista_base };
    })
  );
  const preguntas = guardar();
  res.status(201).json({ lote: generado.lote, origen: generado.origen, preguntas });
});

app.post('/api/preguntas/:id/retroalimentacion', async (req, res) => {
  const pregunta = db.prepare('SELECT * FROM preguntas WHERE id = ?').get(req.params.id);
  if (!pregunta) return res.status(404).json({ error: 'Pregunta no encontrada.' });

  const { respuesta, intento } = req.body || {};
  if (typeof respuesta !== 'string' || respuesta.trim() === '') {
    return res.status(400).json({ error: 'La respuesta no puede estar vacía.' });
  }
  const texto = respuesta.trim().slice(0, MAX_RESPUESTA);
  const n = Number.isInteger(intento) && intento >= 1 ? intento : 1;

  const lectura = db.prepare('SELECT * FROM lecturas WHERE id = ?').get(pregunta.lectura_id);
  try {
    const out = await ia.retroalimentar({ lectura, pregunta, respuesta: texto, intento: n });
    res.json(out);
  } catch (err) {
    console.error('IA retroalimentar falló:', err.message);
    res.status(503).json({
      error: 'No pudimos darte retroalimentación ahora mismo, puedes seguir leyendo.',
    });
  }
});

app.get('/api/salud', (req, res) => {
  res.json({ estado: 'ok' });
});

if (require.main === module) {
  const port = process.env.PORT || 3000;
  app.listen(port, () => console.log(`LecturaAR backend escuchando en http://localhost:${port}`));
}

module.exports = app;
