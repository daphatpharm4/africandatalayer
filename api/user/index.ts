import { requireUser } from "../../lib/auth.js";
import { getUserProfile, isStorageUnavailableError, upsertUserProfile } from "../../lib/server/storage/index.js";
import { errorResponse, jsonResponse } from "../../lib/server/http.js";
import type { MapScope } from "../../shared/types.js";

const MAP_SCOPES: ReadonlySet<MapScope> = new Set(["bonamoussadi", "cameroon", "global"]);

function normalizeMapScope(input: unknown): MapScope | null {
  if (typeof input !== "string") return null;
  const normalized = input.trim().toLowerCase();
  if (!MAP_SCOPES.has(normalized as MapScope)) return null;
  return normalized as MapScope;
}

export async function GET(request: Request): Promise<Response> {
  const auth = await requireUser(request);
  if (!auth) return errorResponse("Unauthorized", 401);
  const authIsAdmin = (auth.token as { isAdmin?: unknown } | undefined)?.isAdmin === true;

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

export async function PUT(request: Request): Promise<Response> {
  const auth = await requireUser(request);
  if (!auth) return errorResponse("Unauthorized", 401);

  let body: any;
  try {
    body = await request.json();
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
