import assert from "node:assert/strict";
import test from "node:test";
import { createPlatformHandler } from "../lib/server/platform/api.js";

const OWNER = { id: "owner@acme.com", token: {}, role: "agent" as const };
const ORG = { id: "5a2f8f18-0000-4000-8000-000000000001", name: "Acme", slug: "acme", logoUrl: null, accentColor: null, createdAt: "" };
const PROJECT_ID = "5a2f8f18-0000-4000-8000-000000000002";

function jsonPost(view: string, body: unknown): Request {
  return new Request(`https://x.test/api/user?view=platform_${view}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function baseDeps(overrides: Record<string, unknown> = {}) {
  return {
    requireUserFn: async () => OWNER,
    getMembershipFn: async () => ({ organizationId: ORG.id, userId: OWNER.id, role: "owner" as const, createdAt: "" }),
    writeAuditFn: async () => {},
    ...overrides,
  };
}

test("unknown view returns 404", async () => {
  const handler = createPlatformHandler(baseDeps());
  const response = await handler(new Request("https://x.test/api/user?view=platform_nope"));
  assert.equal(response.status, 404);
});

test("org_create validates, creates, audits, returns 201", async () => {
  const audits: string[] = [];
  const handler = createPlatformHandler(baseDeps({
    createOrganizationFn: async () => ORG,
    writeAuditFn: async (event: { eventType: string }) => { audits.push(event.eventType); },
  }));
  const response = await handler(jsonPost("org_create", { name: "Acme", slug: "acme" }));
  assert.equal(response.status, 201);
  assert.deepEqual(audits, ["org_created"]);
});

test("org_create rejects invalid slug with 400", async () => {
  const handler = createPlatformHandler(baseDeps());
  const response = await handler(jsonPost("org_create", { name: "Acme", slug: "BAD SLUG" }));
  assert.equal(response.status, 400);
});

test("org_update requires owner: manager gets 403", async () => {
  const handler = createPlatformHandler(baseDeps({
    getMembershipFn: async () => ({ organizationId: ORG.id, userId: OWNER.id, role: "manager" as const, createdAt: "" }),
  }));
  const response = await handler(jsonPost("org_update", { organizationId: ORG.id, accentColor: "#c86b4a" }));
  assert.equal(response.status, 403);
});

test("cross-tenant org_get denied for non-member", async () => {
  const handler = createPlatformHandler(baseDeps({ getMembershipFn: async () => null }));
  const response = await handler(new Request(`https://x.test/api/user?view=platform_org_get&organizationId=${ORG.id}`));
  assert.equal(response.status, 403);
});

test("invite_create sends email with hashed-token invite and never leaks token", async () => {
  const sent: any[] = []; const created: any[] = [];
  const handler = createPlatformHandler(baseDeps({
    getOrganizationFn: async () => ORG,
    createInviteFn: async (input: any) => { created.push(input); return {
      id: "inv-1", organizationId: ORG.id, email: input.email, role: input.role,
      expiresAt: input.expiresAt.toISOString(), acceptedAt: null, createdAt: "",
    }; },
    sendInviteEmailFn: async (input: any) => { sent.push(input); },
  }));
  const response = await handler(jsonPost("invite_create", { organizationId: ORG.id, email: "new@x.com", role: "collector" }));
  assert.equal(response.status, 201);
  assert.match(created[0].tokenHash, /^[0-9a-f]{64}$/);
  assert.match(sent[0].joinUrl, /join\?token=[0-9a-f]{64}/);
  const body = await response.json();
  assert.equal(JSON.stringify(body).includes(created[0].tokenHash), false);
  assert.equal(/token=[0-9a-f]{64}/.test(JSON.stringify(body)), false);
});

test("invite_accept: expired invite gets 410", async () => {
  const handler = createPlatformHandler(baseDeps({
    findInviteByTokenHashFn: async () => ({
      id: "inv-1", organizationId: ORG.id, email: "new@x.com", role: "collector",
      expiresAt: "2020-01-01T00:00:00.000Z", acceptedAt: null, createdAt: "", tokenHash: "h",
    }),
  }));
  const response = await handler(jsonPost("invite_accept", { token: "a".repeat(64) }));
  assert.equal(response.status, 410);
});

