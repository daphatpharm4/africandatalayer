import { createHash } from "node:crypto";
import { requireUser } from "../../lib/auth.js";
import { query } from "../../lib/server/db.js";
import { errorResponse, jsonResponse } from "../../lib/server/http.js";
import { logSecurityEvent } from "../../lib/server/securityAudit.js";
import { toSubmissionAuthContext } from "../../lib/server/submissionAccess.js";
import { captureServerException } from "../../lib/server/sentry.js";
import { consumeRateLimit, extractRateLimitIp } from "../../lib/server/rateLimit.js";
import {
  ipReportPatchSchema,
  ipReportSchema,
  policyAcceptanceSchema,
  privacyActionSchema,
  privacyRequestSchema,
} from "../../lib/server/validation.js";
import type { IpReport, PrivacyRequest } from "../../shared/types.js";
import { POLICY_KINDS, POLICY_VERSIONS, type PolicyKind } from "../../shared/legalPolicies.js";
import { handleUnsubscribeRequest, readPostUnsubscribeToken } from "../../lib/server/email/unsubscribe.js";

const IP_REPORT_LIMIT_PER_WINDOW = Number(process.env.IP_REPORT_LIMIT_PER_WINDOW ?? "5") || 5;
const IP_REPORT_WINDOW_SECONDS = Number(process.env.IP_REPORT_WINDOW_SECONDS ?? "600") || 600;

function isMissingDbObjectError(error: unknown): boolean {
  const pg = error as { code?: unknown; message?: unknown } | null;
  const code = typeof pg?.code === "string" ? pg.code : "";
  if (code === "42P01" || code === "42703") return true;
  const message = typeof pg?.message === "string" ? pg.message.toLowerCase() : "";
  return message.includes("does not exist") || message.includes("undefined table") || message.includes("undefined column");
}

function requestQueryClause(): string {
  return `
    point_id = $1
    OR user_id = $1
    OR details->>'phone' = $1
    OR lower(COALESCE(details->>'name', '')) = lower($1)
    OR lower(COALESCE(details->>'siteName', '')) = lower($1)
  `;
}

function hashIp(ip: string | null): string | null {
  if (!ip) return null;
  return createHash("sha256").update(ip).digest("hex");
}

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const view = url.searchParams.get("view") ?? "requests";

  if (view === "unsubscribe") {
    return handleUnsubscribeRequest(url.searchParams.get("token"));
  }

  const auth = await requireUser(request);
  if (!auth) return errorResponse("Unauthorized", 401);
  const viewer = toSubmissionAuthContext(auth);

  try {
    if (view === "acceptance") {
      const accepted = await query<{ policy_kind: PolicyKind; version: string }>(
        `SELECT policy_kind, version
         FROM policy_acceptance
         WHERE user_id = $1`,
        [auth.id],
      );
      const acceptedMap = new Map<PolicyKind, Set<string>>();
      for (const row of accepted.rows) {
        const set = acceptedMap.get(row.policy_kind) ?? new Set<string>();
        set.add(row.version);
        acceptedMap.set(row.policy_kind, set);
      }
      const outstanding = POLICY_KINDS.filter((kind) => {
        const current = POLICY_VERSIONS[kind];
        return !acceptedMap.get(kind)?.has(current);
      });
      return jsonResponse(
        {
          outstanding,
          current: POLICY_VERSIONS,
        },
        { status: 200 },
      );
    }

    if (view === "requests") {
      if (!viewer?.isAdmin) return errorResponse("Forbidden", 403);
      const result = await query<PrivacyRequest>(
        `SELECT id::text, request_type AS "requestType", status, subject_reference AS "subjectReference",
                created_by AS "createdBy", assigned_to AS "assignedTo", notes, resolution_notes AS "resolutionNotes",
                created_at AS "createdAt", updated_at AS "updatedAt"
         FROM privacy_requests
         ORDER BY updated_at DESC
         LIMIT 200`,
      );
      return jsonResponse(result.rows, { status: 200 });
    }

    if (view === "ip-reports") {
      if (!viewer?.isAdmin) return errorResponse("Forbidden", 403);
      const result = await query<IpReport>(
        `SELECT id::text, reporter_name AS "reporterName", reporter_email AS "reporterEmail",
                reporter_user AS "reporterUser", target_kind AS "targetKind", target_ref AS "targetRef",
                description, sworn, status, resolution_notes AS "resolutionNotes",
                created_at AS "createdAt", updated_at AS "updatedAt"
         FROM ip_reports
         ORDER BY created_at DESC
         LIMIT 200`,
      );
      return jsonResponse(result.rows, { status: 200 });
    }

    return errorResponse("Invalid view", 400);
  } catch (error) {
    if (isMissingDbObjectError(error)) return jsonResponse([], { status: 200 });
    captureServerException(error, { route: "privacy_get", view });
    throw error;
  }
}

