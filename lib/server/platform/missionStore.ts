// lib/server/platform/missionStore.ts
// Persistence + pure logic for the missions & gamification subproject.
// Isolation contract: mission_definitions reads/writes are scoped by
// organization_id; mission_assignments reads/writes are scoped via the
// owning mission (never a bare user_id/mission_id lookup without an org
// check at the API layer — see api.ts's requireOrgRole gates).
import { query } from "../db.js";
import type {
  MissionPeriod,
  MissionState,
  PlatformMission,
  PlatformMissionProgressEntry,
} from "../../../shared/platformTypes.js";
import type { QueryFn, StoreDeps } from "./orgStore.js";

function db(deps: StoreDeps): QueryFn {
  return deps.queryFn ?? (query as unknown as QueryFn);
}

function toIso(value: unknown): string {
  return value instanceof Date ? value.toISOString() : String(value);
}

// ─── Pure logic (no DB — unit-testable without mocks) ──────────────────────

/** current/quota clamped to [0, 1]; a non-positive quota can never progress. */
export function missionProgressFraction(current: number, quota: number): number {
  if (quota <= 0) return 0;
  return Math.min(Math.max(current, 0) / quota, 1);
}

/**
 * Pure lifecycle transition: pending -> in_progress -> completed / expired.
 * `completed` always wins once quota is reached, even past the deadline — a
 * collector who hit quota before the deadline keeps their reward regardless
 * of when this is recomputed. `expired` only applies to an incomplete
 * assignment whose deadline has passed. `pending` is the state before any
 * progress and before the deadline; `in_progress` is partial progress before
 * the deadline.
 */
export function computeMissionAssignmentState(input: {
  current: number;
  quota: number;
  deadline: string | null;
  now?: Date;
}): MissionState {
  if (input.quota > 0 && input.current >= input.quota) return "completed";
  const now = input.now ?? new Date();
  const deadlinePassed = input.deadline != null && new Date(input.deadline).getTime() < now.getTime();
  if (deadlinePassed) return "expired";
  if (input.current > 0) return "in_progress";
  return "pending";
}

/** Start of the mission's current period, in UTC. Daily = today 00:00 UTC; weekly = Monday 00:00 UTC. */
export function missionPeriodStart(period: MissionPeriod, now: Date = new Date()): Date {
  if (period === "daily") {
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  }
  const day = now.getUTCDay(); // 0 = Sunday .. 6 = Saturday
  const daysSinceMonday = (day + 6) % 7;
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - daysSinceMonday));
}

// ─── Row mapping ────────────────────────────────────────────────────────────

interface MissionDefinitionRow {
  id: string;
  organization_id: string;
  period: MissionPeriod;
  title_en: string;
  title_fr: string;
  quota: number;
  deadline: unknown;
  reward_xp: number;
  project_id: string | null;
  category: string | null;
  notes_en: string | null;
  notes_fr: string | null;
  created_by: string | null;
  created_at: unknown;
  updated_at: unknown;
}

