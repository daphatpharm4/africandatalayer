import "../../lib/server/sentry.js";
import bcrypt from "bcryptjs";
import { requireUser } from "../../lib/auth.js";
import { createPointOperatorHandler } from "../../lib/server/pointOperatorApi.js";
import { createPlatformHandler, isPlatformView } from "../../lib/server/platform/api.js";
import { inferDefaultDisplayName, normalizeIdentifier } from "../../lib/shared/identifier.js";
import { getUserProfile, isStorageUnavailableError, upsertUserProfile } from "../../lib/server/storage/index.js";
import { resolveOrProvisionProfile } from "../../lib/server/adminProfileProvisioning.js";
import {
  parseProfileImagePayload,
  classifyBlobUploadError,
  shouldStoreProfileImageInline,
} from "../../lib/server/profileImageUpload.js";
import { classifyUserViewError } from "../../lib/server/userViewErrors.js";
import { buildContributionEvents } from "../../lib/server/submissionEvents.js";
import { computeCanonicalUserXp } from "../../lib/server/xp.js";
import {
  createAssignment,
  getAssignmentById,
  getPlannerContext,
  listAssignments,
  updateAssignment,
} from "../../lib/server/collectionAssignments.js";
import { errorResponse, jsonResponse } from "../../lib/server/http.js";
import { logSecurityEvent } from "../../lib/server/securityAudit.js";
import { updateUserTrust } from "../../lib/server/userTrust.js";
import { extractRateLimitIp } from "../../lib/server/rateLimit.js";
import { consumeRateLimit } from "../../lib/server/rateLimit.js";
import { anonymizeUserAccount, getAccountDeletionRequirements } from "../../lib/server/accountDeletion.js";
import { getCurrentSmsConsent, recordSmsConsent } from "../../lib/server/sms/consent.js";
import {
  adminAccountCreateSchema,
  adminUserAccessPatchSchema,
  userStatusPatchSchema,
  userUpdateSchema,
} from "../../lib/server/validation.js";
import { DEFAULT_AVATAR_PRESET, encodeAvatarPresetImage } from "../../shared/avatarPresets.js";
import { hashRequestPayload, postgresIdempotencyStore, resolveIdempotency } from "../../lib/server/idempotencyGeneric.js";
import { readIdempotencyKey } from "../../lib/server/idempotencyCore.js";
import type {
  CollectionAssignmentCreateInput,
  CollectionAssignmentStatus,
  CollectionAssignmentUpdateInput,
  MapScope,
  UserProfile,
  UserRole,
} from "../../shared/types.js";

const MAP_SCOPES: ReadonlySet<MapScope> = new Set(["bonamoussadi", "cameroon", "global"]);
const ASSIGNMENT_STATUSES: ReadonlySet<CollectionAssignmentStatus> = new Set([
  "pending",
  "in_progress",
  "completed",
  "expired",
]);
const MAX_PROFILE_IMAGE_BYTES = 4_000_000;
const MAX_INLINE_PROFILE_IMAGE_BYTES = 800_000;

function normalizeMapScope(input: unknown): MapScope | null {
  if (typeof input !== "string") return null;
  const normalized = input.trim().toLowerCase();
  if (!MAP_SCOPES.has(normalized as MapScope)) return null;
  return normalized as MapScope;
}

function normalizeAssignmentStatus(input: unknown): CollectionAssignmentStatus | null {
  if (typeof input !== "string") return null;
  const normalized = input.trim().toLowerCase();
  if (!ASSIGNMENT_STATUSES.has(normalized as CollectionAssignmentStatus)) return null;
  return normalized as CollectionAssignmentStatus;
}

function normalizeLookupIdentifier(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const raw = input.trim();
  if (!raw) return null;
  return normalizeIdentifier(raw)?.value ?? raw.toLowerCase();
}

function isAdminToken(token: unknown, role?: UserRole): boolean {
  const claims = token as { isAdmin?: unknown; role?: unknown } | undefined;
  return claims?.isAdmin === true || claims?.role === "admin" || role === "admin";
}

function resolveUserRole(role: unknown, isAdmin: boolean): UserRole {
  if (role === "admin" || role === "agent" || role === "client") return role;
  return isAdmin ? "admin" : "agent";
}

