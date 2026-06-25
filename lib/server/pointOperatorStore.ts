/**
 * pointOperatorStore.ts
 *
 * Persistence layer for point_operator_assignments.
 * All reads/writes go through the shared Postgres pool (getPool / query).
 * The grant and revoke operations run inside explicit transactions so profile
 * role updates and assignment mutations are always atomic.
 */

import type { PointOperatorAssignment, ProjectedPoint, UserProfile } from "../../shared/types.js";
import { getPool, query } from "./db.js";
import { getPointEvents } from "./storage/index.js";
import { projectPointById } from "./pointProjection.js";
import { getUserProfile, upsertUserProfile } from "./storage/index.js";

// ─── Input types ────────────────────────────────────────────────────────────

export interface GrantAssignmentInput {
  actorUserId: string;
  operatorUserId: string;
  pointId: string;
}

export interface RevokeAssignmentInput {
  actorUserId: string;
  operatorUserId: string;
  revokeReason: string;
}

// ─── Row mapper ─────────────────────────────────────────────────────────────

interface AssignmentRow {
  id: string;
  operator_user_id: string;
  point_id: string;
  status: "active" | "revoked";
  granted_by: string;
  granted_at: Date;
  revoked_by: string | null;
  revoked_at: Date | null;
  revoke_reason: string | null;
}

function rowToAssignment(row: AssignmentRow): PointOperatorAssignment {
  return {
    id: row.id,
    operatorUserId: row.operator_user_id,
    pointId: row.point_id,
    status: row.status,
    grantedBy: row.granted_by,
    grantedAt: row.granted_at instanceof Date ? row.granted_at.toISOString() : String(row.granted_at),
    revokedBy: row.revoked_by ?? null,
    revokedAt: row.revoked_at instanceof Date ? row.revoked_at.toISOString() : (row.revoked_at ? String(row.revoked_at) : null),
    revokeReason: row.revoke_reason ?? null,
  };
}

// ─── Read functions ──────────────────────────────────────────────────────────

/**
 * Returns the single active assignment for an operator, or null.
 */
export async function getActivePointOperatorAssignmentByUser(
  userId: string,
): Promise<PointOperatorAssignment | null> {
  const result = await query<AssignmentRow>(
    `SELECT id, operator_user_id, point_id, status, granted_by, granted_at,
            revoked_by, revoked_at, revoke_reason
     FROM public.point_operator_assignments
     WHERE operator_user_id = $1 AND status = 'active'
     LIMIT 1`,
    [userId],
  );
  if (!result.rows.length) return null;
  return rowToAssignment(result.rows[0]);
}

/**
 * Returns the single active assignment for a point, or null.
 */
export async function getActivePointOperatorAssignmentByPoint(
  pointId: string,
): Promise<PointOperatorAssignment | null> {
  const result = await query<AssignmentRow>(
    `SELECT id, operator_user_id, point_id, status, granted_by, granted_at,
            revoked_by, revoked_at, revoke_reason
     FROM public.point_operator_assignments
     WHERE point_id = $1 AND status = 'active'
     LIMIT 1`,
    [pointId],
  );
  if (!result.rows.length) return null;
  return rowToAssignment(result.rows[0]);
}

/**
 * Returns full assignment history for a point (active + revoked), newest first.
 */
export async function listPointOperatorAssignmentHistory(
  pointId: string,
): Promise<PointOperatorAssignment[]> {
  const result = await query<AssignmentRow>(
    `SELECT id, operator_user_id, point_id, status, granted_by, granted_at,
            revoked_by, revoked_at, revoke_reason
     FROM public.point_operator_assignments
     WHERE point_id = $1
     ORDER BY granted_at DESC`,
    [pointId],
  );
  return result.rows.map(rowToAssignment);
}

/**
 * Load point events from storage and project to a verified ProjectedPoint.
 * Never trusts a client-supplied point summary — always derives from events.
 */
export async function findProjectedPointForAssignment(
  pointId: string,
): Promise<ProjectedPoint | null> {
  const events = await getPointEvents();
  return projectPointById(events, pointId);
}

// ─── Write functions (transactional) ────────────────────────────────────────

/**
 * Atomically:
 *   1. Upserts operator profile: role → 'point_operator', mustChangePassword → true
 *   2. Inserts the active assignment row
 *
 * Rolls back if either step fails.
 */
export async function grantPointOperatorAssignmentTx(
  input: GrantAssignmentInput,
): Promise<PointOperatorAssignment> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");

    // 1. Load current profile (required to preserve existing fields)
    const currentProfile = await getUserProfile(input.operatorUserId);
    const updatedProfile: UserProfile = {
      ...(currentProfile ?? {
        id: input.operatorUserId,
        name: input.operatorUserId,
        email: null,
        XP: 0,
      }),
      id: input.operatorUserId,
      role: "point_operator",
      mustChangePassword: true,
    };

    // 2. Update profile within transaction (using raw query to stay in the tx)
    await client.query(
      `INSERT INTO public.profiles (id, name, email, xp, role, must_change_password)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (id) DO UPDATE SET
         role = EXCLUDED.role,
         must_change_password = EXCLUDED.must_change_password`,
      [
        updatedProfile.id,
        updatedProfile.name,
        updatedProfile.email,
        updatedProfile.XP,
        "point_operator",
        true,
      ],
    );

    // 3. Insert assignment
    const insertResult = await client.query<AssignmentRow>(
      `INSERT INTO public.point_operator_assignments
         (operator_user_id, point_id, status, granted_by, granted_at)
       VALUES ($1, $2, 'active', $3, NOW())
       RETURNING id, operator_user_id, point_id, status, granted_by, granted_at,
                 revoked_by, revoked_at, revoke_reason`,
      [input.operatorUserId, input.pointId, input.actorUserId],
    );

    await client.query("COMMIT");

    // Invalidate profile cache (best-effort — storage layer re-reads from DB)
    try {
      await upsertUserProfile(input.operatorUserId, updatedProfile);
    } catch {
      // Non-fatal: the DB is the source of truth; cache will be warm on next read
    }

    return rowToAssignment(insertResult.rows[0]);
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Atomically marks an assignment as revoked, recording who revoked it and why.
 * Historical rows remain immutable — we only update status/revoke fields.
 */
export async function revokePointOperatorAssignmentTx(
  input: RevokeAssignmentInput,
): Promise<PointOperatorAssignment> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");

    const updateResult = await client.query<AssignmentRow>(
      `UPDATE public.point_operator_assignments
       SET status = 'revoked',
           revoked_by = $1,
           revoked_at = NOW(),
           revoke_reason = $2
       WHERE operator_user_id = $3 AND status = 'active'
       RETURNING id, operator_user_id, point_id, status, granted_by, granted_at,
                 revoked_by, revoked_at, revoke_reason`,
      [input.actorUserId, input.revokeReason, input.operatorUserId],
    );

    if (!updateResult.rows.length) {
      await client.query("ROLLBACK");
      throw new Error("Active operator assignment not found");
    }

    await client.query("COMMIT");
    return rowToAssignment(updateResult.rows[0]);
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
