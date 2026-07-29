import assert from "node:assert/strict";
import test from "node:test";
import { canAccessAdlWideAnalytics } from "../api/analytics/index.js";

test("ADL-wide analytics is available only to ADL administrators", () => {
  assert.equal(canAccessAdlWideAnalytics({ role: "admin" }), true);
  assert.equal(canAccessAdlWideAnalytics({ role: "client" }), false);
  assert.equal(canAccessAdlWideAnalytics({ role: "agent" }), false);
  assert.equal(canAccessAdlWideAnalytics(null), false);
});