function applyAdminProfileAccess(profile: UserProfile): boolean {
  let changed = false;
  if (profile.role !== "admin") {
    profile.role = "admin";
    changed = true;
  }
  if (profile.isAdmin !== true) {
    profile.isAdmin = true;
    changed = true;
  }
  if (profile.mapScope !== "global") {
    profile.mapScope = "global";
    changed = true;
  }
  return changed;
}

async function uploadProfilePhoto(userId: string, imageBuffer: Buffer, mime: string, ext: string): Promise<string> {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) throw new Error("Missing BLOB_READ_WRITE_TOKEN token for blob upload");
  const { put } = await import("@vercel/blob");
  const safeUserId = userId.replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 96) || "user";
  const pathname = `profiles/${safeUserId}-${Date.now()}.${ext}`;
  const uploaded = await put(pathname, imageBuffer, {
    access: "public",
    contentType: mime,
    addRandomSuffix: false,
    token,
  });
  return uploaded.url;
}

function sanitizeProfile<T extends { passwordHash?: unknown }>(profile: T): Omit<T, "passwordHash"> {
  const safe = { ...profile } as T & { passwordHash?: unknown };
  delete safe.passwordHash;
  return safe;
}

type GetUserProfileFn = typeof getUserProfile;
type UpsertUserProfileFn = typeof upsertUserProfile;
type HashPasswordFn = typeof bcrypt.hash;
type LogSecurityEventFn = typeof logSecurityEvent;

type AdminAccountCreateDeps = {
  getUserProfileFn?: GetUserProfileFn;
  upsertUserProfileFn?: UpsertUserProfileFn;
  hashPasswordFn?: HashPasswordFn;
  logSecurityEventFn?: LogSecurityEventFn;
};

type AdminAccountAccessDeps = {
  getUserProfileFn?: GetUserProfileFn;
  upsertUserProfileFn?: UpsertUserProfileFn;
  logSecurityEventFn?: LogSecurityEventFn;
};

export function createAdminAccountCreateHandler(deps: AdminAccountCreateDeps = {}) {
  const getUserProfileFn = deps.getUserProfileFn ?? getUserProfile;
  const upsertUserProfileFn = deps.upsertUserProfileFn ?? upsertUserProfile;
  const hashPasswordFn = deps.hashPasswordFn ?? bcrypt.hash;
  const logSecurityEventFn = deps.logSecurityEventFn ?? logSecurityEvent;

  return async function handleAdminAccountCreate(request: Request, actorUserId: string): Promise<Response> {
    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      return errorResponse("Invalid JSON body", 400);
    }

    const validation = adminAccountCreateSchema.safeParse(rawBody);
    if (!validation.success) {
      return errorResponse(validation.error.issues[0]?.message ?? "Invalid request body", 400);
    }

    const body = validation.data;
    const normalizedIdentifier = normalizeIdentifier(body.identifier);
    if (!normalizedIdentifier) {
      return errorResponse("Enter a valid email or phone number", 400);
    }

    const userId = normalizedIdentifier.value;
    try {
      const existing = await getUserProfileFn(userId);
      if (existing) {
        return errorResponse("An account already exists for this phone/email", 409);
      }

      const nextRole = body.role;
      const nextIsAdmin = nextRole === "admin";
      const nextMapScope: MapScope = nextIsAdmin ? "global" : "bonamoussadi";
      const name = body.name?.trim() || inferDefaultDisplayName(userId);

      const profile: UserProfile = {
        id: userId,
        name,
        email: normalizedIdentifier.type === "email" ? userId : null,
        phone: normalizedIdentifier.type === "phone" ? userId : null,
        image: encodeAvatarPresetImage(DEFAULT_AVATAR_PRESET),
        avatarPreset: DEFAULT_AVATAR_PRESET,
        occupation: nextRole === "client" ? "Client stakeholder" : "",
        XP: 0,
        passwordHash: await hashPasswordFn(body.password, 12),
        isAdmin: nextIsAdmin,
        role: nextRole,
        mapScope: nextMapScope,
        trustScore: 50,
        trustTier: "standard",
        failedLoginCount: 0,
        lockedUntil: null,
        wipeRequested: false,
        suspendedUntil: null,
      };

      await upsertUserProfileFn(userId, profile);
      await logSecurityEventFn({
        eventType: "admin_account_created",
        userId,
        request,
        details: {
          actorUserId,
          role: nextRole,
          isAdmin: nextIsAdmin,
          mapScope: nextMapScope,
          identifierType: normalizedIdentifier.type,
        },
      });

      return jsonResponse(sanitizeProfile(profile), { status: 201 });
    } catch (error) {
      if (isStorageUnavailableError(error)) {
        return errorResponse("Storage service temporarily unavailable", 503, { code: "storage_unavailable" });
      }
      throw error;
    }
  };
}

