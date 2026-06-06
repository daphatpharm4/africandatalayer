import assert from "node:assert/strict";
import test from "node:test";
import { classifyUserViewError } from "../lib/server/userViewErrors.js";
import { StorageUnavailableError } from "../lib/server/db.js";

test("storage-unavailable errors map to 503", () => {
  const r = classifyUserViewError(new StorageUnavailableError("Storage temporarily unavailable"));
  assert.equal(r.status, 503);
  assert.equal(r.code, "storage_unavailable");
});

test("unexpected errors map to a 500 with assignments_failed code and a safe message", () => {
  const r = classifyUserViewError(new Error('relation "collection_assignments" does not exist'));
  assert.equal(r.status, 500);
  assert.equal(r.code, "assignments_failed");
  assert.ok(!/collection_assignments/.test(r.message), "must not leak SQL internals to client");
});
