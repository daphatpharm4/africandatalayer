import { requireUser } from "../../lib/auth.js";
import { getUserProfile, isStorageUnavailableError, upsertUserProfile } from "../../lib/server/storage/index.js";
import {
  createAssignment,
  getAssignmentById,
  getPlannerContext,
  listAssignments,
  updateAssignment,
} from "../../lib/server/collectionAssignments.js";
import { errorResponse, jsonResponse } from "../../lib/server/http.js";
import type {
  CollectionAssignmentCreateInput,
  CollectionAssignmentStatus,
  CollectionAssignmentUpdateInput,
  MapScope,
} from "../../shared/types.js";

const MAP_SCOPES: ReadonlySet<MapScope> = new Set(["bonamoussadi", "cameroon", "global"]);
const ASSIGNMENT_STATUSES: ReadonlySet<CollectionAssignmentStatus> = new Set([
  "pending",
  "in_progress",
  "completed",
  "expired",
]);

function normalizeMapScope(input: unknown): MapScope | null {
  if (typeof input !== "string") return null;
  const normalized = input.trim().toLowerCase();
  if (!MAP_SCOPES.has(normalized as MapScope)) return null;
  return normalized as MapScope;
}

function normalizeAssignmentStatus(input: unknown): CollectionAssignmentStatus | null {
  if (typeof input !== "string") return null;
  const normalized = input.trim().toLowerCase();
  if (!ASSIGNMENT_STATUSES.has(normalized as CollectionAssignmentStatus)) return null;
  return normalized as CollectionAssignmentStatus;
}

function isAdminToken(token: unknown): boolean {
  return (token as { isAdmin?: unknown } | undefined)?.isAdmin === true;
}

export async function GET(request: Request): Promise<Response> {
  const auth = await requireUser(request);
  if (!auth) return errorResponse("Unauthorized", 401);
  const authIsAdmin = isAdminToken(auth.token);
  const url = new URL(request.url);
  const view = url.searchParams.get("view");

  if (view === "assignments") {
    const status = normalizeAssignmentStatus(url.searchParams.get("status"));
    const scope = url.searchParams.get("scope");
    const requestedAgent = url.searchParams.get("agentUserId")?.trim().toLowerCase() ?? null;
    const allowAll = authIsAdmin && scope === "all";

    try {
      const assignments = await listAssignments({
        viewerUserId: auth.id,
        isAdmin: allowAll,
        status,
        agentUserId: allowAll ? requestedAgent : null,
      });
      return jsonResponse(assignments, { status: 200 });
    } catch (error) {
      if (isStorageUnavailableError(error)) {
        return errorResponse("Storage service temporarily unavailable", 503, { code: "storage_unavailable" });
      }
      throw error;
    }
  }

  if (view === "assignment_planner_context") {
    if (!authIsAdmin) return errorResponse("Forbidden", 403);
    const status = normalizeAssignmentStatus(url.searchParams.get("status"));
    const requestedAgent = url.searchParams.get("agentUserId")?.trim().toLowerCase() ?? null;
    try {
      const [context, assignments] = await Promise.all([
        getPlannerContext(),
        listAssignments({
          viewerUserId: auth.id,
          isAdmin: true,
          status,
          agentUserId: requestedAgent,
        }),
      ]);
      return jsonResponse({ context, assignments }, { status: 200 });
    } catch (error) {
      if (isStorageUnavailableError(error)) {
        return errorResponse("Storage service temporarily unavailable", 503, { code: "storage_unavailable" });
      }
      throw error;
    }
  }

  try {
    const profile = await getUserProfile(auth.id);
    if (!profile) return errorResponse("Profile not found", 404);

    if (authIsAdmin && (!profile.isAdmin || profile.mapScope !== "global")) {
      profile.isAdmin = true;
      profile.mapScope = "global";
      await upsertUserProfile(auth.id, profile);
    }

    return jsonResponse(profile, { status: 200 });
  } catch (error) {
    if (isStorageUnavailableError(error)) {
      return errorResponse("Storage service temporarily unavailable", 503, { code: "storage_unavailable" });
    }
    throw error;
  }
}

interface UpdateUserBody {
  occupation?: unknown;
  mapScope?: unknown;
}

export async function PUT(request: Request): Promise<Response> {
  const auth = await requireUser(request);
  if (!auth) return errorResponse("Unauthorized", 401);

  let body: UpdateUserBody;
  try {
    body = (await request.json()) as UpdateUserBody;
  } catch {
    return errorResponse("Invalid JSON body", 400);
  }

  try {
    const profile = await getUserProfile(auth.id);
    if (!profile) return errorResponse("Profile not found", 404);

    if (body?.occupation !== undefined) {
      if (typeof body.occupation !== "string") return errorResponse("Invalid occupation", 400);
      const normalized = body.occupation.trim();
      if (normalized.length > 120) return errorResponse("Occupation exceeds maximum length", 400);
      profile.occupation = normalized;
    }

    if (body?.mapScope !== undefined) {
      const nextScope = normalizeMapScope(body.mapScope);
      if (!nextScope) return errorResponse("Invalid mapScope", 400);
      if (!profile.isAdmin && nextScope !== "bonamoussadi") {
        return errorResponse("Only admin users can unlock map scope", 403);
      }
      profile.mapScope = nextScope;
    }

    await upsertUserProfile(auth.id, profile);
    return jsonResponse(profile, { status: 200 });
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
  const authIsAdmin = isAdminToken(auth.token);
  if (!authIsAdmin) return errorResponse("Forbidden", 403);

  const url = new URL(request.url);
  const view = url.searchParams.get("view");
  if (view !== "assignments") return errorResponse("Invalid view", 400);

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

interface AssignmentPatchBody extends CollectionAssignmentUpdateInput {
  id?: unknown;
}

export async function PATCH(request: Request): Promise<Response> {
  const auth = await requireUser(request);
  if (!auth) return errorResponse("Unauthorized", 401);
  const authIsAdmin = isAdminToken(auth.token);

  const url = new URL(request.url);
  const view = url.searchParams.get("view");
  if (view !== "assignments") return errorResponse("Invalid view", 400);

  let body: AssignmentPatchBody;
  try {
    body = (await request.json()) as AssignmentPatchBody;
  } catch {
    return errorResponse("Invalid JSON body", 400);
  }

  const id = typeof body.id === "string" ? body.id.trim() : "";
  if (!id) return errorResponse("Assignment id is required", 400);

  try {
    const existing = await getAssignmentById(id);
    if (!existing) return errorResponse("Assignment not found", 404);
    if (!authIsAdmin && existing.agentUserId !== auth.id.toLowerCase().trim()) {
      return errorResponse("Forbidden", 403);
    }
    if (!authIsAdmin && body.status === "expired") {
      return errorResponse("Only admins can expire assignments", 403);
    }
    if (!authIsAdmin && existing.status === "completed" && body.status && body.status !== "completed") {
      return errorResponse("Completed assignments cannot be reopened", 403);
    }

    const updated = await updateAssignment(id, {
      status: body.status,
      pointsSubmitted: authIsAdmin ? body.pointsSubmitted : undefined,
      notes: body.notes,
    });
    if (!updated) return errorResponse("Assignment not found", 404);
    return jsonResponse(updated, { status: 200 });
  } catch (error) {
    if (isStorageUnavailableError(error)) {
      return errorResponse("Storage service temporarily unavailable", 503, { code: "storage_unavailable" });
    }
    const message = error instanceof Error ? error.message : "Unable to update assignment";
    return errorResponse(message, 400);
  }
}
