import { query } from "../db.js";
import type {
  ExternalPoiCandidate,
  ExternalPoiMatchStatus,
  SubmissionCategory,
  SubmissionDetails,
  SubmissionLocation,
} from "../../../shared/types.js";
import type { NormalizedPoiDraft } from "./normalizePoi.js";
import type { PoiMatchResult } from "./candidateMatcher.js";

type PoiCandidateRow = {
  id: string;
  source: string;
  source_license: string;
  source_attribution: string;
  external_id: string;
  raw_json: unknown;
  normalized_json: unknown;
  category: SubmissionCategory;
  latitude: number | string;
  longitude: number | string;
  name: string | null;
  match_status: ExternalPoiMatchStatus;
  matched_point_id: string | null;
  match_score: number | string;
  confidence: number | string;
  needs_field_verification: boolean;
  assigned_to: string | null;
  created_at: string | Date;
  updated_at: string | Date;
};

export interface PoiCandidateUpsertInput extends NormalizedPoiDraft, PoiMatchResult {
  assignedTo?: string | null;
}

export interface PoiCandidateFilters {
  status?: ExternalPoiMatchStatus | null;
  category?: SubmissionCategory | null;
  assignedTo?: string | null;
  limit?: number;
  offset?: number;
}

export interface PoiCandidatePatch {
  matchStatus?: ExternalPoiMatchStatus;
  assignedTo?: string | null;
  needsFieldVerification?: boolean;
}

