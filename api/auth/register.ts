import bcrypt from "bcryptjs";
import { getUserProfile, isStorageUnavailableError, upsertUserProfile } from "../../lib/server/storage/index.js";
import { errorResponse, jsonResponse } from "../../lib/server/http.js";
import { inferDefaultDisplayName, normalizeIdentifier } from "../../lib/shared/identifier.js";
import { registerBodySchema } from "../../lib/server/validation.js";
import type { UserProfile } from "../../shared/types.js";

export async function POST(request: Request): Promise<Response> {
  let parsedBody: unknown;
  try {
    parsedBody = await request.json();
  } catch {
    return errorResponse("Invalid JSON body", 400);
  }

  const validation = registerBodySchema.safeParse(parsedBody);
  if (!validation.success) {
    return errorResponse(validation.error.issues[0]?.message ?? "Invalid registration payload", 400);
  }

  const body = validation.data;
  const rawIdentifier = body?.identifier ?? body?.email;
  const normalizedIdentifier = normalizeIdentifier(rawIdentifier);
  const password = body?.password;
  const name = body?.name?.trim() ?? "";

  if (!normalizedIdentifier || !password) {
    return errorResponse("Phone/email and password are required", 400);
  }

  try {
    const identifier = normalizedIdentifier.value;
    const existing = await getUserProfile(identifier);
    if (existing) {
      return jsonResponse({ ok: true }, { status: 201 });
    }

    const profile: UserProfile = {
      id: identifier,
      name: name || inferDefaultDisplayName(identifier),
      email: normalizedIdentifier.type === "email" ? identifier : null,
      phone: normalizedIdentifier.type === "phone" ? identifier : null,
      image: "",
      occupation: "",
      XP: 0,
      passwordHash: await bcrypt.hash(password, 12),
      mapScope: "bonamoussadi",
      trustScore: 50,
      trustTier: "standard",
      failedLoginCount: 0,
      lockedUntil: null,
      wipeRequested: false,
      suspendedUntil: null,
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
