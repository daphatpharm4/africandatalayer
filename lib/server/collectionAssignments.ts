import { query } from "./db.js";
import { getCollectionZone, BONAMOUSSADI_COLLECTION_ZONES } from "../../shared/collectionZones.js";
import type {
  AssignmentPlannerContext,
  CollectionAssignment,
  CollectionAssignmentCreateInput,
  CollectionAssignmentStatus,
  CollectionAssignmentUpdateInput,
  PointEvent,
  SubmissionCategory,
  ZoneBounds,
} from "../../shared/types.js";
import { isValidCategory } from "../../shared/verticals.js";

type AssignmentDbRow = {
  id: string;
  agent_user_id: string;
  zone_id: string;
  zone_label: string;
  zone_bounds: unknown;
  assigned_verticals: string[];
  assigned_date: string | Date;
  due_date: string | Date;
  status: CollectionAssignmentStatus;
  points_expected: number;
  points_submitted: number;
  completion_rate: number | string;
  notes: string | null;
  created_at: string | Date;
  updated_at: string | Date;
};

interface ListAssignmentsOptions {
  viewerUserId: string;
  isAdmin: boolean;
  status?: CollectionAssignmentStatus | null;
  agentUserId?: string | null;
}

function dateOnly(input: string | Date): string {
  const parsed = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(parsed.getTime())) return new Date().toISOString().slice(0, 10);
  return parsed.toISOString().slice(0, 10);
}

function isoTimestamp(input: string | Date): string {
  const parsed = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(parsed.getTime())) return new Date().toISOString();
  return parsed.toISOString();
}

function normalizeZoneBounds(input: unknown): ZoneBounds {
  const raw = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  const south = Number(raw.south);
  const west = Number(raw.west);
  const north = Number(raw.north);
  const east = Number(raw.east);
  if (!Number.isFinite(south) || !Number.isFinite(west) || !Number.isFinite(north) || !Number.isFinite(east)) {
    return { south: 0, west: 0, north: 0, east: 0 };
  }
  return { south, west, north, east };
}

function toCollectionAssignment(row: AssignmentDbRow): CollectionAssignment {
  return {
    id: row.id,
    agentUserId: row.agent_user_id,
    zoneId: row.zone_id,
    zoneLabel: row.zone_label,
    zoneBounds: normalizeZoneBounds(row.zone_bounds),
    assignedVerticals: (Array.isArray(row.assigned_verticals) ? row.assigned_verticals : []).filter((v): v is SubmissionCategory => isValidCategory(v)),
    assignedDate: dateOnly(row.assigned_date),
    dueDate: dateOnly(row.due_date),
    status: row.status,
    pointsExpected: Number(row.points_expected) || 0,
    pointsSubmitted: Number(row.points_submitted) || 0,
    completionRate: Number(row.completion_rate) || 0,
    notes: row.notes ?? null,
    createdAt: isoTimestamp(row.created_at),
    updatedAt: isoTimestamp(row.updated_at),
  };
}

