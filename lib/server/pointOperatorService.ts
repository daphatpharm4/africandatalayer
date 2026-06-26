/**
 * pointOperatorService.ts
 *
 * Lifecycle service for point operator assignments.
 *
 * Designed with dependency injection so tests can inject fake store functions
 * and exercise every validation branch without a real database.
 *
 * Production callers use `createPointOperatorLifecycle()` with no arguments;
 * the default deps wire the real store functions.
 */

import type {
  PointEvent,
  PointOperatorAssignment,
  PointOperatorReviewState,
  ProjectedPoint,
  SubmissionCategory,
  SubmissionLocation,
  UserRole,
} from "../../shared/types.js";
import {
  findProjectedPointForAssignment,
  getActivePointOperatorAssignmentByUser,
  getActivePointOperatorAssignmentByPoint,
  grantPointOperatorAssignmentTx,
  revokePointOperatorAssignmentTx,
  type GrantAssignmentInput,
  type RevokeAssignmentInput,
} from "./pointOperatorStore.js";
import { getUserProfile } from "./storage/index.js";

// ─── Input types ─────────────────────────────────────────────────────────────

export interface GrantPointOperatorInput {
  actorUserId: string;
  operatorUserId: string;
  pointId: string;
}

export interface RevokePointOperatorInput {
  actorUserId: string;
  operatorUserId: string;
  revokeReason: string;
}

// ─── Minimal operator profile shape (only what the service needs) ─────────────

interface OperatorProfileSnapshot {
  role?: UserRole;
  isAdmin?: boolean;
}

// ─── Dependency injection interface ──────────────────────────────────────────

export interface PointOperatorLifecycleDeps {
  /** Loads the verified projected point for an assignment (must NOT trust client input). */
  getProjectedPointFn: (pointId: string) => Promise<ProjectedPoint | null>;
  /** Loads a minimal profile for the operator-to-be (to detect admin rejection). */
  getOperatorProfileFn: (userId: string) => Promise<OperatorProfileSnapshot | null>;
  /** Checks whether this operator already holds an active assignment. */
  getActiveByOperatorFn: (userId: string) => Promise<PointOperatorAssignment | null>;
  /** Checks whether this point already has an active operator. */
  getActiveByPointFn: (pointId: string) => Promise<PointOperatorAssignment | null>;
  /** Runs the grant inside an atomic DB transaction (role update + assignment insert). */
  transactionFn: (input: GrantAssignmentInput) => Promise<PointOperatorAssignment>;
  /** Revokes the active assignment (marks it revoked with audit fields). */
  revokeFn: (input: RevokeAssignmentInput) => Promise<PointOperatorAssignment>;
}

// ─── Default deps (wired to real store) ──────────────────────────────────────

const defaultDeps: PointOperatorLifecycleDeps = {
  getProjectedPointFn: findProjectedPointForAssignment,
  getOperatorProfileFn: async (userId) => {
    const profile = await getUserProfile(userId);
    if (!profile) return null;
    return { role: profile.role, isAdmin: profile.isAdmin };
  },
  getActiveByOperatorFn: getActivePointOperatorAssignmentByUser,
  getActiveByPointFn: getActivePointOperatorAssignmentByPoint,
  transactionFn: grantPointOperatorAssignmentTx,
  revokeFn: revokePointOperatorAssignmentTx,
};

// ─── Lifecycle factory ────────────────────────────────────────────────────────

/**
 * Creates a point-operator lifecycle object with `grant` and `revoke` methods.
 *
 * Pass `deps` to override individual store functions for testing; omit to use
 * the real database store.
 *
 * Validation order for grant:
 *   1. Point exists (verified projection)
 *   2. Operator is not an admin account
 *   3. Operator is not already active on another point
 *   4. Point does not already have an active operator
 *   5. Atomic transaction (role update + assignment insert)
 */
