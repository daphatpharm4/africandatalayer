import assert from "node:assert/strict";
import test from "node:test";
import { buildPointEventFromVerifiedCandidate } from "../lib/server/poi/promoteCandidate.js";
import type { ExternalPoiCandidate } from "../shared/types.js";

const candidate: ExternalPoiCandidate = {
  id: "11111111-1111-1111-1111-111111111111",
  source: "osm",
  sourceLicense: "ODbL-1.0",
  sourceAttribution: "OpenStreetMap contributors",
  externalId: "node/123",
  raw: {},
  normalized: { name: "Pharmacie Lumiere" },
  category: "pharmacy",
  location: { latitude: 4.071, longitude: 9.736 },
  name: "Pharmacie Lumiere",
  matchStatus: "verified",
  matchedPointId: null,
  matchScore: 0,
  confidence: 0.8,
  needsFieldVerification: false,
  assignedTo: null,
  createdAt: "2026-05-14T00:00:00.000Z",
  updatedAt: "2026-05-14T00:00:00.000Z",
};

test("buildPointEventFromVerifiedCandidate creates imported point event with attribution", () => {
  const event = buildPointEventFromVerifiedCandidate(candidate, "admin-1", {
    eventId: "22222222-2222-4222-8222-222222222222",
    now: () => new Date("2026-05-14T12:00:00.000Z"),
  });
  assert.equal(event.category, "pharmacy");
  assert.equal(event.eventType, "CREATE_EVENT");
  assert.equal(event.userId, "admin-1");
  assert.equal(event.source, "osm");
  assert.equal(event.externalId, "node/123");
  assert.equal(event.details.sourceAttribution, "OpenStreetMap contributors");
  assert.equal(event.details.isImported, true);
});

test("buildPointEventFromVerifiedCandidate rejects unverified candidates", () => {
  assert.throws(() => {
    buildPointEventFromVerifiedCandidate({ ...candidate, matchStatus: "needs_field_verification" }, "admin-1");
  }, /verified/);
});
