import type {
  PointOperatorAssignment,
  ProjectedPoint,
  UserProfile,
} from "../../shared/types.js";
import {
  findProjectedPointForAssignment,
  getActivePointOperatorAssignmentByPoint,
  getActivePointOperatorAssignmentByUser,
  grantPointOperatorAssignmentTx,
  revokePointOperatorAssignmentTx,
  type GrantAssignmentInput,
  type RevokeAssignmentInput,
} from "./pointOperatorStore.js";
import { getUserProfile } from "./storage/index.js";

export interface GrantPointOperatorInput {
  actorUserId: string;
  operatorUserId: string;
  pointId: string;
  /**
   * Untrusted transport data retained for API compatibility. The lifecycle
   * deliberately ignores it and reloads the projected point on the server.
   */
  point?: unknown;
}

export interface RevokePointOperatorInput {
  actorUserId: string;
  operatorUserId: string;
  reason: string;
}

export interface PointOperatorLifecycleDeps {
  getProjectedPointFn(pointId: string): Promise<ProjectedPoint | null>;
  getActiveByOperatorFn(
    operatorUserId: string,
  ): Promise<PointOperatorAssignment | null>;
  getActiveByPointFn(
    pointId: string,
  ): Promise<PointOperatorAssignment | null>;
  getProfileFn(operatorUserId: string): Promise<UserProfile | null>;
  transactionFn(
    input: GrantAssignmentInput,
  ): Promise<PointOperatorAssignment>;
  revokeFn(
    input: RevokeAssignmentInput,
  ): Promise<PointOperatorAssignment>;
}

export class PointOperatorConflictError extends Error {
  readonly code = "point_operator_conflict";
  readonly constraint: string | null;

  constructor(message: string, constraint: string | null = null) {
    super(message);
    this.name = "PointOperatorConflictError";
    this.constraint = constraint;
  }
}

function normalizeUserId(value: string): string {
  return value.trim().toLowerCase();
}

function normalizePointId(value: string): string {
  return value.trim();
}

function asUniqueConflict(error: unknown): PointOperatorConflictError | null {
  const databaseError = error as {
    code?: unknown;
    constraint?: unknown;
  };
  if (databaseError?.code !== "23505") return null;

  const constraint =
    typeof databaseError.constraint === "string"
      ? databaseError.constraint
      : null;
  if (constraint === "point_operator_one_active_per_user") {
    return new PointOperatorConflictError(
      "Operator already has an active point",
      constraint,
    );
  }
  if (constraint === "point_operator_one_active_per_point") {
    return new PointOperatorConflictError(
      "Point already has an active operator",
      constraint,
    );
  }
  return new PointOperatorConflictError(
    "Point operator assignment conflicts with an existing record",
    constraint,
  );
}

const defaultDeps: PointOperatorLifecycleDeps = {
  getProjectedPointFn: findProjectedPointForAssignment,
  getActiveByOperatorFn: getActivePointOperatorAssignmentByUser,
  getActiveByPointFn: getActivePointOperatorAssignmentByPoint,
  getProfileFn: getUserProfile,
  transactionFn: grantPointOperatorAssignmentTx,
  revokeFn: revokePointOperatorAssignmentTx,
};

export function createPointOperatorLifecycle(
  deps: PointOperatorLifecycleDeps = defaultDeps,
) {
  return {
    async grant(
      input: GrantPointOperatorInput,
    ): Promise<PointOperatorAssignment> {
      const actorUserId = normalizeUserId(input.actorUserId);
      const operatorUserId = normalizeUserId(input.operatorUserId);
      const pointId = normalizePointId(input.pointId);

      const point = await deps.getProjectedPointFn(pointId);
      if (!point) throw new Error("Verified point not found");

      if (await deps.getActiveByOperatorFn(operatorUserId)) {
        throw new PointOperatorConflictError(
          "Operator already has an active point",
        );
      }
      if (await deps.getActiveByPointFn(pointId)) {
        throw new PointOperatorConflictError(
          "Point already has an active operator",
        );
      }

      const operatorProfile = await deps.getProfileFn(operatorUserId);
      if (!operatorProfile) throw new Error("Operator profile not found");
      if (
        operatorProfile.isAdmin === true ||
        operatorProfile.role === "admin"
      ) {
        throw new Error("Admin accounts cannot become point operators");
      }

      try {
        return await deps.transactionFn({
          actorUserId,
          operatorUserId,
          pointId,
          profile: {
            kind: "existing",
            userId: operatorUserId,
            mustChangePassword:
              operatorProfile.mustChangePassword === true,
          },
        });
      } catch (error) {
        const conflict = asUniqueConflict(error);
        if (conflict) throw conflict;
        throw error;
      }
    },

    async revoke(
      input: RevokePointOperatorInput,
    ): Promise<PointOperatorAssignment> {
      const actorUserId = normalizeUserId(input.actorUserId);
      const operatorUserId = normalizeUserId(input.operatorUserId);
      const reason = input.reason.trim();
      if (!reason) throw new Error("Revocation reason is required");

      const active = await deps.getActiveByOperatorFn(operatorUserId);
      if (!active) throw new Error("Active operator assignment not found");

      try {
        return await deps.revokeFn({
          assignmentId: active.id,
          actorUserId,
          operatorUserId,
          reason,
        });
      } catch (error) {
        const conflict = asUniqueConflict(error);
        if (conflict) throw conflict;
        throw error;
      }
    },
  };
}
