import assert from "node:assert/strict";
import test from "node:test";
import { isPlatformView } from "../lib/server/platform/api.js";
import { GET as userGet } from "../api/user/index.js";

test("platform_ prefixed views are recognized", () => {
  assert.equal(isPlatformView("platform_org_create"), true);
  assert.equal(isPlatformView("platform_org_list"), true);
  assert.equal(isPlatformView("po_me"), false);
  assert.equal(isPlatformView(null), false);
  assert.equal(isPlatformView("status"), false);
});

test("unauthenticated platform_ request gets the platform 401 contract via /api/user", async () => {
  const response = await userGet(new Request("https://x.test/api/user?view=platform_org_list"));
  assert.equal(response.status, 401);
  const body = await response.json();
  assert.equal(body.code, "unauthorized");
});
