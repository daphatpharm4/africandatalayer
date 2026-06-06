import assert from "node:assert/strict";
import test from "node:test";
import { parseProfileImagePayload, classifyBlobUploadError } from "../lib/server/profileImageUpload.js";

const ONE_PX_PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

test("parses a valid png data URI", () => {
  const r = parseProfileImagePayload(ONE_PX_PNG, 5 * 1024 * 1024);
  assert.ok(r);
  assert.equal(r.mime, "image/png");
  assert.equal(r.ext, "png");
});

test("rejects a non-image data URI", () => {
  assert.equal(parseProfileImagePayload("data:text/plain;base64,aGk=", 5 * 1024 * 1024), null);
});

test("rejects payload over the size limit", () => {
  assert.equal(parseProfileImagePayload(ONE_PX_PNG, 4), null);
});

test("missing-token blob error classifies as 503 storage_unavailable", () => {
  const r = classifyBlobUploadError(new Error("No token found. Set BLOB_READ_WRITE_TOKEN"));
  assert.equal(r.status, 503);
  assert.equal(r.code, "storage_unavailable");
});

test("any other blob failure classifies as 502 upload_failed, no internal leak", () => {
  const r = classifyBlobUploadError(new Error("ENOTFOUND blob.vercel-storage.com"));
  assert.equal(r.status, 502);
  assert.equal(r.code, "upload_failed");
  assert.ok(!/ENOTFOUND/.test(r.message));
});
