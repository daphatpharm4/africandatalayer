import assert from "node:assert/strict";
import test from "node:test";
import { PLATFORM_PHOTO_MAX_DATA_URL_LENGTH, PlatformPhotoTooLargeError, readPlatformPhotoFile } from "../lib/client/platformPhoto.ts";

test("readPlatformPhotoFile keeps a compact image data URL", async () => {
  const file = new File([Buffer.from("small")], "photo.png", { type: "image/png" });
  const result = await readPlatformPhotoFile(file);
  assert.match(result, /^data:image\/png;base64,/);
  assert.ok(result.length < PLATFORM_PHOTO_MAX_DATA_URL_LENGTH);
});

test("readPlatformPhotoFile fails closed for oversized photos without a browser canvas", async () => {
  const file = new File([Buffer.alloc(PLATFORM_PHOTO_MAX_DATA_URL_LENGTH)], "photo.png", { type: "image/png" });
  await assert.rejects(() => readPlatformPhotoFile(file), PlatformPhotoTooLargeError);
});
