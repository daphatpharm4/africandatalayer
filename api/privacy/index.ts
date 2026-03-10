import { requireUser } from "../../lib/auth.js";
import { query } from "../../lib/server/db.js";
import { errorResponse, jsonResponse } from "../../lib/server/http.js";
import { logSecurityEvent } from "../../lib/server/securityAudit.js";
import { toSubmissionAuthContext } from "../../lib/server/submissionAccess.js";
import { captureServerException } from "../../lib/server/sentry.js";
import { privacyActionSchema, privacyRequestSchema } from "../../lib/server/validation.js";
import type { PrivacyRequest } from "../../shared/types.js";

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

export async function GET(request: Request): Promise<Response> {
  const auth = await requireUser(request);
  if (!auth) return errorResponse("Unauthorized", 401);
  const viewer = toSubmissionAuthContext(auth);
  if (!viewer?.isAdmin) return errorResponse("Forbidden", 403);

  const url = new URL(request.url);
  const view = url.searchParams.get("view") ?? "requests";

  try {
    if (view === "requests") {
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

    return errorResponse("Invalid view", 400);
  } catch (error) {
    if (isMissingDbObjectError(error)) return jsonResponse([], { status: 200 });
    captureServerException(error, { route: "privacy_get" });
    throw error;
  }
}

export async function POST(request: Request): Promise<Response> {
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
  if (view !== "requests") return errorResponse("Invalid view", 400);

  let body: {
    id?: unknown;
    status?: unknown;
    assignedTo?: unknown;
    notes?: unknown;
    resolutionNotes?: unknown;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return errorResponse("Invalid JSON body", 400);
  }

  const id = typeof body.id === "string" ? body.id.trim() : "";
  const status = typeof body.status === "string" ? body.status.trim().toLowerCase() : "";
  const assignedTo = typeof body.assignedTo === "string" ? body.assignedTo.trim() : null;
  const notes = typeof body.notes === "string" ? body.notes.trim().slice(0, 1000) : null;
  const resolutionNotes = typeof body.resolutionNotes === "string" ? body.resolutionNotes.trim().slice(0, 1000) : null;
  if (!id) return errorResponse("Privacy request id is required", 400);
  if (!["open", "in_progress", "completed", "rejected"].includes(status)) {
    return errorResponse("Invalid privacy request status", 400);
  }

  try {
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
  } catch (error) {
    captureServerException(error, { route: "privacy_patch" });
    throw error;
  }
}
