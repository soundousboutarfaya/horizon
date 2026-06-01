"use strict";

// Street-name noise words stripped before matching a free-text address search
// against stored addresses. Keeping them out means "12 rue de la Paix" and
// "12 Paix" both match the same record.
const STOP_WORDS = new Set([
  "rue", "avenue", "av", "boulevard", "boul", "chemin", "ch", "place", "pl",
  "route", "rte", "impasse", "allee", "allée", "voie", "cours", "quai",
  "de", "du", "des", "la", "le", "les", "l", "d", "a", "au", "aux",
  "est", "ouest", "nord", "sud", "e", "o", "n", "s",
  "qc", "quebec", "canada", "montreal",
]);

// Lowercase, strip accents and punctuation so accent-insensitive comparison works.
function normalizeForSearch(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// Split a query into meaningful tokens (no stop words, no empties).
function searchTokens(value) {
  return normalizeForSearch(value)
    .split(" ")
    .filter((t) => t && !STOP_WORDS.has(t));
}

// Does every query token appear somewhere in the candidate address?
function addressMatchesTokens(address, tokens) {
  if (tokens.length === 0) return false;
  const normalized = normalizeForSearch(address);
  return tokens.every((token) => normalized.includes(token));
}

module.exports = { STOP_WORDS, normalizeForSearch, searchTokens, addressMatchesTokens };
