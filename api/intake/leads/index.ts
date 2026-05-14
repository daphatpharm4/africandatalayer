import { errorResponse, jsonResponse } from "../../../lib/server/http.js";
import { isStorageUnavailableError } from "../../../lib/server/db.js";
import { requireAutomationOrAdmin, requireAutomationSecret } from "../../../lib/server/automationAuth.js";
import { ingestAutomationLeadBatch, listAutomationLeads, applyAutomationLeadAction } from "../../../lib/server/automationLeads.js";
import { automationRunInputSchema, automationLeadActionSchema, poiCandidatePatchSchema } from "../../../lib/server/validation.js";
import { getPointEvents, insertPointEvent } from "../../../lib/server/storage/index.js";
import { projectPointsFromEvents } from "../../../lib/server/pointProjection.js";
import { matchPoiCandidate } from "../../../lib/server/poi/candidateMatcher.js";
import {
  assignPoiCandidate,
  getPoiCandidate,
  listPoiCandidates,
  markPoiCandidatePromoted,
  patchPoiCandidate,
  upsertPoiCandidates,
  type PoiCandidateUpsertInput,
} from "../../../lib/server/poi/candidateStore.js";
import { buildPointEventFromVerifiedCandidate } from "../../../lib/server/poi/promoteCandidate.js";
import { requirePoiAdmin } from "../../../lib/server/poi/adminAccess.js";
import {
  fetchOverpassPoiCandidates,
  type FetchOverpassOptions,
  type OverpassBounds,
} from "../../../lib/server/poi/sourceAdapters/osmOverpass.js";
import { isValidCategory } from "../../../shared/verticals.js";
import type {
  AutomationLeadPriority,
  AutomationLeadStatus,
  ExternalPoiMatchStatus,
  SubmissionCategory,
} from "../../../shared/types.js";

export const maxDuration = 60;

const VALID_STATUSES = new Set<AutomationLeadStatus>([
  "rejected_out_of_zone",
  "rejected_manual",
  "matched_existing",
  "needs_field_verify",
  "ready_for_assignment",
  "assignment_created",
  "verified",
  "import_candidate",
]);
const VALID_PRIORITIES = new Set<AutomationLeadPriority>(["high", "medium", "low"]);
const VALID_POI_STATUSES = new Set<ExternalPoiMatchStatus>([
  "discovered",
  "normalized",
  "matched_to_existing",
  "needs_field_verification",
  "assigned_to_agent",
  "verified",
  "promoted_to_point_event",
  "rejected",
]);
const MAX_POI_BBOX_AREA_DEGREES = Number(process.env.POI_IMPORT_MAX_BBOX_AREA_DEGREES ?? "0.25") || 0.25;

function parseStatus(value: string | null): AutomationLeadStatus | null {
  if (!value) return null;
  return VALID_STATUSES.has(value as AutomationLeadStatus) ? (value as AutomationLeadStatus) : null;
}

function parsePriority(value: string | null): AutomationLeadPriority | null {
  if (!value) return null;
  return VALID_PRIORITIES.has(value as AutomationLeadPriority) ? (value as AutomationLeadPriority) : null;
}

function parsePoiStatus(value: string | null): ExternalPoiMatchStatus | null {
  if (!value) return null;
  return VALID_POI_STATUSES.has(value as ExternalPoiMatchStatus) ? (value as ExternalPoiMatchStatus) : null;
}

function parsePositiveInteger(value: string | null, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : fallback;
}

function parseNumber(input: unknown): number | null {
  if (typeof input === "number" && Number.isFinite(input)) return input;
  if (typeof input !== "string") return null;
  const parsed = Number(input.trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function parsePoiBounds(input: unknown): { ok: true; bounds: OverpassBounds } | { ok: false; error: string } {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, error: "bounds are required" };
  }
  const raw = input as Record<string, unknown>;
  const south = parseNumber(raw.south);
  const west = parseNumber(raw.west);
  const north = parseNumber(raw.north);
  const east = parseNumber(raw.east);
  if (south === null || west === null || north === null || east === null) {
    return { ok: false, error: "bounds must include finite south, west, north, and east numbers" };
  }
  if (south < -90 || north > 90 || west < -180 || east > 180) {
    return { ok: false, error: "bounds are out of range" };
  }
  if (south >= north || west >= east) {
    return { ok: false, error: "bounds must satisfy south < north and west < east" };
  }
  if ((north - south) * (east - west) > MAX_POI_BBOX_AREA_DEGREES) {
    return { ok: false, error: "bounds are too large for a single import" };
  }
  return { ok: true, bounds: { south, west, north, east } };
}

function extractPoiCandidateId(request: Request): string | null {
  const url = new URL(request.url);
  const queryId = url.searchParams.get("id");
  if (queryId?.trim()) return queryId.trim();
  const segments = url.pathname.replace(/\/+$/, "").split("/");
  const last = segments[segments.length - 1];
  return last && last !== "candidates" && last !== "leads" ? last : null;
}

