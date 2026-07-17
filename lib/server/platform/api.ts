// lib/server/platform/api.ts
//
// HTTP routing layer for the Data Operations Platform (multi-tenant org/project
// admin surface). Requests arrive at GET|POST /api/user?view=platform_<name>
// and are delegated here — this keeps the project under the Vercel Hobby
// 12-function cap, matching the pointOperatorApi.ts convention.
//
// Views (all prefixed `platform_`):
//   org_list            GET   — orgs for the current user
//   org_create          POST  — create a new organization (creator becomes owner)
//   org_get             GET   — fetch a single organization (viewer+)
//   org_update          POST  — update branding: name, logo, accent color (owner)
//   org_members         GET   — list members + pending invites (manager+)
//   member_update       POST  — change a member's role (owner)
//   member_remove       POST  — remove a member (owner)
//   invite_create       POST  — create + email an invite (manager+)
//   invite_revoke       POST  — revoke a pending invite (manager+)
//   invite_accept       POST  — accept an invite by token (any authed user)
//   project_create      POST  — create a project (manager+)
//   project_list        GET   — list projects for an org (viewer+)
//   schema_get          GET   — draft + published schema + version history (viewer+)
//   schema_draft_save   POST  — save/validate the draft schema (manager+)
//   schema_publish      POST  — publish the current draft (manager+)
//
// Every org/project view resolves tenancy via requireOrgRole/requireProjectOrgRole
// BEFORE touching data; failures (401/403/404) are tenancy Responses returned as-is.

import { requireUser } from "../../auth.js";
import { normalizeEmail } from "../../shared/identifier.js";
import { isStorageUnavailableError } from "../db.js";
import { errorResponse, jsonResponse } from "../http.js";
import { validateSchemaDefinition } from "../../../shared/platformSchema.js";
import { validatePlatformRecord } from "../../../shared/platformRecord.js";
import { readIdempotencyKey } from "../idempotencyCore.js";
import { hashRequestPayload } from "../idempotencyGeneric.js";
import * as orgStore from "./orgStore.js";
import * as projectStore from "./projectStore.js";
import * as recordStore from "./recordStore.js";
import { writePlatformAudit, type PlatformAuditEventType } from "./audit.js";
import { createInviteToken, hashInviteToken, INVITE_TTL_DAYS, sendInviteEmail } from "./invites.js";
import { isTenancyFailure, requireOrgRole, requireProjectOrgRole } from "./tenancy.js";
import {
  inviteAcceptSchema,
  inviteCreateSchema,
  inviteRevokeSchema,
  memberRemoveSchema,
  memberUpdateSchema,
  orgCreateSchema,
  orgUpdateSchema,
  projectCreateSchema,
  recordCreateSchema,
  recordReviewSchema,
  schemaDraftSaveSchema,
  schemaPublishSchema,
} from "./validation.js";

// ─── Deps ───────────────────────────────────────────────────────────────────

export interface PlatformApiDeps {
  // stores
  createOrganizationFn?: typeof orgStore.createOrganization;
  getOrganizationFn?: typeof orgStore.getOrganization;
  listOrganizationsForUserFn?: typeof orgStore.listOrganizationsForUser;
  updateOrganizationBrandingFn?: typeof orgStore.updateOrganizationBranding;
  getMembershipFn?: typeof orgStore.getMembership;
  listMembersFn?: typeof orgStore.listMembers;
  upsertMemberRoleFn?: typeof orgStore.upsertMemberRole;
  removeMemberFn?: typeof orgStore.removeMember;
  createInviteFn?: typeof orgStore.createInvite;
  findInviteByTokenHashFn?: typeof orgStore.findInviteByTokenHash;
  listInvitesFn?: typeof orgStore.listInvites;
  revokeInviteFn?: typeof orgStore.revokeInvite;
  markInviteAcceptedFn?: typeof orgStore.markInviteAccepted;
  createProjectFn?: typeof projectStore.createProject;
  activateProjectFn?: typeof projectStore.activateProject;
  listProjectsFn?: typeof projectStore.listProjects;
  getProjectFn?: typeof projectStore.getProject;
  getDraftSchemaFn?: typeof projectStore.getDraftSchema;
  saveDraftSchemaFn?: typeof projectStore.saveDraftSchema;
  publishDraftSchemaFn?: typeof projectStore.publishDraftSchema;
  getPublishedSchemaFn?: typeof projectStore.getPublishedSchema;
  listSchemaVersionsFn?: typeof projectStore.listSchemaVersions;
  createRecordFn?: typeof recordStore.createRecord;
  listRecordsFn?: typeof recordStore.listRecords;
  reviewRecordFn?: typeof recordStore.reviewRecord;
  // services
  requireUserFn?: typeof requireUser;
  sendInviteEmailFn?: typeof sendInviteEmail;
  writeAuditFn?: typeof writePlatformAudit;
  // uploadLogoFn: (dataUrl, organizationId) => Promise<string> (the uploaded logo's URL)
  uploadLogoFn?: (dataUrl: string, organizationId: string) => Promise<string>;
}

