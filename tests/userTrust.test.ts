import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_TRUST_SCORE, getTrustTier, normalizeTrustScore } from "../lib/server/userTrust.ts";

test("normalizeTrustScore clamps and rounds values into the supported range", () => {
  assert.equal(normalizeTrustScore(undefined), DEFAULT_TRUST_SCORE);
  assert.equal(normalizeTrustScore("88.6"), 89);
  assert.equal(normalizeTrustScore(-10), 0);
  assert.equal(normalizeTrustScore(150), 100);
});

test("getTrustTier maps pilot thresholds consistently", () => {
  assert.equal(getTrustTier(15), "restricted");
  assert.equal(getTrustTier(35), "new");
  assert.equal(getTrustTier(50), "standard");
  assert.equal(getTrustTier(85), "trusted");
});
