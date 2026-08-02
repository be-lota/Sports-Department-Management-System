const path = require('path');
const fs = require('fs');
const { DatabaseSync } = require('node:sqlite');

const DB_PATH = path.join(__dirname, '..', 'data', 'sports.db');
const rawDb = new DatabaseSync(DB_PATH);

rawDb.exec('PRAGMA journal_mode = WAL');
rawDb.exec('PRAGMA foreign_keys = ON');

// Thin wrapper so route code can use the same db.prepare(...).run/get/all()
// and db.transaction(fn)() shape as better-sqlite3, without a native addon.
const db = {
  prepare: (sql) => rawDb.prepare(sql),
  exec: (sql) => rawDb.exec(sql),
  transaction(fn) {
    return (...args) => {
      rawDb.exec('BEGIN IMMEDIATE');
      try {
        const result = fn(...args);
        rawDb.exec('COMMIT');
        return result;
      } catch (err) {
        rawDb.exec('ROLLBACK');
        throw err;
      }
    };
  },
};

function migrate() {
  rawDb.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      name TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  const applied = new Set(rawDb.prepare('SELECT name FROM _migrations').all().map(r => r.name));
  const migrationsDir = path.join(__dirname, 'migrations');
  const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();

  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    rawDb.exec(sql);
    rawDb.prepare('INSERT INTO _migrations (name) VALUES (?)').run(file);
    console.log(`Applied migration: ${file}`);
  }
}

if (require.main === module && process.argv.includes('--migrate')) {
  migrate();
  console.log(`Database ready at ${DB_PATH}`);
}

module.exports = { db, migrate, DB_PATH };
