import type { PoolClient, QueryResult } from "pg";
import type {
  PointEvent,
  PointOperatorAssignment,
  ProjectedPoint,
} from "../../shared/types.js";
import { getPool, query } from "./db.js";
import { projectPointById } from "./pointProjection.js";
import { getPointEvents } from "./storage/index.js";

const ASSIGNMENT_COLUMNS = `
  id,
  operator_user_id,
  point_id,
  status,
  granted_by,
  granted_at,
  revoked_by,
  revoked_at,
  revoke_reason
`;

type QueryResultLike<T = Record<string, unknown>> = {
  rows: T[];
  rowCount: number | null;
};

type QueryFn = (
  text: string,
  values?: unknown[],
) => Promise<QueryResultLike<Record<string, unknown>>>;

export interface PointOperatorTransactionClient {
  query(
    text: string,
    values?: unknown[],
  ): Promise<QueryResultLike<Record<string, unknown>>>;
  release(): void;
}

export interface PreparedExistingPointOperatorProfile {
  kind: "existing";
  userId: string;
  mustChangePassword: boolean;
}

export interface PreparedNewPointOperatorProfile {
  kind: "new";
  userId: string;
  email: string | null;
  phone: string | null;
  name: string;
  passwordHash: string;
  mustChangePassword: boolean;
}

export type PreparedPointOperatorProfile =
  | PreparedExistingPointOperatorProfile
  | PreparedNewPointOperatorProfile;

export interface GrantAssignmentInput {
  actorUserId: string;
  operatorUserId: string;
  pointId: string;
  profile: PreparedPointOperatorProfile;
}

export interface RevokeAssignmentInput {
  assignmentId: string;
  actorUserId: string;
  operatorUserId: string;
  reason: string;
}

export interface PointOperatorStore {
  getActivePointOperatorAssignmentByUser(
    userId: string,
  ): Promise<PointOperatorAssignment | null>;
  getActivePointOperatorAssignmentByPoint(
    pointId: string,
  ): Promise<PointOperatorAssignment | null>;
  listPointOperatorAssignmentHistory(
    pointId: string,
  ): Promise<PointOperatorAssignment[]>;
  findProjectedPointForAssignment(pointId: string): Promise<ProjectedPoint | null>;
  grantPointOperatorAssignmentTx(
    input: GrantAssignmentInput,
  ): Promise<PointOperatorAssignment>;
  revokePointOperatorAssignmentTx(
    input: RevokeAssignmentInput,
  ): Promise<PointOperatorAssignment>;
}

export interface PointOperatorStoreDeps {
  queryFn?: QueryFn;
  connectFn?: () => Promise<PointOperatorTransactionClient>;
  getPointEventsFn?: () => Promise<PointEvent[]>;
}

function normalizeUserId(value: string): string {
  return value.trim().toLowerCase();
}

function normalizePointId(value: string): string {
  return value.trim();
}

function normalizeAssignmentId(value: string): string {
  return value.trim().toLowerCase();
}

function toIsoString(value: unknown): string {
  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) {
    throw new Error("Invalid assignment timestamp");
  }
  return date.toISOString();
}

function nullableIsoString(value: unknown): string | null {
  return value === null || value === undefined ? null : toIsoString(value);
}

function rowToAssignment(
  row: Record<string, unknown>,
): PointOperatorAssignment {
  const status = row.status === "revoked" ? "revoked" : "active";
  return {
    id: normalizeAssignmentId(String(row.id ?? "")),
    operatorUserId: normalizeUserId(String(row.operator_user_id ?? "")),
    pointId: normalizePointId(String(row.point_id ?? "")),
    status,
    grantedBy: normalizeUserId(String(row.granted_by ?? "")),
    grantedAt: toIsoString(row.granted_at),
    revokedBy:
      row.revoked_by === null || row.revoked_by === undefined
        ? null
        : normalizeUserId(String(row.revoked_by)),
    revokedAt: nullableIsoString(row.revoked_at),
    revokeReason:
      typeof row.revoke_reason === "string" ? row.revoke_reason : null,
  };
}

async function prepareProfileForAssignment(
  client: PointOperatorTransactionClient,
  profile: PreparedPointOperatorProfile,
): Promise<void> {
  if (profile.kind === "existing") {
    const result = await client.query(
      `
        update user_profiles
        set
          role = 'point_operator',
          is_admin = false,
          map_scope = 'bonamoussadi',
          must_change_password = $2,
          updated_at = now()
        where id = $1
          and coalesce(is_admin, false) = false
          and role <> 'admin'
        returning id
      `,
      [
        normalizeUserId(profile.userId),
        profile.mustChangePassword,
      ],
    );
    if (result.rowCount !== 1) {
      throw new Error("Operator profile not found or is not assignable");
    }
    return;
  }

  const result = await client.query(
    `
      insert into user_profiles (
        id,
        email,
        phone,
        name,
        password_hash,
        is_admin,
        role,
        map_scope,
        must_change_password,
        updated_at
      )
      values ($1, $2, $3, $4, $5, false, 'point_operator', 'bonamoussadi', $6, now())
      returning id
    `,
    [
      normalizeUserId(profile.userId),
      profile.email?.trim().toLowerCase() || null,
      profile.phone?.trim() || null,
      profile.name.trim(),
      profile.passwordHash,
      profile.mustChangePassword,
    ],
  );
  if (result.rowCount !== 1) {
    throw new Error("Point operator profile could not be created");
  }
}

