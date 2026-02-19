import { requireUser } from "../../lib/auth.js";
import { getUserProfile, setUserProfile } from "../../lib/edgeConfig.js";
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

  const profile = await getUserProfile(auth.id);
  if (!profile) return errorResponse("Profile not found", 404);

  return jsonResponse(profile, { status: 200 });
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

  const profile = await getUserProfile(auth.id);
  if (!profile) return errorResponse("Profile not found", 404);

  if (body?.occupation !== undefined) {
    profile.occupation = body.occupation;
  }

  if (body?.mapScope !== undefined) {
    const nextScope = normalizeMapScope(body.mapScope);
    if (!nextScope) return errorResponse("Invalid mapScope", 400);
    if (!profile.isAdmin && nextScope !== "bonamoussadi") {
      return errorResponse("Only admin users can unlock map scope", 403);
    }
    profile.mapScope = nextScope;
  }

  await setUserProfile(auth.id, profile);
  return jsonResponse(profile, { status: 200 });
}
