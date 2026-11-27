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
  scale       REAL NOT NULL DEFAULT 1.0,
  -- "AR hunt" game: this word is blanked out of paragraph hunt_paragraph (0-based) as the clue.
  hunt_paragraph INTEGER,
  hunt_word      TEXT
);

CREATE TABLE IF NOT EXISTS questions (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  reading_id INTEGER NOT NULL REFERENCES readings(id) ON DELETE CASCADE,
  batch      TEXT NOT NULL,
  type       TEXT NOT NULL CHECK (type IN ('inference', 'author_intent')),
  statement  TEXT NOT NULL,
  base_hint  TEXT NOT NULL,
  origin     TEXT NOT NULL DEFAULT 'ai' CHECK (origin IN ('ai', 'fallback')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  -- Multiple choice (NULL when the question is open-answer only). options is a JSON array;
  -- correct_option never leaves the server.
  options        TEXT,
  correct_option INTEGER
);

CREATE INDEX IF NOT EXISTS idx_readings_grade          ON readings(grade);
CREATE INDEX IF NOT EXISTS idx_glossary_reading        ON glossary(reading_id);
CREATE INDEX IF NOT EXISTS idx_ar_scenes_reading       ON ar_scenes(reading_id);
CREATE INDEX IF NOT EXISTS idx_questions_reading       ON questions(reading_id);
CREATE INDEX IF NOT EXISTS idx_questions_reading_batch ON questions(reading_id, batch);

CREATE TABLE IF NOT EXISTS profiles (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  token_hash TEXT NOT NULL UNIQUE,
  nickname   TEXT NOT NULL,
  avatar     TEXT NOT NULL,
  grade      INTEGER NOT NULL CHECK (grade IN (8, 9, 10)),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_seen  TEXT NOT NULL DEFAULT (datetime('now')),
  -- Guests are created silently on the first answer so points count before the student signs up;
  -- creating a real profile converts the guest row in place, keeping its points.
  is_guest   INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS answers (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  profile_id  INTEGER NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  question_id INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  attempt     INTEGER NOT NULL,
  answer      TEXT NOT NULL,
  feedback    TEXT NOT NULL,
  origin      TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS reading_progress (
  profile_id   INTEGER NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reading_id   INTEGER NOT NULL REFERENCES readings(id) ON DELETE CASCADE,
  completed_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (profile_id, reading_id)
);

-- Points ledger: one row per (profile, kind, ref), so each item pays out once.
-- kind 'question' -> ref_id is a question id; 'reading', 'glossary', 'order' and 'hunt' -> a reading id;
-- 'badge' -> a badge id from src/achievements.js.
-- src/db.js rebuilds older databases whose CHECK predates the game kinds.
CREATE TABLE IF NOT EXISTS points (
  profile_id INTEGER NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  kind       TEXT NOT NULL CHECK (kind IN ('question', 'reading', 'glossary', 'order', 'hunt', 'badge')),
  ref_id     INTEGER NOT NULL,
  points     INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (profile_id, kind, ref_id)
);

-- Days (Ecuador time) with any activity, for streaks. Only tied to the profile, so
-- re-seeding readings (which cascades to questions and answers) does not break a streak.
CREATE TABLE IF NOT EXISTS activity_days (
  profile_id INTEGER NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  day        TEXT NOT NULL,
  PRIMARY KEY (profile_id, day)
);

-- Every submission to a game, used to count attempts. reading_id/ref_id are plain numbers on
-- purpose (same reason as activity_days). ref_id: story_orders.id for 'order', the reading otherwise.
CREATE TABLE IF NOT EXISTS game_plays (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  profile_id INTEGER NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  game       TEXT NOT NULL CHECK (game IN ('glossary', 'order', 'hunt')),
  reading_id INTEGER NOT NULL,
  ref_id     INTEGER NOT NULL,
  correct    INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- "Order the story" rounds. events is the shuffled list shown to the student; solution
-- (indexes into events, in story order) never leaves the server.
CREATE TABLE IF NOT EXISTS story_orders (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  reading_id INTEGER NOT NULL REFERENCES readings(id) ON DELETE CASCADE,
  events     TEXT NOT NULL,
  solution   TEXT NOT NULL,
  origin     TEXT NOT NULL CHECK (origin IN ('ai', 'fallback')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_game_plays_profile ON game_plays(profile_id, game, ref_id);

CREATE INDEX IF NOT EXISTS idx_answers_profile  ON answers(profile_id);
CREATE INDEX IF NOT EXISTS idx_answers_question ON answers(question_id);
