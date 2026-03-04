import { requireUser } from "../../lib/auth.js";
import {
  createAssignment,
  getAssignmentById,
  getPlannerContext,
  listAssignments,
  updateAssignment,
} from "../../lib/server/collectionAssignments.js";
import { errorResponse, jsonResponse } from "../../lib/server/http.js";
import { isStorageUnavailableError } from "../../lib/server/db.js";
import type {
  CollectionAssignmentCreateInput,
  CollectionAssignmentStatus,
  CollectionAssignmentUpdateInput,
} from "../../shared/types.js";

const VALID_STATUSES: ReadonlySet<CollectionAssignmentStatus> = new Set([
  "pending",
  "in_progress",
  "completed",
  "expired",
]);

function normalizeStatus(input: string | null): CollectionAssignmentStatus | null {
  if (!input) return null;
  const normalized = input.trim().toLowerCase();
  if (!VALID_STATUSES.has(normalized as CollectionAssignmentStatus)) return null;
  return normalized as CollectionAssignmentStatus;
}

function isAdminToken(token: unknown): boolean {
  return (token as { isAdmin?: unknown } | undefined)?.isAdmin === true;
}

export async function GET(request: Request): Promise<Response> {
  const auth = await requireUser(request);
  if (!auth) return errorResponse("Unauthorized", 401);
  const isAdmin = isAdminToken(auth.token);

  const url = new URL(request.url);
  const view = (url.searchParams.get("view") ?? "mine").trim().toLowerCase();
  const status = normalizeStatus(url.searchParams.get("status"));
  const requestedAgent = url.searchParams.get("agentUserId")?.trim().toLowerCase() ?? null;

  try {
    if (view === "planner_context") {
      if (!isAdmin) return errorResponse("Forbidden", 403);
      const [context, assignments] = await Promise.all([
        getPlannerContext(),
        listAssignments({
          viewerUserId: auth.id,
          isAdmin: true,
          status,
          agentUserId: requestedAgent,
        }),
      ]);
      return jsonResponse({ context, assignments });
    }

    const allowAll = view === "all" && isAdmin;
    const assignments = await listAssignments({
      viewerUserId: auth.id,
      isAdmin: allowAll,
      status,
      agentUserId: allowAll ? requestedAgent : null,
    });
    return jsonResponse(assignments);
  } catch (error) {
    if (isStorageUnavailableError(error)) {
      return errorResponse("Storage service temporarily unavailable", 503, { code: "storage_unavailable" });
    }
    throw error;
  }
}

export async function POST(request: Request): Promise<Response> {
  const auth = await requireUser(request);
  if (!auth) return errorResponse("Unauthorized", 401);
  if (!isAdminToken(auth.token)) return errorResponse("Forbidden", 403);

  let body: CollectionAssignmentCreateInput;
  try {
    body = (await request.json()) as CollectionAssignmentCreateInput;
  } catch {
    return errorResponse("Invalid JSON body", 400);
  }

  try {
    const created = await createAssignment(body);
    return jsonResponse(created, { status: 201 });
  } catch (error) {
    if (isStorageUnavailableError(error)) {
      return errorResponse("Storage service temporarily unavailable", 503, { code: "storage_unavailable" });
    }
    const message = error instanceof Error ? error.message : "Unable to create assignment";
    return errorResponse(message, 400);
  }
}

interface PatchBody extends CollectionAssignmentUpdateInput {
  id?: unknown;
}

export async function PATCH(request: Request): Promise<Response> {
  const auth = await requireUser(request);
  if (!auth) return errorResponse("Unauthorized", 401);
  const isAdmin = isAdminToken(auth.token);

  let body: PatchBody;
  try {
    body = (await request.json()) as PatchBody;
  } catch {
    return errorResponse("Invalid JSON body", 400);
  }

  const id = typeof body.id === "string" ? body.id.trim() : "";
  if (!id) return errorResponse("Assignment id is required", 400);

  try {
    const existing = await getAssignmentById(id);
    if (!existing) return errorResponse("Assignment not found", 404);
    if (!isAdmin && existing.agentUserId !== auth.id.toLowerCase().trim()) {
      return errorResponse("Forbidden", 403);
    }
    if (!isAdmin && body.status === "expired") {
      return errorResponse("Only admins can expire assignments", 403);
    }
    if (!isAdmin && existing.status === "completed" && body.status && body.status !== "completed") {
      return errorResponse("Completed assignments cannot be reopened", 403);
    }

    const updated = await updateAssignment(id, {
      status: body.status,
      pointsSubmitted: isAdmin ? body.pointsSubmitted : undefined,
      notes: body.notes,
    });
    if (!updated) return errorResponse("Assignment not found", 404);
    return jsonResponse(updated);
  } catch (error) {
    if (isStorageUnavailableError(error)) {
      return errorResponse("Storage service temporarily unavailable", 503, { code: "storage_unavailable" });
    }
    const message = error instanceof Error ? error.message : "Unable to update assignment";
    return errorResponse(message, 400);
  }
}
