// tests/platformOrgStore.test.ts
import assert from "node:assert/strict";
import test from "node:test";
import {
  createOrganization,
  getMembership,
  getOrganizationAccessState,
  listMembers,
  listOrganizationsForUser,
  markInviteAccepted,
  removeMember,
  updateOrganizationBranding,
  setOrganizationAccessState,
  upsertMemberRole,
  createInvite,
  findInviteByTokenHash,
  revokeInvite,
} from "../lib/server/platform/orgStore.js";

const ORG_ROW = {
  id: "org-1", name: "Acme Waste", slug: "acme-waste",
  logo_url: null, accent_color: null, created_at: "2026-07-16T00:00:00.000Z",
};

function fakeQuery(rowsPerCall: Array<{ rows: any[] }>) {
  const calls: Array<{ text: string; values: unknown[] }> = [];
  let index = 0;
  const queryFn = async (text: string, values: unknown[] = []) => {
    calls.push({ text, values });
    const result = rowsPerCall[Math.min(index, rowsPerCall.length - 1)] ?? { rows: [] };
    index += 1;
    return { rows: result.rows, rowCount: result.rows.length };
  };
  return { queryFn, calls };
}

test("createOrganization inserts org then owner membership", async () => {
  const { queryFn, calls } = fakeQuery([{ rows: [ORG_ROW] }, { rows: [] }]);
  const org = await createOrganization({ name: "Acme Waste", slug: "acme-waste", createdBy: "u1" }, { queryFn });
  assert.equal(org.id, "org-1");
  assert.equal(org.slug, "acme-waste");
  assert.equal(calls.length, 2);
  assert.match(calls[0].text, /insert into public\.platform_organizations/i);
  assert.match(calls[1].text, /insert into public\.platform_organization_members/i);
  assert.deepEqual(calls[1].values, ["org-1", "u1", "owner"]);
});

test("getMembership scopes by organization and user", async () => {
  const { queryFn, calls } = fakeQuery([
    { rows: [{ organization_id: "org-1", user_id: "u1", role: "manager", created_at: "2026-07-16T00:00:00.000Z" }] },
  ]);
  const membership = await getMembership("org-1", "u1", { queryFn });
  assert.equal(membership?.role, "manager");
  assert.match(calls[0].text, /organization_id = \$1/i);
  assert.match(calls[0].text, /user_id = \$2/i);
});

test("getMembership returns null when absent", async () => {
  const { queryFn } = fakeQuery([{ rows: [] }]);
  assert.equal(await getMembership("org-1", "ghost", { queryFn }), null);
});

test("organization access state reads and updates without deleting tenant data", async () => {
  const { queryFn, calls } = fakeQuery([
    { rows: [{ access_status: "active" }] },
    { rows: [{
      id: "org-1",
      access_status: "suspended",
      suspension_reason: "Subscription overdue",
      suspended_at: "2026-07-18T00:00:00.000Z",
      suspended_by: "admin@adl.test",
    }] },
  ]);
  assert.equal(await getOrganizationAccessState("org-1", { queryFn }), "active");
  const updated = await setOrganizationAccessState({
    organizationId: "org-1",
    accessStatus: "suspended",
    reason: "Subscription overdue",
    actorUserId: "admin@adl.test",
  }, { queryFn });
  assert.equal(updated?.accessStatus, "suspended");
  assert.equal(updated?.suspensionReason, "Subscription overdue");
  assert.match(calls[1].text, /update public\.platform_organizations/i);
  assert.doesNotMatch(calls[1].text, /delete/i);
});

test("listOrganizationsForUser joins memberships", async () => {
  const { queryFn, calls } = fakeQuery([{ rows: [{ ...ORG_ROW, role: "owner" }] }]);
  const orgs = await listOrganizationsForUser("u1", { queryFn });
  assert.equal(orgs[0].role, "owner");
  assert.match(calls[0].text, /platform_organization_members/i);
  assert.deepEqual(calls[0].values, ["u1"]);
});

test("updateOrganizationBranding only touches provided fields and scopes by id", async () => {
  const { queryFn, calls } = fakeQuery([{ rows: [{ ...ORG_ROW, accent_color: "#c86b4a" }] }]);
  const org = await updateOrganizationBranding({ organizationId: "org-1", accentColor: "#c86b4a" }, { queryFn });
  assert.equal(org?.accentColor, "#c86b4a");
  assert.match(calls[0].text, /update public\.platform_organizations/i);
  assert.match(calls[0].text, /where id = /i);
  assert.doesNotMatch(calls[0].text, /name =/i);
});

test("member role update and removal scope by organization", async () => {
  const { queryFn, calls } = fakeQuery([{ rows: [] }]);
  await upsertMemberRole({ organizationId: "org-1", userId: "u2", role: "reviewer" }, { queryFn });
  await removeMember({ organizationId: "org-1", userId: "u2" }, { queryFn });
  assert.match(calls[0].text, /on conflict \(organization_id, user_id\)/i);
  assert.match(calls[1].text, /delete from public\.platform_organization_members/i);
  assert.match(calls[1].text, /organization_id = \$1/i);
});

test("invite lifecycle stores hash, finds by hash, marks accepted", async () => {
  const inviteRow = {
    id: "inv-1", organization_id: "org-1", email: "new@example.com", role: "collector",
    token_hash: "hash123", expires_at: "2026-07-23T00:00:00.000Z", accepted_at: null,
    created_at: "2026-07-16T00:00:00.000Z",
  };
  const { queryFn, calls } = fakeQuery([{ rows: [inviteRow] }, { rows: [inviteRow] }, { rows: [] }]);
  const invite = await createInvite(
    { organizationId: "org-1", email: "new@example.com", role: "collector", tokenHash: "hash123",
      expiresAt: new Date("2026-07-23T00:00:00.000Z"), createdBy: "u1" },
    { queryFn },
  );
  assert.equal(invite.email, "new@example.com");
  const found = await findInviteByTokenHash("hash123", { queryFn });
  assert.equal(found?.id, "inv-1");
  await markInviteAccepted({ inviteId: "inv-1", userId: "u9" }, { queryFn });
  assert.match(calls[2].text, /accepted_at = now\(\)/i);
  assert.match(calls[2].text, /accepted_at is null/i); // cannot double-accept
});

test("revokeInvite deletes only a pending invite in the requested organization", async () => {
  const { queryFn, calls } = fakeQuery([{ rows: [{ id: "inv-1" }] }]);
  const revoked = await revokeInvite({ organizationId: "org-1", inviteId: "inv-1" }, { queryFn });
  assert.equal(revoked, true);
  assert.match(calls[0].text, /delete from public\.platform_organization_invites/i);
  assert.match(calls[0].text, /organization_id = \$1/i);
  assert.match(calls[0].text, /id = \$2/i);
  assert.match(calls[0].text, /accepted_at is null/i);
  assert.deepEqual(calls[0].values, ["org-1", "inv-1"]);
});

test("listMembers scopes by organization", async () => {
  const { queryFn, calls } = fakeQuery([{ rows: [] }]);
  await listMembers("org-1", { queryFn });
  assert.deepEqual(calls[0].values, ["org-1"]);
});