const handleAdminAccountCreate = createAdminAccountCreateHandler();
const handlePointOperator = createPointOperatorHandler();
const handlePlatform = createPlatformHandler();

export function createAdminAccountAccessHandler(deps: AdminAccountAccessDeps = {}) {
  const getUserProfileFn = deps.getUserProfileFn ?? getUserProfile;
  const upsertUserProfileFn = deps.upsertUserProfileFn ?? upsertUserProfile;
  const logSecurityEventFn = deps.logSecurityEventFn ?? logSecurityEvent;

  return async function handleAdminAccountAccess(request: Request, actorUserId: string): Promise<Response> {
    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      return errorResponse("Invalid JSON body", 400);
    }
    const validation = adminUserAccessPatchSchema.safeParse(rawBody);
    if (!validation.success) {
      return errorResponse(validation.error.issues[0]?.message ?? "Invalid request body", 400);
    }

    const body = validation.data;
    const targetUserId = normalizeLookupIdentifier(body.userId);
    if (!targetUserId) return errorResponse("User id is required", 400);
    if (targetUserId === normalizeLookupIdentifier(actorUserId)) {
      return errorResponse("Admins cannot change their own role from this panel", 400);
    }

    try {
      const profile = await getUserProfileFn(targetUserId);
      if (!profile) return errorResponse("Profile not found", 404);

      const previousRole = resolveUserRole(profile.role, profile.isAdmin === true);
      const previousIsAdmin = profile.isAdmin === true;
      const previousMapScope = normalizeMapScope(profile.mapScope);

      const nextRole = body.role;
      const nextIsAdmin = nextRole === "admin";
      const nextMapScope: MapScope = nextIsAdmin ? "global" : "bonamoussadi";

      profile.role = nextRole;
      profile.isAdmin = nextIsAdmin;
      profile.mapScope = nextMapScope;

      const changed =
        previousRole !== nextRole || previousIsAdmin !== nextIsAdmin || previousMapScope !== nextMapScope;

      if (changed) {
        await upsertUserProfileFn(targetUserId, profile);
        try {
          await logSecurityEventFn({
            eventType: "role_changed",
            userId: targetUserId,
            request,
            details: {
              actorUserId,
              previousRole,
              nextRole,
              previousIsAdmin,
              nextIsAdmin,
              previousMapScope,
              nextMapScope,
            },
          });
        } catch (auditError) {
          console.warn("Unable to write role_changed audit event", auditError);
        }
      }

      return jsonResponse(sanitizeProfile(profile), { status: 200 });
    } catch (error) {
      if (isStorageUnavailableError(error)) {
        return errorResponse("Storage service temporarily unavailable", 503, { code: "storage_unavailable" });
      }
      throw error;
    }
  };
}

