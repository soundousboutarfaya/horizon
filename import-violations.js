const fs = require("fs");
const path = require("path");
const sqlite3 = require("sqlite3").verbose();

const CSV_PATH = path.join(__dirname, "contrevenants-condamnes.csv");
const DB_PATH = path.join(__dirname, "horizon.db");

const ARRONDISSEMENT_MAP = {
  ST: "Saint-Laurent",
  CN: "Côte-des-Neiges–Notre-Dame-de-Grâce",
  VM: "Ville-Marie",
  MN: "Montréal-Nord",
  VY: "Villeray–Saint-Michel–Parc-Extension",
  Vy: "Villeray–Saint-Michel–Parc-Extension",
  VE: "Verdun",
  LN: "Lachine",
  PL: "Le Plateau-Mont-Royal",
  HM: "Mercier–Hochelaga-Maisonneuve",
  RO: "Rosemont–La Petite-Patrie",
  AC: "Ahuntsic-Cartierville",
  IG: "L'Île-Bizard–Sainte-Geneviève",
  AJ: "Anjou",
  LS: "LaSalle"
};

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];

    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
      continue;
    }

    if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += c;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

const MONTREAL_BIAS = "&lat=45.5017&lon=-73.5673&location_bias_scale=0.3";

async function photonQuery(query) {
  const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=1${MONTREAL_BIAS}`;
  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await fetch(url, {
      headers: { "User-Agent": "Horizon/1.0 (import-violations; paularthur2001@gmail.com)" }
    });
    if (response.status === 429 || response.status >= 500) {
      const wait = 5000 * (attempt + 1);
      console.log(`    Photon ${response.status}, attente ${wait / 1000}s...`);
      await new Promise((r) => setTimeout(r, wait));
      continue;
    }
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    if (!data.features || !data.features.length) return null;
    const f = data.features[0];
    if (f.properties && f.properties.country !== "Canada") return null;
    const [lon, lat] = f.geometry.coordinates;
    return { lat, lng: lon };
  }
  throw new Error("Photon: échec après 3 tentatives");
}

function buildAddressLines(civic, street, arrondName) {
  const candidates = [];
  const cleanStreet = street.trim();
  const hasStreetType = /^(rue|avenue|av\.?|boulevard|boul\.?|chemin|ch\.?|place|pl\.?|route|rte|impasse|all[ée]e|cours|quai)\b/i.test(cleanStreet);
  const streetWithType = hasStreetType ? cleanStreet : `rue ${cleanStreet}`;

  if (arrondName) {
    candidates.push(`${civic} ${streetWithType}, ${arrondName}, Montréal, Québec, Canada`);
    candidates.push(`${civic} ${cleanStreet}, ${arrondName}, Montréal, Québec, Canada`);
  }
  candidates.push(`${civic} ${streetWithType}, Montréal, Québec, Canada`);
  candidates.push(`${civic} ${cleanStreet}, Montréal, Québec, Canada`);
  return [...new Set(candidates)];
}

async function geocodeAddress(civic, street, arrondName) {
  const candidates = buildAddressLines(civic, street, arrondName);
  for (const q of candidates) {
    try {
      const result = await photonQuery(q);
      await new Promise((r) => setTimeout(r, 250));
      if (result) return result;
    } catch (e) {
      console.error(`  ! geocode error for "${q}":`, e.message);
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  return null;
}

function dbRun(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

function dbAll(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

async function main() {
  const csv = fs.readFileSync(CSV_PATH, "utf-8");
  const rows = parseCsv(csv).filter((r) => r.length > 1);
  const header = rows.shift();
  console.log(`CSV: ${rows.length} lignes (colonnes: ${header.join(", ")})`);

  const db = new sqlite3.Database(DB_PATH);

  await dbRun(db, `
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

  await dbRun(db, `CREATE INDEX IF NOT EXISTS idx_violations_addr ON violations(civic_no, street, arrondissement_code)`);

  const geocodeCache = new Map();
  const existing = await dbAll(db, `SELECT civic_no, street, arrondissement_code, latitude, longitude FROM violations WHERE latitude IS NOT NULL`);
  existing.forEach((r) => {
    geocodeCache.set(`${r.civic_no}|${r.street}|${r.arrondissement_code}`, { lat: r.latitude, lng: r.longitude });
  });
  console.log(`Cache initial: ${geocodeCache.size} adresses déjà géocodées`);

  let inserted = 0;
  let skipped = 0;
  let geocoded = 0;
  let i = 0;

  for (const cols of rows) {
    i++;
    const [civic, street, code, contrevenant, article, nature, dateInf, dateJug, amende] = cols.map((s) => s.trim());
    if (!civic || !street) {
      skipped++;
      continue;
    }
    const arrondName = ARRONDISSEMENT_MAP[code] || code || "";
    const addressParts = [`${civic} ${street}`, arrondName, "Montréal", "Québec", "Canada"].filter(Boolean);
    const address = addressParts.join(", ");

    const cacheKey = `${civic}|${street}|${code}`;
    let coords = geocodeCache.get(cacheKey);
    if (!coords) {
      console.log(`[${i}/${rows.length}] géocodage: ${civic} ${street} (${code})`);
      coords = await geocodeAddress(civic, street, arrondName);
      if (coords) {
        geocodeCache.set(cacheKey, coords);
        geocoded++;
      } else {
        console.log(`  → introuvable`);
        geocodeCache.set(cacheKey, { lat: null, lng: null });
      }
    }

    try {
      const result = await dbRun(db, `
        INSERT OR IGNORE INTO violations (
          civic_no, street, arrondissement_code, arrondissement_name, address,
          contrevenant, article, nature_infraction, date_infraction, date_jugement, amende,
          latitude, longitude
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        civic, street, code, arrondName, address,
        contrevenant, article, nature, dateInf, dateJug, amende,
        coords ? coords.lat : null,
        coords ? coords.lng : null
      ]);
      if (result.changes > 0) inserted++;
      else skipped++;
    } catch (e) {
      console.error(`  ! insert error:`, e.message);
      skipped++;
    }
  }

  console.log(`\nTerminé. Inséré: ${inserted}, ignoré (doublons): ${skipped}, géocodé: ${geocoded}`);
  db.close();
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
