import type { PoolClient, QueryResult } from "pg";
import type {
  PointOperatorAssignment,
  ProjectedPoint,
} from "../../shared/types.js";
import { getPool, query } from "./db.js";
import {
  findReadableProjectedPoint,
  type ReadablePointSource,
  type ReadableProjectedPoint,
} from "./submissionEvents.js";

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
  release(error?: Error): void;
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
  pointSource: ReadablePointSource;
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
  findReadablePointFn?: (pointId: string) => Promise<ReadableProjectedPoint | null>;
}

export class PointOperatorDataIntegrityError extends Error {
  readonly code = "point_operator_data_integrity";

  constructor(message: string) {
    super(message);
    this.name = "PointOperatorDataIntegrityError";
  }
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

function samePointSource(
  left: ReadablePointSource,
  right: ReadablePointSource,
): boolean {
  if (left.kind !== right.kind) return false;
  if (left.kind === "point_event") return true;
  if (left.kind === "legacy_submission") {
    return (
      right.kind === "legacy_submission" &&
      left.submissionId === right.submissionId
    );
  }
  return right.kind === "curated_seed" && left.eventId === right.eventId;
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

function requiredString(value: unknown, field: string): string {
  const normalized = String(value ?? "").trim();
  if (!normalized) {
    throw new PointOperatorDataIntegrityError(
      `Corrupt point operator assignment: missing ${field}`,
    );
  }
  return normalized;
}

function rowToAssignment(
  row: Record<string, unknown>,
): PointOperatorAssignment {
  if (row.status !== "active" && row.status !== "revoked") {
    throw new PointOperatorDataIntegrityError(
      "Corrupt point operator assignment: invalid status",
    );
  }
  const status = row.status;
  let grantedAt: string;
  let revokedAt: string | null;
  try {
    grantedAt = toIsoString(row.granted_at);
    revokedAt = nullableIsoString(row.revoked_at);
  } catch {
    throw new PointOperatorDataIntegrityError(
      "Corrupt point operator assignment: invalid timestamp",
    );
  }
  const revokedBy =
    row.revoked_by === null || row.revoked_by === undefined
      ? null
      : normalizeUserId(requiredString(row.revoked_by, "revoked_by"));
  if (status === "active" && (revokedBy !== null || revokedAt !== null)) {
    throw new PointOperatorDataIntegrityError(
      "Corrupt point operator assignment: active row contains revocation data",
    );
  }
  if (status === "revoked" && (revokedBy === null || revokedAt === null)) {
    throw new PointOperatorDataIntegrityError(
      "Corrupt point operator assignment: revoked row lacks revocation data",
    );
  }
  return {
    id: normalizeAssignmentId(requiredString(row.id, "id")),
    operatorUserId: normalizeUserId(
      requiredString(row.operator_user_id, "operator_user_id"),
    ),
    pointId: normalizePointId(requiredString(row.point_id, "point_id")),
    status,
    grantedBy: normalizeUserId(requiredString(row.granted_by, "granted_by")),
    grantedAt,
    revokedBy,
    revokedAt,
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
  const findReadablePointFn =
    deps.findReadablePointFn ?? findReadableProjectedPoint;

  async function withTransaction<T>(
    operation: (client: PointOperatorTransactionClient) => Promise<T>,
  ): Promise<T> {
    const client = await connectFn();
    let releaseError: Error | undefined;
    let commitStarted = false;
    try {
      await client.query("BEGIN");
      const result = await operation(client);
      commitStarted = true;
      await client.query("COMMIT");
      return result;
    } catch (error) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        releaseError =
          rollbackError instanceof Error
            ? rollbackError
            : error instanceof Error
              ? error
              : new Error("Point operator transaction rollback failed");
      }
      if (commitStarted && !releaseError) {
        releaseError =
          error instanceof Error
            ? error
            : new Error("Point operator transaction commit failed");
      }
      throw error;
    } finally {
      client.release(releaseError);
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
    return (await findReadablePointFn(normalizedPointId))?.point ?? null;
  }

  async function grantPointOperatorAssignmentInTransaction(
    input: GrantAssignmentInput,
    canonicalSource: ReadablePointSource,
  ): Promise<PointOperatorAssignment> {
    const actorUserId = normalizeUserId(input.actorUserId);
    const operatorUserId = normalizeUserId(input.operatorUserId);
    const pointId = normalizePointId(input.pointId);

    return await withTransaction(async (client) => {
      await prepareProfileForAssignment(client, input.profile);
      if (canonicalSource.kind === "point_event") {
        const pointResult = await client.query(
          `
            select point_id
            from point_events
            where point_id = $1
            limit 1
            for share
          `,
          [pointId],
        );
        if (pointResult.rowCount !== 1) {
          throw new Error("Verified point not found");
        }
      }
      // Legacy and curated seed points live outside Postgres and cannot be
      // locked in this transaction without first materializing them. The
      // public store wrapper performs an immediate canonical revalidation and
      // verifies explicit source provenance so this limitation cannot be silent.
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

  async function grantPointOperatorAssignmentTx(
    input: GrantAssignmentInput,
  ): Promise<PointOperatorAssignment> {
    const operatorUserId = normalizeUserId(input.operatorUserId);
    const pointId = normalizePointId(input.pointId);
    const profileUserId = normalizeUserId(input.profile.userId);
    if (profileUserId !== operatorUserId) {
      throw new Error("Prepared profile user does not match operator");
    }

    // This canonical lookup is intentionally inside the public store boundary,
    // immediately before acquiring the transaction client. Callers may provide
    // expected provenance, but they cannot bypass verification with forged
    // legacy or curated-seed identifiers.
    const canonicalPoint = await findReadablePointFn(pointId);
    if (!canonicalPoint || canonicalPoint.point.pointId !== pointId) {
      throw new Error("Verified point not found");
    }
    if (!samePointSource(input.pointSource, canonicalPoint.source)) {
      throw new Error("Verified point source changed before assignment");
    }

    return await grantPointOperatorAssignmentInTransaction(
      input,
      canonicalPoint.source,
    );
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
