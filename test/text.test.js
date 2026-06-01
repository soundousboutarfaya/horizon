"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");

const { normalizeForSearch, searchTokens, addressMatchesTokens } = require("../lib/text");

test("normalizeForSearch lowercases, strips accents and punctuation", () => {
  assert.equal(normalizeForSearch("123 Rue de l'Église, Montréal"), "123 rue de l eglise montreal");
  assert.equal(normalizeForSearch(null), "");
  assert.equal(normalizeForSearch("  Côté-Nord  "), "cote nord");
});

test("searchTokens removes stop words and empties", () => {
  assert.deepEqual(searchTokens("12 rue de la Paix"), ["12", "paix"]);
  assert.deepEqual(searchTokens("Montréal Québec Canada"), []);
  assert.deepEqual(searchTokens(""), []);
});

test("addressMatchesTokens requires every token to be present", () => {
  const address = "1450 Rue Sainte-Catherine, Montréal";
  assert.equal(addressMatchesTokens(address, searchTokens("1450 Sainte-Catherine")), true);
  assert.equal(addressMatchesTokens(address, searchTokens("1450 Sherbrooke")), false);
  assert.equal(addressMatchesTokens(address, []), false);
});
