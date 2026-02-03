import { requireUser } from "../../lib/auth.js";
import { getUserProfile, setUserProfile } from "../../lib/edgeConfig.js";
import { errorResponse, jsonResponse } from "../../lib/server/http.js";

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

  await setUserProfile(auth.id, profile);
  return jsonResponse(profile, { status: 200 });
}
