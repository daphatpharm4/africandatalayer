import assert from "node:assert/strict";
import test from "node:test";
import {
  PlatformApiError,
  listMyOrganizations,
  createOrganizationRequest,
  getOrganizationRequest,
  updateOrganizationRequest,
  listAdminOrganizationsRequest,
  updateAdminOrganizationAccessRequest,
  listOrgMembersRequest,
  createInviteRequest,
  acceptInviteRequest,
  revokeInviteRequest,
  updateMemberRequest,
  removeMemberRequest,
  createProjectRequest,
  listProjectsRequest,
  getSchemaRequest,
  saveSchemaDraftRequest,
  publishSchemaRequest,
  createPlatformRecordRequest,
  listPlatformRecordsRequest,
  listApprovedPlatformRecordsRequest,
  reviewPlatformRecordRequest,
  nearbyPlatformPointsRequest,
} from "../lib/client/platformApi.ts";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function stubFetch(handler: (url: string, init?: RequestInit) => Response) {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const fetchFn = (async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    return handler(url, init);
  }) as typeof fetch;
  return { fetchFn, calls };
}

test("createOrganizationRequest posts to platform_org_create with credentials and JSON body", async () => {
  const organization = {
    id: "org-1",
    name: "Acme",
    slug: "acme",
    logoUrl: null,
    accentColor: null,
    createdAt: "2026-01-01T00:00:00.000Z",
  };
  const { fetchFn, calls } = stubFetch(() => jsonResponse({ organization }, 201));

  const result = await createOrganizationRequest({ name: "Acme", slug: "acme" }, { fetchFn });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "/api/user?view=platform_org_create");
  assert.equal(calls[0].init?.method, "POST");
  assert.equal(calls[0].init?.credentials, "include");
  assert.equal(calls[0].init?.body, JSON.stringify({ name: "Acme", slug: "acme" }));
  assert.deepEqual(result, organization);
});

test("admin company access clients use protected platform admin views", async () => {
  const summary = { id: "org-1", name: "Acme", accessStatus: "active" };
  const listStub = stubFetch(() => jsonResponse({ organizations: [summary] }));
  assert.deepEqual(await listAdminOrganizationsRequest({ fetchFn: listStub.fetchFn }), [summary]);
  assert.equal(listStub.calls[0].url, "/api/user?view=platform_admin_org_list");

  const updateStub = stubFetch(() => jsonResponse({ organization: {
    id: "org-1", accessStatus: "suspended", suspensionReason: "Subscription overdue",
    suspendedAt: "2026-07-18T00:00:00.000Z", suspendedBy: "admin@adl.test",
  } }));
  const updated = await updateAdminOrganizationAccessRequest({
    organizationId: "org-1",
    accessStatus: "suspended",
    reason: "Subscription overdue",
  }, { fetchFn: updateStub.fetchFn });
  assert.equal(updateStub.calls[0].url, "/api/user?view=platform_admin_org_access");
  assert.match(String(updateStub.calls[0].init?.body), /Subscription overdue/);
  assert.equal(updated.accessStatus, "suspended");
});

test("listMyOrganizations gets platform_org_list and unwraps organizations array", async () => {
  const organizations = [
    { id: "org-1", name: "Acme", slug: "acme", logoUrl: null, accentColor: null, createdAt: "x", role: "owner" },
  ];
  const { fetchFn, calls } = stubFetch(() => jsonResponse({ organizations }));

  const result = await listMyOrganizations({ fetchFn });

  assert.equal(calls[0].url, "/api/user?view=platform_org_list");
  assert.equal(calls[0].init?.method, "GET");
  assert.equal(calls[0].init?.credentials, "include");
  assert.equal(calls[0].init?.body, undefined);
  assert.deepEqual(result, organizations);
});

test("getOrganizationRequest gets platform_org_get with organizationId query param", async () => {
  const organization = { id: "org-1", name: "Acme", slug: "acme", logoUrl: null, accentColor: null, createdAt: "x" };
  const { fetchFn, calls } = stubFetch(() => jsonResponse({ organization }));

  const result = await getOrganizationRequest("org-1", { fetchFn });

  assert.equal(calls[0].url, "/api/user?view=platform_org_get&organizationId=org-1");
  assert.equal(calls[0].init?.method, "GET");
  assert.deepEqual(result, organization);
});

