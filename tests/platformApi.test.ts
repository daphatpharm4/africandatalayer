import assert from "node:assert/strict";
import test from "node:test";
import { createPlatformHandler } from "../lib/server/platform/api.js";

const OWNER = { id: "owner@acme.com", token: {}, role: "agent" as const };
const ADL_ADMIN = { id: "admin@africandatalayer.com", token: {}, role: "admin" as const };
const ORG = { id: "5a2f8f18-0000-4000-8000-000000000001", name: "Acme", slug: "acme", logoUrl: null, accentColor: null, createdAt: "" };
const PROJECT_ID = "5a2f8f18-0000-4000-8000-000000000002";
const SCHEMA_ID = "5a2f8f18-0000-4000-8000-000000000004";

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
    getOrganizationAccessStateFn: async () => "active" as const,
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
    requireUserFn: async () => ADL_ADMIN,
    createOrganizationFn: async () => ORG,
    writeAuditFn: async (event: { eventType: string }) => { audits.push(event.eventType); },
  }));
  const response = await handler(jsonPost("org_create", { name: "Acme", slug: "acme" }));
  assert.equal(response.status, 201);
  assert.deepEqual(audits, ["org_created"]);
});

test("org_create rejects invalid slug with 400", async () => {
  const handler = createPlatformHandler(baseDeps({ requireUserFn: async () => ADL_ADMIN }));
  const response = await handler(jsonPost("org_create", { name: "Acme", slug: "BAD SLUG" }));
  assert.equal(response.status, 400);
});

test("org_create rejects a normal account before creating an owner", async () => {
  let created = false;
  const handler = createPlatformHandler(baseDeps({
    createOrganizationFn: async () => { created = true; return ORG; },
  }));
  const response = await handler(jsonPost("org_create", { name: "Acme", slug: "acme" }));
  assert.equal(response.status, 403);
  assert.equal((await response.json()).code, "platform_admin_required");
  assert.equal(created, false);
});

test("admin_org_list is visible only to ADL admins", async () => {
  let listed = false;
  const ownerHandler = createPlatformHandler(baseDeps({
    listAdminOrganizationSummariesFn: async () => { listed = true; return []; },
  }));
  const denied = await ownerHandler(new Request("https://x.test/api/user?view=platform_admin_org_list"));
  assert.equal(denied.status, 403);
  assert.equal((await denied.json()).code, "platform_admin_required");
  assert.equal(listed, false);

  const adminHandler = createPlatformHandler(baseDeps({
    requireUserFn: async () => ADL_ADMIN,
    listAdminOrganizationSummariesFn: async () => { listed = true; return []; },
  }));
  const allowed = await adminHandler(new Request("https://x.test/api/user?view=platform_admin_org_list"));
  assert.equal(allowed.status, 200);
  assert.equal(listed, true);
});

