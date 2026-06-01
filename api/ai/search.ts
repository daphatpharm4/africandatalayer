import { ZodError } from "zod";
import { requireUser } from "../../lib/auth.js";
import { errorResponse, jsonResponse } from "../../lib/server/http.js";
import { GeminiConfigError, GeminiUpstreamError, searchLocationsServer } from "../../lib/server/geminiSearch.js";
import { consumeBucket, consumeRateLimit, extractRateLimitIp, resolveBucketStore } from "../../lib/server/rateLimit.js";
import { buildAiAuditMetadata } from "../../lib/server/ai/audit.js";
import { answerAnalyticsQuestion, draftAnalyticsReport } from "../../lib/server/ai/analyticsAssistant.js";
import { buildAnalyticsQueryPlan, gatherAggregateAnalyticsFacts } from "../../lib/server/ai/analyticsFacts.js";
import { extractSubmissionFields } from "../../lib/server/ai/extractSubmissionFields.js";
import { defaultAiModelClient, AiModelUpstreamError, type AiModelClient } from "../../lib/server/ai/modelClient.js";
import { buildReviewSummary } from "../../lib/server/ai/reviewAssistant.js";
import { hashAiInput, redactDetailsForAi } from "../../lib/server/ai/redaction.js";
import { isStorageUnavailableError, query } from "../../lib/server/db.js";
import {
  aiAnalyticsQueryRequestSchema,
  aiExtractionRequestSchema,
  aiReviewSummaryRequestSchema,
} from "../../lib/server/validation.js";

export const maxDuration = 60;