async function handlePoiCandidatesGet(request: Request): Promise<Response> {
  const access = await requirePoiAdmin(request);
  if (access instanceof Response) return access;

  const url = new URL(request.url);
  const candidateId = extractPoiCandidateId(request);
  if (candidateId && url.searchParams.get("view") === "poi-candidate") {
    const candidate = await getPoiCandidate(candidateId);
    if (!candidate) return errorResponse("POI candidate not found", 404);
    return jsonResponse(candidate, { status: 200 });
  }

  const status = parsePoiStatus(url.searchParams.get("status"));
  const category = url.searchParams.get("category");
  if (url.searchParams.get("status") && !status) return errorResponse("Invalid status filter", 400);
  if (category && !isValidCategory(category)) return errorResponse("Invalid category filter", 400);

  const candidates = await listPoiCandidates({
    status,
    category: category ? (category as SubmissionCategory) : null,
    assignedTo: url.searchParams.get("assignedTo"),
    limit: parsePositiveInteger(url.searchParams.get("limit"), 100),
    offset: parsePositiveInteger(url.searchParams.get("offset"), 0),
  });
  return jsonResponse(candidates, { status: 200 });
}

async function handlePoiImportOsm(request: Request): Promise<Response> {
  const access = await requirePoiAdmin(request);
  if (access instanceof Response) return access;

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return errorResponse("Invalid JSON body", 400);
  }
  if (!rawBody || typeof rawBody !== "object" || Array.isArray(rawBody)) {
    return errorResponse("Invalid request body", 400);
  }
  const body = rawBody as Record<string, unknown>;
  const parsedBounds = parsePoiBounds(body.bounds);
  if ("error" in parsedBounds) return errorResponse(parsedBounds.error, 400);

  const fetchOptions: FetchOverpassOptions = {
    endpoint: process.env.OVERPASS_ENDPOINT,
  };
  const imported = await fetchOverpassPoiCandidates(parsedBounds.bounds, fetchOptions);
  const dryRun = body.dryRun !== false;
  if (dryRun) {
    return jsonResponse({
      dryRun: true,
      query: imported.query,
      fetchedCount: imported.response.elements?.length ?? 0,
      candidateCount: imported.candidates.length,
      candidates: imported.candidates,
    });
  }

  const points = projectPointsFromEvents(await getPointEvents());
  const upserts: PoiCandidateUpsertInput[] = imported.candidates.map((candidate) => ({
    ...candidate,
    ...matchPoiCandidate(candidate, points),
  }));
  const candidates = await upsertPoiCandidates(upserts);
  return jsonResponse({
    dryRun: false,
    fetchedCount: imported.response.elements?.length ?? 0,
    candidateCount: candidates.length,
    candidates,
  }, { status: 201 });
}

async function handlePoiAssign(request: Request): Promise<Response> {
  const access = await requirePoiAdmin(request);
  if (access instanceof Response) return access;

  const id = extractPoiCandidateId(request);
  if (!id) return errorResponse("Missing candidate id", 400);
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return errorResponse("Invalid JSON body", 400);
  }
  const assignedTo = rawBody && typeof rawBody === "object" && !Array.isArray(rawBody)
    ? (rawBody as Record<string, unknown>).assignedTo
    : null;
  if (typeof assignedTo !== "string" || !assignedTo.trim()) {
    return errorResponse("assignedTo is required", 400);
  }
  const candidate = await assignPoiCandidate(id, assignedTo.trim());
  if (!candidate) return errorResponse("POI candidate not found", 404);
  return jsonResponse(candidate, { status: 200 });
}

async function handlePoiPromote(request: Request): Promise<Response> {
  const access = await requirePoiAdmin(request);
  if (access instanceof Response) return access;

  const id = extractPoiCandidateId(request);
  if (!id) return errorResponse("Missing candidate id", 400);
  const candidate = await getPoiCandidate(id);
  if (!candidate) return errorResponse("POI candidate not found", 404);
  const event = buildPointEventFromVerifiedCandidate(candidate, access.id);
  await insertPointEvent(event);
  const updated = await markPoiCandidatePromoted(id, event.pointId);
  return jsonResponse({ candidate: updated ?? candidate, event }, { status: 201 });
}

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  if (url.searchParams.get("view")?.startsWith("poi-")) {
    try {
      return await handlePoiCandidatesGet(request);
    } catch (error) {
      if (isStorageUnavailableError(error)) {
        return errorResponse("Storage service temporarily unavailable", 503, { code: "storage_unavailable" });
      }
      throw error;
    }
  }

  const access = await requireAutomationOrAdmin(request);
  if (access instanceof Response) return access;

  const status = parseStatus(url.searchParams.get("status"));
  const category = url.searchParams.get("category");
  const zoneId = url.searchParams.get("zoneId");
  const sourceSystem = url.searchParams.get("sourceSystem");
  const priority = parsePriority(url.searchParams.get("priority"));
  const rawLimit = Number(url.searchParams.get("limit") ?? "100");
  const limit = Number.isFinite(rawLimit) ? rawLimit : 100;
  const rawOffset = Number(url.searchParams.get("offset") ?? "0");
  const offset = Number.isFinite(rawOffset) && rawOffset >= 0 ? rawOffset : 0;

  if (url.searchParams.get("status") && !status) {
    return errorResponse("Invalid status filter", 400);
  }
  if (category && !isValidCategory(category)) {
    return errorResponse("Invalid category filter", 400);
  }
  if (url.searchParams.get("priority") && !priority) {
    return errorResponse("Invalid priority filter", 400);
  }

  try {
    const leads = await listAutomationLeads({
      status,
      category: category ? (category as SubmissionCategory) : null,
      zoneId,
      sourceSystem,
      priority,
      limit,
      offset,
    });
    return jsonResponse(leads, { status: 200 });
  } catch (error) {
    if (isStorageUnavailableError(error)) {
      return errorResponse("Storage service temporarily unavailable", 503, { code: "storage_unavailable" });
    }
    throw error;
  }
}

