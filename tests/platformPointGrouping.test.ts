import { test } from "node:test";
import assert from "node:assert/strict";
import { collapseRecordChains } from "../lib/client/platformPointUi.ts";
import type { PlatformRecord } from "../shared/platformTypes.ts";

function rec(partial: Partial<PlatformRecord> & { id: string; createdAt: string }): PlatformRecord {
  return {
    organizationId: "org-1",
    projectId: "proj-1",
    schemaVersionId: "sv-1",
    recordTypeKey: "bin",
    data: {},
    evidence: { gps: { latitude: 4.0, longitude: 9.0 }, photos: [], notes: null, capturedAt: partial.createdAt },
    status: "approved",
    capturedBy: "user-1",
    pointId: null,
    reviewedBy: null,
    reviewedAt: null,
    reviewNotes: null,
    ...partial,
  } as PlatformRecord;
}

test("standalone record (no chain) yields one point unchanged", () => {
  const r1 = rec({ id: "r1", createdAt: "2026-07-18T10:00:00Z", evidence: { gps: { latitude: 4, longitude: 9 }, photos: ["p1"], notes: null, capturedAt: "x" } });
  const out = collapseRecordChains([r1]);
  assert.equal(out.length, 1);
  assert.equal(out[0].id, "r1");
});

test("root + enrichment sharing root collapse to ONE point (the bug)", () => {
  const root = rec({ id: "root", createdAt: "2026-07-18T10:00:00Z", pointId: null });
  const enrich = rec({ id: "e1", createdAt: "2026-07-20T10:00:00Z", pointId: "root" });
  const out = collapseRecordChains([root, enrich]);
  assert.equal(out.length, 1, "chain must be a single point, not two pins");
});

test("newest record is the representative (latest state wins)", () => {
  const root = rec({ id: "root", createdAt: "2026-07-18T10:00:00Z", pointId: null, data: { name: "old" } });
  const enrich = rec({ id: "e1", createdAt: "2026-07-20T10:00:00Z", pointId: "root", data: { name: "new" } });
  const out = collapseRecordChains([enrich, root]); // unordered input
  assert.equal(out[0].data.name, "new");
});

test("photos aggregate across the chain (newest first), deduped", () => {
  const root = rec({ id: "root", createdAt: "2026-07-18T10:00:00Z", pointId: null, evidence: { gps: { latitude: 4, longitude: 9 }, photos: ["a", "b"], notes: null, capturedAt: "x" } });
  const enrich = rec({ id: "e1", createdAt: "2026-07-20T10:00:00Z", pointId: "root", evidence: { gps: { latitude: 4, longitude: 9 }, photos: ["c", "a"], notes: null, capturedAt: "x" } });
  const out = collapseRecordChains([root, enrich]);
  assert.deepEqual(out[0].evidence.photos, ["c", "a", "b"]);
});

test("chain length exposed for the map/detail", () => {
  const root = rec({ id: "root", createdAt: "2026-07-18T10:00:00Z", pointId: null });
  const e1 = rec({ id: "e1", createdAt: "2026-07-19T10:00:00Z", pointId: "root" });
  const e2 = rec({ id: "e2", createdAt: "2026-07-20T10:00:00Z", pointId: "root" });
  const out = collapseRecordChains([root, e1, e2]);
  assert.equal(out.length, 1);
  assert.equal(out[0].chainCount, 3);
});