function normalizeDateInput(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const trimmed = input.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null;
  const parsed = new Date(`${trimmed}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  return trimmed;
}

function normalizeNotes(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const trimmed = input.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, 1000);
}

function normalizeStatus(input: unknown): CollectionAssignmentStatus | null {
  if (typeof input !== "string") return null;
  const normalized = input.trim().toLowerCase();
  if (normalized === "pending" || normalized === "in_progress" || normalized === "completed" || normalized === "expired") {
    return normalized;
  }
  return null;
}

function normalizePointsExpected(input: unknown, fallback = 0): number {
  const value = typeof input === "number" ? input : Number(input);
  if (!Number.isFinite(value)) return fallback;
  return Math.max(0, Math.round(value));
}

function normalizeAssignedVerticals(input: unknown): SubmissionCategory[] {
  if (!Array.isArray(input)) return [];
  const clean = input
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .filter((value): value is SubmissionCategory => isValidCategory(value));
  return Array.from(new Set(clean));
}

async function refreshAssignmentProgress(): Promise<void> {
  await query(
    `
      UPDATE collection_assignments
      SET
        status = 'expired',
        updated_at = now()
      WHERE status IN ('pending', 'in_progress')
        AND due_date < CURRENT_DATE
    `,
  );

  await query(
    `
      WITH computed AS (
        SELECT
          a.id,
          COUNT(pe.id)::int AS points_submitted
        FROM collection_assignments a
        LEFT JOIN point_events pe
          ON pe.user_id = a.agent_user_id
          AND pe.category = ANY(a.assigned_verticals)
          AND pe.created_at::date BETWEEN a.assigned_date AND a.due_date
          AND pe.latitude BETWEEN (a.zone_bounds->>'south')::double precision AND (a.zone_bounds->>'north')::double precision
          AND pe.longitude BETWEEN (a.zone_bounds->>'west')::double precision AND (a.zone_bounds->>'east')::double precision
        GROUP BY a.id
      )
      UPDATE collection_assignments a
      SET
        points_submitted = computed.points_submitted,
        status = CASE
          WHEN a.status = 'expired' THEN a.status
          WHEN a.points_expected > 0 AND computed.points_submitted >= a.points_expected THEN 'completed'
          WHEN computed.points_submitted > 0 AND a.status = 'pending' THEN 'in_progress'
          ELSE a.status
        END,
        updated_at = CASE
          WHEN a.points_submitted IS DISTINCT FROM computed.points_submitted
            OR (
              CASE
                WHEN a.status = 'expired' THEN a.status
                WHEN a.points_expected > 0 AND computed.points_submitted >= a.points_expected THEN 'completed'
                WHEN computed.points_submitted > 0 AND a.status = 'pending' THEN 'in_progress'
                ELSE a.status
              END
            ) IS DISTINCT FROM a.status
          THEN now()
          ELSE a.updated_at
        END
      FROM computed
      WHERE computed.id = a.id
    `,
  );
}

export async function listAssignments(options: ListAssignmentsOptions): Promise<CollectionAssignment[]> {
  await refreshAssignmentProgress();

  const conditions: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  if (options.isAdmin) {
    if (options.agentUserId) {
      conditions.push(`agent_user_id = $${idx++}`);
      values.push(options.agentUserId);
    }
  } else {
    conditions.push(`agent_user_id = $${idx++}`);
    values.push(options.viewerUserId);
  }

  if (options.status) {
    conditions.push(`status = $${idx++}`);
    values.push(options.status);
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const result = await query<AssignmentDbRow>(
    `
      SELECT
        id,
        agent_user_id,
        zone_id,
        zone_label,
        zone_bounds,
        assigned_verticals,
        assigned_date,
        due_date,
        status,
        points_expected,
        points_submitted,
        completion_rate,
        notes,
        created_at,
        updated_at
      FROM collection_assignments
      ${where}
      ORDER BY due_date ASC, created_at DESC
    `,
    values,
  );

  return result.rows.map(toCollectionAssignment);
}

export async function getPlannerContext(): Promise<AssignmentPlannerContext> {
  const agentResult = await query<{ id: string; name: string | null; email: string | null }>(
    `
      SELECT id, name, email
      FROM user_profiles
      WHERE COALESCE(is_admin, false) = false
      ORDER BY COALESCE(NULLIF(name, ''), id) ASC
      LIMIT 200
    `,
  );

  return {
    zones: BONAMOUSSADI_COLLECTION_ZONES.map((zone) => ({ id: zone.id, label: zone.label, bounds: zone.bounds })),
    agents: agentResult.rows.map((row) => ({
      id: row.id,
      name: (row.name ?? "").trim() || row.id,
      email: row.email,
    })),
  };
}

export async function createAssignment(input: CollectionAssignmentCreateInput): Promise<CollectionAssignment> {
  const agentUserId = typeof input.agentUserId === "string" ? input.agentUserId.trim().toLowerCase() : "";
  if (!agentUserId) {
    throw new Error("agentUserId is required");
  }

  const agentExists = await query<{ id: string }>(
    `SELECT id FROM user_profiles WHERE id = $1 LIMIT 1`,
    [agentUserId],
  );
  if (!agentExists.rows[0]) {
    throw new Error("Agent user was not found");
  }

  const zoneId = typeof input.zoneId === "string" ? input.zoneId.trim().toLowerCase() : "";
  const zone = getCollectionZone(zoneId);
  if (!zone) {
    throw new Error("Invalid zoneId");
  }

  const assignedVerticals = normalizeAssignedVerticals(input.assignedVerticals);
  if (!assignedVerticals.length) {
    throw new Error("At least one assigned vertical is required");
  }

  const dueDate = normalizeDateInput(input.dueDate);
  if (!dueDate) {
    throw new Error("Invalid dueDate (expected YYYY-MM-DD)");
  }

  const assignedDate = normalizeDateInput(input.assignedDate) ?? new Date().toISOString().slice(0, 10);
  const pointsExpected = normalizePointsExpected(input.pointsExpected, 0);
  const notes = normalizeNotes(input.notes);

  const result = await query<AssignmentDbRow>(
    `
      INSERT INTO collection_assignments (
        agent_user_id,
        zone_id,
        zone_label,
        zone_bounds,
        assigned_verticals,
        assigned_date,
        due_date,
        points_expected,
        notes
      )
      VALUES ($1, $2, $3, $4::jsonb, $5::text[], $6::date, $7::date, $8, $9)
      RETURNING
        id,
        agent_user_id,
        zone_id,
        zone_label,
        zone_bounds,
        assigned_verticals,
        assigned_date,
        due_date,
        status,
        points_expected,
        points_submitted,
        completion_rate,
        notes,
        created_at,
        updated_at
    `,
    [agentUserId, zone.id, zone.label, JSON.stringify(zone.bounds), assignedVerticals, assignedDate, dueDate, pointsExpected, notes],
  );

  const row = result.rows[0];
  if (!row) throw new Error("Unable to create assignment");
  return toCollectionAssignment(row);
}

export async function updateAssignment(
  assignmentId: string,
  input: CollectionAssignmentUpdateInput,
): Promise<CollectionAssignment | null> {
  const id = assignmentId.trim();
  if (!id) return null;

  const updates: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  if (input.status !== undefined) {
    const status = normalizeStatus(input.status);
    if (!status) throw new Error("Invalid assignment status");
    updates.push(`status = $${idx++}`);
    values.push(status);
  }

  if (input.pointsSubmitted !== undefined) {
    const pointsSubmitted = normalizePointsExpected(input.pointsSubmitted, 0);
    updates.push(`points_submitted = $${idx++}`);
    values.push(pointsSubmitted);
  }

  if (input.notes !== undefined) {
    updates.push(`notes = $${idx++}`);
    values.push(normalizeNotes(input.notes));
  }

  if (!updates.length) {
    const existing = await query<AssignmentDbRow>(
      `
        SELECT
          id,
          agent_user_id,
          zone_id,
          zone_label,
          zone_bounds,
          assigned_verticals,
          assigned_date,
          due_date,
          status,
          points_expected,
          points_submitted,
          completion_rate,
          notes,
          created_at,
          updated_at
        FROM collection_assignments
        WHERE id = $1::uuid
        LIMIT 1
      `,
      [id],
    );
    const row = existing.rows[0];
    return row ? toCollectionAssignment(row) : null;
  }

  values.push(id);
  const result = await query<AssignmentDbRow>(
    `
      UPDATE collection_assignments
      SET
        ${updates.join(", ")},
        updated_at = now()
      WHERE id = $${idx}::uuid
      RETURNING
        id,
        agent_user_id,
        zone_id,
        zone_label,
        zone_bounds,
        assigned_verticals,
        assigned_date,
        due_date,
        status,
        points_expected,
        points_submitted,
        completion_rate,
        notes,
        created_at,
        updated_at
    `,
    values,
  );

  const row = result.rows[0];
  return row ? toCollectionAssignment(row) : null;
}

export async function getAssignmentById(assignmentId: string): Promise<CollectionAssignment | null> {
  const id = assignmentId.trim();
  if (!id) return null;
  const result = await query<AssignmentDbRow>(
    `
      SELECT
        id,
        agent_user_id,
        zone_id,
        zone_label,
        zone_bounds,
        assigned_verticals,
        assigned_date,
        due_date,
        status,
        points_expected,
        points_submitted,
        completion_rate,
        notes,
        created_at,
        updated_at
      FROM collection_assignments
      WHERE id = $1::uuid
      LIMIT 1
    `,
    [id],
  );
  const row = result.rows[0];
  return row ? toCollectionAssignment(row) : null;
}

export async function incrementAssignmentsForEvent(event: PointEvent): Promise<void> {
  const userId = typeof event.userId === "string" ? event.userId.trim().toLowerCase() : "";
  if (!userId) return;
  try {
    await query(
      `
        UPDATE collection_assignments
        SET
          points_submitted = points_submitted + 1,
          status = CASE
            WHEN points_expected > 0 AND points_submitted + 1 >= points_expected THEN 'completed'
            WHEN status = 'pending' THEN 'in_progress'
            ELSE status
          END,
          updated_at = now()
        WHERE agent_user_id = $1
          AND $2 = ANY(assigned_verticals)
          AND $3::date BETWEEN assigned_date AND due_date
          AND $4::double precision BETWEEN (zone_bounds->>'south')::double precision AND (zone_bounds->>'north')::double precision
          AND $5::double precision BETWEEN (zone_bounds->>'west')::double precision AND (zone_bounds->>'east')::double precision
          AND status IN ('pending', 'in_progress')
      `,
      [userId, event.category, event.createdAt, event.location.latitude, event.location.longitude],
    );
  } catch (error) {
    const code = (error as { code?: unknown } | null)?.code;
    if (code === "42P01") return;
    throw error;
  }
}