export async function POST(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const view = url.searchParams.get("view") ?? "requests";

  if (view === "unsubscribe") {
    const token = await readPostUnsubscribeToken(request);
    return handleUnsubscribeRequest(token);
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return errorResponse("Invalid JSON body", 400);
  }

  try {
    if (view === "ip-report") {
      const ip = extractRateLimitIp(request);
      if (ip) {
        const rate = await consumeRateLimit({
          route: "POST /api/privacy:ip-report",
          key: ip,
          windowSeconds: IP_REPORT_WINDOW_SECONDS,
          max: IP_REPORT_LIMIT_PER_WINDOW,
          request,
        });
        if (!rate.allowed) {
          return jsonResponse(
            { error: "Too many requests", code: "rate_limited" },
            { status: 429, headers: { "retry-after": String(rate.retryAfterSeconds) } },
          );
        }
      }

      const validation = ipReportSchema.safeParse(rawBody);
      if (!validation.success) {
        return errorResponse(validation.error.issues[0]?.message ?? "Invalid IP report", 400);
      }
      const body = validation.data;

      const maybeAuth = await requireUser(request).catch(() => null);
      const reporterUser = maybeAuth?.id ?? null;
      const userAgent = request.headers.get("user-agent");
      const result = await query<IpReport>(
        `INSERT INTO ip_reports (
           reporter_name, reporter_email, reporter_user, target_kind, target_ref,
           description, sworn, ip_hash, user_agent
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING id::text, reporter_name AS "reporterName", reporter_email AS "reporterEmail",
                   reporter_user AS "reporterUser", target_kind AS "targetKind", target_ref AS "targetRef",
                   description, sworn, status, resolution_notes AS "resolutionNotes",
                   created_at AS "createdAt", updated_at AS "updatedAt"`,
        [
          body.reporterName,
          body.reporterEmail,
          reporterUser,
          body.targetKind,
          body.targetRef ?? null,
          body.description,
          body.sworn,
          hashIp(ip),
          userAgent,
        ],
      );
      await logSecurityEvent({
        eventType: "ip_report_filed",
        userId: reporterUser,
        request,
        details: {
          reportId: result.rows[0]?.id,
          targetKind: body.targetKind,
          targetRef: body.targetRef ?? null,
        },
      });
      return jsonResponse(result.rows[0], { status: 201 });
    }

    if (view === "acceptance") {
      const auth = await requireUser(request);
      if (!auth) return errorResponse("Unauthorized", 401);

      const validation = policyAcceptanceSchema.safeParse(rawBody);
      if (!validation.success) {
        return errorResponse(validation.error.issues[0]?.message ?? "Invalid acceptance", 400);
      }
      const body = validation.data;
      const ipHash = hashIp(extractRateLimitIp(request));
      const userAgent = request.headers.get("user-agent");

      for (const kind of body.accept) {
        await query(
          `INSERT INTO policy_acceptance (user_id, policy_kind, version, ip_hash, user_agent)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (user_id, policy_kind, version) DO NOTHING`,
          [auth.id, kind, POLICY_VERSIONS[kind], ipHash, userAgent],
        );
      }

      await logSecurityEvent({
        eventType: "policy_accepted",
        userId: auth.id,
        request,
        details: {
          kinds: body.accept,
          versions: body.accept.reduce<Record<string, string>>((acc, kind) => {
            acc[kind] = POLICY_VERSIONS[kind];
            return acc;
          }, {}),
        },
      });

      return jsonResponse({ ok: true, recorded: body.accept }, { status: 201 });
    }

    // Admin-only views below.
    const auth = await requireUser(request);
    if (!auth) return errorResponse("Unauthorized", 401);
    const viewer = toSubmissionAuthContext(auth);
    if (!viewer?.isAdmin) return errorResponse("Forbidden", 403);

    if (view === "requests") {
      const validation = privacyRequestSchema.safeParse(rawBody);
      if (!validation.success) {
        return errorResponse(validation.error.issues[0]?.message ?? "Invalid privacy request", 400);
      }
      const body = validation.data;
      const result = await query<PrivacyRequest>(
        `INSERT INTO privacy_requests (request_type, subject_reference, created_by, notes)
         VALUES ($1, $2, $3, $4)
         RETURNING id::text, request_type AS "requestType", status, subject_reference AS "subjectReference",
                   created_by AS "createdBy", assigned_to AS "assignedTo", notes,
                   resolution_notes AS "resolutionNotes", created_at AS "createdAt", updated_at AS "updatedAt"`,
        [body.requestType, body.subjectReference, auth.id, body.notes ?? null],
      );
      await logSecurityEvent({
        eventType: "privacy_request",
        userId: auth.id,
        request,
        details: {
          requestType: body.requestType,
          subjectReference: body.subjectReference,
        },
      });
      return jsonResponse(result.rows[0], { status: 201 });
    }

    if (view === "export") {
      const validation = privacyActionSchema.safeParse(rawBody);
      if (!validation.success) {
        return errorResponse(validation.error.issues[0]?.message ?? "Invalid export request", 400);
      }
      const body = validation.data;
      const result = await query(
        `SELECT id::text, point_id, user_id, category, latitude, longitude, details, photo_url,
                created_at, consent_status, consent_recorded_at, erased_at, erased_by, erasure_reason
         FROM point_events
         WHERE ${requestQueryClause()}
         ORDER BY created_at DESC
         LIMIT 200`,
        [body.subjectReference],
      );
      await logSecurityEvent({
        eventType: "data_export",
        userId: auth.id,
        request,
        details: { subjectReference: body.subjectReference, rows: result.rowCount ?? 0 },
      });
      return jsonResponse(
        {
          subjectReference: body.subjectReference,
          rows: result.rows,
        },
        { status: 200 },
      );
    }

    if (view === "erase") {
      const validation = privacyActionSchema.safeParse(rawBody);
      if (!validation.success) {
        return errorResponse(validation.error.issues[0]?.message ?? "Invalid erasure request", 400);
      }
      const body = validation.data;
      const result = await query(
        `UPDATE point_events
         SET details = COALESCE(details, '{}'::jsonb)
             - 'name'
             - 'siteName'
             - 'phone'
             - 'merchantId'
             - 'merchantIdByProvider'
             - 'secondPhotoUrl',
             photo_url = NULL,
             consent_status = 'withdrawn',
             erased_at = NOW(),
             erased_by = $2,
             erasure_reason = $3
         WHERE ${requestQueryClause()}
         RETURNING id::text`,
        [body.subjectReference, auth.id, body.notes ?? "privacy_request"],
      );
      await logSecurityEvent({
        eventType: "privacy_erasure",
        userId: auth.id,
        request,
        details: { subjectReference: body.subjectReference, rows: result.rowCount ?? 0 },
      });
      return jsonResponse(
        {
          subjectReference: body.subjectReference,
          erasedCount: result.rowCount ?? 0,
        },
        { status: 200 },
      );
    }

    return errorResponse("Invalid view", 400);
  } catch (error) {
    captureServerException(error, { route: "privacy_post", view });
    throw error;
  }
}

