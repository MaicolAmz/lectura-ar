CREATE TABLE IF NOT EXISTS readings (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  grade        INTEGER NOT NULL CHECK (grade IN (8, 9, 10)),
  title        TEXT NOT NULL,
  author       TEXT NOT NULL,
  source       TEXT NOT NULL DEFAULT '',
  duration_min INTEGER NOT NULL,
  text         TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS glossary (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  reading_id INTEGER NOT NULL REFERENCES readings(id) ON DELETE CASCADE,
  word       TEXT NOT NULL,
  definition TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ar_scenes (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  reading_id  INTEGER NOT NULL REFERENCES readings(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  model_url   TEXT NOT NULL,
  description TEXT NOT NULL,
  scale       REAL NOT NULL DEFAULT 1.0
);

CREATE TABLE IF NOT EXISTS questions (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  reading_id INTEGER NOT NULL REFERENCES readings(id) ON DELETE CASCADE,
  batch      TEXT NOT NULL,
  type       TEXT NOT NULL CHECK (type IN ('inference', 'author_intent')),
  statement  TEXT NOT NULL,
  base_hint  TEXT NOT NULL,
  origin     TEXT NOT NULL DEFAULT 'ai' CHECK (origin IN ('ai', 'fallback')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_readings_grade          ON readings(grade);
CREATE INDEX IF NOT EXISTS idx_glossary_reading        ON glossary(reading_id);
CREATE INDEX IF NOT EXISTS idx_ar_scenes_reading       ON ar_scenes(reading_id);
CREATE INDEX IF NOT EXISTS idx_questions_reading       ON questions(reading_id);
CREATE INDEX IF NOT EXISTS idx_questions_reading_batch ON questions(reading_id, batch);