export interface MissionDefinition {
  id: string;
  organizationId: string;
  period: MissionPeriod;
  titleEn: string;
  titleFr: string;
  quota: number;
  deadline: string | null;
  rewardXp: number;
  projectId: string | null;
  category: string | null;
  notesEn: string | null;
  notesFr: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

function rowToDefinition(row: MissionDefinitionRow): MissionDefinition {
  return {
    id: row.id,
    organizationId: row.organization_id,
    period: row.period,
    titleEn: row.title_en,
    titleFr: row.title_fr,
    quota: Number(row.quota),
    deadline: row.deadline == null ? null : toIso(row.deadline),
    rewardXp: Number(row.reward_xp),
    projectId: row.project_id,
    category: row.category,
    notesEn: row.notes_en,
    notesFr: row.notes_fr,
    createdBy: row.created_by,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

export interface MissionAssignmentRecord {
  id: string;
  missionId: string;
  userId: string;
  state: MissionState;
  current: number;
  completedAt: string | null;
  xpAwarded: boolean;
  createdAt: string;
  updatedAt: string;
}

function rowToAssignment(row: {
  id: string;
  mission_id: string;
  user_id: string;
  state: MissionState;
  current: number;
  completed_at: unknown;
  xp_awarded: boolean;
  created_at: unknown;
  updated_at: unknown;
}): MissionAssignmentRecord {
  return {
    id: row.id,
    missionId: row.mission_id,
    userId: row.user_id,
    state: row.state,
    current: Number(row.current ?? 0),
    completedAt: row.completed_at == null ? null : toIso(row.completed_at),
    xpAwarded: Boolean(row.xp_awarded),
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

function definitionToMission(
  definition: MissionDefinition,
  input: { current: number; state: MissionState; assignedUserIds: string[] | null },
): PlatformMission {
  return {
    id: definition.id,
    organizationId: definition.organizationId,
    period: definition.period,
    state: input.state,
    titleEn: definition.titleEn,
    titleFr: definition.titleFr,
    quota: definition.quota,
    current: input.current,
    rewardXp: definition.rewardXp,
    deadline: definition.deadline,
    projectId: definition.projectId,
    category: definition.category,
    notesEn: definition.notesEn,
    notesFr: definition.notesFr,
    assignedUserIds: input.assignedUserIds,
    createdAt: definition.createdAt,
    updatedAt: definition.updatedAt,
  };
}

const DEFINITION_COLUMNS =
  "id, organization_id, period, title_en, title_fr, quota, deadline, reward_xp, project_id, category, notes_en, notes_fr, created_by, created_at, updated_at";
const ASSIGNMENT_COLUMNS = "id, mission_id, user_id, state, current, completed_at, xp_awarded, created_at, updated_at";

// ─── Mission definitions ────────────────────────────────────────────────────

export async function createMissionDefinition(
  input: {
    organizationId: string;
    period: MissionPeriod;
    titleEn: string;
    titleFr: string;
    quota: number;
    deadline: string | null;
    rewardXp: number;
    projectId?: string | null;
    category?: string | null;
    notesEn?: string | null;
    notesFr?: string | null;
    createdBy: string | null;
  },
  deps: StoreDeps = {},
): Promise<MissionDefinition> {
  const result = await db(deps)(
    `INSERT INTO public.mission_definitions
       (organization_id, period, title_en, title_fr, quota, deadline, reward_xp, project_id, category, notes_en, notes_fr, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
     RETURNING ${DEFINITION_COLUMNS}`,
    [
      input.organizationId,
      input.period,
      input.titleEn,
      input.titleFr,
      input.quota,
      input.deadline,
      input.rewardXp,
      input.projectId ?? null,
      input.category ?? null,
      input.notesEn ?? null,
      input.notesFr ?? null,
      input.createdBy,
    ],
  );
  return rowToDefinition(result.rows[0]);
}

export async function getMissionDefinition(missionId: string, deps: StoreDeps = {}): Promise<MissionDefinition | null> {
  const result = await db(deps)(`SELECT ${DEFINITION_COLUMNS} FROM public.mission_definitions WHERE id = $1`, [missionId]);
  return result.rows[0] ? rowToDefinition(result.rows[0]) : null;
}

/**
 * Upserts today's (UTC) daily mission for an organization. Idempotent: a
 * second call for the same org+day is a no-op that returns the EXISTING row
 * — the INSERT's ON CONFLICT targets `mission_definitions_daily_once_per_org`
 * (see the migration), so concurrent/duplicate cron runs never create two
 * daily missions for the same org on the same day.
 */
export async function upsertDailyMissionDefinition(
  input: { organizationId: string; quota: number; rewardXp: number; titleEn: string; titleFr: string },
  deps: StoreDeps = {},
): Promise<{ mission: MissionDefinition; created: boolean }> {
  const run = db(deps);
  const inserted = await run(
    `INSERT INTO public.mission_definitions
       (organization_id, period, title_en, title_fr, quota, deadline, reward_xp, created_by)
     VALUES ($1, 'daily', $2, $3, $4, NULL, $5, NULL)
     ON CONFLICT (organization_id, (timezone('utc', created_at)::date)) WHERE period = 'daily'
     DO NOTHING
     RETURNING ${DEFINITION_COLUMNS}`,
    [input.organizationId, input.titleEn, input.titleFr, input.quota, input.rewardXp],
  );
  if (inserted.rows[0]) return { mission: rowToDefinition(inserted.rows[0]), created: true };

  const existing = await run(
    `SELECT ${DEFINITION_COLUMNS} FROM public.mission_definitions
     WHERE organization_id = $1 AND period = 'daily'
       AND timezone('utc', created_at)::date = timezone('utc', now())::date`,
    [input.organizationId],
  );
  if (!existing.rows[0]) throw new Error("Daily mission upsert conflicted but no existing row was found");
  return { mission: rowToDefinition(existing.rows[0]), created: false };
}

// ─── Assignments ────────────────────────────────────────────────────────────

/** Idempotent bulk-assign: re-assigning an already-assigned collector never disturbs their existing progress. */
export async function assignMissionToUsers(
  input: { missionId: string; userIds: string[] },
  deps: StoreDeps = {},
): Promise<void> {
  if (input.userIds.length === 0) return;
  const run = db(deps);
  for (const userId of input.userIds) {
    await run(
      `INSERT INTO public.mission_assignments (mission_id, user_id)
       VALUES ($1, $2)
       ON CONFLICT (mission_id, user_id) DO NOTHING`,
      [input.missionId, userId],
    );
  }
}

export async function listAssignmentsForMission(missionId: string, deps: StoreDeps = {}): Promise<MissionAssignmentRecord[]> {
  const result = await db(deps)(
    `SELECT ${ASSIGNMENT_COLUMNS} FROM public.mission_assignments WHERE mission_id = $1 ORDER BY created_at ASC`,
    [missionId],
  );
  return result.rows.map(rowToAssignment);
}

export async function getAssignment(missionId: string, userId: string, deps: StoreDeps = {}): Promise<MissionAssignmentRecord | null> {
  const result = await db(deps)(
    `SELECT ${ASSIGNMENT_COLUMNS} FROM public.mission_assignments WHERE mission_id = $1 AND user_id = $2`,
    [missionId, userId],
  );
  return result.rows[0] ? rowToAssignment(result.rows[0]) : null;
}

/**
 * Recomputes and persists one assignment's `current`/`state`. `xp_awarded`
 * is set the FIRST time (and only the first time) the assignment transitions
 * into `completed` — it is a sticky, one-way ledger flag: once true it stays
 * true even if a later recompute pushes `current` further past quota or the
 * deadline passes. `getMissionRewardXpTotalForUser` sums `reward_xp` for
 * every `xp_awarded = true` row, and `reconcileUserProfileXp`
 * (lib/server/xp.ts) adds that total alongside submission XP — so a mission
 * reward is granted exactly once, never double-counted, and never silently
 * dropped by a later reconcile. Returns `justCompleted: true` only on the
 * call that performs that first transition, so the caller can fire a
 * mission-completion audit event exactly once.
 */
export async function updateAssignmentProgress(
  input: { missionId: string; userId: string; current: number; quota: number; deadline: string | null; now?: Date },
  deps: StoreDeps = {},
): Promise<{ assignment: MissionAssignmentRecord; justCompleted: boolean }> {
  const existing = await getAssignment(input.missionId, input.userId, deps);
  if (!existing) throw new Error("Mission assignment not found");

  const nextState = computeMissionAssignmentState({
    current: input.current,
    quota: input.quota,
    deadline: input.deadline,
    now: input.now,
  });
  const justCompleted = nextState === "completed" && !existing.xpAwarded;

  const result = await db(deps)(
    `UPDATE public.mission_assignments
     SET current = $3,
         state = $4,
         completed_at = CASE WHEN $4 = 'completed' AND completed_at IS NULL THEN now() ELSE completed_at END,
         xp_awarded = xp_awarded OR $5,
         updated_at = now()
     WHERE mission_id = $1 AND user_id = $2
     RETURNING ${ASSIGNMENT_COLUMNS}`,
    [input.missionId, input.userId, input.current, nextState, justCompleted],
  );
  if (!result.rows[0]) throw new Error("Mission assignment not found");
  return { assignment: rowToAssignment(result.rows[0]), justCompleted };
}

/** Counts a collector's `platform_records` since a period start, optionally scoped to a project and/or record type ("category"). */
export async function countRecordSubmissionsSince(
  input: { organizationId: string; userId: string; since: string; projectId?: string | null; recordTypeKey?: string | null },
  deps: StoreDeps = {},
): Promise<number> {
  const result = await db(deps)(
    `SELECT COUNT(*)::int AS total
     FROM public.platform_records
     WHERE organization_id = $1
       AND captured_by = $2
       AND created_at >= $3::timestamptz
       AND ($4::uuid IS NULL OR project_id = $4)
       AND ($5::text IS NULL OR record_type_key = $5)`,
    [input.organizationId, input.userId, input.since, input.projectId ?? null, input.recordTypeKey ?? null],
  );
  return Number(result.rows[0]?.total ?? 0);
}

/**
 * Recomputes one collector's progress on a mission from their
 * `platform_records` since the mission's period start (today 00:00 UTC for
 * daily, this Monday 00:00 UTC for weekly), then persists it via
 * `updateAssignmentProgress`. `category` maps to `record_type_key` — the
 * platform_records schema has no separate "category" column.
 */
export async function refreshAssignmentProgress(
  input: { mission: MissionDefinition; userId: string; now?: Date },
  deps: StoreDeps = {},
): Promise<{ assignment: MissionAssignmentRecord; justCompleted: boolean }> {
  const now = input.now ?? new Date();
  const since = missionPeriodStart(input.mission.period, now).toISOString();
  const current = await countRecordSubmissionsSince(
    {
      organizationId: input.mission.organizationId,
      userId: input.userId,
      since,
      projectId: input.mission.projectId,
      recordTypeKey: input.mission.category,
    },
    deps,
  );
  return updateAssignmentProgress(
    {
      missionId: input.mission.id,
      userId: input.userId,
      current,
      quota: input.mission.quota,
      deadline: input.mission.deadline,
      now,
    },
    deps,
  );
}

/** Sum of `reward_xp` for every mission this user has been granted the reward for — the mission-reward XP ledger total. */
export async function getMissionRewardXpTotalForUser(userId: string, deps: StoreDeps = {}): Promise<number> {
  const result = await db(deps)(
    `SELECT COALESCE(SUM(d.reward_xp), 0)::int AS total
     FROM public.mission_assignments a
     JOIN public.mission_definitions d ON d.id = a.mission_id
     WHERE a.user_id = $1 AND a.xp_awarded = true`,
    [userId],
  );
  return Number(result.rows[0]?.total ?? 0);
}

// ─── Listing / role-scoped views ────────────────────────────────────────────

/** Collector view: only missions this user is assigned to, with THEIR OWN current/state. */
export async function listMissionsForCollector(
  input: { organizationId: string; userId: string },
  deps: StoreDeps = {},
): Promise<PlatformMission[]> {
  const result = await db(deps)(
    `SELECT d.*, a.current AS a_current, a.state AS a_state
     FROM public.mission_definitions d
     JOIN public.mission_assignments a ON a.mission_id = d.id
     WHERE d.organization_id = $1 AND a.user_id = $2
     ORDER BY d.created_at DESC`,
    [input.organizationId, input.userId],
  );
  return result.rows.map((row: MissionDefinitionRow & { a_current: number; a_state: MissionState }) =>
    definitionToMission(rowToDefinition(row), { current: Number(row.a_current ?? 0), state: row.a_state, assignedUserIds: null }),
  );
}

/**
 * Manager/owner view: every mission in the org. `current` and `state` are an
 * org-wide rollup — the sum of every assigned collector's progress compared
 * against the same quota — NOT any single collector's state. Use
 * `mission_progress` (listMissionProgress) for the per-collector breakdown.
 */
export async function listMissionsForManager(organizationId: string, deps: StoreDeps = {}): Promise<PlatformMission[]> {
  const result = await db(deps)(
    `SELECT d.*,
            COALESCE(SUM(a.current), 0)::int AS total_current,
            COALESCE(array_agg(a.user_id) FILTER (WHERE a.user_id IS NOT NULL), '{}') AS assigned_user_ids
     FROM public.mission_definitions d
     LEFT JOIN public.mission_assignments a ON a.mission_id = d.id
     WHERE d.organization_id = $1
     GROUP BY d.id
     ORDER BY d.created_at DESC`,
    [organizationId],
  );
  return result.rows.map((row: MissionDefinitionRow & { total_current: number; assigned_user_ids: string[] }) => {
    const definition = rowToDefinition(row);
    const current = Number(row.total_current ?? 0);
    const state = computeMissionAssignmentState({ current, quota: definition.quota, deadline: definition.deadline });
    return definitionToMission(definition, {
      current,
      state,
      assignedUserIds: Array.isArray(row.assigned_user_ids) ? row.assigned_user_ids : [],
    });
  });
}

/** Per-collector progress breakdown for one mission (`mission_progress` API view). */
export async function listMissionProgress(missionId: string, deps: StoreDeps = {}): Promise<PlatformMissionProgressEntry[]> {
  const assignments = await listAssignmentsForMission(missionId, deps);
  return assignments.map((a) => ({ userId: a.userId, current: a.current, state: a.state }));
}
