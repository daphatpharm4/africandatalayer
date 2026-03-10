import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_AVATAR_PRESET,
  coerceAvatarPreset,
  decodeAvatarPreset,
  encodeAvatarPresetImage,
  isAvatarPreset,
} from "../shared/avatarPresets.ts";

test("avatar preset helpers normalize stored preset values", () => {
  assert.equal(isAvatarPreset("baobab"), true);
  assert.equal(decodeAvatarPreset("preset:sunrise"), "sunrise");
  assert.equal(encodeAvatarPresetImage("lagoon"), "preset:lagoon");
  assert.equal(decodeAvatarPreset("https://example.com/avatar.png"), undefined);
  assert.equal(coerceAvatarPreset("https://example.com/avatar.png"), DEFAULT_AVATAR_PRESET);
});