test("updateOrganizationRequest posts platform_org_update and unwraps organization", async () => {
  const organization = { id: "org-1", name: "New Name", slug: "acme", logoUrl: null, accentColor: "#123456", createdAt: "x" };
  const { fetchFn, calls } = stubFetch(() => jsonResponse({ organization }));

  const result = await updateOrganizationRequest(
    { organizationId: "org-1", name: "New Name", accentColor: "#123456" },
    { fetchFn },
  );

  assert.equal(calls[0].url, "/api/user?view=platform_org_update");
  assert.equal(calls[0].init?.method, "POST");
  assert.deepEqual(JSON.parse(calls[0].init?.body as string), {
    organizationId: "org-1",
    name: "New Name",
    accentColor: "#123456",
  });
  assert.deepEqual(result, organization);
});

test("listOrgMembersRequest gets platform_org_members and passes through members+invites", async () => {
  const members = [{ organizationId: "org-1", userId: "u1", role: "owner", createdAt: "x" }];
  const invites: unknown[] = [];
  const { fetchFn, calls } = stubFetch(() => jsonResponse({ members, invites }));

  const result = await listOrgMembersRequest("org-1", { fetchFn });

  assert.equal(calls[0].url, "/api/user?view=platform_org_members&organizationId=org-1");
  assert.deepEqual(result, { members, invites });
});

test("createInviteRequest posts platform_invite_create and unwraps invite", async () => {
  const invite = {
    id: "inv-1",
    organizationId: "org-1",
    email: "a@b.com",
    role: "viewer",
    expiresAt: "x",
    acceptedAt: null,
    createdAt: "x",
  };
  const { fetchFn, calls } = stubFetch(() => jsonResponse({ invite }, 201));

  const result = await createInviteRequest(
    { organizationId: "org-1", email: "a@b.com", role: "viewer" },
    { fetchFn },
  );

  assert.equal(calls[0].url, "/api/user?view=platform_invite_create");
  assert.equal(calls[0].init?.method, "POST");
  assert.deepEqual(result, invite);
});

test("acceptInviteRequest posts platform_invite_accept and passes through organizationId", async () => {
  const { fetchFn, calls } = stubFetch(() => jsonResponse({ organizationId: "org-1" }));

  const result = await acceptInviteRequest("abcd1234", { fetchFn });

  assert.equal(calls[0].url, "/api/user?view=platform_invite_accept");
  assert.equal(calls[0].init?.method, "POST");
  assert.deepEqual(JSON.parse(calls[0].init?.body as string), { token: "abcd1234" });
  assert.deepEqual(result, { organizationId: "org-1" });
});

test("revokeInviteRequest posts the scoped invite identifier", async () => {
  const { fetchFn, calls } = stubFetch(() => jsonResponse({ revoked: true }));
  await revokeInviteRequest({ organizationId: "org-1", inviteId: "inv-1" }, { fetchFn });
  assert.equal(calls[0].url, "/api/user?view=platform_invite_revoke");
  assert.equal(calls[0].init?.method, "POST");
  assert.deepEqual(JSON.parse(calls[0].init?.body as string), {
    organizationId: "org-1",
    inviteId: "inv-1",
  });
});

test("platform client preserves stable API error codes", async () => {
  const { fetchFn } = stubFetch(() =>
    jsonResponse(
      { error: "This invitation belongs to another account", code: "platform_invite_email_mismatch" },
      403,
    ),
  );

  await assert.rejects(
    () => acceptInviteRequest("abcd1234", { fetchFn }),
    (error: unknown) =>
      error instanceof PlatformApiError &&
      error.status === 403 &&
      error.code === "platform_invite_email_mismatch",
  );
});

test("updateMemberRequest posts platform_member_update and resolves void", async () => {
  const { fetchFn, calls } = stubFetch(() => jsonResponse({ updated: true }));

  const result = await updateMemberRequest(
    { organizationId: "org-1", userId: "u1", role: "manager" },
    { fetchFn },
  );

  assert.equal(calls[0].url, "/api/user?view=platform_member_update");
  assert.equal(calls[0].init?.method, "POST");
  assert.equal(result, undefined);
});

test("removeMemberRequest posts platform_member_remove and resolves void", async () => {
  const { fetchFn, calls } = stubFetch(() => jsonResponse({ removed: true }));

  const result = await removeMemberRequest({ organizationId: "org-1", userId: "u1" }, { fetchFn });

  assert.equal(calls[0].url, "/api/user?view=platform_member_remove");
  assert.equal(calls[0].init?.method, "POST");
  assert.equal(result, undefined);
});

