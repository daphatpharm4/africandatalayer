import assert from "node:assert/strict";
import test from "node:test";
import {
  buildBootstrapAdminProfile,
  resolveOrProvisionProfile,
} from "../lib/server/adminProfileProvisioning.ts";

test("buildBootstrapAdminProfile returns an admin, global-scope profile", () => {
  const p = buildBootstrapAdminProfile("admin@example.com");
  assert.equal(p.id, "admin@example.com");
  assert.equal(p.email, "admin@example.com");
  assert.equal(p.isAdmin, true);
  assert.equal(p.role, "admin");
  assert.equal(p.mapScope, "global");
  assert.equal(p.trustScore, 50);
  assert.equal(p.XP, 0);
});

test("buildBootstrapAdminProfile treats non-email id as phone-less, name-defaulted", () => {
  const p = buildBootstrapAdminProfile("+237600000000");
  assert.equal(p.email, null);
  assert.equal(p.phone, "+237600000000");
  assert.ok(p.name && p.name.length > 0);
});

test("resolveOrProvisionProfile provisions when admin has no row", async () => {
  const store = new Map<string, unknown>();
  const upserts: string[] = [];
  const result = await resolveOrProvisionProfile(
    {
      getProfile: async (id) => (store.get(id) as never) ?? null,
      upsertProfile: async (id, p) => { store.set(id, p); upserts.push(id); },
    },
    "admin@example.com",
    true,
  );
  assert.ok(result);
  assert.equal(result!.isAdmin, true);
  assert.equal(result!.mapScope, "global");
  assert.deepEqual(upserts, ["admin@example.com"]);
});

test("resolveOrProvisionProfile does NOT provision for a non-admin missing row", async () => {
  const result = await resolveOrProvisionProfile(
    { getProfile: async () => null, upsertProfile: async () => { throw new Error("should not upsert"); } },
    "agent@example.com",
    false,
  );
  assert.equal(result, null);
});

test("resolveOrProvisionProfile returns an existing row unchanged without upserting", async () => {
  // Upgrading an existing row to admin access is the caller's job
  // (applyAdminProfileAccess), so this module must not mutate or persist it.
  const existing = { id: "admin@example.com", role: "agent", isAdmin: false, mapScope: "bonamoussadi", XP: 7 };
  const store = new Map<string, unknown>([["admin@example.com", existing]]);
  const result = await resolveOrProvisionProfile(
    {
      getProfile: async (id) => (store.get(id) as never) ?? null,
      upsertProfile: async () => { throw new Error("should not upsert an existing row"); },
    },
    "admin@example.com",
    true,
  );
  assert.equal(result, existing);
  assert.equal(result!.role, "agent");
  assert.equal(result!.isAdmin, false);
  assert.equal(result!.mapScope, "bonamoussadi");
});
