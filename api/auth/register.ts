import bcrypt from "bcryptjs";
import { getUserProfile, isStorageUnavailableError, upsertUserProfile } from "../../lib/server/storage/index.js";
import { errorResponse, jsonResponse } from "../../lib/server/http.js";
import type { UserProfile } from "../../shared/types.js";

export async function POST(request: Request): Promise<Response> {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return errorResponse("Invalid JSON body", 400);
  }

  const email = (body?.email as string | undefined)?.toLowerCase().trim();
  const password = body?.password as string | undefined;
  const name = (body?.name as string | undefined)?.trim() ?? "";

  if (!email || !password) {
    return errorResponse("Email and password are required", 400);
  }

  if (password.length < 8) {
    return errorResponse("Password must be at least 8 characters", 400);
  }

  try {
    const existing = await getUserProfile(email);
    if (existing) {
      return errorResponse("User already exists", 409);
    }

    const profile: UserProfile = {
      id: email,
      name: name || email.split("@")[0],
      email,
      image: "",
      occupation: "",
      XP: 0,
      passwordHash: bcrypt.hashSync(password, 10),
      mapScope: "bonamoussadi",
    };

    await upsertUserProfile(email, profile);
    return jsonResponse({ ok: true }, { status: 201 });
  } catch (error) {
    if (isStorageUnavailableError(error)) {
      return errorResponse("Storage service temporarily unavailable", 503, { code: "storage_unavailable" });
    }
    throw error;
  }
}
