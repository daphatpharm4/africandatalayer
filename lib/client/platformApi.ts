// lib/client/platformApi.ts
//
// Typed client wrapper for the Data Operations Platform admin surface.
// Every view lives behind GET|POST /api/user?view=platform_<name> (see
// lib/server/platform/api.ts) — this module is the single place that knows
// that convention so screen components never hand-build platform URLs.

import type {
  PlatformAdminOrganizationSummary,
  PlatformInvite,
  PlatformMembership,
  PlatformOrganization,
  PlatformOrganizationAccessStatus,
  PlatformProject,
  PlatformRecord,
  PlatformRecordSummary,
  PlatformRecordEvidence,
  PlatformRole,
  PlatformSchemaDefinition,
  PlatformSchemaVersion,
} from "../../shared/platformTypes.js";
import type { SchemaValidationIssue } from "../../shared/platformSchema.js";

export interface PlatformApiDeps {
  fetchFn?: typeof fetch;
}

export class PlatformApiError extends Error {
  status: number;
  code?: string;
  issues?: SchemaValidationIssue[];

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "PlatformApiError";
    this.status = status;
    this.code = code;
  }
}

async function callPlatform<T>(
  view: string,
  options: { method: "GET" | "POST"; body?: unknown; params?: Record<string, string>; idempotencyKey?: string },
  deps: PlatformApiDeps = {},
): Promise<T> {
  const fetchFn = deps.fetchFn ?? fetch;
  const search = new URLSearchParams({ view: `platform_${view}`, ...(options.params ?? {}) });
  const response = await fetchFn(`/api/user?${search.toString()}`, {
    method: options.method,
    credentials: "include",
    headers: options.body !== undefined || options.idempotencyKey
      ? {
          ...(options.body !== undefined ? { "content-type": "application/json" } : {}),
          ...(options.idempotencyKey ? { "Idempotency-Key": options.idempotencyKey } : {}),
        }
      : undefined,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new PlatformApiError(
      payload.error ?? `Request failed (${response.status})`,
      response.status,
      typeof payload.code === "string" ? payload.code : undefined,
    );
    if (Array.isArray(payload.issues)) error.issues = payload.issues;
    throw error;
  }
  return payload as T;
}

// ─── Organizations ──────────────────────────────────────────────────────────

export async function listMyOrganizations(
  deps?: PlatformApiDeps,
): Promise<Array<PlatformOrganization & { role: PlatformRole }>> {
  const payload = await callPlatform<{ organizations: Array<PlatformOrganization & { role: PlatformRole }> }>(
    "org_list",
    { method: "GET" },
    deps,
  );
  return payload.organizations;
}

export async function createOrganizationRequest(
  input: { name: string; slug: string },
  deps?: PlatformApiDeps,
): Promise<PlatformOrganization> {
  const payload = await callPlatform<{ organization: PlatformOrganization }>(
    "org_create",
    { method: "POST", body: input },
    deps,
  );
  return payload.organization;
}

export async function getOrganizationRequest(
  organizationId: string,
  deps?: PlatformApiDeps,
): Promise<PlatformOrganization> {
  const payload = await callPlatform<{ organization: PlatformOrganization }>(
    "org_get",
    { method: "GET", params: { organizationId } },
    deps,
  );
  return payload.organization;
}

export async function updateOrganizationRequest(
  input: { organizationId: string; name?: string; accentColor?: string; logoDataUrl?: string; clearLogo?: boolean },
  deps?: PlatformApiDeps,
): Promise<PlatformOrganization> {
  const payload = await callPlatform<{ organization: PlatformOrganization }>(
    "org_update",
    { method: "POST", body: input },
    deps,
  );
  return payload.organization;
}

export async function listAdminOrganizationsRequest(
  deps?: PlatformApiDeps,
): Promise<PlatformAdminOrganizationSummary[]> {
  const payload = await callPlatform<{ organizations: PlatformAdminOrganizationSummary[] }>(
    "admin_org_list",
    { method: "GET" },
    deps,
  );
  return payload.organizations;
}

export async function updateAdminOrganizationAccessRequest(
  input: {
    organizationId: string;
    accessStatus: PlatformOrganizationAccessStatus;
    reason?: string;
  },
  deps?: PlatformApiDeps,
): Promise<{
  id: string;
  accessStatus: PlatformOrganizationAccessStatus;
  suspensionReason: string | null;
  suspendedAt: string | null;
  suspendedBy: string | null;
}> {
  const payload = await callPlatform<{
    organization: {
      id: string;
      accessStatus: PlatformOrganizationAccessStatus;
      suspensionReason: string | null;
      suspendedAt: string | null;
      suspendedBy: string | null;
    };
  }>("admin_org_access", { method: "POST", body: input }, deps);
  return payload.organization;
}

// ─── Members & invites ──────────────────────────────────────────────────────

export async function listOrgMembersRequest(
  organizationId: string,
  deps?: PlatformApiDeps,
): Promise<{ members: PlatformMembership[]; invites: PlatformInvite[] }> {
  return callPlatform<{ members: PlatformMembership[]; invites: PlatformInvite[] }>(
    "org_members",
    { method: "GET", params: { organizationId } },
    deps,
  );
}

export async function createInviteRequest(
  input: { organizationId: string; email: string; role: string },
  deps?: PlatformApiDeps,
): Promise<PlatformInvite> {
  const payload = await callPlatform<{ invite: PlatformInvite }>(
    "invite_create",
    { method: "POST", body: input },
    deps,
  );
  return payload.invite;
}

export async function acceptInviteRequest(
  token: string,
  deps?: PlatformApiDeps,
): Promise<{ organizationId: string }> {
  return callPlatform<{ organizationId: string }>(
    "invite_accept",
    { method: "POST", body: { token } },
    deps,
  );
}

export async function revokeInviteRequest(
  input: { organizationId: string; inviteId: string },
  deps?: PlatformApiDeps,
): Promise<void> {
  await callPlatform<{ revoked: true }>("invite_revoke", { method: "POST", body: input }, deps);
}

export async function updateMemberRequest(
  input: { organizationId: string; userId: string; role: PlatformRole },
  deps?: PlatformApiDeps,
): Promise<void> {
  await callPlatform<{ updated: true }>("member_update", { method: "POST", body: input }, deps);
}

export async function removeMemberRequest(
  input: { organizationId: string; userId: string },
  deps?: PlatformApiDeps,
): Promise<void> {
  await callPlatform<{ removed: true }>("member_remove", { method: "POST", body: input }, deps);
}

// ─── Projects ───────────────────────────────────────────────────────────────

export async function createProjectRequest(
  input: {
    organizationId: string;
    name: string;
    coverageScope: PlatformProject["coverageScope"];
    coverageLabel?: string;
  },
  deps?: PlatformApiDeps,
): Promise<PlatformProject> {
  const payload = await callPlatform<{ project: PlatformProject }>(
    "project_create",
    { method: "POST", body: input },
    deps,
  );
  return payload.project;
}

export async function listProjectsRequest(
  organizationId: string,
  deps?: PlatformApiDeps,
): Promise<PlatformProject[]> {
  const payload = await callPlatform<{ projects: PlatformProject[] }>(
    "project_list",
    { method: "GET", params: { organizationId } },
    deps,
  );
  return payload.projects;
}

// ─── Schema ─────────────────────────────────────────────────────────────────

export async function getSchemaRequest(
  projectId: string,
  deps?: PlatformApiDeps,
): Promise<{ draft: PlatformSchemaVersion | null; published: PlatformSchemaVersion | null; versions: PlatformSchemaVersion[] }> {
  return callPlatform<{
    draft: PlatformSchemaVersion | null;
    published: PlatformSchemaVersion | null;
    versions: PlatformSchemaVersion[];
  }>("schema_get", { method: "GET", params: { projectId } }, deps);
}

export async function saveSchemaDraftRequest(
  input: { projectId: string; definition: PlatformSchemaDefinition },
  deps?: PlatformApiDeps,
): Promise<PlatformSchemaVersion> {
  const payload = await callPlatform<{ schemaVersion: PlatformSchemaVersion }>(
    "schema_draft_save",
    { method: "POST", body: input },
    deps,
  );
  return payload.schemaVersion;
}

export async function publishSchemaRequest(
  projectId: string,
  deps?: PlatformApiDeps,
): Promise<PlatformSchemaVersion> {
  const payload = await callPlatform<{ schemaVersion: PlatformSchemaVersion }>(
    "schema_publish",
    { method: "POST", body: { projectId } },
    deps,
  );
  return payload.schemaVersion;
}

// ─── Field records ─────────────────────────────────────────────────────────

export async function createPlatformRecordRequest(
  input: {
    projectId: string;
    schemaVersionId: string;
    recordTypeKey: string;
    data: Record<string, unknown>;
    evidence: PlatformRecordEvidence;
    idempotencyKey: string;
  },
  deps?: PlatformApiDeps,
): Promise<PlatformRecord> {
  const payload = await callPlatform<{ record: PlatformRecord }>(
    "record_create",
    {
      method: "POST",
      idempotencyKey: input.idempotencyKey,
      body: {
        projectId: input.projectId,
        schemaVersionId: input.schemaVersionId,
        recordTypeKey: input.recordTypeKey,
        data: input.data,
        evidence: input.evidence,
      },
    },
    deps,
  );
  return payload.record;
}

export async function listPlatformRecordsRequest(
  organizationId: string,
  status?: PlatformRecord["status"],
  deps?: PlatformApiDeps,
): Promise<PlatformRecord[]> {
  const payload = await callPlatform<{ records: PlatformRecord[] }>(
    "record_list",
    {
      method: "GET",
      params: { organizationId, ...(status ? { status } : {}) },
    },
    deps,
  );
  return payload.records;
}

export async function listApprovedPlatformRecordsRequest(
  organizationId: string,
  deps?: PlatformApiDeps,
): Promise<PlatformRecord[]> {
  const payload = await callPlatform<{ records: PlatformRecord[] }>(
    "record_browse",
    { method: "GET", params: { organizationId } },
    deps,
  );
  return payload.records;
}

export async function reviewPlatformRecordRequest(
  input: { organizationId: string; recordId: string; status: "approved" | "rejected"; reviewNotes?: string },
  deps?: PlatformApiDeps,
): Promise<PlatformRecord> {
  const payload = await callPlatform<{ record: PlatformRecord }>(
    "record_review",
    { method: "POST", body: input },
    deps,
  );
  return payload.record;
}

export async function getMyPlatformRecordSummaryRequest(
  deps?: PlatformApiDeps,
): Promise<PlatformRecordSummary> {
  const payload = await callPlatform<{ summary: PlatformRecordSummary }>(
    "record_my_summary",
    { method: "GET" },
    deps,
  );
  return payload.summary;
}
