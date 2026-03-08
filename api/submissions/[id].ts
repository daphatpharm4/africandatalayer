import { requireUser } from "../../lib/auth.js";
import {
  deletePointEvent,
  insertPointEvent,
  isStorageUnavailableError,
} from "../../lib/server/storage/index.js";
import { query } from "../../lib/server/db.js";
import { normalizeEnrichPayload, projectPointsFromEvents } from "../../lib/server/pointProjection.js";
import { errorResponse, jsonResponse } from "../../lib/server/http.js";
import { canViewEventDetail, toSubmissionAuthContext } from "../../lib/server/submissionAccess.js";
import type { PointEvent, SubmissionDetails } from "../../shared/types.js";
import { buildReadableEvents } from "../../lib/server/submissionEvents.js";
import { reconcileUserProfileXp } from "../../lib/server/xp.js";
import { BASE_EVENT_XP } from "../../shared/xp.js";

type ReviewDecision = "approved" | "rejected" | "flagged";

function normalizeReviewDecision(input: unknown): ReviewDecision | null {
  if (typeof input !== "string") return null;
  const normalized = input.trim().toLowerCase();
  if (normalized === "approved" || normalized === "rejected" || normalized === "flagged") {
    return normalized;
  }
  return null;
}

function trimReviewNotes(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const value = input.trim();
  if (!value) return null;
  return value.slice(0, 1000);
}

function isMissingDbObjectError(error: unknown): boolean {
  const pg = error as { code?: unknown; message?: unknown } | null;
  const code = typeof pg?.code === "string" ? pg.code : "";
  if (code === "42P01" || code === "42703") return true;
  const message = typeof pg?.message === "string" ? pg.message.toLowerCase() : "";
  return message.includes("does not exist") || message.includes("undefined table") || message.includes("undefined column");
}

async function applyReviewDecision(params: {
  eventId: string;
  reviewerId: string;
  decision: ReviewDecision;
  notes: string | null;
}): Promise<{ eventId: string; decision: ReviewDecision; reviewStatus: string; xpAwarded: number; userId: string }> {
  const result = await query<{ user_id: string; details: Record<string, unknown> }>(
    `SELECT user_id, details
     FROM point_events
     WHERE id = $1::uuid
     LIMIT 1`,
    [params.eventId],
  );
  const row = result.rows[0];
  if (!row) {
    throw new Error("Submission event not found");
  }

  const details = row.details && typeof row.details === "object" ? ({ ...row.details } as Record<string, unknown>) : {};
  const nextXpAwarded = params.decision === "approved" ? BASE_EVENT_XP : 0;
  const reviewStatus = params.decision === "approved" ? "auto_approved" : "pending_review";

  details.reviewStatus = reviewStatus;
  details.reviewDecision = params.decision;
  details.reviewedBy = params.reviewerId;
  details.reviewedAt = new Date().toISOString();
  if (params.notes) details.reviewNotes = params.notes;
  details.xpAwarded = nextXpAwarded;

  const existingFlags = Array.isArray(details.reviewFlags) ? details.reviewFlags.filter((f) => typeof f === "string") : [];
  if (params.decision === "rejected") {
    if (!existingFlags.includes("rejected_by_admin")) existingFlags.push("rejected_by_admin");
    details.reviewFlags = existingFlags;
  } else {
    details.reviewFlags = existingFlags.filter((flag) => flag !== "rejected_by_admin");
  }

  await query(
    `UPDATE point_events
     SET details = $2::jsonb
     WHERE id = $1::uuid`,
    [params.eventId, JSON.stringify(details)],
  );

  try {
    await query(
      `INSERT INTO admin_reviews (event_id, reviewer_id, decision, notes)
       VALUES ($1::uuid, $2, $3, $4)
       ON CONFLICT (event_id) DO UPDATE SET
         reviewer_id = EXCLUDED.reviewer_id,
         decision = EXCLUDED.decision,
         notes = EXCLUDED.notes,
         reviewed_at = NOW()`,
      [params.eventId, params.reviewerId, params.decision, params.notes],
    );
  } catch (error) {
    if (!isMissingDbObjectError(error)) throw error;
  }

  await reconcileUserProfileXp(row.user_id);

  return {
    eventId: params.eventId,
    decision: params.decision,
    reviewStatus,
    xpAwarded: nextXpAwarded,
    userId: row.user_id,
  };
}

export async function GET(request: Request): Promise<Response> {
  const auth = await requireUser(request);
  if (!auth) return errorResponse("Unauthorized", 401);
  const viewer = toSubmissionAuthContext(auth);
  if (!viewer) return errorResponse("Unauthorized", 401);

  const url = new URL(request.url);
  const id = url.pathname.split("/").pop();
  const view = url.searchParams.get("view");
  if (!id) return errorResponse("Missing submission id", 400);

  let events: PointEvent[];
  try {
    events = await buildReadableEvents();
  } catch (error) {
    if (isStorageUnavailableError(error)) {
      return errorResponse("Storage service temporarily unavailable", 503, { code: "storage_unavailable" });
    }
    throw error;
  }

  if (view === "event") {
    const event = events.find((item) => item.id === id);
    if (!event) return errorResponse("Submission event not found", 404);
    if (!canViewEventDetail(event, viewer)) return errorResponse("Forbidden", 403);
    return jsonResponse(event, { status: 200 });
  }

  const points = projectPointsFromEvents(events);
  const point = points.find((item) => item.pointId === id || item.id === id);
  if (point) return jsonResponse(point, { status: 200 });

  const fallbackEvent = events.find((item) => item.id === id);
  if (fallbackEvent) return jsonResponse(fallbackEvent, { status: 200 });

  return errorResponse("Submission not found", 404);
}

