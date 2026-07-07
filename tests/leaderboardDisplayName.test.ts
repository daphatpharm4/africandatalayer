import assert from "node:assert/strict";
import test from "node:test";
import { getPublicDisplayName } from "../api/leaderboard/index.ts";

test("email local part is never surfaced as a public leaderboard name", () => {
  // Stored profile.name defaults to the email local part at registration
  // (inferDefaultDisplayName). Emitting it publicly reconstructs the address.
  assert.equal(getPublicDisplayName("emmatiatep@gmail.com", "emmatiatep"), "em***");
  // Case/whitespace variations of the local part are still identifier-derived.
  assert.equal(getPublicDisplayName("emmatiatep@gmail.com", "  EmmatIatep "), "em***");
});

test("no stored name falls back to a redacted token for email identifiers, never the raw email", () => {
  assert.equal(getPublicDisplayName("nabilfewou1234@gmail.com", null), "na***");
  assert.equal(getPublicDisplayName("nabilfewou1234@gmail.com", ""), "na***");
});

test("phone-derived default names are non-reconstructable and shown as-is", () => {
  // inferDefaultDisplayName("+237694784029") === "Contributor 4029"
  assert.equal(getPublicDisplayName("+237694784029", "Contributor 4029"), "Contributor 4029");
  assert.equal(getPublicDisplayName("+237694784029", null), "Contributor 4029");
});

test("genuinely user-chosen display names are preserved", () => {
  assert.equal(getPublicDisplayName("emmatiatep@gmail.com", "Emma Tiate"), "Emma Tiate");
  assert.equal(getPublicDisplayName("+237694784029", "Kiosk Aziz"), "Kiosk Aziz");
});
