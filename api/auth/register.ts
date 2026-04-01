import bcrypt from "bcryptjs";
import { getUserProfile, isStorageUnavailableError, upsertUserProfile } from "../../lib/server/storage/index.js";
import { errorResponse, jsonResponse } from "../../lib/server/http.js";
import { inferDefaultDisplayName, normalizeIdentifier } from "../../lib/shared/identifier.js";
import { registerBodySchema } from "../../lib/server/validation.js";
import { consumeRateLimit, extractRateLimitIp } from "../../lib/server/rateLimit.js";
import { DEFAULT_AVATAR_PRESET, encodeAvatarPresetImage } from "../../shared/avatarPresets.js";
import type { UserProfile } from "../../shared/types.js";

const REGISTER_IP_LIMIT_PER_HOUR = Number(process.env.REGISTER_IP_LIMIT_PER_HOUR ?? "20") || 20;
const REGISTER_IDENTIFIER_LIMIT_PER_HOUR = Number(process.env.REGISTER_IDENTIFIER_LIMIT_PER_HOUR ?? "5") || 5;

type GetUserProfileFn = typeof getUserProfile;
type UpsertUserProfileFn = typeof upsertUserProfile;
type ConsumeRateLimitFn = typeof consumeRateLimit;
type HashPasswordFn = typeof bcrypt.hash;

export function createRegisterHandler(
  deps: {
    getUserProfileFn?: GetUserProfileFn;
    upsertUserProfileFn?: UpsertUserProfileFn;
    consumeRateLimitFn?: ConsumeRateLimitFn;
    hashPasswordFn?: HashPasswordFn;
  } = {},
): (request: Request) => Promise<Response> {
  const getUserProfileFn = deps.getUserProfileFn ?? getUserProfile;
  const upsertUserProfileFn = deps.upsertUserProfileFn ?? upsertUserProfile;
  const consumeRateLimitFn = deps.consumeRateLimitFn ?? consumeRateLimit;
  const hashPasswordFn = deps.hashPasswordFn ?? bcrypt.hash;

  return async function handleRegister(request: Request): Promise<Response> {
    let parsedBody: unknown;
    try {
      parsedBody = await request.json();
    } catch {
      return errorResponse("Invalid JSON body", 400);
    }

    const requestIp = extractRateLimitIp(request);
    if (requestIp) {
      const ipRate = await consumeRateLimitFn({
        route: "POST /api/auth/register:ip",
        key: requestIp,
        windowSeconds: 60 * 60,
        max: REGISTER_IP_LIMIT_PER_HOUR,
        request,
      });
      if (!ipRate.allowed) {
        return jsonResponse(
          { error: "Too many requests", code: "rate_limited" },
          { status: 429, headers: { "retry-after": String(ipRate.retryAfterSeconds) } },
        );
      }
    }

    // Extract and normalize identifier first, before password validation,
    // so we can return a 409 conflict if the account already exists rather
    // than a misleading validation error.
    const rawBody = parsedBody as Record<string, unknown> | null;
    const rawIdentifier =
      typeof rawBody?.identifier === "string" ? rawBody.identifier :
      typeof rawBody?.email === "string" ? rawBody.email : "";
    const normalizedIdentifier = normalizeIdentifier(rawIdentifier);

    if (normalizedIdentifier) {
      const identifierRate = await consumeRateLimitFn({
        route: "POST /api/auth/register:identifier",
        key: normalizedIdentifier.value,
        windowSeconds: 60 * 60,
        max: REGISTER_IDENTIFIER_LIMIT_PER_HOUR,
        request,
        userId: normalizedIdentifier.value,
      });
      if (!identifierRate.allowed) {
        return jsonResponse(
          { error: "Too many requests", code: "rate_limited" },
          { status: 429, headers: { "retry-after": String(identifierRate.retryAfterSeconds) } },
        );
      }

      try {
        const existing = await getUserProfileFn(normalizedIdentifier.value);
        if (existing) {
          return errorResponse("An account already exists for this phone/email", 409);
        }
      } catch (error) {
        if (isStorageUnavailableError(error)) {
          return errorResponse("Storage service temporarily unavailable", 503, { code: "storage_unavailable" });
        }
        throw error;
      }
    }

    const validation = registerBodySchema.safeParse(parsedBody);
    if (!validation.success) {
      return errorResponse(validation.error.issues[0]?.message ?? "Invalid registration payload", 400);
    }

    const body = validation.data;
    const password = body?.password;
    const name = body?.name?.trim() ?? "";

    if (!normalizedIdentifier || !password) {
      return errorResponse("Phone/email and password are required", 400);
    }

    try {
      const identifier = normalizedIdentifier.value;
      const profile: UserProfile = {
        id: identifier,
        name: name || inferDefaultDisplayName(identifier),
        email: normalizedIdentifier.type === "email" ? identifier : null,
        phone: normalizedIdentifier.type === "phone" ? identifier : null,
        image: encodeAvatarPresetImage(DEFAULT_AVATAR_PRESET),
        avatarPreset: DEFAULT_AVATAR_PRESET,
        occupation: "",
        XP: 0,
        passwordHash: await hashPasswordFn(password, 12),
        mapScope: "bonamoussadi",
        trustScore: 50,
        trustTier: "standard",
        failedLoginCount: 0,
        lockedUntil: null,
        wipeRequested: false,
        suspendedUntil: null,
      };

      await upsertUserProfileFn(identifier, profile);
      return jsonResponse({ ok: true }, { status: 201 });
    } catch (error) {
      if (isStorageUnavailableError(error)) {
        return errorResponse("Storage service temporarily unavailable", 503, { code: "storage_unavailable" });
      }
      throw error;
    }
  };
}

export const POST = createRegisterHandler();
