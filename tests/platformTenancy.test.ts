import assert from "node:assert/strict";
import test from "node:test";
import { isTenancyFailure, requireOrgRole, requireProjectOrgRole } from "../lib/server/platform/tenancy.js";

const request = new Request("https://example.com/api/platform");
const authedUser = async () => ({ id: "u1", token: {}, role: "agent" as const });
const noUser = async () => null;

test("unauthenticated request gets 401", async () => {
  const result = await requireOrgRole(request, "org-1", "viewer", { requireUserFn: noUser as any });
  assert.ok(isTenancyFailure(result));
  assert.equal((result as Response).status, 401);
});

test("non-member gets 403", async () => {
  const result = await requireOrgRole(request, "org-1", "viewer", {
    requireUserFn: authedUser as any,
    getMembershipFn: async () => null,
  });
  assert.ok(isTenancyFailure(result));
  assert.equal((result as Response).status, 403);
});

test("member below minimum role gets 403", async () => {
  const result = await requireOrgRole(request, "org-1", "manager", {
    requireUserFn: authedUser as any,
    getMembershipFn: async () => ({ organizationId: "org-1", userId: "u1", role: "collector", createdAt: "" }),
  });
  assert.ok(isTenancyFailure(result));
  assert.equal((result as Response).status, 403);
});

test("member at or above minimum role gets context", async () => {
  const result = await requireOrgRole(request, "org-1", "manager", {
    requireUserFn: authedUser as any,
    getMembershipFn: async () => ({ organizationId: "org-1", userId: "u1", role: "owner", createdAt: "" }),
  });
  assert.ok(!isTenancyFailure(result));
  assert.deepEqual(result, { userId: "u1", organizationId: "org-1", role: "owner" });
});

test("cross-tenant: membership lookup is scoped to the requested org, not any org", async () => {
  const lookups: string[] = [];
  await requireOrgRole(request, "org-2", "viewer", {
    requireUserFn: authedUser as any,
    getMembershipFn: async (orgId: string) => {
      lookups.push(orgId);
      return null; // member of org-1, but org-2 requested
    },
  });
  assert.deepEqual(lookups, ["org-2"]);
});

test("requireProjectOrgRole: missing project gets 404", async () => {
  const result = await requireProjectOrgRole(request, "ghost", "viewer", {
    requireUserFn: authedUser as any,
    getProjectFn: async () => null,
  });
  assert.ok(isTenancyFailure(result));
  assert.equal((result as Response).status, 404);
});

test("requireProjectOrgRole: project in another org gets 403, body identical to plain 403", async () => {
  const foreign = await requireProjectOrgRole(request, "proj-9", "viewer", {
    requireUserFn: authedUser as any,
    getProjectFn: async () => ({
      id: "proj-9", organizationId: "org-9", name: "x", status: "draft",
      coverageScope: "worldwide", coverageLabel: null, createdAt: "",
    }),
    getMembershipFn: async () => null,
  });
  const plain = await requireOrgRole(request, "org-9", "viewer", {
    requireUserFn: authedUser as any,
    getMembershipFn: async () => null,
  });
  assert.equal((foreign as Response).status, 403);
  assert.equal(await (foreign as Response).text(), await (plain as Response).text());
});

test("requireProjectOrgRole: member gets context with projectId", async () => {
  const result = await requireProjectOrgRole(request, "proj-1", "reviewer", {
    requireUserFn: authedUser as any,
    getProjectFn: async () => ({
      id: "proj-1", organizationId: "org-1", name: "x", status: "active",
      coverageScope: "worldwide", coverageLabel: null, createdAt: "",
    }),
    getMembershipFn: async () => ({ organizationId: "org-1", userId: "u1", role: "manager", createdAt: "" }),
  });
  assert.ok(!isTenancyFailure(result));
  assert.equal((result as { projectId: string }).projectId, "proj-1");
});
