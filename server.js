"use strict";

const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const config = require("./config");
const { createDatabase } = require("./lib/db");
const { geocodeAddress } = require("./lib/geocode");
const { searchTokens, addressMatchesTokens } = require("./lib/text");
const { createRequireAdmin } = require("./lib/auth");

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function createApp(db) {
  const app = express();

  // --- Uploads (photos) -----------------------------------------------------
  if (!fs.existsSync(config.uploadsDir)) {
    fs.mkdirSync(config.uploadsDir, { recursive: true });
  }

  const storage = multer.diskStorage({
    destination: (_, __, cb) => cb(null, config.uploadsDir),
    filename: (_, file, cb) => {
      const ext = path.extname(file.originalname || "");
      cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext || ".jpg"}`);
    },
  });

  const upload = multer({
    storage,
    limits: { fileSize: config.maxPhotoSize },
    fileFilter: (_, file, cb) => {
      if (config.allowedImageTypes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error("Type de fichier non autorisé. Formats acceptés : JPEG, PNG, WebP, GIF."));
      }
    },
  });

  const requireAdmin = createRequireAdmin(config.admin);

  // --- Middleware -----------------------------------------------------------
  app.use((req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("X-DNS-Prefetch-Control", "off");
    next();
  });

  app.use(express.static(config.publicDir));
  app.use("/uploads", express.static(config.uploadsDir));
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // --- Pages ----------------------------------------------------------------
  app.get("/", (_, res) => {
    res.sendFile(path.join(config.publicDir, "index.html"));
  });

  app.get("/admin", requireAdmin, (_, res) => {
    res.sendFile(path.join(config.privateDir, "admin.html"));
  });

  // --- Admin API ------------------------------------------------------------
  app.get("/api/admin/reports", requireAdmin, (_, res) => {
    db.all(
      `SELECT id, address, issueType, description, reportDate,
              reporterName, reporterEmail, photoPath, latitude, longitude, createdAt
       FROM reports
       ORDER BY id DESC`,
      [],
      (err, rows) => {
        if (err) return res.status(500).json({ error: "Erreur BDD." });
        res.json(rows);
      }
    );
  });

  app.delete("/api/admin/reports/:id", requireAdmin, (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: "ID invalide." });
    db.run(`DELETE FROM reports WHERE id = ?`, [id], function (err) {
      if (err) return res.status(500).json({ error: "Erreur BDD." });
      res.json({ success: true, deleted: this.changes });
    });
  });

  // --- Public API -----------------------------------------------------------
  app.get("/api/violations", (_, res) => {
    db.all(
      `SELECT id, civic_no, street, arrondissement_code, arrondissement_name,
              address, contrevenant, article, nature_infraction,
              date_infraction, date_jugement, amende, latitude, longitude
       FROM violations
       WHERE latitude IS NOT NULL AND longitude IS NOT NULL
         AND LOWER(nature_infraction) NOT LIKE '%omis de fournir%'
         AND LOWER(nature_infraction) NOT LIKE '%permettant pas%'
         AND LOWER(nature_infraction) NOT LIKE '%entrav%'
         AND LOWER(nature_infraction) NOT LIKE '%vérification d''un matériau%'
         AND LOWER(nature_infraction) NOT LIKE '%verification d''un materiau%'
       ORDER BY date_jugement DESC, id DESC`,
      [],
      (err, rows) => {
        if (err) {
          return res.status(500).json({ error: "Impossible de charger les condamnations." });
        }
        res.json(rows);
      }
    );
  });

  app.get("/api/reports", (_, res) => {
    db.all(
      `SELECT id, address, issueType, description, reportDate,
              photoPath, latitude, longitude, createdAt
       FROM reports
       ORDER BY id DESC`,
      [],
      (err, rows) => {
        if (err) {
          return res.status(500).json({ error: "Impossible de charger les signalements." });
        }
        res.json(rows);
      }
    );
  });

  app.get("/api/search", (req, res) => {
    const tokens = searchTokens(req.query.address);
    if (tokens.length === 0) {
      return res.json({ found: false });
    }

    db.all(
      `SELECT id, address, issueType, description, reportDate,
              photoPath, latitude, longitude, createdAt
       FROM reports
       ORDER BY id DESC`,
      [],
      (err, rows) => {
        if (err) {
          console.error("DB ERROR:", err);
          return res.status(500).json({ error: "Erreur lors de la recherche." });
        }

        const matches = rows.filter((row) => addressMatchesTokens(row.address, tokens));
        if (matches.length === 0) {
          return res.json({ found: false });
        }
        return res.json({ found: true, data: matches[0], matches });
      }
    );
  });

  app.post("/api/reports/:id/geocode", (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: "ID invalide." });
    }

    db.get(`SELECT id, address FROM reports WHERE id = ?`, [id], async (err, row) => {
      if (err) return res.status(500).json({ error: "Erreur BDD." });
      if (!row) return res.status(404).json({ error: "Signalement introuvable." });

      const coords = await geocodeAddress(row.address);
      if (coords.lat == null || coords.lng == null) {
        return res.json({ found: false });
      }

      db.run(
        `UPDATE reports SET latitude = ?, longitude = ? WHERE id = ?`,
        [coords.lat, coords.lng, id],
        (updateErr) => {
          if (updateErr) {
            return res.status(500).json({ error: "Impossible de sauvegarder la position." });
          }
          res.json({ found: true, latitude: coords.lat, longitude: coords.lng });
        }
      );
    });
  });

  function handleUpload(req, res, next) {
    upload.single("photo")(req, res, (err) => {
      if (err) {
        const message =
          err.code === "LIMIT_FILE_SIZE"
            ? "La photo dépasse la taille maximale de 5 Mo."
            : err.message || "Erreur lors de l'upload.";
        return res.status(400).json({ success: false, error: message });
      }
      next();
    });
  }

  app.post("/api/reports", handleUpload, async (req, res) => {
    const {
      civicNumber,
      street,
      city,
      postalCode,
      issueType,
      description,
      reportDate,
      reporterName,
      reporterEmail,
    } = req.body;

    if (!civicNumber || !street || !city || !issueType || !description || !reportDate || !reporterName || !reporterEmail) {
      return res.status(400).json({
        success: false,
        error: "Tous les champs obligatoires doivent être remplis.",
      });
    }

    if (!EMAIL_REGEX.test(String(reporterEmail).trim())) {
      return res.status(400).json({
        success: false,
        error: "L'adresse email n'est pas valide.",
      });
    }

    const addressParts = [`${civicNumber} ${street}`, city, postalCode, "Québec", "Canada"].filter(Boolean);
    const address = addressParts.join(", ");

    const photoPath = req.file ? `/uploads/${req.file.filename}` : null;
    let coords = { lat: null, lng: null };
    try {
      coords = await geocodeAddress(address);
    } catch (e) {
      console.error("GEOCODING ERROR:", e.message);
    }

    db.run(
      `INSERT INTO reports (
        address, issueType, description, reportDate,
        reporterName, reporterEmail, photoPath, latitude, longitude
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [address, issueType, description, reportDate, reporterName, reporterEmail, photoPath, coords.lat, coords.lng],
      function (err) {
        if (err) {
          return res.status(500).json({ success: false, error: "Erreur lors de l'enregistrement." });
        }
        res.json({ success: true, message: "Signalement envoyé avec succès.", id: this.lastID });
      }
    );
  });

  return app;
}

// Only start a server when this file is run directly (not when imported by tests).
if (require.main === module) {
  if (config.admin.usingDefaultCredentials) {
    console.warn(
      "\x1b[33m⚠  Using DEFAULT admin credentials (admin/admin123). " +
        "Set ADMIN_USER and ADMIN_PASSWORD before deploying.\x1b[0m"
    );
  }

  const db = createDatabase(config.dbPath);
  const app = createApp(db);
  app.listen(config.port, () => {
    console.log(`Server running on http://localhost:${config.port}`);
  });
}

module.exports = { createApp };