export async function POST(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const view = url.searchParams.get("view");
  if (view?.startsWith("poi-")) {
    try {
      if (view === "poi-import-osm") return await handlePoiImportOsm(request);
      if (view === "poi-assign") return await handlePoiAssign(request);
      if (view === "poi-promote") return await handlePoiPromote(request);
      return errorResponse("Invalid POI action", 400);
    } catch (error) {
      if (isStorageUnavailableError(error)) {
        return errorResponse("Storage service temporarily unavailable", 503, { code: "storage_unavailable" });
      }
      const message = error instanceof Error ? error.message : "Unable to process POI request";
      return errorResponse(message, message.includes("Overpass") ? 502 : 400);
    }
  }

  const access = await requireAutomationSecret(request);
  if (access instanceof Response) return access;

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return errorResponse("Invalid JSON body", 400);
  }

  const validation = automationRunInputSchema.safeParse(rawBody);
  if (!validation.success) {
    return errorResponse(validation.error.issues[0]?.message ?? "Invalid automation lead batch", 400);
  }

  try {
    const result = await ingestAutomationLeadBatch(validation.data);
    return jsonResponse(result, { status: result.errors.length > 0 ? 207 : 201 });
  } catch (error) {
    if (isStorageUnavailableError(error)) {
      return errorResponse("Storage service temporarily unavailable", 503, { code: "storage_unavailable" });
    }
    const message = error instanceof Error ? error.message : "Unable to ingest automation leads";
    return errorResponse(message, 400);
  }
}

function extractLeadId(request: Request): string | null {
  const url = new URL(request.url);
  const segments = url.pathname.replace(/\/+$/, "").split("/");
  const last = segments[segments.length - 1];
  return last && last !== "leads" ? last : null;
}

export async function PATCH(request: Request): Promise<Response> {
  const url = new URL(request.url);
  if (url.searchParams.get("view") === "poi-candidate") {
    const access = await requirePoiAdmin(request);
    if (access instanceof Response) return access;

    const id = extractPoiCandidateId(request);
    if (!id) return errorResponse("Missing candidate id", 400);
    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      return errorResponse("Invalid JSON body", 400);
    }
    const validation = poiCandidatePatchSchema.safeParse(rawBody);
    if (!validation.success) {
      return errorResponse(validation.error.issues[0]?.message ?? "Invalid POI candidate patch", 400);
    }
    const patch = { ...validation.data };
    if (patch.matchStatus === "promoted_to_point_event") {
      return errorResponse("Use the promote action to create a point event", 400);
    }
    if (patch.matchStatus === "verified" && patch.needsFieldVerification === undefined) {
      patch.needsFieldVerification = false;
    }

    try {
      const candidate = await patchPoiCandidate(id, patch);
      if (!candidate) return errorResponse("POI candidate not found", 404);
      return jsonResponse(candidate, { status: 200 });
    } catch (error) {
      if (isStorageUnavailableError(error)) {
        return errorResponse("Storage service temporarily unavailable", 503, { code: "storage_unavailable" });
      }
      const message = error instanceof Error ? error.message : "Unable to update POI candidate";
      return errorResponse(message, 400);
    }
  }

  const access = await requireAutomationOrAdmin(request);
  if (access instanceof Response) return access;

  const id = extractLeadId(request);
  if (!id) return errorResponse("Missing lead id", 400);

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return errorResponse("Invalid JSON body", 400);
  }

  const validation = automationLeadActionSchema.safeParse(rawBody);
  if (!validation.success) {
    return errorResponse(validation.error.issues[0]?.message ?? "Invalid lead action", 400);
  }

  try {
    const updated = await applyAutomationLeadAction(id, validation.data);
    if (!updated) return errorResponse("Automation lead not found", 404);
    return jsonResponse(updated, { status: 200 });
  } catch (error) {
    if (isStorageUnavailableError(error)) {
      return errorResponse("Storage service temporarily unavailable", 503, { code: "storage_unavailable" });
    }
    const message = error instanceof Error ? error.message : "Unable to update automation lead";
    return errorResponse(message, 400);
  }
}
