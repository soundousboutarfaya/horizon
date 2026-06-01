"use strict";

const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");

const { createDatabase } = require("../lib/db");
const { createApp } = require("../server");

let server;
let baseUrl;
let db;

before(async () => {
  db = createDatabase(":memory:");
  // Seed one report so search/list endpoints have data to return.
  await new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO reports (address, issueType, description, reportDate, reporterName, reporterEmail, latitude, longitude)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ["1450 Rue Sainte-Catherine, Montréal", "Moisissure", "Test", "2026-01-01", "Tester", "tester@example.com", 45.5, -73.56],
      (err) => (err ? reject(err) : resolve())
    );
  });

  const app = createApp(db);
  await new Promise((resolve) => {
    server = app.listen(0, () => {
      baseUrl = `http://127.0.0.1:${server.address().port}`;
      resolve();
    });
  });
});

after(() => {
  server?.close();
  db?.close();
});

test("GET /api/reports returns the seeded report", async () => {
  const res = await fetch(`${baseUrl}/api/reports`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.ok(Array.isArray(body));
  assert.equal(body.length, 1);
  assert.equal(body[0].address, "1450 Rue Sainte-Catherine, Montréal");
  // Public endpoint must NOT leak reporter identity.
  assert.equal(body[0].reporterEmail, undefined);
});

test("GET /api/search finds a matching address", async () => {
  const res = await fetch(`${baseUrl}/api/search?address=${encodeURIComponent("1450 Sainte-Catherine")}`);
  const body = await res.json();
  assert.equal(body.found, true);
  assert.equal(body.matches.length, 1);
});

test("GET /api/search returns found:false for empty query", async () => {
  const res = await fetch(`${baseUrl}/api/search?address=`);
  const body = await res.json();
  assert.equal(body.found, false);
});

test("admin endpoint rejects requests without credentials", async () => {
  const res = await fetch(`${baseUrl}/api/admin/reports`);
  assert.equal(res.status, 401);
});

test("admin endpoint accepts valid default credentials", async () => {
  const auth = Buffer.from("admin:admin123").toString("base64");
  const res = await fetch(`${baseUrl}/api/admin/reports`, {
    headers: { Authorization: `Basic ${auth}` },
  });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body[0].reporterEmail, "tester@example.com");
});

test("POST /api/reports rejects missing required fields", async () => {
  const res = await fetch(`${baseUrl}/api/reports`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ civicNumber: "10" }),
  });
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.equal(body.success, false);
});

test("POST /api/reports rejects an invalid email", async () => {
  const res = await fetch(`${baseUrl}/api/reports`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      civicNumber: "10",
      street: "Rue Test",
      city: "Montréal",
      issueType: "Moisissure",
      description: "x",
      reportDate: "2026-01-01",
      reporterName: "Tester",
      reporterEmail: "not-an-email",
    }),
  });
  assert.equal(res.status, 400);
});