test("createProjectRequest posts project coverage and unwraps project", async () => {
  const project = {
    id: "proj-1", organizationId: "org-1", name: "Census", status: "draft",
    coverageScope: "country", coverageLabel: "Kenya", createdAt: "x",
  };
  const { fetchFn, calls } = stubFetch(() => jsonResponse({ project }, 201));

  const result = await createProjectRequest({
    organizationId: "org-1",
    name: "Census",
    coverageScope: "country",
    coverageLabel: "Kenya",
  }, { fetchFn });

  assert.equal(calls[0].url, "/api/user?view=platform_project_create");
  assert.match(String(calls[0].init?.body), /"coverageScope":"country"/);
  assert.deepEqual(result, project);
});

test("listProjectsRequest gets platform_project_list and unwraps projects array", async () => {
  const projects = [{ id: "proj-1", organizationId: "org-1", name: "Census", status: "draft", createdAt: "x" }];
  const { fetchFn, calls } = stubFetch(() => jsonResponse({ projects }));

  const result = await listProjectsRequest("org-1", { fetchFn });

  assert.equal(calls[0].url, "/api/user?view=platform_project_list&organizationId=org-1");
  assert.deepEqual(result, projects);
});

test("getSchemaRequest gets platform_schema_get and passes through draft/published/versions", async () => {
  const body = { draft: null, published: null, versions: [] };
  const { fetchFn, calls } = stubFetch(() => jsonResponse(body));

  const result = await getSchemaRequest("proj-1", { fetchFn });

  assert.equal(calls[0].url, "/api/user?view=platform_schema_get&projectId=proj-1");
  assert.deepEqual(result, body);
});

test("saveSchemaDraftRequest posts platform_schema_draft_save and unwraps schemaVersion", async () => {
  const definition = { recordTypes: [] };
  const schemaVersion = {
    id: "sv-1",
    projectId: "proj-1",
    organizationId: "org-1",
    version: 1,
    status: "draft",
    definition,
    publishedAt: null,
  };
  const { fetchFn, calls } = stubFetch(() => jsonResponse({ schemaVersion }));

  const result = await saveSchemaDraftRequest({ projectId: "proj-1", definition }, { fetchFn });

  assert.equal(calls[0].url, "/api/user?view=platform_schema_draft_save");
  assert.equal(calls[0].init?.method, "POST");
  assert.deepEqual(JSON.parse(calls[0].init?.body as string), { projectId: "proj-1", definition });
  assert.deepEqual(result, schemaVersion);
});

test("publishSchemaRequest posts platform_schema_publish and unwraps schemaVersion", async () => {
  const schemaVersion = {
    id: "sv-1",
    projectId: "proj-1",
    organizationId: "org-1",
    version: 1,
    status: "published",
    definition: { recordTypes: [] },
    publishedAt: "x",
  };
  const { fetchFn, calls } = stubFetch(() => jsonResponse({ schemaVersion }));

  const result = await publishSchemaRequest("proj-1", { fetchFn });

  assert.equal(calls[0].url, "/api/user?view=platform_schema_publish");
  assert.equal(calls[0].init?.method, "POST");
  assert.deepEqual(JSON.parse(calls[0].init?.body as string), { projectId: "proj-1" });
  assert.deepEqual(result, schemaVersion);
});

test("record review client lists and decides company records", async () => {
  const record = { id: "r1", organizationId: "org-1", projectId: "p1", schemaVersionId: "s1", recordTypeKey: "shop", data: {}, evidence: { photos: [] }, status: "pending_review", capturedBy: "u1", createdAt: "x" };
  const list = stubFetch(() => jsonResponse({ records: [record] }));
  assert.deepEqual(await listPlatformRecordsRequest("org-1", "pending_review", { fetchFn: list.fetchFn }), [record]);
  assert.equal(list.calls[0].url, "/api/user?view=platform_record_list&organizationId=org-1&status=pending_review");

  const browse = stubFetch(() => jsonResponse({ records: [{ ...record, status: "approved" }] }));
  assert.equal((await listApprovedPlatformRecordsRequest("org-1", { fetchFn: browse.fetchFn }))[0].status, "approved");
  assert.equal(browse.calls[0].url, "/api/user?view=platform_record_browse&organizationId=org-1");

  const review = stubFetch(() => jsonResponse({ record: { ...record, status: "approved" } }));
  const result = await reviewPlatformRecordRequest({ organizationId: "org-1", recordId: "r1", status: "approved" }, { fetchFn: review.fetchFn });
  assert.equal(result.status, "approved");
  assert.equal(review.calls[0].url, "/api/user?view=platform_record_review");
});