export function createPointOperatorLifecycle(
  deps: PointOperatorLifecycleDeps = defaultDeps,
) {
  return {
    /**
     * Grant a point operator assignment.
     *
     * Throws with exact error messages (tested via regex):
     *   - "Verified point not found"
     *   - "Admin accounts cannot become point operators"
     *   - "Operator already has an active point"
     *   - "Point already has an active operator"
     */
    async grant(input: GrantPointOperatorInput): Promise<PointOperatorAssignment> {
      // 1. Verify the point exists
      const point = await deps.getProjectedPointFn(input.pointId);
      if (!point) {
        throw new Error("Verified point not found");
      }

      // 2. Reject admin accounts
      const operatorProfile = await deps.getOperatorProfileFn(input.operatorUserId);
      if (operatorProfile && (operatorProfile.role === "admin" || operatorProfile.isAdmin === true)) {
        throw new Error("Admin accounts cannot become point operators");
      }

      // 3. Reject operators already active on another point
      const existingByOperator = await deps.getActiveByOperatorFn(input.operatorUserId);
      if (existingByOperator) {
        throw new Error("Operator already has an active point");
      }

      // 4. Reject points that already have an active operator
      const existingByPoint = await deps.getActiveByPointFn(input.pointId);
      if (existingByPoint) {
        throw new Error("Point already has an active operator");
      }

      // 5. Atomic transaction
      return await deps.transactionFn({
        actorUserId: input.actorUserId,
        operatorUserId: input.operatorUserId,
        pointId: input.pointId,
      });
    },

    /**
     * Revoke an active point operator assignment.
     *
     * Throws with exact error messages (tested via regex):
     *   - "Revoke reason is required"
     *   - "Active operator assignment not found"
     */
    async revoke(input: RevokePointOperatorInput): Promise<PointOperatorAssignment> {
      // Validate reason before any DB call
      if (!input.revokeReason || !input.revokeReason.trim()) {
        throw new Error("Revoke reason is required");
      }

      const active = await deps.getActiveByOperatorFn(input.operatorUserId);
      if (!active) {
        throw new Error("Active operator assignment not found");
      }

      return await deps.revokeFn({
        actorUserId: input.actorUserId,
        operatorUserId: input.operatorUserId,
        revokeReason: input.revokeReason,
      });
    },
  };
}

// ─── Expiry TTLs per category/field ──────────────────────────────────────────
//
// These are the per-field expiry durations (in hours) for point operator signals.
//
// TTL design choices:
//   isOpenNow      → 6h  (brief-specified, used in test fixture)
//   isOnDuty       → 6h  (pharmacist on duty: same semantic as isOpenNow)
//   hasFuelAvailable→ 4h  (fuel stations deplete quickly during the day)
//   isActive       → 8h  (mobile money agent activity, roughly one shift)
//   hasFloat       → 4h  (float runs out quickly under load)
//   hasMin50000XafAvailable → 4h (same semantic as hasFloat)
//   isOccupied     → 24h (billboard occupancy changes slowly)
//   isBlocked      → 2h  (road blockages resolve or change quickly)
//   isFlooded      → 3h  (flood conditions change with rainfall)
//   DEFAULT        → 6h  (safe default for any boolean field without a specific TTL)
//
// Concern: these TTLs are currently hardcoded constants. If product requirements
// change, they should be moved to a configurable source (DB table or env vars).

const FIELD_TTL_HOURS: Record<string, number> = {
  isOpenNow: 6,
  isOnDuty: 6,
  hasFuelAvailable: 4,
  isActive: 8,
  hasFloat: 4,
  hasMin50000XafAvailable: 4,
  hasCashAvailable: 4,
  isOccupied: 24,
  isBlocked: 2,
  isFlooded: 3,
};

const DEFAULT_TTL_HOURS = 6;

/**
 * Resolves the expiry Date for a point operator signal.
 * Returns reportedAt + TTL for the given category/field combination.
 */
export function resolvePointOperatorExpiry(
  _category: SubmissionCategory,
  field: string,
  reportedAt: Date,
): Date {
  const ttlHours = FIELD_TTL_HOURS[field] ?? DEFAULT_TTL_HOURS;
  return new Date(reportedAt.getTime() + ttlHours * 60 * 60 * 1000);
}

// ─── Event builder input types ────────────────────────────────────────────────

export interface BuildSignalEventInput {
  eventId: string;
  operatorUserId: string;
  point: {
    pointId: string;
    category: SubmissionCategory;
    location: SubmissionLocation;
  };
  field: string;
  value: boolean;
  reportedAt: Date;
  reviewState: "auto_approved" | "pending_review";
}

export interface BuildPhotoEventInput {
  eventId: string;
  operatorUserId: string;
  point: {
    pointId: string;
    category: SubmissionCategory;
    location: SubmissionLocation;
  };
  photoUrl: string;
  reportedAt: Date;
}

// ─── Event builders ───────────────────────────────────────────────────────────

/**
 * Builds a point operator signal event (ENRICH_EVENT, source="point_operator").
 * Sets xpAwarded=0 and includes operatorSignal metadata with expiry.
 */
export function buildPointOperatorSignalEvent(input: BuildSignalEventInput): PointEvent {
  const expiresAt = resolvePointOperatorExpiry(input.point.category, input.field, input.reportedAt);
  return {
    id: input.eventId,
    pointId: input.point.pointId,
    eventType: "ENRICH_EVENT",
    userId: input.operatorUserId,
    category: input.point.category,
    location: input.point.location,
    details: {
      [input.field]: input.value,
      operatorSignal: {
        field: input.field,
        reportedAt: input.reportedAt.toISOString(),
        expiresAt: expiresAt.toISOString(),
        reviewState: input.reviewState,
      },
      reviewStatus: input.reviewState === "pending_review" ? "pending_review" : "auto_approved",
      xpAwarded: 0,
    },
    createdAt: input.reportedAt.toISOString(),
    source: "point_operator",
  };
}

