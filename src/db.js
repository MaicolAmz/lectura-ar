const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const db = new Database(process.env.DB_PATH || 'lecturaar.db');

// foreign_keys is a per-connection setting in SQLite and is off by default;
// without it ON DELETE CASCADE would silently do nothing.
db.pragma('foreign_keys = ON');
db.pragma('journal_mode = WAL');

db.exec(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));

// CREATE TABLE IF NOT EXISTS leaves older databases untouched, so new columns are added here.
const questionColumns = db.prepare('PRAGMA table_info(questions)').all().map((c) => c.name);
if (!questionColumns.includes('options')) db.exec('ALTER TABLE questions ADD COLUMN options TEXT');
if (!questionColumns.includes('correct_option')) db.exec('ALTER TABLE questions ADD COLUMN correct_option INTEGER');
const profileColumns = db.prepare('PRAGMA table_info(profiles)').all().map((c) => c.name);
if (!profileColumns.includes('is_guest')) db.exec('ALTER TABLE profiles ADD COLUMN is_guest INTEGER NOT NULL DEFAULT 0');
const sceneColumns = db.prepare('PRAGMA table_info(ar_scenes)').all().map((c) => c.name);
if (!sceneColumns.includes('hunt_paragraph')) db.exec('ALTER TABLE ar_scenes ADD COLUMN hunt_paragraph INTEGER');
if (!sceneColumns.includes('hunt_word')) db.exec('ALTER TABLE ar_scenes ADD COLUMN hunt_word TEXT');

// SQLite cannot alter a CHECK constraint: an old points table is rebuilt with the new kinds.
const pointsSql = db.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'points'").get().sql;
if (!pointsSql.includes("'badge'")) {
  db.transaction(() => {
    db.exec(`
      CREATE TABLE points_new (
        profile_id INTEGER NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
        kind       TEXT NOT NULL CHECK (kind IN ('question', 'reading', 'glossary', 'order', 'hunt', 'badge')),
        ref_id     INTEGER NOT NULL,
        points     INTEGER NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        PRIMARY KEY (profile_id, kind, ref_id)
      );
      INSERT INTO points_new SELECT profile_id, kind, ref_id, points, created_at FROM points;
      DROP TABLE points;
      ALTER TABLE points_new RENAME TO points;
    `);
  })();
}

module.exports = db;
