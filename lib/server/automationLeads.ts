import { query } from "./db.js";
import { getPointEvents, getLegacySubmissions } from "./storage/index.js";
import { projectPointsFromEvents, mergePointEventsWithLegacy } from "./pointProjection.js";
import { buildDedupCandidates } from "./dedup.js";
import { isWithinBonamoussadi } from "../../shared/geofence.js";
import { findCollectionZoneByLocation } from "../../shared/collectionZones.js";
import { getVertical, isValidCategory, normalizeCategoryAlias } from "../../shared/verticals.js";
import type {
  AutomationLeadAction,
  AutomationLeadActionInput,
  AutomationLeadBatchResult,
  AutomationLeadPriority,
  AutomationLeadStatus,
  AutomationRunInput,
  AutomationRunRecord,
  AutomationRunStatus,
  LeadCandidate,
  LeadCandidateInput,
  ProjectedPoint,
  SubmissionCategory,
  SubmissionDetails,
} from "../../shared/types.js";

type AutomationLeadDbRow = {
  id: string;
  run_id: string | null;
  source_system: string;
  source_record_id: string;
  source_url: string | null;
  category: SubmissionCategory;
  zone_id: string | null;
  latitude: number;
  longitude: number;
  normalized_details: unknown;
  raw_payload: unknown;
  evidence_urls: string[] | null;
  freshness_at: string | Date | null;
  match_point_id: string | null;
  match_confidence: number | null;
  status: AutomationLeadStatus;
  priority: AutomationLeadPriority;
  assignment_id: string | null;
  created_at: string | Date;
  updated_at: string | Date;
  last_ingested_at: string | Date;
};

type AutomationRunDbRow = {
  id: string;
  run_key: string;
  workflow_name: string;
  source_system: string;
  trigger_type: AutomationRunInput["triggerType"];
  status: AutomationRunStatus;
  requested_count: number;
  accepted_count: number;
  rejected_count: number;
  error_count: number;
  failure_summary: unknown;
  started_at: string | Date | null;
  completed_at: string | Date | null;
  created_at: string | Date;
  updated_at: string | Date;
};

type AutomationLeadFilters = {
  status?: AutomationLeadStatus | null;
  category?: SubmissionCategory | null;
  zoneId?: string | null;
  sourceSystem?: string | null;
  priority?: AutomationLeadPriority | null;
  limit?: number;
};

type ClassifiedAutomationLead = {
  category: SubmissionCategory;
  zoneId: string | null;
  normalizedDetails: SubmissionDetails;
  status: AutomationLeadStatus;
  matchPointId: string | null;
  matchConfidence: number | null;
};

const TERMINAL_LEAD_STATUSES = new Set<AutomationLeadStatus>([
  "rejected_manual",
  "assignment_created",
  "verified",
  "import_candidate",
]);
const HIGH_CONFIDENCE_MATCH_SCORE = 0.9;

