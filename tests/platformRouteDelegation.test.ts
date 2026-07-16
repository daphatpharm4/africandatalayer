import assert from "node:assert/strict";
import test from "node:test";
import { isPlatformView } from "../lib/server/platform/api.js";

test("platform_ prefixed views are recognized", () => {
  assert.equal(isPlatformView("platform_org_create"), true);
  assert.equal(isPlatformView("platform_org_list"), true);
  assert.equal(isPlatformView("po_me"), false);
  assert.equal(isPlatformView(null), false);
  assert.equal(isPlatformView("status"), false);
});
