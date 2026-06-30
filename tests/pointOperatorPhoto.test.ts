import assert from "node:assert/strict";
import test from "node:test";
import {
  POINT_OPERATOR_PHOTO_MAX_DATA_URL_LENGTH,
  compactPointOperatorPhotoDataUrl,
  isOversizedPointOperatorPhotoDataUrl,
  isPointOperatorPhotoDataUrl,
} from "../lib/client/pointOperatorPhoto.ts";

test("recognizes point operator photo data URLs", () => {
  assert.equal(isPointOperatorPhotoDataUrl("data:image/jpeg;base64,abc"), true);
  assert.equal(isPointOperatorPhotoDataUrl("data:image/png;base64,abc"), true);
  assert.equal(isPointOperatorPhotoDataUrl("https://example.com/photo.jpg"), false);
});

test("flags oversized queued photo payloads", () => {
  const oversized = `data:image/jpeg;base64,${"a".repeat(POINT_OPERATOR_PHOTO_MAX_DATA_URL_LENGTH)}`;
  assert.equal(isOversizedPointOperatorPhotoDataUrl(oversized), true);
});

test("keeps oversized photo unchanged outside a browser canvas environment", async () => {
  const oversized = `data:image/jpeg;base64,${"a".repeat(POINT_OPERATOR_PHOTO_MAX_DATA_URL_LENGTH)}`;
  const compacted = await compactPointOperatorPhotoDataUrl(oversized);

  assert.equal(compacted, oversized);
});