const MAX_QUERY_LENGTH = 200;
const AI_SEARCH_USER_LIMIT_PER_HOUR = Number(process.env.AI_SEARCH_USER_LIMIT_PER_HOUR ?? "50") || 50;
const AI_SEARCH_IP_LIMIT_PER_HOUR = Number(process.env.AI_SEARCH_IP_LIMIT_PER_HOUR ?? "100") || 100;
const AI_EXTRACT_USER_LIMIT_PER_HOUR = Number(process.env.AI_EXTRACT_USER_LIMIT_PER_HOUR ?? "60") || 60;

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
type QueryFn = typeof query;
type AuthUser = NonNullable<Awaited<ReturnType<RequireUserFn>>>;

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
  deps: {
    requireUserFn?: RequireUserFn;
    searchFn?: SearchFn;
    consumeRateLimitFn?: ConsumeRateLimitFn;
    modelClient?: AiModelClient;
    queryFn?: QueryFn;
  } = {},
): (request: Request) => Promise<Response> {
  const requireUserFn = deps.requireUserFn ?? requireUser;
  const searchFn = deps.searchFn ?? searchLocationsServer;
  const consumeRateLimitFn = deps.consumeRateLimitFn ?? consumeRateLimit;
  const modelClient = deps.modelClient ?? defaultAiModelClient;
  const queryFn = deps.queryFn ?? query;

  async function readObjectBody(request: Request): Promise<Record<string, unknown> | Response> {
    try {
      const raw = await request.json();
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
        return errorResponse("Invalid request body", 400);
      }
      return raw as Record<string, unknown>;
    } catch {
      return errorResponse("Invalid JSON body", 400);
    }
  }

  function isResponse(value: unknown): value is Response {
    return value instanceof Response;
  }

  function isClientOrAdmin(auth: AuthUser): boolean {
    const token = auth.token as { isAdmin?: unknown; role?: unknown } | undefined;
    const role = typeof token?.role === "string" ? token.role : auth.role;
    return role === "client" || role === "admin" || token?.isAdmin === true;
  }

  function isAdmin(auth: AuthUser): boolean {
    const token = auth.token as { isAdmin?: unknown; role?: unknown } | undefined;
    return auth.role === "admin" || token?.isAdmin === true || token?.role === "admin";
  }

  function resolveRole(auth: AuthUser): string {
    const token = auth.token as { isAdmin?: unknown; role?: unknown } | undefined;
    if (token?.isAdmin === true) return "admin";
    if (typeof token?.role === "string") return token.role;
    return auth.role;
  }

  async function handleExtractSubmission(request: Request, auth: AuthUser): Promise<Response> {
    const rateLimit = await consumeRateLimitFn({
      route: "POST /api/ai/extract-submission:user",
      key: auth.id,
      windowSeconds: 60 * 60,
      max: AI_EXTRACT_USER_LIMIT_PER_HOUR,
      request,
      userId: auth.id,
    });
    if (!rateLimit.allowed) {
      return jsonResponse(
        { error: "Too many requests", code: "rate_limited" },
        { status: 429, headers: { "retry-after": String(rateLimit.retryAfterSeconds) } },
      );
    }

    const rawBody = await readObjectBody(request);
    if (isResponse(rawBody)) return rawBody;
    const validation = aiExtractionRequestSchema.safeParse(rawBody);
    if (!validation.success) {
      return errorResponse(validation.error.issues[0]?.message ?? "Invalid extraction request", 400);
    }

    const body = validation.data;
    const redactedDraftDetails = redactDetailsForAi(body.draftDetails ?? {});
    const auditInput = {
      category: body.category ?? null,
      location: body.location,
      language: body.language,
      draftDetails: redactedDraftDetails,
      photoUrl: body.photoUrl ?? null,
      imageDataHash: body.imageData ? hashAiInput(body.imageData) : null,
    };
    const result = await extractSubmissionFields(
      {
        category: body.category ?? null,
        imageData: body.imageData,
        photoUrl: body.photoUrl,
        location: body.location,
        language: body.language,
        draftDetails: body.draftDetails,
      },
      modelClient,
    );
    const audit = buildAiAuditMetadata(auditInput, result.modelMetadata);

    await queryFn(
      `INSERT INTO ai_extractions (
         user_id, category, input_hash, output_json, accepted_fields_json, rejected_fields_json,
         model_provider, model_name, model_version, prompt_version
       )
       VALUES ($1, $2, $3, $4::jsonb, '{}'::jsonb, '{}'::jsonb, $5, $6, $7, $8)`,
      [
        auth.id,
        body.category ?? result.detectedCategory,
        audit.inputHash,
        JSON.stringify(result),
        audit.modelProvider,
        audit.modelName,
        audit.modelVersion,
        audit.promptVersion,
      ],
    );
    return jsonResponse(result, { status: 200 });
  }

  async function handleReviewSummary(request: Request, auth: AuthUser): Promise<Response> {
    if (!isAdmin(auth)) return errorResponse("Forbidden", 403);
    const rawBody = await readObjectBody(request);
    if (isResponse(rawBody)) return rawBody;
    const validation = aiReviewSummaryRequestSchema.safeParse(rawBody);
    if (!validation.success) {
      return errorResponse(validation.error.issues[0]?.message ?? "Invalid review summary request", 400);
    }

    const eventResult = await queryFn<{ id: string; point_id: string; details: Record<string, unknown> | null }>(
      `SELECT id, point_id, details
       FROM point_events
       WHERE id = $1::uuid
       LIMIT 1`,
      [validation.data.eventId],
    );
    const event = eventResult.rows[0];
    if (!event) return errorResponse("Submission event not found", 404);

    const details = event.details && typeof event.details === "object" ? event.details : {};
    const reviewFlags = Array.isArray(details.reviewFlags)
      ? details.reviewFlags.filter((flag): flag is string => typeof flag === "string" && flag.trim().length > 0)
      : [];
    const riskScore = typeof details.riskScore === "number" ? details.riskScore : Number(details.riskScore ?? 0) || 0;
    const riskComponents = details.riskComponents && typeof details.riskComponents === "object"
      ? details.riskComponents as Record<string, unknown>
      : {};
    const reviewStatus = typeof details.reviewStatus === "string" ? details.reviewStatus : null;
    const input = {
      eventId: event.id,
      pointId: event.point_id,
      reviewStatus,
      riskScore,
      reviewFlags,
      riskComponents,
    };
    const result = await buildReviewSummary(input, modelClient);
    const audit = buildAiAuditMetadata(input, result.modelMetadata);

    await queryFn(
      `INSERT INTO ai_review_summaries (
         event_id, point_id, review_status_at_generation, risk_score_at_generation, summary_json,
         model_provider, model_name, model_version, prompt_version
       )
       VALUES ($1::uuid, $2, $3, $4, $5::jsonb, $6, $7, $8, $9)`,
      [
        event.id,
        event.point_id,
        reviewStatus,
        riskScore,
        JSON.stringify({ ...result, inputHash: audit.inputHash }),
        audit.modelProvider,
        audit.modelName,
        audit.modelVersion,
        audit.promptVersion,
      ],
    );
    return jsonResponse(result, { status: 200 });
  }

  async function handleAnalyticsAssistant(request: Request, auth: AuthUser, reportDraft: boolean): Promise<Response> {
    if (!isClientOrAdmin(auth)) return errorResponse("Forbidden", 403);
    const rawBody = await readObjectBody(request);
    if (isResponse(rawBody)) return rawBody;
    const validation = aiAnalyticsQueryRequestSchema.safeParse(rawBody);
    if (!validation.success) {
      return errorResponse(validation.error.issues[0]?.message ?? "Invalid analytics query request", 400);
    }

    const body = validation.data;
    const queryPlan = { ...buildAnalyticsQueryPlan(body), mode: reportDraft ? "report_draft" : "analytics_query" };
    const facts = await gatherAggregateAnalyticsFacts(body, queryFn);
    const result = reportDraft
      ? await draftAnalyticsReport({ ...body, facts }, modelClient)
      : await answerAnalyticsQuestion({ ...body, facts }, modelClient);
    const responseBody = reportDraft
      ? {
          ...result,
          reportSections: [
            { title: "Executive summary", body: result.answer },
            { title: "Evidence", bullets: result.facts.map((fact) => `${fact.label}: ${fact.value} (${fact.source})`) },
            { title: "Caveats", bullets: result.caveats },
            { title: "Next validations", bullets: result.suggestedNextValidations },
          ],
        }
      : result;
    const audit = buildAiAuditMetadata({ ...queryPlan, question: body.question }, result.modelMetadata);

    await queryFn(
      `INSERT INTO ai_analytics_runs (
         user_id, role, client_scope, question, query_plan_json, answer_json,
         model_provider, model_name, model_version, prompt_version
       )
       VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7, $8, $9, $10)`,
      [
        auth.id,
        resolveRole(auth),
        body.zone ?? null,
        body.question,
        JSON.stringify({ ...queryPlan, inputHash: audit.inputHash }),
        JSON.stringify(responseBody),
        audit.modelProvider,
        audit.modelName,
        audit.modelVersion,
        audit.promptVersion,
      ],
    );
    return jsonResponse(responseBody, { status: 200 });
  }

  return async function handleAiSearch(request: Request): Promise<Response> {
    const auth = await requireUserFn(request);
    if (!auth) return errorResponse("Unauthorized", 401);

    const url = new URL(request.url);
    const view = url.searchParams.get("view");

    try {
      if (view === "extract-submission") return await handleExtractSubmission(request, auth);
      if (view === "review-summary") return await handleReviewSummary(request, auth);
      if (view === "analytics-query") return await handleAnalyticsAssistant(request, auth, false);
      if (view === "report-draft") return await handleAnalyticsAssistant(request, auth, true);
    } catch (error) {
      if (error instanceof ZodError) {
        return errorResponse("Invalid AI model output", 502, { code: "ai_invalid_output" });
      }
      if (error instanceof AiModelUpstreamError) {
        return errorResponse("AI model unavailable", 503, { code: "ai_unavailable" });
      }
      if (isStorageUnavailableError(error)) {
        return errorResponse("Storage service temporarily unavailable", 503, { code: "storage_unavailable" });
      }
      console.error(`[ai/${view ?? "search"}] unexpected error`, error);
      return errorResponse("Internal server error", 500);
    }

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

    const burstStore = await resolveBucketStore();
    const burst = await consumeBucket({
      store: burstStore,
      route: "ai:search",
      key: requestIp ?? "anon",
      strategy: "token",
      capacity: 5,
      refillPerSec: 1,
    });
    if (!burst.allowed) {
      return errorResponse("Too many requests, slow down", 429, { code: "rate_limited" });
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