export function createPointOperatorStore(
  deps: PointOperatorStoreDeps = {},
): PointOperatorStore {
  const queryFn: QueryFn =
    deps.queryFn ??
    (async (text, values = []) =>
      (await query<Record<string, unknown>>(
        text,
        values,
      )) as QueryResult<Record<string, unknown>>);
  const connectFn =
    deps.connectFn ??
    (async () => (await getPool().connect()) as PoolClient);
  const getPointEventsFn = deps.getPointEventsFn ?? (() => getPointEvents());

  async function withTransaction<T>(
    operation: (client: PointOperatorTransactionClient) => Promise<T>,
  ): Promise<T> {
    const client = await connectFn();
    try {
      await client.query("BEGIN");
      const result = await operation(client);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      try {
        await client.query("ROLLBACK");
      } catch {
        // Preserve the operation error; the pool will discard a broken client.
      }
      throw error;
    } finally {
      client.release();
    }
  }

  async function getActivePointOperatorAssignmentByUser(
    userId: string,
  ): Promise<PointOperatorAssignment | null> {
    const result = await queryFn(
      `
        select ${ASSIGNMENT_COLUMNS}
        from point_operator_assignments
        where operator_user_id = $1
          and status = 'active'
        limit 1
      `,
      [normalizeUserId(userId)],
    );
    return result.rows[0] ? rowToAssignment(result.rows[0]) : null;
  }

  async function getActivePointOperatorAssignmentByPoint(
    pointId: string,
  ): Promise<PointOperatorAssignment | null> {
    const result = await queryFn(
      `
        select ${ASSIGNMENT_COLUMNS}
        from point_operator_assignments
        where point_id = $1
          and status = 'active'
        limit 1
      `,
      [normalizePointId(pointId)],
    );
    return result.rows[0] ? rowToAssignment(result.rows[0]) : null;
  }

  async function listPointOperatorAssignmentHistory(
    pointId: string,
  ): Promise<PointOperatorAssignment[]> {
    const result = await queryFn(
      `
        select ${ASSIGNMENT_COLUMNS}
        from point_operator_assignments
        where point_id = $1
        order by granted_at desc
      `,
      [normalizePointId(pointId)],
    );
    return result.rows.map(rowToAssignment);
  }

  async function findProjectedPointForAssignment(
    pointId: string,
  ): Promise<ProjectedPoint | null> {
    const normalizedPointId = normalizePointId(pointId);
    const events = await getPointEventsFn();
    return projectPointById(events, normalizedPointId);
  }

  async function grantPointOperatorAssignmentTx(
    input: GrantAssignmentInput,
  ): Promise<PointOperatorAssignment> {
    const actorUserId = normalizeUserId(input.actorUserId);
    const operatorUserId = normalizeUserId(input.operatorUserId);
    const pointId = normalizePointId(input.pointId);

    return await withTransaction(async (client) => {
      await prepareProfileForAssignment(client, input.profile);
      const result = await client.query(
        `
          insert into point_operator_assignments (
            operator_user_id,
            point_id,
            status,
            granted_by
          )
          values ($1, $2, 'active', $3)
          returning ${ASSIGNMENT_COLUMNS}
        `,
        [operatorUserId, pointId, actorUserId],
      );
      const row = result.rows[0];
      if (!row) throw new Error("Point operator assignment was not created");
      return rowToAssignment(row);
    });
  }

  async function revokePointOperatorAssignmentTx(
    input: RevokeAssignmentInput,
  ): Promise<PointOperatorAssignment> {
    const assignmentId = normalizeAssignmentId(input.assignmentId);
    const actorUserId = normalizeUserId(input.actorUserId);
    const operatorUserId = normalizeUserId(input.operatorUserId);
    const reason = input.reason.trim();

    return await withTransaction(async (client) => {
      const result = await client.query(
        `
          update point_operator_assignments
          set
            status = 'revoked',
            revoked_by = $2,
            revoked_at = now(),
            revoke_reason = $3
          where id = $1::uuid
            and operator_user_id = $4
            and status = 'active'
          returning ${ASSIGNMENT_COLUMNS}
        `,
        [assignmentId, actorUserId, reason, operatorUserId],
      );
      const row = result.rows[0];
      if (!row) throw new Error("Active operator assignment not found");
      return rowToAssignment(row);
    });
  }

  return {
    getActivePointOperatorAssignmentByUser,
    getActivePointOperatorAssignmentByPoint,
    listPointOperatorAssignmentHistory,
    findProjectedPointForAssignment,
    grantPointOperatorAssignmentTx,
    revokePointOperatorAssignmentTx,
  };
}

const defaultStore = createPointOperatorStore();

export const getActivePointOperatorAssignmentByUser =
  defaultStore.getActivePointOperatorAssignmentByUser;
export const getActivePointOperatorAssignmentByPoint =
  defaultStore.getActivePointOperatorAssignmentByPoint;
export const listPointOperatorAssignmentHistory =
  defaultStore.listPointOperatorAssignmentHistory;
export const findProjectedPointForAssignment =
  defaultStore.findProjectedPointForAssignment;
export const grantPointOperatorAssignmentTx =
  defaultStore.grantPointOperatorAssignmentTx;
export const revokePointOperatorAssignmentTx =
  defaultStore.revokePointOperatorAssignmentTx;
