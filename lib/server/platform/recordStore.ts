import type { PlatformRecord, PlatformRecordEvidence } from "../../../shared/platformTypes.js";
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
  },
  deps: StoreDeps = {},
): Promise<PlatformRecord> {
  const result = await db(deps)(
    `INSERT INTO public.platform_records
       (organization_id, project_id, schema_version_id, record_type_key, data, evidence, captured_by, idempotency_key, request_hash)
     VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7, $8, $9)
     ON CONFLICT (project_id, captured_by, idempotency_key)
     DO UPDATE SET idempotency_key = EXCLUDED.idempotency_key
     WHERE platform_records.request_hash = EXCLUDED.request_hash
     RETURNING id, organization_id, project_id, schema_version_id, record_type_key,
       data, evidence, status, captured_by, created_at`,
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
    ],
  );
  if (!result.rows[0]) throw new PlatformRecordIdempotencyConflictError();
  return rowToRecord(result.rows[0]);
}

export async function listRecords(
  input: { organizationId: string; status?: PlatformRecord["status"]; limit?: number },
  deps: StoreDeps = {},
): Promise<PlatformRecord[]> {
  const limit = Math.min(200, Math.max(1, input.limit ?? 100));
  const result = await db(deps)(
    `SELECT id, organization_id, project_id, schema_version_id, record_type_key,
       data, evidence, status, captured_by, created_at
     FROM public.platform_records
     WHERE organization_id = $1
       AND ($2::text IS NULL OR status = $2)
     ORDER BY created_at DESC
     LIMIT $3`,
    [input.organizationId, input.status ?? null, limit],
  );
  return result.rows.map(rowToRecord);
}

export async function reviewRecord(
  input: { organizationId: string; recordId: string; status: "approved" | "rejected" },
  deps: StoreDeps = {},
): Promise<PlatformRecord | null> {
  const result = await db(deps)(
    `UPDATE public.platform_records
     SET status = $3
     WHERE organization_id = $1 AND id = $2 AND status = 'pending_review'
     RETURNING id, organization_id, project_id, schema_version_id, record_type_key,
       data, evidence, status, captured_by, created_at`,
    [input.organizationId, input.recordId, input.status],
  );
  return result.rows[0] ? rowToRecord(result.rows[0]) : null;
}
