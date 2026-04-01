import { requireUser } from "../../lib/auth.js";
import { errorResponse, jsonResponse } from "../../lib/server/http.js";
import { GeminiConfigError, GeminiUpstreamError, searchLocationsServer } from "../../lib/server/geminiSearch.js";
import { consumeRateLimit, extractRateLimitIp } from "../../lib/server/rateLimit.js";

export const maxDuration = 60;

const MAX_QUERY_LENGTH = 200;
const AI_SEARCH_USER_LIMIT_PER_HOUR = Number(process.env.AI_SEARCH_USER_LIMIT_PER_HOUR ?? "50") || 50;
const AI_SEARCH_IP_LIMIT_PER_HOUR = Number(process.env.AI_SEARCH_IP_LIMIT_PER_HOUR ?? "100") || 100;

interface SearchBody {
  query?: unknown;
  lat?: unknown;
  lng?: unknown;
}

interface ValidatedSearchRequest {
  query: string;
  lat?: number;
  lng?: number;
}

type RequireUserFn = typeof requireUser;
type SearchFn = typeof searchLocationsServer;
type ConsumeRateLimitFn = typeof consumeRateLimit;

function parseNumber(input: unknown): number | null {
  if (typeof input === "number" && Number.isFinite(input)) return input;
  if (typeof input !== "string") return null;
  const trimmed = input.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

export function validateSearchBody(input: SearchBody): { ok: true; value: ValidatedSearchRequest } | { ok: false; error: string } {
  const query = typeof input.query === "string" ? input.query.trim() : "";
  if (!query) return { ok: false, error: "query is required" };
  if (query.length > MAX_QUERY_LENGTH) {
    return { ok: false, error: `query must be ${MAX_QUERY_LENGTH} characters or fewer` };
  }

  const hasLat = input.lat !== undefined;
  const hasLng = input.lng !== undefined;
  if (hasLat !== hasLng) return { ok: false, error: "lat and lng must be provided together" };

  if (!hasLat && !hasLng) {
    return {
      ok: true,
      value: { query },
    };
  }

  const lat = parseNumber(input.lat);
  const lng = parseNumber(input.lng);
  if (lat === null || lng === null) {
    return { ok: false, error: "lat and lng must be valid numbers" };
  }

  return {
    ok: true,
    value: { query, lat, lng },
  };
}

export function createAiSearchHandler(
  deps: { requireUserFn?: RequireUserFn; searchFn?: SearchFn; consumeRateLimitFn?: ConsumeRateLimitFn } = {},
): (request: Request) => Promise<Response> {
  const requireUserFn = deps.requireUserFn ?? requireUser;
  const searchFn = deps.searchFn ?? searchLocationsServer;
  const consumeRateLimitFn = deps.consumeRateLimitFn ?? consumeRateLimit;

  return async function handleAiSearch(request: Request): Promise<Response> {
    const auth = await requireUserFn(request);
    if (!auth) return errorResponse("Unauthorized", 401);

    let body: SearchBody;
    try {
      const rawBody = await request.json();
      if (!rawBody || typeof rawBody !== "object" || Array.isArray(rawBody)) {
        return errorResponse("Invalid request body", 400);
      }
      body = rawBody as SearchBody;
    } catch {
      return errorResponse("Invalid JSON body", 400);
    }

    const validated = validateSearchBody(body);
    if ("error" in validated) return errorResponse(validated.error, 400);

    const requestIp = extractRateLimitIp(request) ?? "unknown";
    const [userRateLimit, ipRateLimit] = await Promise.all([
      consumeRateLimitFn({
        route: "POST /api/ai/search:user",
        key: auth.id,
        windowSeconds: 60 * 60,
        max: AI_SEARCH_USER_LIMIT_PER_HOUR,
        request,
        userId: auth.id,
      }),
      consumeRateLimitFn({
        route: "POST /api/ai/search:ip",
        key: requestIp,
        windowSeconds: 60 * 60,
        max: AI_SEARCH_IP_LIMIT_PER_HOUR,
        request,
        userId: auth.id,
      }),
    ]);
    if (!userRateLimit.allowed || !ipRateLimit.allowed) {
      const retryAfterSeconds = Math.max(userRateLimit.retryAfterSeconds, ipRateLimit.retryAfterSeconds);
      return jsonResponse(
        { error: "Too many requests", code: "rate_limited" },
        { status: 429, headers: { "retry-after": String(retryAfterSeconds) } },
      );
    }

    try {
      const result = await searchFn(validated.value.query, validated.value.lat, validated.value.lng);
      return jsonResponse(result, { status: 200 });
    } catch (error) {
      if (error instanceof GeminiConfigError) {
        return errorResponse("Gemini service unavailable", 503, { code: "gemini_unconfigured" });
      }
      if (error instanceof GeminiUpstreamError) {
        return errorResponse("Gemini service unavailable", 503, { code: "gemini_unavailable" });
      }
      console.error("[ai/search] unexpected error", error);
      return errorResponse("Internal server error", 500);
    }
  };
}

export const POST = createAiSearchHandler();
