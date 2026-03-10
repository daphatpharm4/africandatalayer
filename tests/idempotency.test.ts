import assert from "node:assert/strict";
import test from "node:test";
import { hashIdempotencyPayload } from "../lib/server/idempotency.ts";

test("hashIdempotencyPayload is stable across object key order", () => {
  const first = {
    category: "pharmacy",
    details: {
      brand: "Mboa",
      consentStatus: "obtained",
      gpsIntegrity: { mockLocationDetected: false, networkType: "4g" },
    },
    location: { latitude: 4.061, longitude: 9.733 },
  };
  const second = {
    details: {
      gpsIntegrity: { networkType: "4g", mockLocationDetected: false },
      consentStatus: "obtained",
      brand: "Mboa",
    },
    location: { longitude: 9.733, latitude: 4.061 },
    category: "pharmacy",
  };

  assert.equal(hashIdempotencyPayload(first), hashIdempotencyPayload(second));
});

test("hashIdempotencyPayload changes when the request body changes", () => {
  const base = hashIdempotencyPayload({
    category: "pharmacy",
    details: { consentStatus: "obtained" },
  });
  const changed = hashIdempotencyPayload({
    category: "pharmacy",
    details: { consentStatus: "withdrawn" },
  });

  assert.notEqual(base, changed);
});