async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

function parse<T>(
  schema: { safeParse: (input: unknown) => { success: boolean; data?: T; error?: { issues: Array<{ message: string }> } } },
  body: unknown,
): { data: T } | { response: Response } {
  const result = schema.safeParse(body) as {
    success: boolean;
    data?: T;
    error?: { issues: Array<{ message: string }> };
  };
  if (!result.success) {
    const message = result.error?.issues[0]?.message ?? "Invalid request body";
    return { response: errorResponse(message, 400) };
  }
  return { data: result.data as T };
}

// ─── Platform view detection ───────────────────────────────────────────────

export function isPlatformView(view: string | null): boolean {
  return typeof view === "string" && view.startsWith("platform_");
}

// ─── Handler factory ────────────────────────────────────────────────────────

export function createPlatformHandler(deps: PlatformApiDeps = {}): (request: Request) => Promise<Response> {
  const createOrganizationFn = deps.createOrganizationFn ?? orgStore.createOrganization;
  const getOrganizationFn = deps.getOrganizationFn ?? orgStore.getOrganization;
  const listOrganizationsForUserFn = deps.listOrganizationsForUserFn ?? orgStore.listOrganizationsForUser;
  const updateOrganizationBrandingFn = deps.updateOrganizationBrandingFn ?? orgStore.updateOrganizationBranding;
  const getMembershipFn = deps.getMembershipFn ?? orgStore.getMembership;
  const listMembersFn = deps.listMembersFn ?? orgStore.listMembers;
  const upsertMemberRoleFn = deps.upsertMemberRoleFn ?? orgStore.upsertMemberRole;
  const removeMemberFn = deps.removeMemberFn ?? orgStore.removeMember;
  const createInviteFn = deps.createInviteFn ?? orgStore.createInvite;
  const findInviteByTokenHashFn = deps.findInviteByTokenHashFn ?? orgStore.findInviteByTokenHash;
  const listInvitesFn = deps.listInvitesFn ?? orgStore.listInvites;
  const revokeInviteFn = deps.revokeInviteFn ?? orgStore.revokeInvite;
  const markInviteAcceptedFn = deps.markInviteAcceptedFn ?? orgStore.markInviteAccepted;
  const createProjectFn = deps.createProjectFn ?? projectStore.createProject;
  const activateProjectFn = deps.activateProjectFn ?? projectStore.activateProject;
  const listProjectsFn = deps.listProjectsFn ?? projectStore.listProjects;
  const getProjectFn = deps.getProjectFn ?? projectStore.getProject;
  const getDraftSchemaFn = deps.getDraftSchemaFn ?? projectStore.getDraftSchema;
  const saveDraftSchemaFn = deps.saveDraftSchemaFn ?? projectStore.saveDraftSchema;
  const publishDraftSchemaFn = deps.publishDraftSchemaFn ?? projectStore.publishDraftSchema;
  const getPublishedSchemaFn = deps.getPublishedSchemaFn ?? projectStore.getPublishedSchema;
  const listSchemaVersionsFn = deps.listSchemaVersionsFn ?? projectStore.listSchemaVersions;
  const createRecordFn = deps.createRecordFn ?? recordStore.createRecord;
  const listRecordsFn = deps.listRecordsFn ?? recordStore.listRecords;
  const reviewRecordFn = deps.reviewRecordFn ?? recordStore.reviewRecord;

  const requireUserFn = deps.requireUserFn ?? requireUser;
  const sendInviteEmailFn = deps.sendInviteEmailFn ?? sendInviteEmail;
  const writeAuditFn = deps.writeAuditFn ?? writePlatformAudit;
  const uploadLogoFn: (dataUrl: string, organizationId: string) => Promise<string> =
    deps.uploadLogoFn ??
    (async (dataUrl: string, organizationId: string) => {
      const { put } = await import("@vercel/blob");
      const base64Data = dataUrl.replace(/^data:[^;]+;base64,/, "");
      const buffer = Buffer.from(base64Data, "base64");
      const blob = await put(`platform/logos/${organizationId}.png`, buffer, {
        access: "public",
        addRandomSuffix: true,
      });
      return blob.url;
    });

  // Tenancy deps passthrough — lets tests stub requireUserFn/getMembershipFn/getProjectFn
  // without touching the real database.
  const tenancyDeps = { requireUserFn, getMembershipFn, getProjectFn };

  async function audit(input: {
    organizationId: string;
    projectId?: string | null;
    actorUserId: string;
    eventType: PlatformAuditEventType;
    payload?: Record<string, unknown>;
  }): Promise<void> {
    await writeAuditFn(input);
  }

  // ── org_list ──────────────────────────────────────────────────────────────
  async function handleOrgList(request: Request): Promise<Response> {
    const user = await requireUserFn(request);
    if (!user) return errorResponse("Authentication required", 401, { code: "unauthorized" });
    const orgs = await listOrganizationsForUserFn(user.id);
    return jsonResponse({ organizations: orgs }, { status: 200 });
  }

  // ── org_create ────────────────────────────────────────────────────────────
  async function handleOrgCreate(request: Request): Promise<Response> {
    const user = await requireUserFn(request);
    if (!user) return errorResponse("Authentication required", 401, { code: "unauthorized" });
    if (user.role !== "admin") {
      return errorResponse("Only an ADL administrator can create an organization", 403, {
        code: "platform_admin_required",
      });
    }

    const rawBody = await readJson(request);
    if (rawBody === null) return errorResponse("Invalid JSON body", 400);

    const parsed = parse(orgCreateSchema, rawBody);
    if ("response" in parsed) return parsed.response;

    const organization = await createOrganizationFn({
      name: parsed.data.name,
      slug: parsed.data.slug,
      createdBy: user.id,
    });

    await audit({
      organizationId: organization.id,
      actorUserId: user.id,
      eventType: "org_created",
      payload: { name: organization.name, slug: organization.slug },
    });

    return jsonResponse({ organization }, { status: 201 });
  }

  // ── org_get ───────────────────────────────────────────────────────────────
  async function handleOrgGet(request: Request, url: URL): Promise<Response> {
    const organizationId = url.searchParams.get("organizationId") ?? "";
    const context = await requireOrgRole(request, organizationId, "viewer", tenancyDeps);
    if (isTenancyFailure(context)) return context;

    const organization = await getOrganizationFn(organizationId);
    if (!organization) return errorResponse("Organization not found", 404, { code: "platform_org_not_found" });
    return jsonResponse({ organization }, { status: 200 });
  }

  // ── org_update ────────────────────────────────────────────────────────────
  async function handleOrgUpdate(request: Request): Promise<Response> {
    const rawBody = await readJson(request);
    if (rawBody === null) return errorResponse("Invalid JSON body", 400);

    const parsed = parse(orgUpdateSchema, rawBody);
    if ("response" in parsed) return parsed.response;
    const body = parsed.data;

    const context = await requireOrgRole(request, body.organizationId, "owner", tenancyDeps);
    if (isTenancyFailure(context)) return context;

    let logoUrl: string | null | undefined;
    if (body.logoDataUrl) {
      logoUrl = await uploadLogoFn(body.logoDataUrl, body.organizationId);
    } else if (body.clearLogo) {
      logoUrl = null;
    }

    const organization = await updateOrganizationBrandingFn({
      organizationId: body.organizationId,
      name: body.name,
      logoUrl,
      accentColor: body.accentColor,
    });

    await audit({
      organizationId: body.organizationId,
      actorUserId: context.userId,
      eventType: "org_branding_updated",
      payload: { name: body.name, accentColor: body.accentColor, logoUpdated: logoUrl !== undefined },
    });

    return jsonResponse({ organization }, { status: 200 });
  }

  // ── org_members ───────────────────────────────────────────────────────────
  async function handleOrgMembers(request: Request, url: URL): Promise<Response> {
    const organizationId = url.searchParams.get("organizationId") ?? "";
    const context = await requireOrgRole(request, organizationId, "manager", tenancyDeps);
    if (isTenancyFailure(context)) return context;

    const [members, invites] = await Promise.all([
      listMembersFn(organizationId),
      listInvitesFn(organizationId),
    ]);
    return jsonResponse({ members, invites }, { status: 200 });
  }

  // ── member_update ─────────────────────────────────────────────────────────
  async function handleMemberUpdate(request: Request): Promise<Response> {
    const rawBody = await readJson(request);
    if (rawBody === null) return errorResponse("Invalid JSON body", 400);

    const parsed = parse(memberUpdateSchema, rawBody);
    if ("response" in parsed) return parsed.response;
    const body = parsed.data;

    const context = await requireOrgRole(request, body.organizationId, "owner", tenancyDeps);
    if (isTenancyFailure(context)) return context;

    if (body.role === "owner" && !context.isAdlAdmin) {
      return errorResponse("Only an ADL administrator can assign the owner role", 403, {
        code: "platform_admin_required",
      });
    }

    if (body.role !== "owner") {
      const members = await listMembersFn(body.organizationId);
      const owners = members.filter((m) => m.role === "owner");
      if (owners.length === 1 && owners[0].userId === body.userId) {
        return errorResponse("Cannot remove the last owner", 409, { code: "last_owner" });
      }
    }

    await upsertMemberRoleFn({ organizationId: body.organizationId, userId: body.userId, role: body.role });

    await audit({
      organizationId: body.organizationId,
      actorUserId: context.userId,
      eventType: "member_role_changed",
      payload: { userId: body.userId, role: body.role },
    });

    return jsonResponse({ updated: true }, { status: 200 });
  }

  // ── member_remove ─────────────────────────────────────────────────────────
  async function handleMemberRemove(request: Request): Promise<Response> {
    const rawBody = await readJson(request);
    if (rawBody === null) return errorResponse("Invalid JSON body", 400);

    const parsed = parse(memberRemoveSchema, rawBody);
    if ("response" in parsed) return parsed.response;
    const body = parsed.data;

    const context = await requireOrgRole(request, body.organizationId, "owner", tenancyDeps);
    if (isTenancyFailure(context)) return context;

    const members = await listMembersFn(body.organizationId);
    const owners = members.filter((m) => m.role === "owner");
    if (owners.length === 1 && owners[0].userId === body.userId) {
      return errorResponse("Cannot remove the last owner", 409, { code: "last_owner" });
    }

    await removeMemberFn({ organizationId: body.organizationId, userId: body.userId });

    await audit({
      organizationId: body.organizationId,
      actorUserId: context.userId,
      eventType: "member_removed",
      payload: { userId: body.userId },
    });

    return jsonResponse({ removed: true }, { status: 200 });
  }

  // ── invite_create ─────────────────────────────────────────────────────────
  async function handleInviteCreate(request: Request): Promise<Response> {
    const rawBody = await readJson(request);
    if (rawBody === null) return errorResponse("Invalid JSON body", 400);

    const parsed = parse(inviteCreateSchema, rawBody);
    if ("response" in parsed) return parsed.response;
    const body = parsed.data;

    const context = await requireOrgRole(request, body.organizationId, "manager", tenancyDeps);
    if (isTenancyFailure(context)) return context;

    const organization = await getOrganizationFn(body.organizationId);
    if (!organization) return errorResponse("Organization not found", 404, { code: "platform_org_not_found" });

    const { token, tokenHash } = createInviteToken();
    const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000);

    const invite = await createInviteFn({
      organizationId: body.organizationId,
      email: body.email,
      role: body.role,
      tokenHash,
      expiresAt,
      createdBy: context.userId,
    });

    // Join URL built ONLY from the server-derived request origin + the server-
    // generated token — never from client-supplied strings.
    const origin = new URL(request.url).origin;
    const joinUrl = `${origin}/console#/join?token=${token}`;

    await sendInviteEmailFn({
      email: body.email,
      idempotencyKey: invite.id,
      orgName: organization.name,
      role: body.role,
      joinUrl,
      invitedBy: context.userId,
    });

    await audit({
      organizationId: body.organizationId,
      actorUserId: context.userId,
      eventType: "member_invited",
      payload: { email: body.email, role: body.role, inviteId: invite.id },
    });

    // The token/tokenHash MUST NEVER appear in the response body.
    return jsonResponse({ invite }, { status: 201 });
  }

  // ── invite_accept ─────────────────────────────────────────────────────────
  async function handleInviteAccept(request: Request): Promise<Response> {
    const user = await requireUserFn(request);
    if (!user) return errorResponse("Authentication required", 401, { code: "unauthorized" });

    const rawBody = await readJson(request);
    if (rawBody === null) return errorResponse("Invalid JSON body", 400);

    const parsed = parse(inviteAcceptSchema, rawBody);
    if ("response" in parsed) return parsed.response;
    const body = parsed.data;

    const invite = await findInviteByTokenHashFn(hashInviteToken(body.token));
    if (!invite) return errorResponse("Invite not found", 404, { code: "platform_invite_not_found" });

    const expired = new Date(invite.expiresAt).getTime() <= Date.now();
    if (expired || invite.acceptedAt) {
      return errorResponse("Invite is no longer valid", 410, { code: "platform_invite_expired" });
    }

    const sessionEmail = normalizeEmail(user.token.email);
    const inviteEmail = normalizeEmail(invite.email);
    if (!sessionEmail || !inviteEmail || sessionEmail !== inviteEmail) {
      return errorResponse("This invitation belongs to another account", 403, {
        code: "platform_invite_email_mismatch",
      });
    }

    const existingMembership = await getMembershipFn(invite.organizationId, user.id);
    if (existingMembership) {
      return errorResponse("This account is already a member of the organization", 409, {
        code: "platform_invite_already_member",
      });
    }

    await upsertMemberRoleFn({ organizationId: invite.organizationId, userId: user.id, role: invite.role });
    // inviteId comes ONLY from the server-side lookup result — never from client input.
    await markInviteAcceptedFn({ inviteId: invite.id, userId: user.id });

    await audit({
      organizationId: invite.organizationId,
      actorUserId: user.id,
      eventType: "invite_accepted",
      payload: { inviteId: invite.id, role: invite.role },
    });

    return jsonResponse({ organizationId: invite.organizationId }, { status: 200 });
  }

  // ── invite_revoke ─────────────────────────────────────────────────────────
  async function handleInviteRevoke(request: Request): Promise<Response> {
    const rawBody = await readJson(request);
    if (rawBody === null) return errorResponse("Invalid JSON body", 400);

    const parsed = parse(inviteRevokeSchema, rawBody);
    if ("response" in parsed) return parsed.response;
    const body = parsed.data;

    const context = await requireOrgRole(request, body.organizationId, "manager", tenancyDeps);
    if (isTenancyFailure(context)) return context;

    const revoked = await revokeInviteFn(body);
    if (!revoked) {
      return errorResponse("Pending invite not found", 404, { code: "platform_invite_not_found" });
    }

    await audit({
      organizationId: body.organizationId,
      actorUserId: context.userId,
      eventType: "invite_revoked",
      payload: { inviteId: body.inviteId },
    });

    return jsonResponse({ revoked: true }, { status: 200 });
  }

  // ── project_create ────────────────────────────────────────────────────────
  async function handleProjectCreate(request: Request): Promise<Response> {
    const rawBody = await readJson(request);
    if (rawBody === null) return errorResponse("Invalid JSON body", 400);

    const parsed = parse(projectCreateSchema, rawBody);
    if ("response" in parsed) return parsed.response;
    const body = parsed.data;

    const context = await requireOrgRole(request, body.organizationId, "manager", tenancyDeps);
    if (isTenancyFailure(context)) return context;

    const project = await createProjectFn({
      organizationId: body.organizationId,
      name: body.name,
      coverageScope: body.coverageScope,
      coverageLabel: body.coverageScope === "worldwide" ? null : (body.coverageLabel ?? null),
      createdBy: context.userId,
    });

    await audit({
      organizationId: body.organizationId,
      projectId: project.id,
      actorUserId: context.userId,
      eventType: "project_created",
      payload: {
        name: project.name,
        coverageScope: project.coverageScope,
        coverageLabel: project.coverageLabel,
      },
    });

    return jsonResponse({ project }, { status: 201 });
  }

  // ── project_list ──────────────────────────────────────────────────────────
  async function handleProjectList(request: Request, url: URL): Promise<Response> {
    const organizationId = url.searchParams.get("organizationId") ?? "";
    const context = await requireOrgRole(request, organizationId, "viewer", tenancyDeps);
    if (isTenancyFailure(context)) return context;

    const projects = await listProjectsFn(organizationId);
    return jsonResponse({ projects }, { status: 200 });
  }

  // ── schema_get ────────────────────────────────────────────────────────────
  async function handleSchemaGet(request: Request, url: URL): Promise<Response> {
    const projectId = url.searchParams.get("projectId") ?? "";
    const context = await requireProjectOrgRole(request, projectId, "viewer", tenancyDeps);
    if (isTenancyFailure(context)) return context;

    const [draft, published, versions] = await Promise.all([
      getDraftSchemaFn(projectId, context.organizationId),
      getPublishedSchemaFn(projectId, context.organizationId),
      listSchemaVersionsFn(projectId, context.organizationId),
    ]);
    return jsonResponse({ draft, published, versions }, { status: 200 });
  }

  // ── schema_draft_save ─────────────────────────────────────────────────────
  async function handleSchemaDraftSave(request: Request): Promise<Response> {
    const rawBody = await readJson(request);
    if (rawBody === null) return errorResponse("Invalid JSON body", 400);

    const parsed = parse(schemaDraftSaveSchema, rawBody);
    if ("response" in parsed) return parsed.response;
    const body = parsed.data;

    const context = await requireProjectOrgRole(request, body.projectId, "manager", tenancyDeps);
    if (isTenancyFailure(context)) return context;

    const validation = validateSchemaDefinition(body.definition);
    if (validation.ok === false) {
      return jsonResponse({ issues: validation.issues }, { status: 422 });
    }

    const schemaVersion = await saveDraftSchemaFn({
      projectId: body.projectId,
      organizationId: context.organizationId,
      definition: validation.definition,
      userId: context.userId,
    });

    await audit({
      organizationId: context.organizationId,
      projectId: body.projectId,
      actorUserId: context.userId,
      eventType: "schema_draft_saved",
      payload: { version: schemaVersion.version },
    });

    return jsonResponse({ schemaVersion }, { status: 200 });
  }

  // ── schema_publish ────────────────────────────────────────────────────────
  async function handleSchemaPublish(request: Request): Promise<Response> {
    const rawBody = await readJson(request);
    if (rawBody === null) return errorResponse("Invalid JSON body", 400);

    const parsed = parse(schemaPublishSchema, rawBody);
    if ("response" in parsed) return parsed.response;
    const body = parsed.data;

    const context = await requireProjectOrgRole(request, body.projectId, "manager", tenancyDeps);
    if (isTenancyFailure(context)) return context;

    const draft = await getDraftSchemaFn(body.projectId, context.organizationId);
    if (!draft) return errorResponse("No draft to publish", 409, { code: "platform_no_draft" });

    // Defense in depth — re-validate the stored draft before publishing.
    const validation = validateSchemaDefinition(draft.definition);
    if (validation.ok === false) {
      return jsonResponse({ issues: validation.issues }, { status: 422 });
    }

    const published = await publishDraftSchemaFn({
      projectId: body.projectId,
      organizationId: context.organizationId,
    });
    if (!published) return errorResponse("No draft to publish", 409, { code: "platform_no_draft" });
    await activateProjectFn(body.projectId, context.organizationId);

    await audit({
      organizationId: context.organizationId,
      projectId: body.projectId,
      actorUserId: context.userId,
      eventType: "schema_published",
      payload: { version: published.version },
    });

    return jsonResponse({ schemaVersion: published }, { status: 200 });
  }

  // ── record_create ─────────────────────────────────────────────────────────
  async function handleRecordCreate(request: Request): Promise<Response> {
    const idempotencyKey = readIdempotencyKey(request.headers);
    if (!idempotencyKey || idempotencyKey.length < 8 || idempotencyKey.length > 160) {
      return errorResponse("A valid Idempotency-Key header is required", 422, { code: "idempotency_key_required" });
    }

    const rawBody = await readJson(request);
    if (rawBody === null) return errorResponse("Invalid JSON body", 400);
    const parsed = parse(recordCreateSchema, rawBody);
    if ("response" in parsed) return parsed.response;
    const body = parsed.data;

    const context = await requireProjectOrgRole(request, body.projectId, "collector", tenancyDeps);
    if (isTenancyFailure(context)) return context;

    const project = await getProjectFn(body.projectId);
    if (!project || project.status === "archived") {
      return errorResponse("Project is not accepting records", 409, { code: "platform_project_inactive" });
    }

    const published = await getPublishedSchemaFn(body.projectId, context.organizationId);
    if (!published || published.id !== body.schemaVersionId) {
      return errorResponse("The published project form has changed. Reload before submitting.", 409, {
        code: "platform_schema_stale",
      });
    }
    const recordType = published.definition.recordTypes.find((candidate) => candidate.key === body.recordTypeKey);
    if (!recordType) return errorResponse("Record type not found", 400, { code: "platform_record_type_not_found" });

    const issues = validatePlatformRecord(recordType, body.data, body.evidence);
    if (issues.length > 0) return jsonResponse({ issues }, { status: 422 });

    const record = await createRecordFn({
      organizationId: context.organizationId,
      projectId: body.projectId,
      schemaVersionId: published.id,
      recordTypeKey: body.recordTypeKey,
      data: body.data,
      evidence: body.evidence,
      capturedBy: context.userId,
      idempotencyKey,
      requestHash: hashRequestPayload(body),
    });

    await audit({
      organizationId: context.organizationId,
      projectId: body.projectId,
      actorUserId: context.userId,
      eventType: "record_created",
      payload: { recordId: record.id, recordTypeKey: record.recordTypeKey, schemaVersionId: published.id },
    });
    return jsonResponse({ record }, { status: 201 });
  }

  // ── record_list / record_review ──────────────────────────────────────────
  async function handleRecordList(request: Request, url: URL): Promise<Response> {
    const organizationId = url.searchParams.get("organizationId") ?? "";
    const rawStatus = url.searchParams.get("status");
    const status = rawStatus === "pending_review" || rawStatus === "approved" || rawStatus === "rejected"
      ? rawStatus
      : undefined;
    const context = await requireOrgRole(request, organizationId, "reviewer", tenancyDeps);
    if (isTenancyFailure(context)) return context;
    const records = await listRecordsFn({ organizationId, status });
    return jsonResponse({ records }, { status: 200 });
  }

  async function handleRecordBrowse(request: Request, url: URL): Promise<Response> {
    const organizationId = url.searchParams.get("organizationId") ?? "";
    const context = await requireOrgRole(request, organizationId, "viewer", tenancyDeps);
    if (isTenancyFailure(context)) return context;
    const records = await listRecordsFn({ organizationId, status: "approved" });
    return jsonResponse({ records }, { status: 200 });
  }

  async function handleRecordReview(request: Request): Promise<Response> {
    const rawBody = await readJson(request);
    if (rawBody === null) return errorResponse("Invalid JSON body", 400);
    const parsed = parse(recordReviewSchema, rawBody);
    if ("response" in parsed) return parsed.response;
    const body = parsed.data;
    const context = await requireOrgRole(request, body.organizationId, "reviewer", tenancyDeps);
    if (isTenancyFailure(context)) return context;
    const record = await reviewRecordFn(body);
    if (!record) return errorResponse("Record not found", 404, { code: "platform_record_not_found" });
    await audit({
      organizationId: body.organizationId,
      projectId: record.projectId,
      actorUserId: context.userId,
      eventType: "record_reviewed",
      payload: { recordId: record.id, status: record.status },
    });
    return jsonResponse({ record }, { status: 200 });
  }

  // ── Dispatch map ──────────────────────────────────────────────────────────
  const routes: Record<string, { method: "GET" | "POST"; handler: (request: Request) => Promise<Response> }> = {
    platform_org_list: { method: "GET", handler: handleOrgList },
    platform_org_create: { method: "POST", handler: handleOrgCreate },
    platform_org_get: { method: "GET", handler: (request) => handleOrgGet(request, new URL(request.url)) },
    platform_org_update: { method: "POST", handler: handleOrgUpdate },
    platform_org_members: { method: "GET", handler: (request) => handleOrgMembers(request, new URL(request.url)) },
    platform_member_update: { method: "POST", handler: handleMemberUpdate },
    platform_member_remove: { method: "POST", handler: handleMemberRemove },
    platform_invite_create: { method: "POST", handler: handleInviteCreate },
    platform_invite_revoke: { method: "POST", handler: handleInviteRevoke },
    platform_invite_accept: { method: "POST", handler: handleInviteAccept },
    platform_project_create: { method: "POST", handler: handleProjectCreate },
    platform_project_list: { method: "GET", handler: (request) => handleProjectList(request, new URL(request.url)) },
    platform_schema_get: { method: "GET", handler: (request) => handleSchemaGet(request, new URL(request.url)) },
    platform_schema_draft_save: { method: "POST", handler: handleSchemaDraftSave },
    platform_schema_publish: { method: "POST", handler: handleSchemaPublish },
    platform_record_create: { method: "POST", handler: handleRecordCreate },
    platform_record_list: { method: "GET", handler: (request) => handleRecordList(request, new URL(request.url)) },
    platform_record_browse: { method: "GET", handler: (request) => handleRecordBrowse(request, new URL(request.url)) },
    platform_record_review: { method: "POST", handler: handleRecordReview },
  };

  return async function handlePlatform(request: Request): Promise<Response> {
    try {
      const url = new URL(request.url);
      const view = url.searchParams.get("view");
      if (!view) return errorResponse("Unknown view", 404);

      const route = routes[view];
      if (!route) return errorResponse("Unknown view", 404);

      // Every view requires at least basic authentication, checked before the
      // method-mismatch check so an unauthenticated caller always sees 401.
      const user = await requireUserFn(request);
      if (!user) return errorResponse("Authentication required", 401, { code: "unauthorized" });

      if (route.method !== request.method) return errorResponse("Method not allowed", 405);

      return await route.handler(request);
    } catch (error) {
      if (error instanceof recordStore.PlatformRecordIdempotencyConflictError) {
        return errorResponse("Idempotency-Key reused with a different body", 409, { code: "idempotency_conflict" });
      }
      if (isStorageUnavailableError(error)) {
        return errorResponse("Storage service temporarily unavailable", 503, { code: "storage_unavailable" });
      }
      throw error;
    }
  };
}
