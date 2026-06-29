import assert from "node:assert/strict";
import test from "node:test";
import { requireUser } from "../lib/auth.js";
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

test("existing token does not heal session version without sign-in user", async () => {
  let profileLookups = 0;
  const token = await applyRoleClaimsToToken(
    {
      email: "op@example.com",
      uid: "op@example.com",
      role: "point_operator",
      mustChangePassword: false,
      sessionVersion: 1,
    },
    null,
    {
      getUserProfileFn: async () => {
        profileLookups += 1;
        return {
          id: "op@example.com",
          email: "op@example.com",
          name: "Operator",
          XP: 0,
          role: "point_operator",
          mustChangePassword: false,
          sessionVersion: 2,
        };
      },
    },
  );

  assert.equal(profileLookups, 0);
  assert.equal(token.role, "point_operator");
  assert.equal(token.sessionVersion, 1);
});

test("requireUser fails closed when session version cannot be verified", async () => {
  let profileLookups = 0;
  const user = await requireUser(
    new Request("http://localhost/api/user"),
    {
      getAuthTokenFn: async () => ({
        email: "op@example.com",
        uid: "op@example.com",
        role: "point_operator",
        sessionVersion: 1,
      }),
      getUserProfileFn: async () => {
        profileLookups += 1;
        throw new Error("storage unavailable");
      },
    },
  );

  assert.equal(profileLookups, 1);
  assert.equal(user, null);
});
