"use strict";

const crypto = require("crypto");

// Constant-time string comparison. Prevents leaking how many characters of a
// credential are correct through response-timing differences.
function safeEqual(a, b) {
  const ab = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ab.length !== bb.length) {
    // Compare against itself so the work done is independent of input length.
    crypto.timingSafeEqual(ab, ab);
    return false;
  }
  return crypto.timingSafeEqual(ab, bb);
}

// Express middleware factory enforcing HTTP Basic Auth against the configured
// admin credentials, using constant-time comparison.
function createRequireAdmin({ user, password }) {
  return function requireAdmin(req, res, next) {
    const header = req.headers.authorization || "";
    const [scheme, encoded] = header.split(" ");

    if (scheme !== "Basic" || !encoded) {
      res.set("WWW-Authenticate", 'Basic realm="Horizon Admin"');
      return res.status(401).send("Authentification requise");
    }

    const decoded = Buffer.from(encoded, "base64").toString("utf-8");
    const [reqUser, ...rest] = decoded.split(":");
    const reqPassword = rest.join(":");

    const userOk = safeEqual(reqUser, user);
    const passOk = safeEqual(reqPassword, password);
    if (!userOk || !passOk) {
      res.set("WWW-Authenticate", 'Basic realm="Horizon Admin"');
      return res.status(401).send("Identifiants invalides");
    }

    next();
  };
}

module.exports = { createRequireAdmin, safeEqual };