/**
 * Builds a point operator photo event (ENRICH_EVENT, source="point_operator").
 * Photo events always start as pending_review and award 0 XP.
 */
export function buildPointOperatorPhotoEvent(input: BuildPhotoEventInput): PointEvent {
  return {
    id: input.eventId,
    pointId: input.point.pointId,
    eventType: "ENRICH_EVENT",
    userId: input.operatorUserId,
    category: input.point.category,
    location: input.point.location,
    details: {
      operatorPhotoUpdate: true,
      reviewStatus: "pending_review",
      xpAwarded: 0,
    },
    photoUrl: input.photoUrl,
    createdAt: input.reportedAt.toISOString(),
    source: "point_operator",
  };
}

// ─── Anomaly classifier ───────────────────────────────────────────────────────

/**
 * Classifies a point operator signal as auto_approved or pending_review.
 *
 * Triggers pending_review if ANY of:
 *   - >= 6 same-field events in the last hour (high submission velocity)
 *   - >= 3 value flips in the last hour (rapid oscillation)
 *   - Disagrees with a recent verified agent value (agent/operator contradiction)
 */
export function classifyPointOperatorSignal(input: {
  field: string;
  recentSameFieldEvents: PointEvent[];
  value: boolean;
  capturedAt: Date;
  recentVerifiedAgentValue?: boolean;
}): "auto_approved" | "pending_review" {
  const lastHour = input.recentSameFieldEvents.filter(
    (event) => input.capturedAt.getTime() - new Date(event.createdAt).getTime() <= 60 * 60 * 1000,
  );
  const flips = lastHour.filter(
    (event) => event.details[input.field] !== input.value,
  );
  if (lastHour.length >= 6 || flips.length >= 3) return "pending_review";
  if (
    typeof input.recentVerifiedAgentValue === "boolean" &&
    input.recentVerifiedAgentValue !== input.value
  ) return "pending_review";
  return "auto_approved";
}

// ─── Submit input types (for API wiring in pointOperatorApi.ts) ───────────────

export interface SubmitSignalInput {
  operatorUserId: string;
  pointId: string;
  category: SubmissionCategory;
  location: SubmissionLocation;
  field: string;
  value: boolean;
  reportedAt?: Date;
  idempotencyKey: string;
  recentSameFieldEvents?: PointEvent[];
  recentVerifiedAgentValue?: boolean;
}

export interface SubmitPhotoInput {
  operatorUserId: string;
  pointId: string;
  category: SubmissionCategory;
  location: SubmissionLocation;
  photoUrl: string;
  reportedAt?: Date;
  idempotencyKey: string;
}

// ─── Submit functions (to be wired by pointOperatorApi.ts) ────────────────────

/**
 * Builds and persists a point operator signal event.
 * Classifies for anomaly review, awards 0 XP, and stores the event.
 */
export async function submitPointOperatorSignal(
  input: SubmitSignalInput,
  persistFn: (event: PointEvent) => Promise<void>,
): Promise<PointEvent> {
  const reportedAt = input.reportedAt ?? new Date();
  const reviewState = classifyPointOperatorSignal({
    field: input.field,
    recentSameFieldEvents: input.recentSameFieldEvents ?? [],
    value: input.value,
    capturedAt: reportedAt,
    recentVerifiedAgentValue: input.recentVerifiedAgentValue,
  });

  const event = buildPointOperatorSignalEvent({
    eventId: input.idempotencyKey,
    operatorUserId: input.operatorUserId,
    point: {
      pointId: input.pointId,
      category: input.category,
      location: input.location,
    },
    field: input.field,
    value: input.value,
    reportedAt,
    reviewState,
  });

  await persistFn(event);
  return event;
}

/**
 * Builds and persists a point operator photo event.
 * Always starts as pending_review, awards 0 XP.
 */
export async function submitPointOperatorPhoto(
  input: SubmitPhotoInput,
  persistFn: (event: PointEvent) => Promise<void>,
): Promise<PointEvent> {
  const reportedAt = input.reportedAt ?? new Date();

  const event = buildPointOperatorPhotoEvent({
    eventId: input.idempotencyKey,
    operatorUserId: input.operatorUserId,
    point: {
      pointId: input.pointId,
      category: input.category,
      location: input.location,
    },
    photoUrl: input.photoUrl,
    reportedAt,
  });

  await persistFn(event);
  return event;
}
