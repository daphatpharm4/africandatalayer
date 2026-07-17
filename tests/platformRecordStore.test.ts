import assert from "node:assert/strict";
import test from "node:test";
import { createRecord } from "../lib/server/platform/recordStore.ts";

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