const handleAdminAccountAccess = createAdminAccountAccessHandler();

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const view = url.searchParams.get("view");

  // Delegate all platform_* views to the platform handler (before auth check, as platform handler has its own auth)
  if (isPlatformView(view)) {
    return handlePlatform(request);
  }

  const auth = await requireUser(request);
  if (!auth) return errorResponse("Unauthorized", 401);
  const authIsAdmin = isAdminToken(auth.token, auth.role);

  // Delegate all po_* views to the point-operator handler
  if (view?.startsWith("po_")) {
    return handlePointOperator(request);
  }

  if (view === "status") {
    const requestedUserId = url.searchParams.get("userId")?.trim().toLowerCase() ?? auth.id;
    if (!authIsAdmin && requestedUserId !== auth.id) return errorResponse("Forbidden", 403);
    try {
      const profile = await getUserProfile(requestedUserId);
      if (!profile) return errorResponse("Profile not found", 404);
      return jsonResponse(
        {
          id: profile.id,
          role: profile.role ?? "agent",
          trustScore: profile.trustScore ?? 50,
          trustTier: profile.trustTier ?? "standard",
          suspendedUntil: profile.suspendedUntil ?? null,
          wipeRequested: profile.wipeRequested === true,
          lockedUntil: profile.lockedUntil ?? null,
        },
        { status: 200 },
      );
    } catch (error) {
      if (isStorageUnavailableError(error)) {
        return errorResponse("Storage service temporarily unavailable", 503, { code: "storage_unavailable" });
      }
      throw error;
    }
  }

  if (view === "sms-consent") {
    const consent = await getCurrentSmsConsent(auth.id);
    return jsonResponse(consent, { status: 200 });
  }

  if (view === "account_delete") {
    try {
      const requirements = await getAccountDeletionRequirements(auth.id);
      if (!requirements) return errorResponse("Profile not found", 404);
      return jsonResponse(requirements, { status: 200 });
    } catch (error) {
      if (isStorageUnavailableError(error)) {
        return errorResponse("Storage service temporarily unavailable", 503, { code: "storage_unavailable" });
      }
      throw error;
    }
  }

  if (view === "assignments") {
    const status = normalizeAssignmentStatus(url.searchParams.get("status"));
    const scope = url.searchParams.get("scope");
    const requestedAgent = url.searchParams.get("agentUserId")?.trim().toLowerCase() ?? null;
    const allowAll = authIsAdmin && scope === "all";

    try {
      const assignments = await listAssignments({
        viewerUserId: auth.id,
        isAdmin: allowAll,
        status,
        agentUserId: allowAll ? requestedAgent : null,
      });
      return jsonResponse(assignments, { status: 200 });
    } catch (error) {
      console.error("[api/user] assignments view failed", error);
      const v = classifyUserViewError(error);
      return errorResponse(v.message, v.status, { code: v.code });
    }
  }

  if (view === "assignment_planner_context") {
    if (!authIsAdmin) return errorResponse("Forbidden", 403);
    const status = normalizeAssignmentStatus(url.searchParams.get("status"));
    const requestedAgent = url.searchParams.get("agentUserId")?.trim().toLowerCase() ?? null;
    try {
      const [context, assignments] = await Promise.all([
        getPlannerContext(),
        listAssignments({
          viewerUserId: auth.id,
          isAdmin: true,
          status,
          agentUserId: requestedAgent,
        }),
      ]);
      return jsonResponse({ context, assignments }, { status: 200 });
    } catch (error) {
      console.error("[api/user] assignment_planner_context view failed", error);
      const v = classifyUserViewError(error);
      return errorResponse(v.message, v.status, { code: v.code });
    }
  }

  if (view === "lookup") {
    if (!authIsAdmin) return errorResponse("Forbidden", 403);
    const identifier = normalizeLookupIdentifier(url.searchParams.get("identifier"));
    if (!identifier) return errorResponse("Identifier is required", 400);

    try {
      const profile = await getUserProfile(identifier);
      if (!profile) return errorResponse("Profile not found", 404);
      if (identifier === normalizeLookupIdentifier(auth.id) && applyAdminProfileAccess(profile)) {
        await upsertUserProfile(auth.id, profile);
      }
      return jsonResponse(sanitizeProfile(profile), { status: 200 });
    } catch (error) {
      if (isStorageUnavailableError(error)) {
        return errorResponse("Storage service temporarily unavailable", 503, { code: "storage_unavailable" });
      }
      throw error;
    }
  }

  try {
    const profile = await resolveOrProvisionProfile(
      { getProfile: getUserProfile, upsertProfile: upsertUserProfile },
      auth.id,
      authIsAdmin,
    );
    if (!profile) return errorResponse("Profile not found", 404);

    let shouldPersist = false;
    if (authIsAdmin && applyAdminProfileAccess(profile)) {
      shouldPersist = true;
    }

    const events = await buildContributionEvents();
    const canonicalXp = computeCanonicalUserXp(events, auth.id);
    if ((profile.XP ?? 0) !== canonicalXp) {
      profile.XP = canonicalXp;
      shouldPersist = true;
    }

    if (shouldPersist) {
      await upsertUserProfile(auth.id, profile);
    }

    return jsonResponse(sanitizeProfile(profile), { status: 200 });
  } catch (error) {
    if (isStorageUnavailableError(error)) {
      return errorResponse("Storage service temporarily unavailable", 503, { code: "storage_unavailable" });
    }
    throw error;
  }
}

