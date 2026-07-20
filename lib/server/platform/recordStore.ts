import type { PlatformRecord, PlatformRecordEvidence, PlatformRecordSummary } from "../../../shared/platformTypes.js";
import { query } from "../db.js";
import type { QueryFn, StoreDeps } from "./orgStore.js";

function db(deps: StoreDeps): QueryFn {
  return deps.queryFn ?? (query as unknown as QueryFn);
}

function toIso(value: unknown): string {
  return value instanceof Date ? value.toISOString() : String(value);
}

function rowToRecord(row: any): PlatformRecord {
  return {
    id: row.id,
    projectId: row.project_id,
    organizationId: row.organization_id,
    schemaVersionId: row.schema_version_id,
    recordTypeKey: row.record_type_key,
    data: typeof row.data === "string" ? JSON.parse(row.data) : row.data,
    evidence: (typeof row.evidence === "string" ? JSON.parse(row.evidence) : row.evidence) as PlatformRecordEvidence,
    status: row.status,
    capturedBy: row.captured_by,
    createdAt: toIso(row.created_at),
    pointId: row.point_id ?? null,
    reviewedBy: row.reviewed_by ?? null,
    reviewedAt: row.reviewed_at ? toIso(row.reviewed_at) : null,
    reviewNotes: row.review_notes ?? null,
  };
}

export class PlatformRecordIdempotencyConflictError extends Error {
  constructor() {
    super("Idempotency key reused with a different record");
    this.name = "PlatformRecordIdempotencyConflictError";
  }
}

export async function createRecord(
  input: {
    organizationId: string;
    projectId: string;
    schemaVersionId: string;
    recordTypeKey: string;
    data: Record<string, unknown>;
    evidence: PlatformRecordEvidence;
    capturedBy: string;
    idempotencyKey: string;
    requestHash: string;
    pointId?: string | null;
    captureLat?: number | null;
    captureLng?: number | null;
  },
  deps: StoreDeps = {},
): Promise<PlatformRecord> {
  const result = await db(deps)(
    `INSERT INTO public.platform_records
       (organization_id, project_id, schema_version_id, record_type_key, data, evidence, captured_by, idempotency_key, request_hash, point_id, capture_lat, capture_lng)
     VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7, $8, $9, $10, $11, $12)
     ON CONFLICT (project_id, captured_by, idempotency_key)
     DO UPDATE SET idempotency_key = EXCLUDED.idempotency_key
     WHERE platform_records.request_hash = EXCLUDED.request_hash
     RETURNING id, organization_id, project_id, schema_version_id, record_type_key,
       data, evidence, status, captured_by, created_at, point_id, reviewed_by, reviewed_at, review_notes`,
    [
      input.organizationId,
      input.projectId,
      input.schemaVersionId,
      input.recordTypeKey,
      JSON.stringify(input.data),
      JSON.stringify(input.evidence),
      input.capturedBy,
      input.idempotencyKey,
      input.requestHash,
      input.pointId ?? null,
      input.captureLat ?? null,
      input.captureLng ?? null,
    ],
  );
  if (!result.rows[0]) throw new PlatformRecordIdempotencyConflictError();
  return rowToRecord(result.rows[0]);
}

export async function listRecords(
  input: { organizationId: string; projectId?: string; status?: PlatformRecord["status"]; pointId?: string; limit?: number },
  deps: StoreDeps = {},
): Promise<PlatformRecord[]> {
  const limit = Math.min(200, Math.max(1, input.limit ?? 100));
  const result = await db(deps)(
    `SELECT id, organization_id, project_id, schema_version_id, record_type_key,
       data, evidence, status, captured_by, created_at, point_id, reviewed_by, reviewed_at, review_notes
     FROM public.platform_records
     WHERE organization_id = $1
       AND ($2::text IS NULL OR project_id = $2)
       AND ($3::text IS NULL OR status = $3)
       AND ($4::text IS NULL OR point_id = $4)
     ORDER BY created_at DESC
     LIMIT $5`,
    [input.organizationId, input.projectId ?? null, input.status ?? null, input.pointId ?? null, limit],
  );
  return result.rows.map(rowToRecord);
}

export async function listRecordsForExport(
  input: { organizationId: string; projectId?: string; status?: PlatformRecord["status"] },
  deps: StoreDeps = {},
): Promise<PlatformRecord[]> {
  const result = await db(deps)(
    `SELECT id, organization_id, project_id, schema_version_id, record_type_key,
       data, evidence, status, captured_by, created_at, point_id, reviewed_by, reviewed_at, review_notes
     FROM public.platform_records
     WHERE organization_id = $1
       AND ($2::text IS NULL OR project_id = $2)
       AND ($3::text IS NULL OR status = $3)
     ORDER BY created_at DESC
     LIMIT 10000`,
    [input.organizationId, input.projectId ?? null, input.status ?? null],
  );
  return result.rows.map(rowToRecord);
}

export async function reviewRecord(
  input: {
    organizationId: string;
    recordId: string;
    status: "approved" | "rejected";
    reviewedBy: string;
    reviewNotes?: string;
  },
  deps: StoreDeps = {},
): Promise<PlatformRecord | null> {
  const result = await db(deps)(
    `UPDATE public.platform_records
     SET status = $3, reviewed_by = $4, reviewed_at = now(), review_notes = NULLIF($5, '')
     WHERE organization_id = $1 AND id = $2 AND status = 'pending_review'
     RETURNING id, organization_id, project_id, schema_version_id, record_type_key,
       data, evidence, status, captured_by, created_at, point_id, reviewed_by, reviewed_at, review_notes`,
    [input.organizationId, input.recordId, input.status, input.reviewedBy, input.reviewNotes ?? ""],
  );
  return result.rows[0] ? rowToRecord(result.rows[0]) : null;
}

export async function getRecordSummaryForUser(
  userId: string,
  deps: StoreDeps = {},
): Promise<PlatformRecordSummary> {
  const result = await db(deps)(
    `SELECT
       COUNT(*)::int AS total,
       COUNT(*) FILTER (WHERE status = 'pending_review')::int AS pending_review,
       COUNT(*) FILTER (WHERE status = 'approved')::int AS approved,
       COUNT(*) FILTER (WHERE status = 'rejected')::int AS rejected,
       COUNT(*) FILTER (WHERE created_at >= date_trunc('day', now()))::int AS submitted_today
     FROM public.platform_records
     WHERE captured_by = $1`,
    [userId],
  );
  const row = result.rows[0] ?? {};
  return {
    total: Number(row.total ?? 0),
    pendingReview: Number(row.pending_review ?? 0),
    approved: Number(row.approved ?? 0),
    rejected: Number(row.rejected ?? 0),
    submittedToday: Number(row.submitted_today ?? 0),
  };
}

export async function hasRecentRecordForPoint(
  input: { organizationId: string; pointId: string; capturedBy: string; recordTypeKey: string; withinHours: number },
  deps: StoreDeps = {},
): Promise<boolean> {
  const result = await db(deps)(
    `SELECT EXISTS(
       SELECT 1 FROM public.platform_records
       WHERE organization_id = $1
         AND point_id = $2
         AND captured_by = $3
         AND record_type_key = $4
         AND created_at >= now() - make_interval(hours => $5)
     ) AS present`,
    [input.organizationId, input.pointId, input.capturedBy, input.recordTypeKey, input.withinHours],
  );
  return Boolean(result.rows[0]?.present);
}
