import assert from "node:assert/strict";
import test from "node:test";

test("applyReviewDecision module exports the function", async () => {
  const mod = await import("../lib/server/reviewDecision.js");
  assert.equal(typeof mod.applyReviewDecision, "function");
});
