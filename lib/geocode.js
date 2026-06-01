"use strict";

// Forward geocoding (address -> lat/lng) for citizen reports, backed by the
// free OpenStreetMap Nominatim service. Several address spellings are tried in
// order because user-entered addresses are messy (missing street type, etc.).

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const STREET_TYPE_PREFIX = /^(\d+)\s+(?!(rue|avenue|av\.|boulevard|boul\.|chemin|place)\b)/i;

async function nominatimQuery(query, fetchImpl = fetch) {
  const url = `${NOMINATIM_URL}?format=json&limit=1&q=${encodeURIComponent(query)}`;
  const response = await fetchImpl(url, {
    headers: { "User-Agent": "Horizon/1.0" },
  });
  if (!response.ok) {
    throw new Error(`Geocoding error: ${response.status}`);
  }
  const data = await response.json();
  if (!data.length) return null;
  return { lat: Number(data[0].lat), lng: Number(data[0].lon) };
}

// Build an ordered, de-duplicated list of address spellings worth trying.
// Pure function — unit tested.
function buildGeocodeCandidates(address) {
  const original = String(address || "").trim();
  if (!original) return [];

  const candidates = new Set();
  candidates.add(original);

  // Insert an implicit "rue" when the address starts with "<number> <name>".
  candidates.add(original.replace(STREET_TYPE_PREFIX, "$1 rue "));

  const parts = original.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 2) {
    candidates.add(`${parts[0]}, Montréal, Québec, Canada`);
    const streetWithRue = parts[0].replace(STREET_TYPE_PREFIX, "$1 rue ");
    candidates.add(`${streetWithRue}, Montréal, Québec, Canada`);
  }

  return [...candidates];
}

async function geocodeAddress(address, fetchImpl = fetch) {
  const candidates = buildGeocodeCandidates(address);
  for (const candidate of candidates) {
    try {
      const result = await nominatimQuery(candidate, fetchImpl);
      if (result) return result;
    } catch (e) {
      console.error("GEOCODE TRY FAILED:", candidate, e.message);
    }
  }
  return { lat: null, lng: null };
}

module.exports = { buildGeocodeCandidates, geocodeAddress, nominatimQuery };
