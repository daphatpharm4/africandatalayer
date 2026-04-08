import assert from "node:assert/strict";
import test from "node:test";

test("applyReviewDecision module exports the function", async () => {
  const mod = await import("../lib/server/reviewDecision.js");
  assert.equal(typeof mod.applyReviewDecision, "function");
});

test("batchReviewBodySchema validates correct input", async () => {
  const { batchReviewBodySchema } = await import("../lib/server/validation.js");
  const result = batchReviewBodySchema.safeParse({
    eventIds: ["550e8400-e29b-41d4-a716-446655440000"],
    decision: "approved",
  });
  assert.equal(result.success, true);
});

test("batchReviewBodySchema rejects empty eventIds", async () => {
  const { batchReviewBodySchema } = await import("../lib/server/validation.js");
  const result = batchReviewBodySchema.safeParse({
    eventIds: [],
    decision: "approved",
  });
  assert.equal(result.success, false);
});

test("batchReviewBodySchema rejects more than 100 eventIds", async () => {
  const { batchReviewBodySchema } = await import("../lib/server/validation.js");
  const ids = Array.from({ length: 101 }, (_, i) => `550e8400-e29b-41d4-a716-${String(i).padStart(12, "0")}`);
  const result = batchReviewBodySchema.safeParse({
    eventIds: ids,
    decision: "approved",
  });
  assert.equal(result.success, false);
});

test("batchReviewBodySchema rejects invalid decision", async () => {
  const { batchReviewBodySchema } = await import("../lib/server/validation.js");
  const result = batchReviewBodySchema.safeParse({
    eventIds: ["550e8400-e29b-41d4-a716-446655440000"],
    decision: "deleted",
  });
  assert.equal(result.success, false);
});

test("batchReviewBodySchema accepts optional notes", async () => {
  const { batchReviewBodySchema } = await import("../lib/server/validation.js");
  const result = batchReviewBodySchema.safeParse({
    eventIds: ["550e8400-e29b-41d4-a716-446655440000"],
    decision: "rejected",
    notes: "Duplicate submission",
  });
  assert.equal(result.success, true);
});

test("batch-review module exports POST handler", async () => {
  const mod = await import("../api/submissions/batch-review.js");
  assert.equal(typeof mod.POST, "function");
});