export async function PUT(request: Request): Promise<Response> {
  const auth = await requireUser(request);
  if (!auth) return errorResponse("Unauthorized", 401);

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return errorResponse("Invalid JSON body", 400);
  }

  const validation = userUpdateSchema.safeParse(rawBody);
  if (!validation.success) {
    return errorResponse(validation.error.issues[0]?.message ?? "Invalid request body", 400);
  }
  const body = validation.data;

  const idempotencyKey = readIdempotencyKey(request.headers);
  if (idempotencyKey) {
    const requestHash = hashRequestPayload(body);
    const decision = await resolveIdempotency(postgresIdempotencyStore, {
      scope: "user:put",
      userId: auth.id,
      idempotencyKey,
      requestHash,
    });
    if (decision.status === "conflict") {
      return errorResponse("Idempotency-Key reused with a different body", 409, { code: "idempotency_conflict" });
    }
    if (decision.status === "in_flight") {
      return errorResponse("A request with this idempotency key is already in progress", 409, {
        code: "idempotency_in_flight",
        retryAfterSeconds: 2,
      });
    }
    if (decision.status === "replay") {
      return jsonResponse(decision.responseJson, { status: decision.responseStatus });
    }
  }

  try {
    const profile = await getUserProfile(auth.id);
    if (!profile) return errorResponse("Profile not found", 404);

    if (body?.name !== undefined) {
      profile.name = body.name.trim();
    }

    if (body?.occupation !== undefined) {
      if (typeof body.occupation !== "string") return errorResponse("Invalid occupation", 400);
      const normalized = body.occupation.trim();
      if (normalized.length > 120) return errorResponse("Occupation exceeds maximum length", 400);
      profile.occupation = normalized;
    }

    if (body?.mapScope !== undefined) {
      const nextScope = normalizeMapScope(body.mapScope);
      if (!nextScope) return errorResponse("Invalid mapScope", 400);
      if (!profile.isAdmin && nextScope !== "bonamoussadi") {
        return errorResponse("Only admin users can unlock map scope", 403);
      }
      profile.mapScope = nextScope;
    }

    if (body?.avatarPreset !== undefined) {
      profile.avatarPreset = body.avatarPreset;
      profile.image = encodeAvatarPresetImage(body.avatarPreset);
    }

    const profileImageBase64 = body?.imageBase64 ?? body?.imagebase64;
    if (profileImageBase64 !== undefined) {
      const parsedImage = parseProfileImagePayload(profileImageBase64, MAX_PROFILE_IMAGE_BYTES);
      if (!parsedImage) return errorResponse("Invalid profile image", 400);
      try {
        profile.image = await uploadProfilePhoto(auth.id, parsedImage.imageBuffer, parsedImage.mime, parsedImage.ext);
      } catch (uploadError) {
        console.error("[api/user] profile photo upload failed", uploadError);
        const u = classifyBlobUploadError(uploadError);
        if (shouldStoreProfileImageInline(u, parsedImage.imageBuffer.byteLength, MAX_INLINE_PROFILE_IMAGE_BYTES)) {
          profile.image = profileImageBase64;
        } else {
          return errorResponse(u.message, u.status, { code: u.code });
        }
      }
      profile.avatarPreset = undefined;
    }

    await upsertUserProfile(auth.id, profile);
    const sanitized = sanitizeProfile(profile);

    if (idempotencyKey) {
      await postgresIdempotencyStore.complete("user:put", auth.id, idempotencyKey, sanitized, 200);
    }
    return jsonResponse(sanitized, { status: 200 });
  } catch (error) {
    if (isStorageUnavailableError(error)) {
      return errorResponse("Storage service temporarily unavailable", 503, { code: "storage_unavailable" });
    }
    const message = error instanceof Error ? error.message.toLowerCase() : "";
    if (message.includes("blob") && message.includes("token")) {
      return errorResponse("Storage service temporarily unavailable", 503, { code: "storage_unavailable" });
    }
    throw error;
  }
}

