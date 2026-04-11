import test from "node:test";
import assert from "node:assert/strict";
import {
  decodeGeohashBounds,
  encodeGeohash,
  extractGeohash,
  generateImportPointId,
  generatePointId,
} from "../lib/shared/pointId.js";

test("encodeGeohash returns deterministic 6-char value", () => {
  const geohash = encodeGeohash(4.0862, 9.7354, 6);
  assert.equal(geohash.length, 6);
  assert.equal(geohash, encodeGeohash(4.0862, 9.7354, 6));
});

test("generatePointId encodes category and geohash", () => {
  const id = generatePointId("pharmacy", 4.0862, 9.7354);
  assert.match(id, /^pharmacy-[0123456789bcdefghjkmnpqrstuvwxyz]{6}-[a-f0-9]{8}$/);
});

test("generateImportPointId creates ext-prefixed deterministic id", () => {
  const id = generateImportPointId("osm_overpass", "4382447689");
  assert.equal(id, "ext-osm-overpass-4382447689");
});

test("extractGeohash returns geohash for field-created IDs", () => {
  const geohash = extractGeohash("mobile_money-s16gdp-a1b2c3d4");
  assert.equal(geohash, "s16gdp");
  assert.equal(extractGeohash("ext-osm-overpass-4382447689"), null);
});

test("decodeGeohashBounds contains the encoded point", () => {
  const latitude = 4.0862;
  const longitude = 9.7354;
  const geohash = encodeGeohash(latitude, longitude, 6);
  const bounds = decodeGeohashBounds(geohash);

  assert.ok(bounds.south <= latitude && bounds.north >= latitude);
  assert.ok(bounds.west <= longitude && bounds.east >= longitude);
  assert.ok(bounds.north > bounds.south);
  assert.ok(bounds.east > bounds.west);
});
