import assert from "node:assert/strict";
import test from "node:test";
import { ipReportSchema, ipReportPatchSchema } from "../lib/server/validation.js";

const baseInput = {
  reporterName: "Jane Holder",
  reporterEmail: "jane@example.com",
  targetKind: "submission" as const,
  targetRef: "submission-123",
  description: "This submission reuses my copyrighted brochure.",
  sworn: true as const,
};

test("ipReportSchema accepts a complete sworn report", () => {
  const result = ipReportSchema.safeParse(baseInput);
  assert.equal(result.success, true);
});

test("ipReportSchema rejects sworn=false", () => {
  const result = ipReportSchema.safeParse({ ...baseInput, sworn: false });
  assert.equal(result.success, false);
});

test("ipReportSchema rejects descriptions under 20 characters", () => {
  const result = ipReportSchema.safeParse({ ...baseInput, description: "too short" });
  assert.equal(result.success, false);
});

test("ipReportSchema rejects unknown targetKind", () => {
  const result = ipReportSchema.safeParse({ ...baseInput, targetKind: "user" });
  assert.equal(result.success, false);
});

test("ipReportSchema rejects malformed email", () => {
  const result = ipReportSchema.safeParse({ ...baseInput, reporterEmail: "not-an-email" });
  assert.equal(result.success, false);
});

test("ipReportSchema rejects extra props (strict)", () => {
  const result = ipReportSchema.safeParse({ ...baseInput, ipAddress: "1.2.3.4" });
  assert.equal(result.success, false);
});

test("ipReportSchema allows targetRef to be omitted", () => {
  const { targetRef: _omit, ...rest } = baseInput;
  const result = ipReportSchema.safeParse(rest);
  assert.equal(result.success, true);
});

test("ipReportPatchSchema accepts a valid status transition", () => {
  const result = ipReportPatchSchema.safeParse({
    id: "550e8400-e29b-41d4-a716-446655440000",
    status: "reviewing",
    resolutionNotes: "Confirmed with rights holder.",
  });
  assert.equal(result.success, true);
});

test("ipReportPatchSchema rejects non-uuid id", () => {
  const result = ipReportPatchSchema.safeParse({
    id: "not-a-uuid",
    status: "open",
  });
  assert.equal(result.success, false);
});

test("ipReportPatchSchema rejects unknown status", () => {
  const result = ipReportPatchSchema.safeParse({
    id: "550e8400-e29b-41d4-a716-446655440000",
    status: "archived",
  });
  assert.equal(result.success, false);
});
