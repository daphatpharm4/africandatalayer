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

import type { PointOperatorAssignment, ProjectedPoint, UserRole } from "../../shared/types.js";
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
