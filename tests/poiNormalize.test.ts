import assert from "node:assert/strict";
import test from "node:test";
import { normalizeOsmElementToPoi } from "../lib/server/poi/normalizePoi.js";
import { normalizeOverpassResponse } from "../lib/server/poi/sourceAdapters/osmOverpass.js";

test("normalizeOsmElementToPoi maps amenity=pharmacy to ADL pharmacy", () => {
  const candidate = normalizeOsmElementToPoi({
    type: "node",
    id: 123,
    lat: 4.071,
    lon: 9.736,
    tags: { amenity: "pharmacy", name: "Pharmacie Lumiere", phone: "+237699000000" },
  });

  assert.equal(candidate?.category, "pharmacy");
  assert.equal(candidate?.externalId, "node/123");
  assert.equal(candidate?.name, "Pharmacie Lumiere");
  assert.equal(candidate?.normalized.name, "Pharmacie Lumiere");
  assert.equal(candidate?.sourceAttribution, "OpenStreetMap contributors");
});

test("normalizeOsmElementToPoi maps amenity=fuel to fuel_station", () => {
  const candidate = normalizeOsmElementToPoi({
    type: "way",
    id: 456,
    center: { lat: 4.072, lon: 9.737 },
    tags: { amenity: "fuel", brand: "Tradex" },
  });

  assert.equal(candidate?.category, "fuel_station");
  assert.equal(candidate?.location.latitude, 4.072);
  assert.equal(candidate?.normalized.brand, "Tradex");
});

test("normalizeOsmElementToPoi returns null for unsupported tags", () => {
  const candidate = normalizeOsmElementToPoi({
    type: "node",
    id: 999,
    lat: 4.07,
    lon: 9.73,
    tags: { amenity: "bench" },
  });

  assert.equal(candidate, null);
});

test("normalizeOverpassResponse drops unsupported elements and keeps supported candidates", () => {
  const candidates = normalizeOverpassResponse({
    elements: [
      { type: "node", id: 1, lat: 4.071, lon: 9.736, tags: { amenity: "pharmacy", name: "P1" } },
      { type: "node", id: 2, lat: 4.072, lon: 9.737, tags: { amenity: "bench" } },
    ],
  });

  assert.equal(candidates.length, 1);
  assert.equal(candidates[0]?.externalId, "node/1");
});