export async function POST(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const view = url.searchParams.get("view");

  // Delegate all platform_* views to the platform handler (before auth check, as platform handler has its own auth)
  if (isPlatformView(view)) {
    return handlePlatform(request);
  }

  const auth = await requireUser(request);
  if (!auth) return errorResponse("Unauthorized", 401);

  // Delegate all po_* views to the point-operator handler (handles its own auth)
  if (view?.startsWith("po_")) {
    return handlePointOperator(request);
  }

  const authIsAdmin = isAdminToken(auth.token, auth.role);
  if (!authIsAdmin) return errorResponse("Forbidden", 403);

  if (view === "account_create") {
    return await handleAdminAccountCreate(request, auth.id);
  }
  if (view !== "assignments") return errorResponse("Invalid view", 400);

  let body: CollectionAssignmentCreateInput;
  try {
    body = (await request.json()) as CollectionAssignmentCreateInput;
  } catch {
    return errorResponse("Invalid JSON body", 400);
  }

  try {
    const created = await createAssignment(body);
    return jsonResponse(created, { status: 201 });
  } catch (error) {
    if (isStorageUnavailableError(error)) {
      return errorResponse("Storage service temporarily unavailable", 503, { code: "storage_unavailable" });
    }
    const message = error instanceof Error ? error.message : "Unable to create assignment";
    return errorResponse(message, 400);
  }
}

interface AssignmentPatchBody extends CollectionAssignmentUpdateInput {
  id?: unknown;
}

export async function PATCH(request: Request): Promise<Response> {
  const auth = await requireUser(request);
  if (!auth) return errorResponse("Unauthorized", 401);
  const authIsAdmin = isAdminToken(auth.token, auth.role);

  const url = new URL(request.url);
  const view = url.searchParams.get("view");

  // Delegate all po_* views to the point-operator handler (handles its own auth)
  if (view?.startsWith("po_")) {
    return handlePointOperator(request);
  }

  if (view === "status") {
    if (!authIsAdmin) return errorResponse("Forbidden", 403);
    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      return errorResponse("Invalid JSON body", 400);
    }
    const validation = userStatusPatchSchema.safeParse(rawBody);
    if (!validation.success) {
      return errorResponse(validation.error.issues[0]?.message ?? "Invalid request body", 400);
    }
    const body = validation.data;
    try {
      const profile = await getUserProfile(body.userId);
      if (!profile) return errorResponse("Profile not found", 404);
      const nextStatus = await updateUserTrust({
        userId: body.userId,
        setScore: body.trustScore,
        suspendedUntil: body.suspendedUntil,
        wipeRequested: body.wipeRequested,
      });
      await logSecurityEvent({
        eventType: body.wipeRequested ? "remote_wipe_triggered" : "suspicious_activity",
        userId: body.userId,
        request,
        details: {
          trustScore: nextStatus.trustScore,
          trustTier: nextStatus.trustTier,
          suspendedUntil: nextStatus.suspendedUntil,
          wipeRequested: nextStatus.wipeRequested,
        },
      });
      return jsonResponse(
        {
          id: body.userId,
          ...nextStatus,
        },
        { status: 200 },
      );
    } catch (error) {
      if (isStorageUnavailableError(error)) {
        return errorResponse("Storage service temporarily unavailable", 503, { code: "storage_unavailable" });
      }
      throw error;
    }
  }

  if (view === "account_access") {
    if (!authIsAdmin) return errorResponse("Forbidden", 403);
    return await handleAdminAccountAccess(request, auth.id);
  }

  if (view === "sms-consent") {
    let consentBody: { consented?: unknown };
    try {
      consentBody = (await request.json()) as { consented?: unknown };
    } catch {
      return errorResponse("Invalid JSON body", 400);
    }
    const consented = typeof consentBody.consented === "boolean" ? consentBody.consented : null;
    if (consented === null) {
      return errorResponse("Field 'consented' (boolean) is required", 400);
    }
    const ip = extractRateLimitIp(request);
    const userAgent = request.headers.get("user-agent");
    await recordSmsConsent({
      userId: auth.id,
      consented,
      source: "settings",
      ip,
      userAgent,
    });
    return jsonResponse({ ok: true, consented }, { status: 200 });
  }

  if (view !== "assignments") return errorResponse("Invalid view", 400);

  let body: AssignmentPatchBody;
  try {
    body = (await request.json()) as AssignmentPatchBody;
  } catch {
    return errorResponse("Invalid JSON body", 400);
  }

  const id = typeof body.id === "string" ? body.id.trim() : "";
  if (!id) return errorResponse("Assignment id is required", 400);

  try {
    const existing = await getAssignmentById(id);
    if (!existing) return errorResponse("Assignment not found", 404);
    if (!authIsAdmin && existing.agentUserId !== auth.id.toLowerCase().trim()) {
      return errorResponse("Forbidden", 403);
    }
    if (!authIsAdmin && body.status === "expired") {
      return errorResponse("Only admins can expire assignments", 403);
    }
    if (!authIsAdmin && existing.status === "completed" && body.status && body.status !== "completed") {
      return errorResponse("Completed assignments cannot be reopened", 403);
    }

    const updated = await updateAssignment(id, {
      status: body.status,
      pointsSubmitted: authIsAdmin ? body.pointsSubmitted : undefined,
      notes: body.notes,
    });
    if (!updated) return errorResponse("Assignment not found", 404);
    return jsonResponse(updated, { status: 200 });
  } catch (error) {
    if (isStorageUnavailableError(error)) {
      return errorResponse("Storage service temporarily unavailable", 503, { code: "storage_unavailable" });
    }
    const message = error instanceof Error ? error.message : "Unable to update assignment";
    return errorResponse(message, 400);
  }
}

