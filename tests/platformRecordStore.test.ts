import assert from "node:assert/strict";
import test from "node:test";
import { createRecord, getRecordSummaryForUser, hasRecentRecordForPoint, listRecords, reviewRecord } from "../lib/server/platform/recordStore.ts";

test("createRecord inserts with all tenant scopes and idempotent conflict handling", async () => {
  const calls: Array<{ text: string; values: unknown[] }> = [];
  const queryFn = async (text: string, values: unknown[] = []) => {
    calls.push({ text, values });
    return { rows: [{
      id: "r1", organization_id: "org-1", project_id: "project-1", schema_version_id: "schema-1",
      record_type_key: "retail_outlet", data: { name: "Kiosk" }, evidence: { photos: [] },
      status: "pending_review", captured_by: "u1", created_at: "2026-07-17T00:00:00.000Z",
    }], rowCount: 1 };
  };
  const record = await createRecord({
    organizationId: "org-1", projectId: "project-1", schemaVersionId: "schema-1",
    recordTypeKey: "retail_outlet", data: { name: "Kiosk" }, evidence: { photos: [] },
    capturedBy: "u1", idempotencyKey: "key-12345", requestHash: "a".repeat(64),
  }, { queryFn });
  assert.equal(record.organizationId, "org-1");
  assert.match(calls[0].text, /on conflict \(project_id, captured_by, idempotency_key\)/i);
  assert.match(calls[0].text, /platform_records\.request_hash = excluded\.request_hash/i);
  assert.deepEqual(calls[0].values.slice(0, 4), ["org-1", "project-1", "schema-1", "retail_outlet"]);
});

test("getRecordSummaryForUser counts every company capture by review status", async () => {
  const calls: Array<{ text: string; values: unknown[] }> = [];
  const summary = await getRecordSummaryForUser("collector@example.com", {
    queryFn: async (text, values = []) => {
      calls.push({ text, values });
      return { rows: [{ total: 4, pending_review: 1, approved: 2, rejected: 1, submitted_today: 3 }], rowCount: 1 };
    },
  });
  assert.deepEqual(summary, { total: 4, pendingReview: 1, approved: 2, rejected: 1, submittedToday: 3 });
  assert.match(calls[0].text, /where captured_by = \$1/i);
  assert.deepEqual(calls[0].values, ["collector@example.com"]);
});

test("listRecords and reviewRecord keep every query tenant-scoped", async () => {
  const calls: Array<{ text: string; values: unknown[] }> = [];
  const row = {
    id: "r1", organization_id: "org-1", project_id: "project-1", schema_version_id: "schema-1",
    record_type_key: "retail_outlet", data: {}, evidence: { photos: [] }, status: "pending_review",
    captured_by: "u1", created_at: "2026-07-17T00:00:00.000Z",
  };
  const queryFn = async (text: string, values: unknown[] = []) => {
    calls.push({ text, values });
    return { rows: [text.startsWith("UPDATE") ? { ...row, status: values[2] } : row], rowCount: 1 };
  };
  assert.equal((await listRecords({ organizationId: "org-1", status: "pending_review" }, { queryFn })).length, 1);
  assert.match(calls[0].text, /where organization_id = \$1/i);
  assert.deepEqual(calls[0].values.slice(0, 4), ["org-1", null, "pending_review", null]);

  const reviewed = await reviewRecord({
    organizationId: "org-1",
    recordId: "r1",
    status: "approved",
    reviewedBy: "reviewer-1",
    reviewNotes: "Evidence verified",
  }, { queryFn });
  assert.equal(reviewed?.status, "approved");
  assert.match(calls[1].text, /where organization_id = \$1 and id = \$2/i);
  assert.match(calls[1].text, /status = 'pending_review'/i);
  assert.deepEqual(calls[1].values, ["org-1", "r1", "approved", "reviewer-1", "Evidence verified"]);
});

test("createRecord persists point link and capture coordinates", async () => {
  const calls: Array<{ text: string; values: unknown[] }> = [];
  const queryFn = async (text: string, values: unknown[] = []) => {
    calls.push({ text, values });
    return { rows: [{
      id: "r1", organization_id: "o1", project_id: "p1", schema_version_id: "s1",
      record_type_key: "audit", data: {}, evidence: { photos: [] },
      status: "pending_review", captured_by: "u1", created_at: new Date(),
      point_id: "pt_1", capture_lat: 4.05, capture_lng: 9.7,
    }], rowCount: 1 };
  };
  const record = await createRecord({
    organizationId: "o1", projectId: "p1", schemaVersionId: "s1", recordTypeKey: "audit",
    data: {}, evidence: { photos: [] }, capturedBy: "u1", idempotencyKey: "k".repeat(8), requestHash: "a".repeat(64),
    pointId: "pt_1", captureLat: 4.05, captureLng: 9.7,
  }, { queryFn: queryFn as any });
  assert.match(calls[0].text, /point_id/);
  assert.match(calls[0].text, /capture_lat/);
  assert.ok(calls[0].values.includes("pt_1"));
  assert.equal(record.pointId, "pt_1");
});

test("hasRecentRecordForPoint returns the EXISTS result", async () => {
  const calls: Array<{ text: string; values: unknown[] }> = [];
  const queryFn = async (text: string, values: unknown[] = []) => {
    calls.push({ text, values });
    return { rows: [{ present: true }], rowCount: 1 };
  };
  const result = await hasRecentRecordForPoint(
    { organizationId: "o1", pointId: "pt_1", capturedBy: "u1", recordTypeKey: "audit", withinHours: 1 },
    { queryFn: queryFn as any },
  );
  assert.equal(result, true);
  assert.match(calls[0].text, /point_id = \$2/);
  assert.ok(calls[0].values.includes(1));
});

test("listRecords filters by pointId when provided", async () => {
  const calls: Array<{ text: string; values: unknown[] }> = [];
  const queryFn = async (text: string, values: unknown[] = []) => {
    calls.push({ text, values });
    return { rows: [], rowCount: 0 };
  };
  await listRecords({ organizationId: "o1", pointId: "pt_1" }, { queryFn: queryFn as any });
  assert.match(calls[0].text, /point_id = \$4/);
  assert.ok(calls[0].values.includes("pt_1"));
});
