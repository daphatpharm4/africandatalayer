import { requireUser } from "../../lib/auth.js";
import {
  deletePointEvent,
  isStorageUnavailableError,
} from "../../lib/server/storage/index.js";
import { createFraudAlert } from "../../lib/server/fraudAlerts.js";
import { projectPointsFromEvents } from "../../lib/server/pointProjection.js";
import { errorResponse, jsonResponse } from "../../lib/server/http.js";
import { logSecurityEvent } from "../../lib/server/securityAudit.js";
import { captureServerException } from "../../lib/server/sentry.js";
import { canViewEventDetail, toSubmissionAuthContext } from "../../lib/server/submissionAccess.js";
import { reviewBodySchema } from "../../lib/server/validation.js";
import type { PointEvent } from "../../shared/types.js";
import { buildReadableEvents } from "../../lib/server/submissionEvents.js";
import { reconcileUserProfileXp } from "../../lib/server/xp.js";
import { applyReviewDecision } from "../../lib/server/reviewDecision.js";

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

  if (!viewer.isAdmin) return errorResponse("Forbidden", 403);

  const points = projectPointsFromEvents(events);
  const point = points.find((item) => item.pointId === id || item.id === id);
  if (point) return jsonResponse(point, { status: 200 });

  const fallbackEvent = events.find((item) => item.id === id);
  if (fallbackEvent) return jsonResponse(fallbackEvent, { status: 200 });

  return errorResponse("Submission not found", 404);
}

export async function PUT(request: Request): Promise<Response> {
  void request;
  return errorResponse("Method not allowed", 405);
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

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return errorResponse("Invalid JSON body", 400);
  }

  const validation = reviewBodySchema.safeParse(rawBody);
  if (!validation.success) {
    return errorResponse(validation.error.issues[0]?.message ?? "Invalid review decision", 400);
  }
  const decision = validation.data.decision;
  const notes = validation.data.notes?.trim() ?? null;

  try {
    const updated = await applyReviewDecision({
      eventId: id,
      reviewerId: auth.id,
      decision,
      notes,
    });
    await logSecurityEvent({
      eventType: decision === "rejected" ? "submission_rejected" : "admin_review",
      userId: updated.userId,
      request,
      details: {
        eventId: id,
        reviewerId: auth.id,
        decision,
        notes,
      },
    });
    if (decision !== "approved") {
      await createFraudAlert({
        eventId: id,
        userId: updated.userId,
        alertCode: decision === "rejected" ? "submission_rejected" : "submission_flagged",
        severity: decision === "rejected" ? "high" : "medium",
        payload: { reviewerId: auth.id, notes },
      });
    }
    return jsonResponse(updated, { status: 200 });
  } catch (error) {
    if (isStorageUnavailableError(error)) {
      return errorResponse("Storage service temporarily unavailable", 503, { code: "storage_unavailable" });
    }
    const message = error instanceof Error ? error.message : "Unable to apply review decision";
    captureServerException(error, { route: "submission_review_patch", eventId: id });
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
