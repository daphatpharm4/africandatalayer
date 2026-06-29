/**
 * pointOperatorApi.ts
 *
 * HTTP routing layer for the point-operator feature.
 *
 * Routing: view params prefixed `po_` are detected by api/user/index.ts and
 * delegated here via `createPointOperatorHandler`. This keeps the project at
 * the Vercel Hobby 12-function cap — no new file under api/ is created.
 *
 * Views:
 *   Admin (role === "admin"):
 *     po_admin_search_points  GET   — find verified points available for assignment
 *     po_admin_create         POST  — create operator account + grant assignment
 *     po_admin_assignment     GET   — look up current/history assignment for an operator
 *     po_admin_revoke         POST  — revoke an active assignment
 *
 *   Operator (role === "point_operator"):
 *     po_me                   GET   — load own assignment + point + controls + signals
 *     po_status               POST  — submit an open/closed status signal
 *     po_photo                POST  — submit a photo (stub for Task 5)
 *     po_password             POST  — change own password (first-login forced change)
 */

import bcrypt from "bcryptjs";
import type { PointEvent, PointOperatorAssignment, ProjectedPoint, UserRole } from "../../shared/types.js";
import type { SecurityAuditEventType } from "./securityAudit.js";
import { logSecurityEvent } from "./securityAudit.js";
import { jsonResponse, errorResponse } from "./http.js";
import { readIdempotencyKey } from "./idempotencyCore.js";
import {
  pointOperatorCreateSchema,
  pointOperatorSignalSchema,
  pointOperatorRevokeSchema,
  pointOperatorPhotoSchema,
  pointOperatorPasswordSchema,
} from "./validation.js";
import { inferDefaultDisplayName, normalizeIdentifier } from "../shared/identifier.js";
import { getUserProfile, upsertUserProfile } from "./storage/index.js";
import {
  getActivePointOperatorAssignmentByUser,
  findProjectedPointForAssignment,
  searchAssignableProjectedPoints,
  listRecentOperatorSignalEvents,
} from "./pointOperatorStore.js";
import { createPointOperatorLifecycle, submitPointOperatorSignal, submitPointOperatorPhoto } from "./pointOperatorService.js";
import { DEFAULT_AVATAR_PRESET, encodeAvatarPresetImage } from "../../shared/avatarPresets.js";
import type { UserProfile, MapScope } from "../../shared/types.js";

// ─── Types ────────────────────────────────────────────────────────────────────

type PointOperatorView =
  | "po_admin_search_points"
  | "po_admin_create"
  | "po_admin_assignment"
  | "po_admin_revoke"
  | "po_me"
  | "po_status"
  | "po_photo"
  | "po_password";

type AuthUser = { id: string; token: unknown; role: UserRole };

// submitSignalFn is the Task 5 dep; for Task 4 we accept it as an injected dep.
// Shape: accepts the signal input and returns an eventId.
export type SubmitSignalInput = {
  operatorUserId: string;
  pointId: string;
  field: string;
  value: boolean;
  capturedAt?: string;
  idempotencyKey: string;
};

// When tests inject submitSignalFn without pointId routing, the pointId is
// resolved server-side and stripped from what the fn receives.
export type SubmitSignalFnInput = Omit<SubmitSignalInput, "pointId">;

export type SubmitSignalFn = (input: SubmitSignalFnInput) => Promise<{ eventId: string }>;

// submitPhotoFn: injectable dep for photo submission (mirrors submitSignalFn pattern).
// Tests can inject a fake; production uses the default closure wired to submitPointOperatorPhoto.
// imageData: raw base64 or data URL from the client; the default fn uploads it to blob storage.
export type SubmitPhotoFnInput = {
  operatorUserId: string;
  imageData: string;
  capturedAt?: string;
  idempotencyKey: string;
};

export type SubmitPhotoFn = (input: SubmitPhotoFnInput) => Promise<{ eventId: string }>;

