"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");

const { buildGeocodeCandidates } = require("../lib/geocode");

test("buildGeocodeCandidates returns [] for empty input", () => {
  assert.deepEqual(buildGeocodeCandidates(""), []);
  assert.deepEqual(buildGeocodeCandidates(null), []);
});

test("buildGeocodeCandidates injects an implicit 'rue' when missing", () => {
  const candidates = buildGeocodeCandidates("123 Sainte-Catherine, Montréal, Québec, Canada");
  assert.ok(candidates.includes("123 rue Sainte-Catherine, Montréal, Québec, Canada"));
});

test("buildGeocodeCandidates keeps an existing street type and de-duplicates", () => {
  const candidates = buildGeocodeCandidates("10 rue Saint-Denis, Montréal");
  assert.ok(candidates.includes("10 rue Saint-Denis, Montréal"));
  assert.equal(candidates.length, new Set(candidates).size);
});
