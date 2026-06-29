import assert from "node:assert/strict";
import test from "node:test";
import { applyRoleClaimsToToken } from "../lib/server/auth/handler.js";
import { canPerformAction } from "../lib/server/submissionAccess.js";

test("operator token carries password-change gate", async () => {
  const token = await applyRoleClaimsToToken({}, { id: "op@example.com" }, {
    getUserProfileFn: async () => ({
      id: "op@example.com",
      email: "op@example.com",
      name: "Operator",
      XP: 0,
      role: "point_operator",
      mustChangePassword: true,
      sessionVersion: 4,
    }),
  });
  assert.equal(token.role, "point_operator");
  assert.equal(token.mustChangePassword, true);
  assert.equal(token.sessionVersion, 4);
});

test("operator cannot use generic submission action", () => {
  assert.equal(canPerformAction("point_operator", "submit"), false);
  assert.equal(canPerformAction("point_operator", "read"), true);
});
