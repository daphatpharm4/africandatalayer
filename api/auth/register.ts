import bcrypt from "bcryptjs";
import { createHash } from "node:crypto";
import { getUserProfile, isStorageUnavailableError, upsertUserProfile } from "../../lib/server/storage/index.js";
import { errorResponse, jsonResponse } from "../../lib/server/http.js";
import { inferDefaultDisplayName, normalizeIdentifier } from "../../lib/shared/identifier.js";
import { registerBodySchema } from "../../lib/server/validation.js";
import { consumeRateLimit, extractRateLimitIp } from "../../lib/server/rateLimit.js";
import { DEFAULT_AVATAR_PRESET, encodeAvatarPresetImage } from "../../shared/avatarPresets.js";
import type { UserProfile } from "../../shared/types.js";
import { preflightResponse, applyCorsHeaders } from "../../lib/server/auth/cors.js";
import { query } from "../../lib/server/db.js";
import { logSecurityEvent } from "../../lib/server/securityAudit.js";
import { POLICY_VERSIONS, type PolicyKind } from "../../shared/legalPolicies.js";

const REGISTER_IP_LIMIT_PER_HOUR = Number(process.env.REGISTER_IP_LIMIT_PER_HOUR ?? "20") || 20;
const REGISTER_IDENTIFIER_LIMIT_PER_HOUR = Number(process.env.REGISTER_IDENTIFIER_LIMIT_PER_HOUR ?? "5") || 5;

type GetUserProfileFn = typeof getUserProfile;
type UpsertUserProfileFn = typeof upsertUserProfile;
type ConsumeRateLimitFn = typeof consumeRateLimit;
type HashPasswordFn = typeof bcrypt.hash;
type RecordPolicyAcceptanceFn = (input: {
  userId: string;
  kinds: PolicyKind[];
  ipHash: string | null;
  userAgent: string | null;
  request: Request;
}) => Promise<void>;

async function defaultRecordPolicyAcceptance({
  userId,
  kinds,
  ipHash,
  userAgent,
  request,
}: {
  userId: string;
  kinds: PolicyKind[];
  ipHash: string | null;
  userAgent: string | null;
  request: Request;
}): Promise<void> {
  for (const kind of kinds) {
    await query(
      `INSERT INTO policy_acceptance (user_id, policy_kind, version, ip_hash, user_agent)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (user_id, policy_kind, version) DO NOTHING`,
      [userId, kind, POLICY_VERSIONS[kind], ipHash, userAgent],
    );
  }
  await logSecurityEvent({
    eventType: "policy_accepted",
    userId,
    request,
    details: {
      context: "register",
      kinds,
      versions: kinds.reduce<Record<string, string>>((acc, kind) => {
        acc[kind] = POLICY_VERSIONS[kind];
        return acc;
      }, {}),
    },
  });
}

export function createRegisterHandler(
  deps: {
    getUserProfileFn?: GetUserProfileFn;
    upsertUserProfileFn?: UpsertUserProfileFn;
    consumeRateLimitFn?: ConsumeRateLimitFn;
    hashPasswordFn?: HashPasswordFn;
    recordPolicyAcceptanceFn?: RecordPolicyAcceptanceFn;
  } = {},
): (request: Request) => Promise<Response> {
  const getUserProfileFn = deps.getUserProfileFn ?? getUserProfile;
  const upsertUserProfileFn = deps.upsertUserProfileFn ?? upsertUserProfile;
  const consumeRateLimitFn = deps.consumeRateLimitFn ?? consumeRateLimit;
  const hashPasswordFn = deps.hashPasswordFn ?? bcrypt.hash;
  const recordPolicyAcceptanceFn = deps.recordPolicyAcceptanceFn ?? defaultRecordPolicyAcceptance;

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

      const ipForHash = requestIp ?? extractRateLimitIp(request);
      const ipHash = ipForHash ? createHash("sha256").update(ipForHash).digest("hex") : null;
      const userAgent = request.headers.get("user-agent");
      await recordPolicyAcceptanceFn({
        userId: identifier,
        kinds: body.acceptedPolicies as PolicyKind[],
        ipHash,
        userAgent,
        request,
      });

      return jsonResponse({ ok: true }, { status: 201 });
    } catch (error) {
      if (isStorageUnavailableError(error)) {
        return errorResponse("Storage service temporarily unavailable", 503, { code: "storage_unavailable" });
      }
      throw error;
    }
  };
}

const handleRegister = createRegisterHandler();

export async function OPTIONS(request: Request): Promise<Response> {
  return preflightResponse(request);
}

export async function POST(request: Request): Promise<Response> {
  const response = await handleRegister(request);
  applyCorsHeaders(request, response);
  return response;
}