test("saveSchemaDraftRequest throws PlatformApiError with issues on 422", async () => {
  const issues = [{ path: "recordTypes.0.key", message: "Duplicate record type key" }];
  const { fetchFn } = stubFetch(() => jsonResponse({ issues }, 422));

  await assert.rejects(
    () => saveSchemaDraftRequest({ projectId: "proj-1", definition: { recordTypes: [] } }, { fetchFn }),
    (error: unknown) => {
      assert.ok(error instanceof PlatformApiError);
      assert.equal(error.status, 422);
      assert.deepEqual(error.issues, issues);
      return true;
    },
  );
});

test("listMyOrganizations throws PlatformApiError with status 403 on forbidden", async () => {
  const { fetchFn } = stubFetch(() => jsonResponse({ error: "Forbidden" }, 403));

  await assert.rejects(
    () => listMyOrganizations({ fetchFn }),
    (error: unknown) => {
      assert.ok(error instanceof PlatformApiError);
      assert.equal(error.status, 403);
      assert.equal((error as Error).message, "Forbidden");
      assert.equal(error.issues, undefined);
      return true;
    },
  );
});

test("createPlatformRecordRequest sends the stable idempotency key outside the JSON body", async () => {
  const record = { id: "record-1" };
  const { fetchFn, calls } = stubFetch(() => jsonResponse({ record }, 201));
  const result = await createPlatformRecordRequest({
    projectId: "project-1",
    schemaVersionId: "schema-1",
    recordTypeKey: "retail_outlet",
    data: { name: "Kiosk" },
    evidence: { photos: [] },
    idempotencyKey: "stable-record-key",
  }, { fetchFn });

  assert.deepEqual(result, record);
  assert.equal(calls[0].url, "/api/user?view=platform_record_create");
  assert.equal(new Headers(calls[0].init?.headers).get("Idempotency-Key"), "stable-record-key");
  assert.equal(JSON.parse(calls[0].init?.body as string).idempotencyKey, undefined);
});

const RECORD_INPUT = {
  projectId: "p1",
  schemaVersionId: "s1",
  recordTypeKey: "retail_outlet",
  data: { name: "Kiosk" },
  evidence: { gps: { latitude: 4.05, longitude: 9.7 }, photos: [] as string[] },
  idempotencyKey: "record-key-000001",
};

test("createPlatformRecordRequest forwards pointId when attaching to a point", async () => {
  const { fetchFn, calls } = stubFetch(() => jsonResponse({ record: { id: "r1" } }, 201));
  await createPlatformRecordRequest({ ...RECORD_INPUT, pointId: "pt_1" }, { fetchFn });
  const body = JSON.parse(String(calls[0].init?.body));
  assert.equal(body.pointId, "pt_1");
});

test("createPlatformRecordRequest omits pointId for standalone records", async () => {
  const { fetchFn, calls } = stubFetch(() => jsonResponse({ record: { id: "r1" } }, 201));
  await createPlatformRecordRequest(RECORD_INPUT, { fetchFn });
  const body = JSON.parse(String(calls[0].init?.body));
  assert.equal("pointId" in body, false);
});

test("nearbyPlatformPointsRequest hits platform_point_nearby with coordinates", async () => {
  const points = [{
    pointId: "pt_1", category: "pharmacy", name: "Pharmacie Centrale",
    location: { latitude: 4.0503, longitude: 9.7001 },
    updatedAt: "2026-07-01T00:00:00.000Z", distanceMeters: 35,
  }];
  const { fetchFn, calls } = stubFetch(() => jsonResponse({ points }));
  const result = await nearbyPlatformPointsRequest(
    { projectId: "p1", latitude: 4.05, longitude: 9.7 },
    { fetchFn },
  );
  assert.match(calls[0].url, /view=platform_point_nearby/);
  assert.match(calls[0].url, /projectId=p1/);
  assert.match(calls[0].url, /latitude=4\.05/);
  assert.match(calls[0].url, /longitude=9\.7/);
  assert.deepEqual(result, points);
});
