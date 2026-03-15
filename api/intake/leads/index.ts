import { errorResponse, jsonResponse } from "../../../lib/server/http.js";
import { isStorageUnavailableError } from "../../../lib/server/db.js";
import { requireAutomationOrAdmin, requireAutomationSecret } from "../../../lib/server/automationAuth.js";
import { ingestAutomationLeadBatch, listAutomationLeads, applyAutomationLeadAction } from "../../../lib/server/automationLeads.js";
import { automationRunInputSchema, automationLeadActionSchema } from "../../../lib/server/validation.js";
import { isValidCategory } from "../../../shared/verticals.js";
import type { AutomationLeadPriority, AutomationLeadStatus, SubmissionCategory } from "../../../shared/types.js";

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

function parseStatus(value: string | null): AutomationLeadStatus | null {
  if (!value) return null;
  return VALID_STATUSES.has(value as AutomationLeadStatus) ? (value as AutomationLeadStatus) : null;
}

function parsePriority(value: string | null): AutomationLeadPriority | null {
  if (!value) return null;
  return VALID_PRIORITIES.has(value as AutomationLeadPriority) ? (value as AutomationLeadPriority) : null;
}

export async function GET(request: Request): Promise<Response> {
  const access = await requireAutomationOrAdmin(request);
  if (access instanceof Response) return access;

  const url = new URL(request.url);
  const status = parseStatus(url.searchParams.get("status"));
  const category = url.searchParams.get("category");
  const zoneId = url.searchParams.get("zoneId");
  const sourceSystem = url.searchParams.get("sourceSystem");
  const priority = parsePriority(url.searchParams.get("priority"));
  const rawLimit = Number(url.searchParams.get("limit") ?? "100");
  const limit = Number.isFinite(rawLimit) ? rawLimit : 100;

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