test("invite_accept: valid invite adds membership and marks accepted", async () => {
  const roleUpserts: any[] = []; const accepted: any[] = [];
  const future = new Date(Date.now() + 86_400_000).toISOString();
  const handler = createPlatformHandler(baseDeps({
    requireUserFn: async () => ({ id: "new@x.com", token: { email: "new@x.com" }, role: "agent" as const }),
    getMembershipFn: async () => null,
    findInviteByTokenHashFn: async () => ({
      id: "inv-1", organizationId: ORG.id, email: "new@x.com", role: "collector",
      expiresAt: future, acceptedAt: null, createdAt: "", tokenHash: "h",
    }),
    upsertMemberRoleFn: async (input: any) => { roleUpserts.push(input); },
    markInviteAcceptedFn: async (input: any) => { accepted.push(input); },
  }));
  const response = await handler(jsonPost("invite_accept", { token: "a".repeat(64) }));
  assert.equal(response.status, 200);
  assert.equal(roleUpserts[0].role, "collector");
  assert.equal(accepted[0].inviteId, "inv-1");
});

test("invite_accept: rejects a different signed-in email before membership mutation", async () => {
  let upserted = false;
  const future = new Date(Date.now() + 86_400_000).toISOString();
  const handler = createPlatformHandler(baseDeps({
    requireUserFn: async () => ({ id: "owner@acme.com", token: { email: "owner@acme.com" }, role: "agent" as const }),
    findInviteByTokenHashFn: async () => ({
      id: "inv-1", organizationId: ORG.id, email: "new@x.com", role: "collector",
      expiresAt: future, acceptedAt: null, createdAt: "", tokenHash: "h",
    }),
    upsertMemberRoleFn: async () => { upserted = true; },
  }));

  const response = await handler(jsonPost("invite_accept", { token: "a".repeat(64) }));
  assert.equal(response.status, 403);
  assert.equal((await response.json()).code, "platform_invite_email_mismatch");
  assert.equal(upserted, false);
});

test("invite_accept: never overwrites an existing membership role", async () => {
  let upserted = false;
  const future = new Date(Date.now() + 86_400_000).toISOString();
  const handler = createPlatformHandler(baseDeps({
    requireUserFn: async () => ({ id: "owner@acme.com", token: { email: "OWNER@acme.com" }, role: "agent" as const }),
    getMembershipFn: async () => ({ organizationId: ORG.id, userId: "owner@acme.com", role: "owner" as const, createdAt: "" }),
    findInviteByTokenHashFn: async () => ({
      id: "inv-1", organizationId: ORG.id, email: "owner@acme.com", role: "collector",
      expiresAt: future, acceptedAt: null, createdAt: "", tokenHash: "h",
    }),
    upsertMemberRoleFn: async () => { upserted = true; },
  }));

  const response = await handler(jsonPost("invite_accept", { token: "a".repeat(64) }));
  assert.equal(response.status, 409);
  assert.equal((await response.json()).code, "platform_invite_already_member");
  assert.equal(upserted, false);
});

test("member_remove blocks removing the last owner", async () => {
  const handler = createPlatformHandler(baseDeps({
    listMembersFn: async () => [{ organizationId: ORG.id, userId: OWNER.id, role: "owner" as const, createdAt: "" }],
  }));
  const response = await handler(jsonPost("member_remove", { organizationId: ORG.id, userId: OWNER.id }));
  assert.equal(response.status, 409);
});

test("schema_draft_save returns 422 with issues for invalid definition", async () => {
  const handler = createPlatformHandler(baseDeps({
    getProjectFn: async () => ({ id: PROJECT_ID, organizationId: ORG.id, name: "p", status: "draft" as const, createdAt: "" }),
  }));
  const response = await handler(jsonPost("schema_draft_save", { projectId: PROJECT_ID, definition: { recordTypes: [] } }));
  assert.equal(response.status, 422);
  const body = await response.json();
  assert.ok(Array.isArray(body.issues));
});

test("schema_publish with no draft returns 409", async () => {
  const handler = createPlatformHandler(baseDeps({
    getProjectFn: async () => ({ id: PROJECT_ID, organizationId: ORG.id, name: "p", status: "draft" as const, createdAt: "" }),
    getDraftSchemaFn: async () => null,
  }));
  const response = await handler(jsonPost("schema_publish", { projectId: PROJECT_ID }));
  assert.equal(response.status, 409);
});

test("unauthenticated request gets 401 on every view", async () => {
  const handler = createPlatformHandler({ requireUserFn: async () => null });
  for (const view of ["org_list", "org_create", "invite_accept"]) {
    const response = await handler(jsonPost(view, {}));
    assert.equal(response.status, 401, view);
  }
});
