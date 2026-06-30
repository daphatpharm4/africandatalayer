import assert from "node:assert/strict";
import test from "node:test";
import { getBatchApproveSkipReason, ReviewDecisionSkippedError, runReviewSideEffect } from "../lib/server/reviewDecision.js";

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

test("batch approve server guard derives skip reasons from stored details", () => {
  assert.equal(getBatchApproveSkipReason({ reviewStatus: "pending_review", riskScore: 20 }), null);
  assert.equal(
    getBatchApproveSkipReason({
      reviewStatus: "pending_review",
      riskScore: 20,
      reviewDecision: "approved",
      reviewedAt: "2026-06-06T00:00:00.000Z",
    }),
    "already_finalized",
  );
  assert.equal(getBatchApproveSkipReason({ reviewStatus: "pending_review", riskScore: 80 }), "high_risk");
  assert.equal(getBatchApproveSkipReason({ reviewStatus: "flagged", riskScore: 20 }), "ineligible");
});

test("ReviewDecisionSkippedError carries a skipped reason for batch response mapping", () => {
  const error = new ReviewDecisionSkippedError("event-1", "high_risk");
  assert.equal(error.eventId, "event-1");
  assert.equal(error.reason, "high_risk");
  assert.match(error.message, /high risk/);
});

test("review side effects are best-effort after the decision write", async () => {
  const originalWarn = console.warn;
  console.warn = () => undefined;
  try {
    await assert.doesNotReject(
      runReviewSideEffect("test_failure", async () => {
        throw new Error("optional audit table missing");
      }),
    );
  } finally {
    console.warn = originalWarn;
  }
});
