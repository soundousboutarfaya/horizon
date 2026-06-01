"use strict";

const path = require("path");

const ADMIN_USER = process.env.ADMIN_USER || "admin";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";

// True when the operator did not provide any custom credentials.
// Used to print a loud warning at startup so insecure defaults never ship silently.
const usingDefaultCredentials =
  !process.env.ADMIN_USER && !process.env.ADMIN_PASSWORD;

module.exports = {
  port: Number(process.env.PORT) || 3000,
  dbPath: process.env.HORIZON_DB || path.join(__dirname, "horizon.db"),
  uploadsDir: process.env.UPLOADS_DIR || path.join(__dirname, "uploads"),
  publicDir: path.join(__dirname, "public"),
  privateDir: path.join(__dirname, "private"),
  maxPhotoSize: 5 * 1024 * 1024, // 5 MB
  allowedImageTypes: ["image/jpeg", "image/png", "image/webp", "image/gif"],
  admin: {
    user: ADMIN_USER,
    password: ADMIN_PASSWORD,
    usingDefaultCredentials,
  },
  isProduction: process.env.NODE_ENV === "production",
};