export async function PUT(request: Request): Promise<Response> {
  const auth = await requireUser(request);
  if (!auth) return errorResponse("Unauthorized", 401);

  const url = new URL(request.url);
  const id = url.pathname.split("/").pop();
  if (!id) return errorResponse("Missing submission id", 400);

  let body: any;
  try {
    body = await request.json();
  } catch {
    return errorResponse("Invalid JSON body", 400);
  }

  const details = body?.details && typeof body.details === "object" ? ({ ...(body.details as SubmissionDetails) } as SubmissionDetails) : null;
  if (!details) return errorResponse("Missing details payload", 400);

  try {
    const combinedEvents = await buildReadableEvents();
    const points = projectPointsFromEvents(combinedEvents);
    const targetPoint = points.find((point) => point.pointId === id || point.id === id);
    if (!targetPoint) return errorResponse("Submission not found", 404);

    const newEvent: PointEvent = {
      id: crypto.randomUUID(),
      pointId: targetPoint.pointId,
      eventType: "ENRICH_EVENT",
      userId: auth.id,
      category: targetPoint.category,
      location: targetPoint.location,
      details: normalizeEnrichPayload(targetPoint.category, details),
      photoUrl: typeof body?.photoUrl === "string" ? body.photoUrl : undefined,
      createdAt: new Date().toISOString(),
      source: "compat_put",
    };

    await insertPointEvent(newEvent);
    return jsonResponse(newEvent, { status: 200 });
  } catch (error) {
    if (isStorageUnavailableError(error)) {
      return errorResponse("Storage service temporarily unavailable", 503, { code: "storage_unavailable" });
    }
    throw error;
  }
}

interface ReviewBody {
  decision?: unknown;
  notes?: unknown;
}

export async function PATCH(request: Request): Promise<Response> {
  const auth = await requireUser(request);
  if (!auth) return errorResponse("Unauthorized", 401);
  const viewer = toSubmissionAuthContext(auth);
  if (!viewer) return errorResponse("Unauthorized", 401);
  if (!viewer.isAdmin) return errorResponse("Forbidden", 403);

  const url = new URL(request.url);
  const id = url.pathname.split("/").pop();
  const view = url.searchParams.get("view");
  if (!id) return errorResponse("Missing submission id", 400);
  if (view !== "review") return errorResponse("Invalid view", 400);

  let body: ReviewBody;
  try {
    body = (await request.json()) as ReviewBody;
  } catch {
    return errorResponse("Invalid JSON body", 400);
  }

  const decision = normalizeReviewDecision(body.decision);
  if (!decision) return errorResponse("Invalid review decision", 400);
  const notes = trimReviewNotes(body.notes);

  try {
    const updated = await applyReviewDecision({
      eventId: id,
      reviewerId: auth.id,
      decision,
      notes,
    });
    return jsonResponse(updated, { status: 200 });
  } catch (error) {
    if (isStorageUnavailableError(error)) {
      return errorResponse("Storage service temporarily unavailable", 503, { code: "storage_unavailable" });
    }
    const message = error instanceof Error ? error.message : "Unable to apply review decision";
    const status = message.includes("not found") ? 404 : 400;
    return errorResponse(message, status);
  }
}

export async function DELETE(request: Request): Promise<Response> {
  const auth = await requireUser(request);
  if (!auth) return errorResponse("Unauthorized", 401);
  const viewer = toSubmissionAuthContext(auth);
  if (!viewer) return errorResponse("Unauthorized", 401);
  if (!viewer.isAdmin) return errorResponse("Forbidden", 403);

  const url = new URL(request.url);
  const id = url.pathname.split("/").pop();
  const view = url.searchParams.get("view");
  if (!id) return errorResponse("Missing submission id", 400);
  if (view !== "event") return errorResponse("Use view=event for event deletion", 400);

  try {
    const combined = await buildReadableEvents();
    const targetEvent = combined.find((event) => event.id === id) ?? null;
    const deleted = await deletePointEvent(id);
    if (deleted) {
      if (targetEvent) {
        await reconcileUserProfileXp(targetEvent.userId);
      }
      return jsonResponse({ ok: true, id }, { status: 200 });
    }

    const existsReadOnly = combined.some((event) => event.id === id);
    if (existsReadOnly) {
      return errorResponse("Submission source is read-only and cannot be deleted", 409);
    }
    return errorResponse("Submission event not found", 404);
  } catch (error) {
    if (isStorageUnavailableError(error)) {
      return errorResponse("Storage service temporarily unavailable", 503, { code: "storage_unavailable" });
    }
    throw error;
  }
}
