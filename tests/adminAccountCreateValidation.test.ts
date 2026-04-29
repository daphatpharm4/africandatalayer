import assert from "node:assert/strict";
import test from "node:test";
import { adminAccountCreateSchema } from "../lib/server/validation.js";

test("adminAccountCreateSchema defaults new accounts to client role", () => {
  const result = adminAccountCreateSchema.safeParse({
    identifier: "buyer@example.com",
    name: "Buyer Team",
    password: "ClientPass123!",
  });

  assert.equal(result.success, true);
  if (!result.success) return;
  assert.equal(result.data.identifier, "buyer@example.com");
  assert.equal(result.data.name, "Buyer Team");
  assert.equal(result.data.role, "client");
  assert.equal(result.data.password, "ClientPass123!");
});

test("adminAccountCreateSchema accepts explicit admin role", () => {
  const result = adminAccountCreateSchema.safeParse({
    identifier: "ops-admin@example.com",
    name: "Ops Admin",
    role: "admin",
    password: "AdminPass123!",
  });

  assert.equal(result.success, true);
  if (!result.success) return;
  assert.equal(result.data.role, "admin");
});

test("adminAccountCreateSchema rejects weak temporary passwords", () => {
  const result = adminAccountCreateSchema.safeParse({
    identifier: "buyer@example.com",
    role: "client",
    password: "weakpass",
  });

  assert.equal(result.success, false);
  if (result.success) return;
  assert.equal(
    result.error.issues.some((issue) => issue.message === "Password must include an uppercase letter"),
    true,
  );
});

test("adminAccountCreateSchema rejects unsupported roles", () => {
  const result = adminAccountCreateSchema.safeParse({
    identifier: "buyer@example.com",
    role: "owner",
    password: "ClientPass123!",
  });

  assert.equal(result.success, false);
});