export async function PATCH(request: Request): Promise<Response> {
  const auth = await requireUser(request);
  if (!auth) return errorResponse("Unauthorized", 401);
  const viewer = toSubmissionAuthContext(auth);
  if (!viewer?.isAdmin) return errorResponse("Forbidden", 403);

  const url = new URL(request.url);
  const view = url.searchParams.get("view") ?? "requests";

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return errorResponse("Invalid JSON body", 400);
  }

  try {
    if (view === "requests") {
      const body = rawBody as {
        id?: unknown;
        status?: unknown;
        assignedTo?: unknown;
        notes?: unknown;
        resolutionNotes?: unknown;
      };
      const id = typeof body.id === "string" ? body.id.trim() : "";
      const status = typeof body.status === "string" ? body.status.trim().toLowerCase() : "";
      const assignedTo = typeof body.assignedTo === "string" ? body.assignedTo.trim() : null;
      const notes = typeof body.notes === "string" ? body.notes.trim().slice(0, 1000) : null;
      const resolutionNotes = typeof body.resolutionNotes === "string" ? body.resolutionNotes.trim().slice(0, 1000) : null;
      if (!id) return errorResponse("Privacy request id is required", 400);
      if (!["open", "in_progress", "completed", "rejected"].includes(status)) {
        return errorResponse("Invalid privacy request status", 400);
      }

      const result = await query<PrivacyRequest>(
        `UPDATE privacy_requests
         SET status = $2,
             assigned_to = $3,
             notes = COALESCE($4, notes),
             resolution_notes = COALESCE($5, resolution_notes),
             updated_at = NOW()
         WHERE id = $1::uuid
         RETURNING id::text, request_type AS "requestType", status, subject_reference AS "subjectReference",
                   created_by AS "createdBy", assigned_to AS "assignedTo", notes,
                   resolution_notes AS "resolutionNotes", created_at AS "createdAt", updated_at AS "updatedAt"`,
        [id, status, assignedTo, notes, resolutionNotes],
      );
      if (!result.rows[0]) return errorResponse("Privacy request not found", 404);
      return jsonResponse(result.rows[0], { status: 200 });
    }

    if (view === "ip-report") {
      const validation = ipReportPatchSchema.safeParse(rawBody);
      if (!validation.success) {
        return errorResponse(validation.error.issues[0]?.message ?? "Invalid IP report update", 400);
      }
      const body = validation.data;
      const result = await query<IpReport>(
        `UPDATE ip_reports
         SET status = $2,
             resolution_notes = COALESCE($3, resolution_notes),
             updated_at = NOW()
         WHERE id = $1::uuid
         RETURNING id::text, reporter_name AS "reporterName", reporter_email AS "reporterEmail",
                   reporter_user AS "reporterUser", target_kind AS "targetKind", target_ref AS "targetRef",
                   description, sworn, status, resolution_notes AS "resolutionNotes",
                   created_at AS "createdAt", updated_at AS "updatedAt"`,
        [body.id, body.status, body.resolutionNotes ?? null],
      );
      if (!result.rows[0]) return errorResponse("IP report not found", 404);
      await logSecurityEvent({
        eventType: "ip_report_updated",
        userId: auth.id,
        request,
        details: { reportId: body.id, status: body.status },
      });
      return jsonResponse(result.rows[0], { status: 200 });
    }

    return errorResponse("Invalid view", 400);
  } catch (error) {
    captureServerException(error, { route: "privacy_patch", view });
    throw error;
  }
}
