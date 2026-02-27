import bcrypt from "bcryptjs";
import { getUserProfile, isStorageUnavailableError, upsertUserProfile } from "../../lib/server/storage/index.js";
import { errorResponse, jsonResponse } from "../../lib/server/http.js";
import { inferDefaultDisplayName, normalizeIdentifier } from "../../lib/shared/identifier.js";
import type { UserProfile } from "../../shared/types.js";

interface RegisterBody {
  identifier?: string;
  email?: string;
  password?: string;
  name?: string;
}

export async function POST(request: Request): Promise<Response> {
  let body: RegisterBody;
  try {
    body = (await request.json()) as RegisterBody;
  } catch {
    return errorResponse("Invalid JSON body", 400);
  }

  const rawIdentifier = body?.identifier ?? body?.email;
  const normalizedIdentifier = normalizeIdentifier(rawIdentifier);
  const password = body?.password;
  const name = body?.name?.trim() ?? "";

  if (!normalizedIdentifier || !password) {
    return errorResponse("Phone/email and password are required", 400);
  }

  if (password.length < 8) {
    return errorResponse("Password must be at least 8 characters", 400);
  }

  try {
    const identifier = normalizedIdentifier.value;
    const existing = await getUserProfile(identifier);
    if (existing) {
      return errorResponse("User already exists", 409);
    }

    const profile: UserProfile = {
      id: identifier,
      name: name || inferDefaultDisplayName(identifier),
      email: normalizedIdentifier.type === "email" ? identifier : null,
      phone: normalizedIdentifier.type === "phone" ? identifier : null,
      image: "",
      occupation: "",
      XP: 0,
      passwordHash: bcrypt.hashSync(password, 10),
      mapScope: "bonamoussadi",
    };

    await upsertUserProfile(identifier, profile);
    return jsonResponse({ ok: true }, { status: 201 });
  } catch (error) {
    if (isStorageUnavailableError(error)) {
      return errorResponse("Storage service temporarily unavailable", 503, { code: "storage_unavailable" });
    }
    throw error;
  }
}