function toIsoString(input: string | Date | null | undefined): string {
  const date = input instanceof Date ? input : input ? new Date(input) : new Date();
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

function toJsonObject(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {};
  return input as Record<string, unknown>;
}

function toDetails(input: unknown): SubmissionDetails {
  return toJsonObject(input) as SubmissionDetails;
}

function toNumber(input: number | string): number {
  const parsed = typeof input === "number" ? input : Number(input);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function rowToPoiCandidate(row: PoiCandidateRow): ExternalPoiCandidate {
  return {
    id: row.id,
    source: row.source,
    sourceLicense: row.source_license,
    sourceAttribution: row.source_attribution,
    externalId: row.external_id,
    raw: toJsonObject(row.raw_json),
    normalized: toDetails(row.normalized_json),
    category: row.category,
    location: {
      latitude: toNumber(row.latitude),
      longitude: toNumber(row.longitude),
    },
    name: row.name,
    matchStatus: row.match_status,
    matchedPointId: row.matched_point_id,
    matchScore: toNumber(row.match_score),
    confidence: toNumber(row.confidence),
    needsFieldVerification: row.needs_field_verification,
    assignedTo: row.assigned_to,
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at),
  };
}

export async function getPoiCandidate(id: string): Promise<ExternalPoiCandidate | null> {
  const result = await query<PoiCandidateRow>(
    `SELECT *
     FROM external_poi_candidates
     WHERE id = $1::uuid`,
    [id],
  );
  const row = result.rows[0];
  return row ? rowToPoiCandidate(row) : null;
}

export async function listPoiCandidates(filters: PoiCandidateFilters = {}): Promise<ExternalPoiCandidate[]> {
  const conditions: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  if (filters.status) {
    conditions.push(`match_status = $${idx++}`);
    values.push(filters.status);
  }
  if (filters.category) {
    conditions.push(`category = $${idx++}`);
    values.push(filters.category);
  }
  if (filters.assignedTo) {
    conditions.push(`assigned_to = $${idx++}`);
    values.push(filters.assignedTo);
  }

  const limit = Math.min(Math.max(Math.floor(filters.limit ?? 100), 1), 500);
  const offset = Math.max(Math.floor(filters.offset ?? 0), 0);
  values.push(limit, offset);
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const result = await query<PoiCandidateRow>(
    `SELECT *
     FROM external_poi_candidates
     ${where}
     ORDER BY updated_at DESC
     LIMIT $${idx} OFFSET $${idx + 1}`,
    values,
  );
  return result.rows.map(rowToPoiCandidate);
}

export async function upsertPoiCandidate(input: PoiCandidateUpsertInput): Promise<ExternalPoiCandidate> {
  const result = await query<PoiCandidateRow>(
    `INSERT INTO external_poi_candidates (
       source,
       source_license,
       source_attribution,
       external_id,
       raw_json,
       normalized_json,
       category,
       latitude,
       longitude,
       name,
       match_status,
       matched_point_id,
       match_score,
       confidence,
       needs_field_verification,
       assigned_to
     )
     VALUES (
       $1,
       $2,
       $3,
       $4,
       $5::jsonb,
       $6::jsonb,
       $7,
       $8,
       $9,
       $10,
       $11,
       $12,
       $13,
       $14,
       $15,
       $16
     )
     ON CONFLICT (source, external_id) DO UPDATE
     SET
       source_license = EXCLUDED.source_license,
       source_attribution = EXCLUDED.source_attribution,
       raw_json = EXCLUDED.raw_json,
       normalized_json = EXCLUDED.normalized_json,
       category = EXCLUDED.category,
       latitude = EXCLUDED.latitude,
       longitude = EXCLUDED.longitude,
       name = EXCLUDED.name,
       match_status = CASE
         WHEN external_poi_candidates.match_status IN ('assigned_to_agent', 'verified', 'promoted_to_point_event', 'rejected')
           THEN external_poi_candidates.match_status
         ELSE EXCLUDED.match_status
       END,
       matched_point_id = CASE
         WHEN external_poi_candidates.match_status IN ('assigned_to_agent', 'verified', 'promoted_to_point_event', 'rejected')
           THEN external_poi_candidates.matched_point_id
         ELSE EXCLUDED.matched_point_id
       END,
       match_score = EXCLUDED.match_score,
       confidence = EXCLUDED.confidence,
       needs_field_verification = CASE
         WHEN external_poi_candidates.match_status IN ('assigned_to_agent', 'verified', 'promoted_to_point_event', 'rejected')
           THEN external_poi_candidates.needs_field_verification
         ELSE EXCLUDED.needs_field_verification
       END,
       assigned_to = COALESCE(external_poi_candidates.assigned_to, EXCLUDED.assigned_to),
       updated_at = NOW()
     RETURNING *`,
    [
      input.source,
      input.sourceLicense,
      input.sourceAttribution,
      input.externalId,
      JSON.stringify(input.raw),
      JSON.stringify(input.normalized),
      input.category,
      input.location.latitude,
      input.location.longitude,
      input.name,
      input.matchStatus,
      input.matchedPointId,
      input.matchScore,
      input.confidence,
      input.needsFieldVerification,
      input.assignedTo ?? null,
    ],
  );
  return rowToPoiCandidate(result.rows[0]!);
}

export async function upsertPoiCandidates(inputs: PoiCandidateUpsertInput[]): Promise<ExternalPoiCandidate[]> {
  const candidates: ExternalPoiCandidate[] = [];
  for (const input of inputs) {
    candidates.push(await upsertPoiCandidate(input));
  }
  return candidates;
}

export async function patchPoiCandidate(id: string, patch: PoiCandidatePatch): Promise<ExternalPoiCandidate | null> {
  const sets: string[] = [];
  const values: unknown[] = [id];

  if (patch.matchStatus !== undefined) {
    values.push(patch.matchStatus);
    sets.push(`match_status = $${values.length}`);
  }
  if (patch.assignedTo !== undefined) {
    values.push(patch.assignedTo);
    sets.push(`assigned_to = $${values.length}`);
  }
  if (patch.needsFieldVerification !== undefined) {
    values.push(patch.needsFieldVerification);
    sets.push(`needs_field_verification = $${values.length}`);
  }

  if (!sets.length) {
    throw new Error("At least one patch field is required");
  }

  const result = await query<PoiCandidateRow>(
    `UPDATE external_poi_candidates
     SET ${sets.join(", ")}, updated_at = NOW()
     WHERE id = $1::uuid
     RETURNING *`,
    values,
  );
  const row = result.rows[0];
  return row ? rowToPoiCandidate(row) : null;
}

export async function assignPoiCandidate(id: string, assignedTo: string): Promise<ExternalPoiCandidate | null> {
  const result = await query<PoiCandidateRow>(
    `UPDATE external_poi_candidates
     SET
       assigned_to = $2,
       match_status = 'assigned_to_agent',
       needs_field_verification = TRUE,
       updated_at = NOW()
     WHERE id = $1::uuid
     RETURNING *`,
    [id, assignedTo],
  );
  const row = result.rows[0];
  return row ? rowToPoiCandidate(row) : null;
}

export async function markPoiCandidatePromoted(
  id: string,
  pointId: string,
): Promise<ExternalPoiCandidate | null> {
  const result = await query<PoiCandidateRow>(
    `UPDATE external_poi_candidates
     SET
       match_status = 'promoted_to_point_event',
       matched_point_id = $2,
       needs_field_verification = FALSE,
       updated_at = NOW()
     WHERE id = $1::uuid
     RETURNING *`,
    [id, pointId],
  );
  const row = result.rows[0];
  return row ? rowToPoiCandidate(row) : null;
}
