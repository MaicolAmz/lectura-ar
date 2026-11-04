const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const db = new Database(process.env.DB_PATH || 'lecturaar.db');

// foreign_keys is a per-connection setting in SQLite and is off by default;
// without it ON DELETE CASCADE would silently do nothing.
db.pragma('foreign_keys = ON');
db.pragma('journal_mode = WAL');

db.exec(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));

module.exports = db;
