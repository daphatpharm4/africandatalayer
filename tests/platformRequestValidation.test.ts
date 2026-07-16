import assert from "node:assert/strict";
import test from "node:test";
import {
  inviteAcceptSchema,
  inviteCreateSchema,
  orgCreateSchema,
  orgUpdateSchema,
  projectCreateSchema,
} from "../lib/server/platform/validation.js";
import { writePlatformAudit } from "../lib/server/platform/audit.js";

test("org create accepts valid name and slug", () => {
  const result = orgCreateSchema.safeParse({ name: "Acme Waste", slug: "acme-waste" });
  assert.equal(result.success, true);
});

test("org create rejects bad slug", () => {
  assert.equal(orgCreateSchema.safeParse({ name: "Acme", slug: "Acme Waste!" }).success, false);
  assert.equal(orgCreateSchema.safeParse({ name: "Acme", slug: "-bad" }).success, false);
});

test("invite create rejects owner role and normalizes email", () => {
  assert.equal(inviteCreateSchema.safeParse({
    organizationId: "5a2f8f18-0000-4000-8000-000000000000", email: "A@B.com", role: "owner",
  }).success, false);
  const ok = inviteCreateSchema.safeParse({
    organizationId: "5a2f8f18-0000-4000-8000-000000000000", email: "A@B.com", role: "collector",
  });
  assert.equal(ok.success, true);
  if (ok.success) assert.equal(ok.data.email, "a@b.com");
});

test("invite accept requires 64-hex token", () => {
  assert.equal(inviteAcceptSchema.safeParse({ token: "short" }).success, false);
  assert.equal(inviteAcceptSchema.safeParse({ token: "a".repeat(64) }).success, true);
});

test("org update validates accent color format", () => {
  const base = { organizationId: "5a2f8f18-0000-4000-8000-000000000000" };
  assert.equal(orgUpdateSchema.safeParse({ ...base, accentColor: "#c86b4a" }).success, true);
  assert.equal(orgUpdateSchema.safeParse({ ...base, accentColor: "red" }).success, false);
});

test("project create bounds name length", () => {
  const base = { organizationId: "5a2f8f18-0000-4000-8000-000000000000" };
  assert.equal(projectCreateSchema.safeParse({ ...base, name: "x" }).success, false);
  assert.equal(projectCreateSchema.safeParse({ ...base, name: "Bin census" }).success, true);
});

test("writePlatformAudit inserts scoped row and swallows failures", async () => {
  const calls: Array<{ text: string; values: unknown[] }> = [];
  await writePlatformAudit(
    { organizationId: "org-1", actorUserId: "u1", eventType: "org_created", payload: { slug: "acme" } },
    { queryFn: async (text, values = []) => { calls.push({ text, values }); return { rows: [], rowCount: 0 }; } },
  );
  assert.match(calls[0].text, /insert into public\.platform_audit_events/i);
  assert.equal(calls[0].values[0], "org-1");

  // failure path must not throw
  await writePlatformAudit(
    { organizationId: "org-1", actorUserId: "u1", eventType: "org_created" },
    { queryFn: async () => { throw new Error("db down"); } },
  );
});