function toIsoString(input: string | Date | null | undefined): string | null {
  if (!input) return null;
  const parsed = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

function toJsonObject(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {};
  return input as Record<string, unknown>;
}

function trimString(input: unknown, maxLen = 1000): string | null {
  if (typeof input !== "string") return null;
  const value = input.trim();
  if (!value) return null;
  return value.slice(0, maxLen);
}

function normalizePriority(input: unknown): AutomationLeadPriority {
  if (input === "high" || input === "medium" || input === "low") return input;
  return "medium";
}

function normalizeEvidenceUrls(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return Array.from(
    new Set(
      input
        .map((item) => trimString(item, 1000))
        .filter((item): item is string => Boolean(item)),
    ),
  ).slice(0, 20);
}

function pointName(details: SubmissionDetails): string | null {
  return (
    trimString(details.siteName, 240) ??
    trimString(details.name, 240) ??
    trimString(details.roadName, 240) ??
    trimString(details.brand, 240)
  );
}

function hasActionableContext(lead: LeadCandidateInput, details: SubmissionDetails): boolean {
  return Boolean(pointName(details) || trimString(lead.sourceUrl) || normalizeEvidenceUrls(lead.evidenceUrls).length > 0);
}

function toLeadCandidate(row: AutomationLeadDbRow): LeadCandidate {
  return {
    id: row.id,
    runId: row.run_id,
    sourceSystem: row.source_system,
    sourceRecordId: row.source_record_id,
    sourceUrl: row.source_url,
    category: row.category,
    zoneId: row.zone_id,
    location: {
      latitude: Number(row.latitude),
      longitude: Number(row.longitude),
    },
    normalizedDetails: toJsonObject(row.normalized_details) as SubmissionDetails,
    rawPayload: toJsonObject(row.raw_payload),
    evidenceUrls: Array.isArray(row.evidence_urls) ? row.evidence_urls : [],
    freshnessAt: toIsoString(row.freshness_at),
    matchPointId: row.match_point_id,
    matchConfidence: typeof row.match_confidence === "number" ? row.match_confidence : null,
    status: row.status,
    priority: row.priority,
    assignmentId: row.assignment_id,
    createdAt: toIsoString(row.created_at) ?? new Date().toISOString(),
    updatedAt: toIsoString(row.updated_at) ?? new Date().toISOString(),
    lastIngestedAt: toIsoString(row.last_ingested_at) ?? new Date().toISOString(),
  };
}

function toRunRecord(row: AutomationRunDbRow): AutomationRunRecord {
  const failures = Array.isArray(row.failure_summary)
    ? row.failure_summary.filter(
        (item): item is { sourceRecordId: string; message: string } =>
          Boolean(item && typeof item === "object" && typeof (item as { sourceRecordId?: unknown }).sourceRecordId === "string"),
      )
    : [];

  return {
    id: row.id,
    runKey: row.run_key,
    workflowName: row.workflow_name,
    sourceSystem: row.source_system,
    triggerType: (row.trigger_type ?? "api") as NonNullable<AutomationRunRecord["triggerType"]>,
    status: row.status,
    requestedCount: Number(row.requested_count) || 0,
    acceptedCount: Number(row.accepted_count) || 0,
    rejectedCount: Number(row.rejected_count) || 0,
    errorCount: Number(row.error_count) || 0,
    failureSummary: failures,
    startedAt: toIsoString(row.started_at),
    completedAt: toIsoString(row.completed_at),
    createdAt: toIsoString(row.created_at) ?? new Date().toISOString(),
    updatedAt: toIsoString(row.updated_at) ?? new Date().toISOString(),
  };
}

function normalizeCategory(input: string): SubmissionCategory {
  const trimmed = input.trim();
  const canonical = normalizeCategoryAlias(trimmed) ?? normalizeCategoryAlias(trimmed.toUpperCase()) ?? trimmed;
  if (!isValidCategory(canonical)) {
    throw new Error(`Unsupported category: ${input}`);
  }
  return canonical as SubmissionCategory;
}

export function deriveAutomationRunStatus(
  acceptedCount: number,
  rejectedCount: number,
  errorCount: number,
): AutomationRunStatus {
  if (errorCount === 0) return "completed";
  if (acceptedCount > 0 || rejectedCount > 0) return "partial";
  return "failed";
}

export function nextAutomationLeadStatusForAction(action: AutomationLeadAction): AutomationLeadStatus {
  if (action === "reject") return "rejected_manual";
  if (action === "mark_assigned") return "assignment_created";
  if (action === "mark_verified") return "verified";
  return "import_candidate";
}

export function preserveAutomationLeadStatus(
  existingStatus: AutomationLeadStatus | null,
  nextStatus: AutomationLeadStatus,
): AutomationLeadStatus {
  if (!existingStatus) return nextStatus;
  if (TERMINAL_LEAD_STATUSES.has(existingStatus)) return existingStatus;
  return nextStatus;
}

async function loadProjectedPoints(): Promise<ProjectedPoint[]> {
  const [pointEvents, legacySubmissions] = await Promise.all([getPointEvents(), getLegacySubmissions()]);
  return projectPointsFromEvents(mergePointEventsWithLegacy(pointEvents, legacySubmissions));
}

export function classifyAutomationLead(input: LeadCandidateInput, points: ProjectedPoint[]): ClassifiedAutomationLead {
  const category = normalizeCategory(input.category);
  const vertical = getVertical(category);
  const normalizedDetails = vertical.normalizeDetails(
    input.normalizedDetails && typeof input.normalizedDetails === "object"
      ? { ...input.normalizedDetails }
      : {},
  );
  const { latitude, longitude } = input.location;

  if (!isWithinBonamoussadi({ latitude, longitude })) {
    return {
      category,
      zoneId: null,
      normalizedDetails,
      status: "rejected_out_of_zone",
      matchPointId: null,
      matchConfidence: null,
    };
  }

  const zone = findCollectionZoneByLocation(latitude, longitude);
  const dedup = buildDedupCandidates(category, input.location, normalizedDetails, points);
  const bestCandidate = dedup.candidates[0] ?? null;
  if (bestCandidate && (dedup.shouldPrompt || bestCandidate.matchScore >= HIGH_CONFIDENCE_MATCH_SCORE)) {
    return {
      category,
      zoneId: zone?.id ?? null,
      normalizedDetails,
      status: "matched_existing",
      matchPointId: bestCandidate.pointId,
      matchConfidence: bestCandidate.matchScore,
    };
  }

  return {
    category,
    zoneId: zone?.id ?? null,
    normalizedDetails,
    status: hasActionableContext(input, normalizedDetails) ? "ready_for_assignment" : "needs_field_verify",
    matchPointId: bestCandidate?.pointId ?? null,
    matchConfidence: bestCandidate?.matchScore ?? null,
  };
}

async function getLeadBySource(sourceSystem: string, sourceRecordId: string): Promise<LeadCandidate | null> {
  const result = await query<AutomationLeadDbRow>(
    `SELECT *
     FROM automation_leads
     WHERE source_system = $1 AND source_record_id = $2
     LIMIT 1`,
    [sourceSystem, sourceRecordId],
  );
  const row = result.rows[0];
  return row ? toLeadCandidate(row) : null;
}

export async function getAutomationLeadById(id: string): Promise<LeadCandidate | null> {
  const result = await query<AutomationLeadDbRow>(
    `SELECT *
     FROM automation_leads
     WHERE id = $1::uuid
     LIMIT 1`,
    [id],
  );
  const row = result.rows[0];
  return row ? toLeadCandidate(row) : null;
}

async function upsertRun(input: AutomationRunInput): Promise<AutomationRunRecord> {
  const result = await query<AutomationRunDbRow>(
    `INSERT INTO automation_runs (
       run_key,
       workflow_name,
       source_system,
       trigger_type,
       status,
       requested_count,
       started_at,
       completed_at
     )
     VALUES ($1, $2, $3, $4, 'pending', $5, $6::timestamptz, $7::timestamptz)
     ON CONFLICT (run_key) DO UPDATE SET
       workflow_name = EXCLUDED.workflow_name,
       source_system = EXCLUDED.source_system,
       trigger_type = EXCLUDED.trigger_type,
       requested_count = EXCLUDED.requested_count,
       started_at = COALESCE(EXCLUDED.started_at, automation_runs.started_at),
       completed_at = EXCLUDED.completed_at,
       updated_at = NOW()
     RETURNING *`,
    [
      input.runKey,
      input.workflowName,
      input.sourceSystem.trim(),
      input.triggerType ?? "api",
      input.leads.length,
      input.startedAt ?? null,
      input.completedAt ?? null,
    ],
  );
  return toRunRecord(result.rows[0]!);
}

async function finalizeRun(
  runId: string,
  counts: {
    acceptedCount: number;
    rejectedCount: number;
    errorCount: number;
    failures: Array<{ sourceRecordId: string; message: string }>;
    completedAt?: string | null;
  },
): Promise<AutomationRunRecord> {
  const status = deriveAutomationRunStatus(counts.acceptedCount, counts.rejectedCount, counts.errorCount);
  const result = await query<AutomationRunDbRow>(
    `UPDATE automation_runs
     SET
       status = $2,
       accepted_count = $3,
       rejected_count = $4,
       error_count = $5,
       failure_summary = $6::jsonb,
       completed_at = COALESCE($7::timestamptz, NOW()),
       updated_at = NOW()
     WHERE id = $1::uuid
     RETURNING *`,
    [
      runId,
      status,
      counts.acceptedCount,
      counts.rejectedCount,
      counts.errorCount,
      JSON.stringify(counts.failures),
      counts.completedAt ?? null,
    ],
  );
  return toRunRecord(result.rows[0]!);
}

async function upsertAutomationLeadRow(params: {
  runId: string;
  sourceSystem: string;
  input: LeadCandidateInput;
  classified: ClassifiedAutomationLead;
}): Promise<LeadCandidate> {
  const existing = await getLeadBySource(params.sourceSystem, params.input.sourceRecordId);
  const finalStatus = preserveAutomationLeadStatus(existing?.status ?? null, params.classified.status);
  const assignmentId = existing?.assignmentId ?? null;
  const result = await query<AutomationLeadDbRow>(
    `INSERT INTO automation_leads (
       run_id,
       source_system,
       source_record_id,
       source_url,
       category,
       zone_id,
       latitude,
       longitude,
       normalized_details,
       raw_payload,
       evidence_urls,
       freshness_at,
       match_point_id,
       match_confidence,
       status,
       priority,
       assignment_id
     )
     VALUES (
       $1::uuid,
       $2,
       $3,
       $4,
       $5,
       $6,
       $7,
       $8,
       $9::jsonb,
       $10::jsonb,
       $11::text[],
       $12::timestamptz,
       $13,
       $14,
       $15,
       $16,
       $17::uuid
     )
     ON CONFLICT (source_system, source_record_id) DO UPDATE SET
       run_id = EXCLUDED.run_id,
       source_url = EXCLUDED.source_url,
       category = EXCLUDED.category,
       zone_id = EXCLUDED.zone_id,
       latitude = EXCLUDED.latitude,
       longitude = EXCLUDED.longitude,
       normalized_details = EXCLUDED.normalized_details,
       raw_payload = EXCLUDED.raw_payload,
       evidence_urls = EXCLUDED.evidence_urls,
       freshness_at = EXCLUDED.freshness_at,
       match_point_id = EXCLUDED.match_point_id,
       match_confidence = EXCLUDED.match_confidence,
       status = EXCLUDED.status,
       priority = EXCLUDED.priority,
       assignment_id = COALESCE(automation_leads.assignment_id, EXCLUDED.assignment_id),
       updated_at = NOW(),
       last_ingested_at = NOW()
     RETURNING *`,
    [
      params.runId,
      params.sourceSystem,
      params.input.sourceRecordId.trim(),
      trimString(params.input.sourceUrl),
      params.classified.category,
      params.classified.zoneId,
      params.input.location.latitude,
      params.input.location.longitude,
      JSON.stringify(params.classified.normalizedDetails),
      JSON.stringify(toJsonObject(params.input.rawPayload)),
      normalizeEvidenceUrls(params.input.evidenceUrls),
      params.input.freshnessAt ?? null,
      params.classified.matchPointId,
      params.classified.matchConfidence,
      finalStatus,
      normalizePriority(params.input.priority),
      assignmentId,
    ],
  );
  return toLeadCandidate(result.rows[0]!);
}

export async function ingestAutomationLeadBatch(input: AutomationRunInput): Promise<AutomationLeadBatchResult> {
  const run = await upsertRun(input);
  const points = await loadProjectedPoints();
  const leads: LeadCandidate[] = [];
  const failures: Array<{ sourceRecordId: string; message: string }> = [];
  let acceptedCount = 0;
  let rejectedCount = 0;

  for (const item of input.leads) {
    try {
      const classified = classifyAutomationLead(item, points);
      const lead = await upsertAutomationLeadRow({
        runId: run.id,
        sourceSystem: input.sourceSystem.trim(),
        input: item,
        classified,
      });
      leads.push(lead);
      if (lead.status === "rejected_out_of_zone" || lead.status === "rejected_manual") rejectedCount += 1;
      else acceptedCount += 1;
    } catch (error) {
      failures.push({
        sourceRecordId: item.sourceRecordId,
        message: error instanceof Error ? error.message : "Unable to process lead",
      });
    }
  }

  const finalizedRun = await finalizeRun(run.id, {
    acceptedCount,
    rejectedCount,
    errorCount: failures.length,
    failures,
    completedAt: input.completedAt ?? null,
  });

  return {
    run: finalizedRun,
    leads,
    errors: failures,
  };
}

export async function listAutomationLeads(filters: AutomationLeadFilters = {}): Promise<LeadCandidate[]> {
  const conditions: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  if (filters.status) {
    conditions.push(`status = $${idx++}`);
    values.push(filters.status);
  }
  if (filters.category) {
    conditions.push(`category = $${idx++}`);
    values.push(filters.category);
  }
  if (filters.zoneId) {
    conditions.push(`zone_id = $${idx++}`);
    values.push(filters.zoneId);
  }
  if (filters.sourceSystem) {
    conditions.push(`source_system = $${idx++}`);
    values.push(filters.sourceSystem);
  }
  if (filters.priority) {
    conditions.push(`priority = $${idx++}`);
    values.push(filters.priority);
  }

  const limit = Math.min(Math.max(filters.limit ?? 100, 1), 500);
  values.push(limit);
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const result = await query<AutomationLeadDbRow>(
    `SELECT *
     FROM automation_leads
     ${where}
     ORDER BY
       CASE priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END,
       updated_at DESC
     LIMIT $${idx}`,
    values,
  );
  return result.rows.map(toLeadCandidate);
}

export async function applyAutomationLeadAction(
  id: string,
  input: AutomationLeadActionInput,
): Promise<LeadCandidate | null> {
  const existing = await getAutomationLeadById(id);
  if (!existing) return null;

  const nextStatus = nextAutomationLeadStatusForAction(input.action);
  const nextAssignmentId =
    input.action === "mark_assigned"
      ? trimString(input.assignmentId, 64)
      : input.action === "reject"
        ? null
        : existing.assignmentId;

  if (input.action === "mark_assigned" && !nextAssignmentId) {
    throw new Error("assignmentId is required for mark_assigned");
  }

  const result = await query<AutomationLeadDbRow>(
    `UPDATE automation_leads
     SET
       status = $2,
       assignment_id = $3::uuid,
       updated_at = NOW()
     WHERE id = $1::uuid
     RETURNING *`,
    [id, nextStatus, nextAssignmentId],
  );

  const row = result.rows[0];
  return row ? toLeadCandidate(row) : null;
}