test("admin_org_access requires a reason, updates access, and audits suspension", async () => {
  const updates: any[] = [];
  const audits: any[] = [];
  const handler = createPlatformHandler(baseDeps({
    requireUserFn: async () => ADL_ADMIN,
    setOrganizationAccessStateFn: async (input: any) => {
      updates.push(input);
      return {
        id: ORG.id,
        accessStatus: input.accessStatus,
        suspensionReason: input.reason ?? null,
        suspendedAt: "2026-07-18T00:00:00.000Z",
        suspendedBy: ADL_ADMIN.id,
      };
    },
    writeAuditFn: async (event: any) => { audits.push(event); },
  }));

  const invalid = await handler(jsonPost("admin_org_access", {
    organizationId: ORG.id,
    accessStatus: "suspended",
  }));
  assert.equal(invalid.status, 400);
  assert.equal(updates.length, 0);

  const response = await handler(jsonPost("admin_org_access", {
    organizationId: ORG.id,
    accessStatus: "suspended",
    reason: "Subscription payment overdue",
  }));
  assert.equal(response.status, 200);
  assert.equal(updates[0].actorUserId, ADL_ADMIN.id);
  assert.equal(updates[0].accessStatus, "suspended");
  assert.equal(audits[0].eventType, "org_access_suspended");
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

test("invite_revoke invalidates a pending invite and audits the action", async () => {
  const revoked: any[] = [];
  const audits: string[] = [];
  const inviteId = "5a2f8f18-0000-4000-8000-000000000003";
  const handler = createPlatformHandler(baseDeps({
    revokeInviteFn: async (input: any) => { revoked.push(input); return true; },
    writeAuditFn: async (event: { eventType: string }) => { audits.push(event.eventType); },
  }));
  const response = await handler(jsonPost("invite_revoke", { organizationId: ORG.id, inviteId }));
  assert.equal(response.status, 200);
  assert.deepEqual(revoked, [{ organizationId: ORG.id, inviteId }]);
  assert.deepEqual(audits, ["invite_revoked"]);
});

test("invite_revoke returns 404 when the invite is accepted, revoked, or belongs elsewhere", async () => {
  const handler = createPlatformHandler(baseDeps({ revokeInviteFn: async () => false }));
  const response = await handler(jsonPost("invite_revoke", {
    organizationId: ORG.id,
    inviteId: "5a2f8f18-0000-4000-8000-000000000003",
  }));
  assert.equal(response.status, 404);
  assert.equal((await response.json()).code, "platform_invite_not_found");
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

test("invite_accept blocks joining a suspended company", async () => {
  let upserted = false;
  const future = new Date(Date.now() + 86_400_000).toISOString();
  const handler = createPlatformHandler(baseDeps({
    requireUserFn: async () => ({ id: "new@x.com", token: { email: "new@x.com" }, role: "agent" as const }),
    getOrganizationAccessStateFn: async () => "suspended" as const,
    findInviteByTokenHashFn: async () => ({
      id: "inv-1", organizationId: ORG.id, email: "new@x.com", role: "collector",
      expiresAt: future, acceptedAt: null, createdAt: "", tokenHash: "h",
    }),
    upsertMemberRoleFn: async () => { upserted = true; },
  }));
  const response = await handler(jsonPost("invite_accept", { token: "a".repeat(64) }));
  assert.equal(response.status, 403);
  assert.equal((await response.json()).code, "platform_org_suspended");
  assert.equal(upserted, false);
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

test("member_update allows only ADL admins to promote another owner", async () => {
  const promoted: any[] = [];
  const body = { organizationId: ORG.id, userId: "manager@acme.com", role: "owner" };
  const ownerHandler = createPlatformHandler(baseDeps({
    upsertMemberRoleFn: async (input: any) => { promoted.push(input); },
  }));
  const denied = await ownerHandler(jsonPost("member_update", body));
  assert.equal(denied.status, 403);
  assert.equal((await denied.json()).code, "platform_admin_required");
  assert.equal(promoted.length, 0);

  const adminHandler = createPlatformHandler(baseDeps({
    requireUserFn: async () => ADL_ADMIN,
    getMembershipFn: async () => ({ organizationId: ORG.id, userId: ADL_ADMIN.id, role: "owner" as const, createdAt: "" }),
    upsertMemberRoleFn: async (input: any) => { promoted.push(input); },
  }));
  assert.equal((await adminHandler(jsonPost("member_update", body))).status, 200);
  assert.equal(promoted[0].role, "owner");
});

test("notification_broadcast lets higher roles notify only lower-role members", async () => {
  const audits: any[] = [];
  const handler = createPlatformHandler(baseDeps({
    getMembershipFn: async () => ({ organizationId: ORG.id, userId: OWNER.id, role: "manager" as const, createdAt: "" }),
    listMembersFn: async () => [
      { organizationId: ORG.id, userId: OWNER.id, role: "manager" as const, createdAt: "" },
      { organizationId: ORG.id, userId: "reviewer@acme.com", role: "reviewer" as const, createdAt: "" },
      { organizationId: ORG.id, userId: "collector@acme.com", role: "collector" as const, createdAt: "" },
      { organizationId: ORG.id, userId: "viewer@acme.com", role: "viewer" as const, createdAt: "" },
    ],
    writeAuditFn: async (event: any) => { audits.push(event); },
  }));

  const response = await handler(jsonPost("notification_broadcast", {
    organizationId: ORG.id,
    targetRoles: ["collector", "viewer"],
    title: "Route updated",
    body: "Start with the Nairobi pilot.",
  }));

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { sentCount: 2, skippedCount: 2, failedCount: 0 });
  assert.equal(audits[0].eventType, "notification_broadcast_sent");
  assert.deepEqual(audits[0].payload.targetRoles, ["collector", "viewer"]);
});

test("notification_broadcast rejects peer or higher target roles", async () => {
  let listed = false;
  const handler = createPlatformHandler(baseDeps({
    getMembershipFn: async () => ({ organizationId: ORG.id, userId: OWNER.id, role: "manager" as const, createdAt: "" }),
    listMembersFn: async () => { listed = true; return []; },
  }));

  const response = await handler(jsonPost("notification_broadcast", {
    organizationId: ORG.id,
    targetRoles: ["manager"],
    title: "Route updated",
    body: "Start with the Nairobi pilot.",
  }));

  assert.equal(response.status, 403);
  assert.equal((await response.json()).code, "platform_notification_target_forbidden");
  assert.equal(listed, false);
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

test("record_create validates against the current published schema and preserves tenant scope", async () => {
  const created: any[] = [];
  const definition = { recordTypes: [{
    key: "retail_outlet",
    label: { en: "Retail outlet", fr: "Point de vente" },
    fields: [{ key: "name", label: { en: "Name", fr: "Nom" }, type: "text", required: true }],
    evidence: { gpsRequired: true, minPhotos: 0, notesRequired: false },
  }] };
  const handler = createPlatformHandler(baseDeps({
    getProjectFn: async () => ({ id: PROJECT_ID, organizationId: ORG.id, name: "Census", status: "active" as const, createdAt: "" }),
    getPublishedSchemaFn: async () => ({ id: SCHEMA_ID, projectId: PROJECT_ID, organizationId: ORG.id, version: 2, status: "published" as const, definition, publishedAt: "" }),
    createRecordFn: async (input: any) => {
      created.push(input);
      return { id: "record-1", ...input, status: "pending_review", createdAt: "" };
    },
  }));
  const response = await handler(new Request("https://x.test/api/user?view=platform_record_create", {
    method: "POST",
    headers: { "content-type": "application/json", "Idempotency-Key": "record-key-1" },
    body: JSON.stringify({
      projectId: PROJECT_ID,
      schemaVersionId: SCHEMA_ID,
      recordTypeKey: "retail_outlet",
      data: { name: "Central kiosk" },
      evidence: { gps: { latitude: 4.05, longitude: 9.7, accuracyMeters: 8 }, photos: [] },
    }),
  }));

  assert.equal(response.status, 201);
  assert.equal(created[0].organizationId, ORG.id);
  assert.equal(created[0].capturedBy, OWNER.id);
  assert.equal(created[0].idempotencyKey, "record-key-1");
  assert.match(created[0].requestHash, /^[0-9a-f]{64}$/);
});

test("record_create rejects viewers, missing idempotency, and stale schema versions", async () => {
  const project = { id: PROJECT_ID, organizationId: ORG.id, name: "Census", status: "active" as const, createdAt: "" };
  const body = { projectId: PROJECT_ID, schemaVersionId: SCHEMA_ID, recordTypeKey: "retail_outlet", data: {}, evidence: { photos: [] } };

  const missingKey = createPlatformHandler(baseDeps({ getProjectFn: async () => project }));
  assert.equal((await missingKey(jsonPost("record_create", body))).status, 422);

  const viewer = createPlatformHandler(baseDeps({
    getProjectFn: async () => project,
    getMembershipFn: async () => ({ organizationId: ORG.id, userId: OWNER.id, role: "viewer" as const, createdAt: "" }),
  }));
  const viewerRequest = jsonPost("record_create", body);
  viewerRequest.headers.set("Idempotency-Key", "record-key-2");
  assert.equal((await viewer(viewerRequest)).status, 403);

  const stale = createPlatformHandler(baseDeps({
    getProjectFn: async () => project,
    getPublishedSchemaFn: async () => ({ id: "5a2f8f18-0000-4000-8000-000000000099", projectId: PROJECT_ID, organizationId: ORG.id, version: 3, status: "published" as const, definition: { recordTypes: [] }, publishedAt: "" }),
  }));
  const staleRequest = jsonPost("record_create", body);
  staleRequest.headers.set("Idempotency-Key", "record-key-3");
  const staleResponse = await stale(staleRequest);
  assert.equal(staleResponse.status, 409);
  assert.equal((await staleResponse.json()).code, "platform_schema_stale");
});

test("record review queue is tenant-scoped and requires reviewer access", async () => {
  const record = {
    id: "5a2f8f18-0000-4000-8000-000000000005",
    organizationId: ORG.id,
    projectId: PROJECT_ID,
    schemaVersionId: SCHEMA_ID,
    recordTypeKey: "retail_outlet",
    data: { name: "Kiosk" },
    evidence: { photos: [] },
    status: "pending_review" as const,
    capturedBy: "collector@acme.com",
    createdAt: "",
  };
  const listed: any[] = [];
  const handler = createPlatformHandler(baseDeps({
    getMembershipFn: async () => ({ organizationId: ORG.id, userId: OWNER.id, role: "reviewer" as const, createdAt: "" }),
    listRecordsFn: async (input: any) => { listed.push(input); return [record]; },
  }));
  const response = await handler(new Request(`https://x.test/api/user?view=platform_record_list&organizationId=${ORG.id}&status=pending_review`));
  assert.equal(response.status, 200);
  assert.deepEqual(listed[0], { organizationId: ORG.id, status: "pending_review" });
  assert.equal((await response.json()).records[0].id, record.id);

  const viewer = createPlatformHandler(baseDeps({
    getMembershipFn: async () => ({ organizationId: ORG.id, userId: OWNER.id, role: "viewer" as const, createdAt: "" }),
  }));
  assert.equal((await viewer(new Request(`https://x.test/api/user?view=platform_record_list&organizationId=${ORG.id}`))).status, 403);
});

test("viewers can browse only approved tenant records", async () => {
  const listed: any[] = [];
  const handler = createPlatformHandler(baseDeps({
    getMembershipFn: async () => ({ organizationId: ORG.id, userId: OWNER.id, role: "viewer" as const, createdAt: "" }),
    listRecordsFn: async (input: any) => { listed.push(input); return []; },
  }));
  const response = await handler(new Request(`https://x.test/api/user?view=platform_record_browse&organizationId=${ORG.id}`));
  assert.equal(response.status, 200);
  assert.deepEqual(listed[0], { organizationId: ORG.id, status: "approved" });
});

test("record_review updates a tenant record and audits the decision", async () => {
  const audits: string[] = [];
  const reviewed: any[] = [];
  const handler = createPlatformHandler(baseDeps({
    getMembershipFn: async () => ({ organizationId: ORG.id, userId: OWNER.id, role: "reviewer" as const, createdAt: "" }),
    reviewRecordFn: async (input: any) => {
      reviewed.push(input);
      return {
        id: input.recordId, organizationId: ORG.id, projectId: PROJECT_ID, schemaVersionId: SCHEMA_ID,
        recordTypeKey: "retail_outlet", data: {}, evidence: { photos: [] }, status: input.status,
        capturedBy: "collector@acme.com", createdAt: "",
      };
    },
    writeAuditFn: async (event: { eventType: string }) => { audits.push(event.eventType); },
  }));
  const response = await handler(jsonPost("record_review", {
    organizationId: ORG.id,
    recordId: "5a2f8f18-0000-4000-8000-000000000005",
    status: "approved",
  }));
  assert.equal(response.status, 200);
  assert.equal(reviewed[0].status, "approved");
  assert.equal(reviewed[0].reviewedBy, OWNER.id);
  assert.deepEqual(audits, ["record_reviewed"]);
});

test("unauthenticated request gets 401 on every view", async () => {
  const handler = createPlatformHandler({ requireUserFn: async () => null });
  for (const view of ["org_list", "org_create", "invite_accept"]) {
    const response = await handler(jsonPost(view, {}));
    assert.equal(response.status, 401, view);
  }
});

// ── record_create point enrichment gates ────────────────────────────────────

const enrichDefinition = { recordTypes: [{
  key: "retail_outlet",
  label: { en: "Retail outlet", fr: "Point de vente" },
  fields: [{ key: "name", label: { en: "Name", fr: "Nom" }, type: "text", required: true }],
  evidence: { gpsRequired: true, minPhotos: 0, notesRequired: false },
}] };

const enrichProject = { id: PROJECT_ID, organizationId: ORG.id, name: "Census", status: "active" as const, createdAt: "" };

const enrichBody = {
  projectId: PROJECT_ID,
  schemaVersionId: SCHEMA_ID,
  recordTypeKey: "retail_outlet",
  data: { name: "Central kiosk" },
  evidence: { gps: { latitude: 4.05, longitude: 9.7, accuracyMeters: 8 }, photos: [] },
  pointId: "pt_test_1",
};

function enrichDeps(overrides: Record<string, unknown> = {}) {
  return baseDeps({
    getProjectFn: async () => enrichProject,
    getPublishedSchemaFn: async () => ({
      id: SCHEMA_ID, projectId: PROJECT_ID, organizationId: ORG.id, version: 2,
      status: "published" as const, definition: enrichDefinition, publishedAt: "",
    }),
    findOrgPointFn: async (input: any) => {
      assert.equal(input.organizationId, ORG.id);
      return {
        pointId: input.pointId,
        location: { latitude: 4.0503, longitude: 9.7001 }, // ~35 m from evidence GPS
      };
    },
    hasRecentRecordForPointFn: async () => false,
    ...overrides,
  });
}

test("record_create with pointId enriches within range, records capture coords, and audits pointId", async () => {
  const created: any[] = [];
  const audits: any[] = [];
  const handler = createPlatformHandler(enrichDeps({
    createRecordFn: async (input: any) => { created.push(input); return { id: "record-2", ...input, status: "pending_review", createdAt: "" }; },
    writeAuditFn: async (event: any) => { audits.push(event); },
  }));
  const request = jsonPost("record_create", enrichBody);
  request.headers.set("Idempotency-Key", "enrich-key-1");
  const response = await handler(request);
  assert.equal(response.status, 201);
  assert.equal(created[0].pointId, "pt_test_1");
  assert.equal(created[0].captureLat, 4.05);
  assert.equal(created[0].captureLng, 9.7);
  assert.equal(audits[0].payload.pointId, "pt_test_1");
});

test("record_create with an unknown pointId returns 409 platform_point_not_found", async () => {
  const handler = createPlatformHandler(enrichDeps({ findOrgPointFn: async () => null }));
  const request = jsonPost("record_create", enrichBody);
  request.headers.set("Idempotency-Key", "enrich-key-2");
  const response = await handler(request);
  assert.equal(response.status, 409);
  assert.equal((await response.json()).code, "platform_point_not_found");
});

test("record_create too far from the point returns 422 platform_enrich_too_far", async () => {
  const handler = createPlatformHandler(enrichDeps({
    findOrgPointFn: async () => ({
      pointId: "pt_test_1",
      location: { latitude: 4.2, longitude: 9.7 }, // ~16 km away
    }),
  }));
  const request = jsonPost("record_create", enrichBody);
  request.headers.set("Idempotency-Key", "enrich-key-3");
  const response = await handler(request);
  assert.equal(response.status, 422);
  assert.equal((await response.json()).code, "platform_enrich_too_far");
});

test("record_create on cooldown returns 429 platform_enrich_cooldown", async () => {
  const handler = createPlatformHandler(enrichDeps({ hasRecentRecordForPointFn: async () => true }));
  const request = jsonPost("record_create", enrichBody);
  request.headers.set("Idempotency-Key", "enrich-key-4");
  const response = await handler(request);
  assert.equal(response.status, 429);
  assert.equal((await response.json()).code, "platform_enrich_cooldown");
});

test("record_create without a pointId is a standalone create and never touches point lookup", async () => {
  const created: any[] = [];
  let lookupCalled = false;
  let cooldownCalled = false;
  const { pointId: _pointId, ...standaloneBody } = enrichBody;
  const handler = createPlatformHandler(enrichDeps({
    findOrgPointFn: async () => { lookupCalled = true; return null; },
    hasRecentRecordForPointFn: async () => { cooldownCalled = true; return false; },
    createRecordFn: async (input: any) => { created.push(input); return { id: "record-3", ...input, status: "pending_review", createdAt: "" }; },
  }));
  const request = jsonPost("record_create", standaloneBody);
  request.headers.set("Idempotency-Key", "enrich-key-5");
  const response = await handler(request);
  assert.equal(response.status, 201);
  assert.equal(created[0].pointId ?? null, null);
  assert.equal(lookupCalled, false);
  assert.equal(cooldownCalled, false);
});

// ── platform_point_nearby ────────────────────────────────────────────────────

test("platform_point_nearby returns points for a project-scoped collector", async () => {
  const handler = createPlatformHandler(baseDeps({
    getProjectFn: async () => enrichProject,
    listNearbyOrgPointsFn: async (input: any) => {
      assert.equal(input.organizationId, ORG.id);
      assert.equal(input.latitude, 4.05);
      assert.equal(input.longitude, 9.7);
      return [{
        pointId: "pt_test_1", category: "pharmacy", name: "Pharmacie Centrale",
        location: { latitude: 4.0503, longitude: 9.7001 }, updatedAt: "2026-07-01T00:00:00.000Z", distanceMeters: 35,
      }];
    },
  }));
  const response = await handler(new Request(
    `https://x.test/api/user?view=platform_point_nearby&projectId=${PROJECT_ID}&latitude=4.05&longitude=9.7`,
  ));
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.points.length, 1);
  assert.equal(body.points[0].pointId, "pt_test_1");
});

test("platform_point_nearby rejects missing/invalid coordinates with 400", async () => {
  const handler = createPlatformHandler(baseDeps({ getProjectFn: async () => enrichProject }));
  const response = await handler(new Request(
    `https://x.test/api/user?view=platform_point_nearby&projectId=${PROJECT_ID}&longitude=9.7`,
  ));
  assert.equal(response.status, 400);
});

test("platform_point_nearby requires collector role: viewer gets 403", async () => {
  const handler = createPlatformHandler(baseDeps({
    getProjectFn: async () => enrichProject,
    getMembershipFn: async () => ({ organizationId: ORG.id, userId: OWNER.id, role: "viewer" as const, createdAt: "" }),
    listNearbyOrgPointsFn: async () => { throw new Error("should not be called"); },
  }));
  const response = await handler(new Request(
    `https://x.test/api/user?view=platform_point_nearby&projectId=${PROJECT_ID}&latitude=4.05&longitude=9.7`,
  ));
  assert.equal(response.status, 403);
});

// ── record_browse pointId filter ────────────────────────────────────────────

test("record_browse accepts an optional pointId filter and passes it through", async () => {
  const listed: any[] = [];
  const handler = createPlatformHandler(baseDeps({
    listRecordsFn: async (input: any) => { listed.push(input); return []; },
  }));
  const response = await handler(new Request(
    `https://x.test/api/user?view=platform_record_browse&organizationId=${ORG.id}&pointId=pt_1`,
  ));
  assert.equal(response.status, 200);
  assert.equal(listed[0].pointId, "pt_1");
});
