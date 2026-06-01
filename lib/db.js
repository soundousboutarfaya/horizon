"use strict";

const sqlite3 = require("sqlite3").verbose();

// Opens (or creates) the SQLite database and ensures the schema exists.
// `dbPath` may be ":memory:" for an ephemeral database (used in tests).
function createDatabase(dbPath) {
  const db = new sqlite3.Database(dbPath);

  db.serialize(() => {
    db.run(`
      CREATE TABLE IF NOT EXISTS reports (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        address TEXT NOT NULL,
        issueType TEXT NOT NULL,
        description TEXT NOT NULL,
        reportDate TEXT NOT NULL,
        reporterName TEXT NOT NULL,
        reporterEmail TEXT NOT NULL,
        photoPath TEXT,
        latitude REAL,
        longitude REAL,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS violations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        civic_no TEXT,
        street TEXT,
        arrondissement_code TEXT,
        arrondissement_name TEXT,
        address TEXT NOT NULL,
        contrevenant TEXT,
        article TEXT,
        nature_infraction TEXT,
        date_infraction TEXT,
        date_jugement TEXT,
        amende TEXT,
        latitude REAL,
        longitude REAL,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(civic_no, street, arrondissement_code, article, nature_infraction, date_infraction, date_jugement)
      )
    `);

    db.run(
      `CREATE INDEX IF NOT EXISTS idx_violations_addr ON violations(civic_no, street, arrondissement_code)`
    );
  });

  return db;
}

module.exports = { createDatabase };