export interface PointOperatorHandlerDeps {
  requireUserFn?: (req: Request) => Promise<AuthUser | null>;
  lifecycleFn?: () => ReturnType<typeof createPointOperatorLifecycle>;
  getActiveAssignmentByUserFn?: (userId: string) => Promise<PointOperatorAssignment | null>;
  getPointFn?: (pointId: string) => Promise<ProjectedPoint | null>;
  searchAssignablePointsFn?: (query?: string) => Promise<ProjectedPoint[]>;
  /** Injectable for the classifier data loader — allows tests to inject fake recent events. */
  listRecentSignalEventsFn?: typeof listRecentOperatorSignalEvents;
  /**
   * Injectable persist function used by the default submitSignalFn and submitPhotoFn closures.
   * Defaults to the real `insertPointEvent` from storage/index.js.
   * Tests inject a fake to capture the persisted event without hitting the DB.
   */
  insertPointEventFn?: (event: PointEvent) => Promise<void>;
  submitSignalFn?: SubmitSignalFn;
  submitPhotoFn?: SubmitPhotoFn;
  getUserProfileFn?: typeof getUserProfile;
  upsertUserProfileFn?: typeof upsertUserProfile;
  hashPasswordFn?: (password: string, rounds: number) => Promise<string>;
  logSecurityEventFn?: typeof logSecurityEvent;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function _sanitizeProfile<T extends { passwordHash?: unknown }>(profile: T): Omit<T, "passwordHash"> {
  const safe = { ...profile } as T & { passwordHash?: unknown };
  delete safe.passwordHash;
  return safe;
}

function isAdminRole(role: UserRole | undefined): boolean {
  return role === "admin";
}

function isOperatorRole(role: UserRole | undefined): boolean {
  return role === "point_operator";
}

/** Map lifecycle error messages to HTTP status codes */
function lifecycleErrorStatus(message: string): number | null {
  if (message.includes("Verified point not found")) return 404;
  if (message.includes("Active operator assignment not found")) return 404;
  if (message.includes("Admin accounts cannot become point operators")) return 403;
  if (message.includes("Operator already has an active point")) return 409;
  if (message.includes("Point already has an active operator")) return 409;
  return null;
}

// ─── Handler factory ──────────────────────────────────────────────────────────

/**
 * Creates the point-operator HTTP handler with dependency injection.
 *
 * Production usage (wired to real store):
 *   const handler = createPointOperatorHandler();
 *
 * Test usage:
 *   const handler = createPointOperatorHandler({ requireUserFn: ..., ... });
 */
export function createPointOperatorHandler(deps: PointOperatorHandlerDeps = {}) {
  const requireUserFn =
    deps.requireUserFn ??
    (async (req: Request): Promise<AuthUser | null> => {
      const { requireUser } = await import("../../lib/auth.js");
      return requireUser(req);
    });

  const lifecycleFn = deps.lifecycleFn ?? (() => createPointOperatorLifecycle());
  const getActiveAssignmentByUserFn = deps.getActiveAssignmentByUserFn ?? getActivePointOperatorAssignmentByUser;
  const getPointFn = deps.getPointFn ?? findProjectedPointForAssignment;
  const searchAssignablePointsFn = deps.searchAssignablePointsFn ?? searchAssignableProjectedPoints;
  const listRecentSignalEventsFn = deps.listRecentSignalEventsFn ?? listRecentOperatorSignalEvents;
  const getUserProfileFn = deps.getUserProfileFn ?? getUserProfile;
  const upsertUserProfileFn = deps.upsertUserProfileFn ?? upsertUserProfile;
  const hashPasswordFn = deps.hashPasswordFn ?? bcrypt.hash;
  const logSecurityEventFn = deps.logSecurityEventFn ?? logSecurityEvent;

  // Resolved once; used by default submitSignalFn and submitPhotoFn closures.
  // Tests inject a fake to capture persisted events without touching the DB.
  const insertPointEventFn: (event: PointEvent) => Promise<void> =
    deps.insertPointEventFn ??
    (async (event) => {
      const { insertPointEvent } = await import("./storage/index.js");
      return insertPointEvent(event);
    });

  // Default submitSignalFn: resolves assignment → loads projected point → feeds real
  // classifier inputs (recentSameFieldEvents + recentVerifiedAgentValue) → calls submitPointOperatorSignal.
  // This ensures the pending_review pathway is live in production, not just in unit tests.
  const submitSignalFn: SubmitSignalFn =
    deps.submitSignalFn ??
    (async (input: SubmitSignalFnInput): Promise<{ eventId: string }> => {
      const assignment = await getActiveAssignmentByUserFn(input.operatorUserId);
      if (!assignment) throw new Error("No active point operator assignment found");
      const point = await getPointFn(assignment.pointId);
      if (!point) throw new Error("Assigned point not found");

      // Load real classifier inputs: recent same-field events (60min window) and
      // the current projected consensus value for the field (if it's a boolean).
      const reportedAt = input.capturedAt ? new Date(input.capturedAt) : new Date();
      const recentSameFieldEvents = await listRecentSignalEventsFn(
        point.pointId,
        input.field,
        60 * 60 * 1000,
        reportedAt,
      );
      const currentFieldValue = (point.details as Record<string, unknown>)[input.field];
      const recentVerifiedAgentValue =
        typeof currentFieldValue === "boolean" ? currentFieldValue : undefined;

      const event = await submitPointOperatorSignal(
        {
          operatorUserId: input.operatorUserId,
          pointId: point.pointId,
          category: point.category,
          location: point.location,
          field: input.field,
          value: input.value,
          reportedAt,
          idempotencyKey: input.idempotencyKey,
          recentSameFieldEvents,
          recentVerifiedAgentValue,
        },
        insertPointEventFn,
      );
      return { eventId: event.id };
    });

  // Default submitPhotoFn: resolves assignment → uploads image to blob → calls submitPointOperatorPhoto
  const submitPhotoFn: SubmitPhotoFn =
    deps.submitPhotoFn ??
    (async (input: SubmitPhotoFnInput): Promise<{ eventId: string }> => {
      const { put } = await import("@vercel/blob");
      const assignment = await getActiveAssignmentByUserFn(input.operatorUserId);
      if (!assignment) throw new Error("No active point operator assignment found");
      const point = await getPointFn(assignment.pointId);
      if (!point) throw new Error("Assigned point not found");
      // Decode base64/data-URL image and upload to blob storage
      const base64Data = input.imageData.replace(/^data:[^;]+;base64,/, "");
      const buffer = Buffer.from(base64Data, "base64");
      const blobKey = `point-operator-photos/${input.idempotencyKey}.jpg`;
      const blob = await put(blobKey, buffer, { access: "public", contentType: "image/jpeg" });
      const event = await submitPointOperatorPhoto(
        {
          operatorUserId: input.operatorUserId,
          pointId: point.pointId,
          category: point.category,
          location: point.location,
          photoUrl: blob.url,
          reportedAt: input.capturedAt ? new Date(input.capturedAt) : new Date(),
          idempotencyKey: input.idempotencyKey,
        },
        insertPointEventFn,
      );
      return { eventId: event.id };
    });

  // ── Main dispatcher ──────────────────────────────────────────────────────────
  return async function handlePointOperator(request: Request): Promise<Response> {
    const auth = await requireUserFn(request);
    if (!auth) return errorResponse("Unauthorized", 401);

    const url = new URL(request.url);
    const view = url.searchParams.get("view") as PointOperatorView | null;

    // Route to the appropriate sub-handler
    switch (view) {
      case "po_admin_search_points":
        return handleAdminSearchPoints(request, auth);
      case "po_admin_create":
        return handleAdminCreate(request, auth);
      case "po_admin_assignment":
        return handleAdminAssignment(request, auth, url);
      case "po_admin_revoke":
        return handleAdminRevoke(request, auth);
      case "po_me":
        return handleOperatorMe(request, auth);
      case "po_status":
        return handleOperatorStatus(request, auth);
      case "po_photo":
        return handleOperatorPhoto(request, auth);
      case "po_password":
        return handleOperatorPassword(request, auth);
      default:
        return errorResponse("Invalid view", 400);
    }
  };

  // ── Admin: search available verified points ──────────────────────────────────
  async function handleAdminSearchPoints(request: Request, auth: AuthUser): Promise<Response> {
    if (!isAdminRole(auth.role)) return errorResponse("Forbidden", 403);
    const url = new URL(request.url);
    const query = url.searchParams.get("q")?.trim() || undefined;
    const points = await searchAssignablePointsFn(query);
    return jsonResponse({ points }, { status: 200 });
  }

  // ── Admin: create operator account and grant assignment ─────────────────────
  async function handleAdminCreate(request: Request, auth: AuthUser): Promise<Response> {
    if (!isAdminRole(auth.role)) return errorResponse("Forbidden", 403);

    const idempotencyKey = readIdempotencyKey(request.headers);
    if (!idempotencyKey) {
      return errorResponse("Idempotency-Key header is required", 422);
    }

    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      return errorResponse("Invalid JSON body", 400);
    }

    const validation = pointOperatorCreateSchema.safeParse(rawBody);
    if (!validation.success) {
      return errorResponse(validation.error.issues[0]?.message ?? "Invalid request body", 422);
    }
    const body = validation.data;

    const normalizedIdentifier = normalizeIdentifier(body.identifier);
    if (!normalizedIdentifier) {
      return errorResponse("Enter a valid email or phone number", 422);
    }
    const userId = normalizedIdentifier.value;

    // Check if account already exists
    const existing = await getUserProfileFn(userId);
    const alreadyExists = Boolean(existing);

    // Run lifecycle (grant) — this also atomically sets role = 'point_operator'
    const lifecycle = lifecycleFn();
    let assignment: PointOperatorAssignment;
    try {
      assignment = await lifecycle.grant({
        actorUserId: auth.id,
        operatorUserId: userId,
        pointId: body.pointId,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      const status = lifecycleErrorStatus(msg);
      if (status === null) throw err;
      return errorResponse(msg, status);
    }

    // If the account did not already exist, provision it
    if (!alreadyExists) {
      const name = body.name.trim() || inferDefaultDisplayName(userId);
      const newProfile: UserProfile = {
        id: userId,
        name,
        email: normalizedIdentifier.type === "email" ? userId : null,
        phone: normalizedIdentifier.type === "phone" ? userId : null,
        image: encodeAvatarPresetImage(DEFAULT_AVATAR_PRESET),
        avatarPreset: DEFAULT_AVATAR_PRESET,
        occupation: "",
        XP: 0,
        passwordHash: await hashPasswordFn(body.password, 12),
        isAdmin: false,
        role: "point_operator",
        mapScope: "bonamoussadi" as MapScope,
        trustScore: 50,
        trustTier: "standard",
        failedLoginCount: 0,
        lockedUntil: null,
        wipeRequested: false,
        suspendedUntil: null,
        mustChangePassword: true,
      };
      try {
        await upsertUserProfileFn(userId, newProfile);
      } catch {
        // Profile may already be upserted by the lifecycle tx; best-effort
      }
    }

    // Audit fires for EVERY successful grant, regardless of whether the account
    // was newly provisioned or already existed.
    try {
      await logSecurityEventFn({
        eventType: "point_operator_granted" as SecurityAuditEventType,
        userId,
        request,
        details: {
          actorUserId: auth.id,
          pointId: body.pointId,
          assignmentId: assignment.id,
          accountProvisioned: !alreadyExists,
        },
      });
    } catch {
      // Audit is best-effort
    }

    return jsonResponse({ assignment }, { status: 201 });
  }

  // ── Admin: look up assignment (history) for an operator ────────────────────
  async function handleAdminAssignment(_request: Request, auth: AuthUser, url: URL): Promise<Response> {
    if (!isAdminRole(auth.role)) return errorResponse("Forbidden", 403);

    const operatorUserId = url.searchParams.get("operatorUserId")?.trim().toLowerCase();
    if (!operatorUserId) return errorResponse("operatorUserId query param is required", 400);

    const assignment = await getActiveAssignmentByUserFn(operatorUserId);
    return jsonResponse({ assignment: assignment ?? null }, { status: 200 });
  }

  // ── Admin: revoke an active assignment ──────────────────────────────────────
  async function handleAdminRevoke(request: Request, auth: AuthUser): Promise<Response> {
    if (!isAdminRole(auth.role)) return errorResponse("Forbidden", 403);

    const idempotencyKey = readIdempotencyKey(request.headers);
    if (!idempotencyKey) {
      return errorResponse("Idempotency-Key header is required", 422);
    }

    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      return errorResponse("Invalid JSON body", 400);
    }

    const validation = pointOperatorRevokeSchema.safeParse(rawBody);
    if (!validation.success) {
      return errorResponse(validation.error.issues[0]?.message ?? "Invalid request body", 422);
    }
    const body = validation.data;

    const lifecycle = lifecycleFn();
    let assignment: PointOperatorAssignment;
    try {
      assignment = await lifecycle.revoke({
        actorUserId: auth.id,
        operatorUserId: body.operatorUserId,
        revokeReason: body.reason,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      const status = lifecycleErrorStatus(msg);
      if (status === null) throw err;
      return errorResponse(msg, status);
    }

    try {
      await logSecurityEventFn({
        eventType: "point_operator_revoked" as SecurityAuditEventType,
        userId: body.operatorUserId,
        request,
        details: {
          actorUserId: auth.id,
          assignmentId: assignment.id,
          reason: body.reason,
        },
      });
    } catch {
      // Audit is best-effort
    }

    return jsonResponse({ assignment }, { status: 200 });
  }

  // ── Operator: load own assignment + point ───────────────────────────────────
  async function handleOperatorMe(_request: Request, auth: AuthUser): Promise<Response> {
    if (!isOperatorRole(auth.role)) return errorResponse("Forbidden", 403);

    const assignment = await getActiveAssignmentByUserFn(auth.id);
    if (!assignment) return errorResponse("No active point operator assignment found", 403);

    const point = await getPointFn(assignment.pointId);
    if (!point) return errorResponse("Assigned point not found", 404);

    return jsonResponse({ assignment, point, controls: [], signals: {} }, { status: 200 });
  }

  // ── Operator: submit a status signal ────────────────────────────────────────
  async function handleOperatorStatus(request: Request, auth: AuthUser): Promise<Response> {
    if (!isOperatorRole(auth.role)) return errorResponse("Forbidden", 403);

    const idempotencyKey = readIdempotencyKey(request.headers);
    if (!idempotencyKey) {
      return errorResponse("Idempotency-Key header is required", 422);
    }

    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      return errorResponse("Invalid JSON body", 400);
    }

    // Strict schema — rejects pointId, category, or any extra field
    const validation = pointOperatorSignalSchema.safeParse(rawBody);
    if (!validation.success) {
      return errorResponse(validation.error.issues[0]?.message ?? "Invalid request body", 422);
    }
    const body = validation.data;

    // Resolve assignment server-side — never trust client-supplied pointId
    const assignment = await getActiveAssignmentByUserFn(auth.id);
    if (!assignment) return errorResponse("No active point operator assignment found", 403);

    let result: { eventId: string };
    try {
      result = await submitSignalFn({
        operatorUserId: auth.id,
        field: body.field,
        value: body.value,
        capturedAt: body.capturedAt,
        idempotencyKey,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      return errorResponse(msg, 500);
    }

    return jsonResponse({ eventId: result.eventId }, { status: 201 });
  }

  // ── Operator: submit a photo ─────────────────────────────────────────────────
  async function handleOperatorPhoto(request: Request, auth: AuthUser): Promise<Response> {
    if (!isOperatorRole(auth.role)) return errorResponse("Forbidden", 403);

    const idempotencyKey = readIdempotencyKey(request.headers);
    if (!idempotencyKey) {
      return errorResponse("Idempotency-Key header is required", 422);
    }

    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      return errorResponse("Invalid JSON body", 400);
    }

    const validation = pointOperatorPhotoSchema.safeParse(rawBody);
    if (!validation.success) {
      return errorResponse(validation.error.issues[0]?.message ?? "Invalid request body", 422);
    }

    const assignment = await getActiveAssignmentByUserFn(auth.id);
    if (!assignment) return errorResponse("No active point operator assignment found", 403);

    const body = validation.data;
    let result: { eventId: string };
    try {
      result = await submitPhotoFn({
        operatorUserId: auth.id,
        imageData: body.imageData,
        capturedAt: body.capturedAt,
        idempotencyKey,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      return errorResponse(msg, 500);
    }

    return jsonResponse({ eventId: result.eventId }, { status: 201 });
  }

  // ── Operator: change password ────────────────────────────────────────────────
  async function handleOperatorPassword(request: Request, auth: AuthUser): Promise<Response> {
    if (!isOperatorRole(auth.role)) return errorResponse("Forbidden", 403);

    const idempotencyKey = readIdempotencyKey(request.headers);
    if (!idempotencyKey) {
      return errorResponse("Idempotency-Key header is required", 422);
    }

    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      return errorResponse("Invalid JSON body", 400);
    }

    const validation = pointOperatorPasswordSchema.safeParse(rawBody);
    if (!validation.success) {
      return errorResponse(validation.error.issues[0]?.message ?? "Invalid request body", 422);
    }
    const body = validation.data;

    const profile = await getUserProfileFn(auth.id);
    if (!profile) return errorResponse("Profile not found", 404);

    // Verify current password
    const currentHash = profile.passwordHash as string | undefined;
    if (!currentHash) return errorResponse("No password set on this account", 409);
    const matches = await bcrypt.compare(body.currentPassword, currentHash);
    if (!matches) return errorResponse("Current password is incorrect", 403);

    profile.passwordHash = await hashPasswordFn(body.newPassword, 12);
    profile.mustChangePassword = false;
    const currentSessionVersion = (profile as { sessionVersion?: unknown }).sessionVersion;
    (profile as unknown as { sessionVersion: number }).sessionVersion =
      typeof currentSessionVersion === "number" && Number.isFinite(currentSessionVersion)
        ? Math.max(0, Math.floor(currentSessionVersion)) + 1
        : 1;

    try {
      await upsertUserProfileFn(auth.id, profile);
    } catch {
      return errorResponse("Storage service temporarily unavailable", 503, { code: "storage_unavailable" });
    }

    try {
      await logSecurityEventFn({
        eventType: "point_operator_password_changed" as SecurityAuditEventType,
        userId: auth.id,
        request,
        details: { actorUserId: auth.id },
      });
    } catch {
      // Audit is best-effort
    }

    return jsonResponse({ changed: true, reauthenticate: true }, { status: 200 });
  }
}
