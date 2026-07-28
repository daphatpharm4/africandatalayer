import assert from "node:assert/strict";
import test from "node:test";
import { createPlatformHandler } from "../lib/server/platform/api.js";

const OWNER = { id: "owner@acme.com", token: {}, role: "agent" as const };
const ORG = { id: "5a2f8f18-0000-4000-8000-000000000001", name: "Acme", slug: "acme", logoUrl: null, accentColor: null, createdAt: "" };
const PROJECT_ID = "5a2f8f18-0000-4000-8000-000000000002";
const SCHEMA_ID = "5a2f8f18-0000-4000-8000-000000000004";

const RECORD_1 = "5a2f8f18-0000-4000-8000-0000000000a1";
const RECORD_2 = "5a2f8f18-0000-4000-8000-0000000000a2";
const RECORD_3 = "5a2f8f18-0000-4000-8000-0000000000a3";

function jsonPost(view: string, body: unknown): Request {
  return new Request(`https://x.test/api/user?view=platform_${view}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function baseDeps(overrides: Record<string, unknown> = {}) {
  return {
    requireUserFn: async () => OWNER,
    getMembershipFn: async () => ({ organizationId: ORG.id, userId: OWNER.id, role: "reviewer" as const, createdAt: "" }),
    getOrganizationAccessStateFn: async () => "active" as const,
    writeAuditFn: async () => {},
    ...overrides,
  };
}

function fakeRecord(recordId: string, status: "approved" | "rejected") {
  return {
    id: recordId,
    organizationId: ORG.id,
    projectId: PROJECT_ID,
    schemaVersionId: SCHEMA_ID,
    recordTypeKey: "retail_outlet",
    data: {},
    evidence: { photos: [] },
    status,
    capturedBy: "collector@acme.com",
    createdAt: "",
  };
}

test("record_batch_review approves every id, one audit per record, side effects fire per record", async () => {
  const reviewed: any[] = [];
  const audits: any[] = [];
  const handler = createPlatformHandler(baseDeps({
    reviewRecordFn: async (input: any) => {
      reviewed.push(input);
      return fakeRecord(input.recordId, input.status);
    },
    writeAuditFn: async (event: any) => { audits.push(event); },
  }));

  const response = await handler(jsonPost("record_batch_review", {
    organizationId: ORG.id,
    recordIds: [RECORD_1, RECORD_2, RECORD_3],
    decision: "approved",
  }));

  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.skippedCount, 0);
  assert.deepEqual(
    body.results,
    [RECORD_1, RECORD_2, RECORD_3].map((recordId) => ({ recordId, status: "ok" })),
  );

  // Same per-record core as the single-review path: one reviewRecordFn call
  // (the side effect) and one record_reviewed audit event per record.
  assert.equal(reviewed.length, 3);
  for (const input of reviewed) {
    assert.equal(input.status, "approved");
    assert.equal(input.reviewedBy, OWNER.id);
  }
  assert.deepEqual(audits.map((a) => a.eventType), ["record_reviewed", "record_reviewed", "record_reviewed"]);
  assert.deepEqual(audits.map((a) => a.payload.recordId), [RECORD_1, RECORD_2, RECORD_3]);
});

test("record_batch_review reports mixed ok/error results without aborting the batch", async () => {
  const handler = createPlatformHandler(baseDeps({
    reviewRecordFn: async (input: any) => {
      if (input.recordId === RECORD_2) {
        throw new Error("simulated database failure");
      }
      return fakeRecord(input.recordId, input.status);
    },
  }));

  const response = await handler(jsonPost("record_batch_review", {
    organizationId: ORG.id,
    recordIds: [RECORD_1, RECORD_2, RECORD_3],
    decision: "approved",
  }));

  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.skippedCount, 0);
  assert.deepEqual(body.results, [
    { recordId: RECORD_1, status: "ok" },
    { recordId: RECORD_2, status: "error", error: "simulated database failure" },
    { recordId: RECORD_3, status: "ok" },
  ]);
});

test("record_batch_review reports a not-found/already-reviewed record as skipped", async () => {
  const handler = createPlatformHandler(baseDeps({
    reviewRecordFn: async (input: any) => {
      if (input.recordId === RECORD_1) return null;
      return fakeRecord(input.recordId, input.status);
    },
  }));

  const response = await handler(jsonPost("record_batch_review", {
    organizationId: ORG.id,
    recordIds: [RECORD_1, RECORD_2],
    decision: "approved",
  }));

  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.skippedCount, 1);
  assert.deepEqual(body.results, [
    { recordId: RECORD_1, status: "skipped", skippedReason: "Record not found or already reviewed" },
    { recordId: RECORD_2, status: "ok" },
  ]);
});

test("record_batch_review rejects an empty recordIds array with 400", async () => {
  const handler = createPlatformHandler(baseDeps());
  const response = await handler(jsonPost("record_batch_review", {
    organizationId: ORG.id,
    recordIds: [],
    decision: "approved",
  }));
  assert.equal(response.status, 400);
});

test("record_batch_review requires notes when rejecting", async () => {
  const handler = createPlatformHandler(baseDeps());
  const response = await handler(jsonPost("record_batch_review", {
    organizationId: ORG.id,
    recordIds: [RECORD_1],
    decision: "rejected",
  }));
  assert.equal(response.status, 400);
});

test("record_batch_review requires reviewer role", async () => {
  const handler = createPlatformHandler(baseDeps({
    getMembershipFn: async () => ({ organizationId: ORG.id, userId: OWNER.id, role: "collector" as const, createdAt: "" }),
  }));
  const response = await handler(jsonPost("record_batch_review", {
    organizationId: ORG.id,
    recordIds: [RECORD_1],
    decision: "approved",
  }));
  assert.equal(response.status, 403);
});
