CREATE TABLE IF NOT EXISTS lecturas (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  curso        INTEGER NOT NULL CHECK (curso IN (8, 9, 10)),
  titulo       TEXT NOT NULL,
  autor        TEXT NOT NULL,
  duracion_min INTEGER NOT NULL,
  texto        TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS glosario (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  lectura_id INTEGER NOT NULL REFERENCES lecturas(id) ON DELETE CASCADE,
  palabra    TEXT NOT NULL,
  definicion TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS escenas_ar (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  lectura_id  INTEGER NOT NULL REFERENCES lecturas(id) ON DELETE CASCADE,
  nombre      TEXT NOT NULL,
  modelo_url  TEXT NOT NULL,
  descripcion TEXT NOT NULL,
  escala      REAL NOT NULL DEFAULT 1.0
);

CREATE TABLE IF NOT EXISTS preguntas (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  lectura_id INTEGER NOT NULL REFERENCES lecturas(id) ON DELETE CASCADE,
  lote       TEXT NOT NULL,
  tipo       TEXT NOT NULL CHECK (tipo IN ('inferencia', 'intencion_autor')),
  enunciado  TEXT NOT NULL,
  pista_base TEXT NOT NULL,
  origen     TEXT NOT NULL DEFAULT 'ia' CHECK (origen IN ('ia', 'respaldo')),
  creada_en  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_lecturas_curso       ON lecturas(curso);
CREATE INDEX IF NOT EXISTS idx_glosario_lectura     ON glosario(lectura_id);
CREATE INDEX IF NOT EXISTS idx_escenas_lectura      ON escenas_ar(lectura_id);
CREATE INDEX IF NOT EXISTS idx_preguntas_lectura    ON preguntas(lectura_id);
CREATE INDEX IF NOT EXISTS idx_preguntas_lectura_lote ON preguntas(lectura_id, lote);