export async function DELETE(request: Request): Promise<Response> {
  const auth = await requireUser(request);
  if (!auth) return errorResponse("Unauthorized", 401);

  const url = new URL(request.url);
  if (url.searchParams.get("view") !== "account_delete") return errorResponse("Invalid view", 400);
  if (request.headers.get("x-adl-delete-confirmation") !== "DELETE") {
    return errorResponse("Deletion confirmation header is required", 400, { code: "confirmation_required" });
  }
  if (!request.headers.get("content-type")?.toLowerCase().includes("application/json")) {
    return errorResponse("Content-Type must be application/json", 415);
  }

  const rateLimit = await consumeRateLimit({
    route: "DELETE /api/user?view=account_delete",
    key: `${extractRateLimitIp(request) ?? "unknown"}:${auth.id}`,
    windowSeconds: 60 * 60,
    max: 3,
    request,
    userId: auth.id,
  });
  if (!rateLimit.allowed) {
    return errorResponse("Too many deletion attempts. Try again later.", 429, { code: "rate_limited" });
  }

  let body: { confirmation?: unknown; acknowledgeDataLoss?: unknown; password?: unknown };
  try {
    body = await request.json() as typeof body;
  } catch {
    return errorResponse("Invalid JSON body", 400);
  }
  if (body.confirmation !== "DELETE" || body.acknowledgeDataLoss !== true) {
    return errorResponse("Type DELETE and acknowledge permanent data loss", 400, { code: "confirmation_required" });
  }

  try {
    const requirements = await getAccountDeletionRequirements(auth.id);
    if (!requirements) return errorResponse("Profile not found", 404);
    if (requirements.blockers.length > 0) {
      return jsonResponse({
        error: "Transfer protected access before deleting this account",
        code: "account_delete_blocked",
        blockers: requirements.blockers,
      }, { status: 409 });
    }

    const profile = await getUserProfile(auth.id);
    if (!profile) return errorResponse("Profile not found", 404);
    if (requirements.requiresPassword) {
      const password = typeof body.password === "string" ? body.password : "";
      if (!password || !profile.passwordHash || !(await bcrypt.compare(password, profile.passwordHash))) {
        return errorResponse("Password is incorrect", 403, { code: "password_incorrect" });
      }
    }

    const tombstone = await anonymizeUserAccount(auth.id);
    try {
      await logSecurityEvent({
        eventType: "privacy_erasure",
        userId: tombstone,
        request,
        details: { method: "self_service", completed: true },
      });
    } catch (auditError) {
      console.warn("Unable to write privacy erasure audit event", auditError);
    }
    return jsonResponse({ ok: true }, { status: 200 });
  } catch (error) {
    if (isStorageUnavailableError(error)) {
      return errorResponse("Storage service temporarily unavailable", 503, { code: "storage_unavailable" });
    }
    const message = error instanceof Error ? error.message : "";
    if (message.includes("last_organization_owner") || message.includes("last_adl_admin")) {
      return errorResponse("Transfer protected access before deleting this account", 409, { code: "account_delete_blocked" });
    }
    if (message.includes("account_not_found")) return errorResponse("Profile not found", 404);
    throw error;
  }
}
