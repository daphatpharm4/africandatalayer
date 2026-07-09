import assert from "node:assert/strict";
import test, { afterEach } from "node:test";
import {
  getSemanticDuplicateMatches,
  setEmbeddingQueryForTesting,
} from "../lib/server/imageEmbeddings.ts";

afterEach(() => setEmbeddingQueryForTesting(null));

function result<T>(rows: T[]): { rows: T[]; rowCount: number } {
  return { rows, rowCount: rows.length };
}

test("returns an empty map and issues no query for an empty id list", async () => {
  let called = false;
  setEmbeddingQueryForTesting((async () => {
    called = true;
    return result([]);
  }) as never);
  const map = await getSemanticDuplicateMatches([]);
  assert.equal(map.size, 0);
  assert.equal(called, false);
});

test("groups matches by event, normalizes decision, and validates matched category", async () => {
  const rows = [
    {
      event_id: "e1", matched_event_id: "m1", similarity: 0.97, model_version: "multimodalembedding@001",
      rule_triggered: "semantic_duplicate_soft", decision: "pending_review",
      created_at: "2026-07-09T00:00:00Z", last_seen_at: "2026-07-09T01:00:00Z",
      matched_point_id: "pharmacy-abc", matched_category: "pharmacy", matched_user_id: "u2",
      matched_created_at: "2026-07-01T00:00:00Z",
    },
    {
      event_id: "e1", matched_event_id: "m2", similarity: 0.95, model_version: "multimodalembedding@001",
      rule_triggered: "semantic_duplicate_soft", decision: "logged",
      created_at: "2026-07-09T00:00:00Z", last_seen_at: "2026-07-09T00:30:00Z",
      matched_point_id: null, matched_category: "not-a-real-vertical", matched_user_id: null,
      matched_created_at: null,
    },
  ];
  setEmbeddingQueryForTesting((async (_sql: string, values: unknown[]) => {
    assert.deepEqual(values, [["e1"]]);
    return result(rows);
  }) as never);

  const map = await getSemanticDuplicateMatches(["e1", "e1", " "]);
  const list = map.get("e1");
  assert.ok(list);
  assert.equal(list!.length, 2);
  assert.equal(list![0].decision, "pending_review");
  assert.equal(list![0].matchedCategory, "pharmacy");
  assert.equal(list![0].similarity, 0.97);
  // Unknown category is dropped to null rather than passed through.
  assert.equal(list![1].matchedCategory, null);
  assert.equal(list![1].decision, "logged");
});

test("treats a missing table as empty (safe before the migration / Stage B)", async () => {
  setEmbeddingQueryForTesting((async () => {
    throw Object.assign(new Error('relation "submission_image_similarity_matches" does not exist'), { code: "42P01" });
  }) as never);
  const map = await getSemanticDuplicateMatches(["e1"]);
  assert.equal(map.size, 0);
});

test("rethrows non-missing-object errors", async () => {
  setEmbeddingQueryForTesting((async () => {
    throw Object.assign(new Error("connection reset"), { code: "ECONNRESET" });
  }) as never);
  await assert.rejects(() => getSemanticDuplicateMatches(["e1"]), /connection reset/);
});
