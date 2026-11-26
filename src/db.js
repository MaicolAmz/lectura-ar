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

module.exports = db;
