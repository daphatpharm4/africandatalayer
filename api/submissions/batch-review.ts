import { requireUser } from "../../lib/auth.js";
import { errorResponse, jsonResponse } from "../../lib/server/http.js";
import { applyReviewDecision, type ReviewDecision } from "../../lib/server/reviewDecision.js";
import { logSecurityEvent } from "../../lib/server/securityAudit.js";
import { captureServerException } from "../../lib/server/sentry.js";
import { createFraudAlert } from "../../lib/server/fraudAlerts.js";
import { resolveAdminViewAccess, toSubmissionAuthContext } from "../../lib/server/submissionAccess.js";
import { batchReviewBodySchema } from "../../lib/server/validation.js";

interface BatchReviewResultItem {
  eventId: string;
  decision: ReviewDecision;
  status: "ok" | "error";
  error?: string;
}

export async function POST(request: Request): Promise<Response> {
  const auth = await requireUser(request);
  if (!auth) return errorResponse("Unauthorized", 401);

  const viewer = toSubmissionAuthContext(auth);
  const adminAccess = resolveAdminViewAccess(viewer);
  if (adminAccess === "unauthorized") return errorResponse("Unauthorized", 401);
  if (adminAccess === "forbidden") return errorResponse("Forbidden", 403);

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return errorResponse("Invalid JSON body", 400);
  }

  const validation = batchReviewBodySchema.safeParse(rawBody);
  if (!validation.success) {
    return errorResponse(validation.error.issues[0]?.message ?? "Invalid batch review body", 400);
  }

  const { eventIds, decision, notes: rawNotes } = validation.data;
  const notes = rawNotes?.trim() ?? null;
  const results: BatchReviewResultItem[] = [];

  for (const eventId of eventIds) {
    try {
      const updated = await applyReviewDecision({
        eventId,
        reviewerId: auth.id,
        decision,
        notes,
      });

      await logSecurityEvent({
        eventType: decision === "rejected" ? "submission_rejected" : "admin_review",
        userId: updated.userId,
        request,
        details: {
          eventId,
          reviewerId: auth.id,
          decision,
          notes,
          batch: true,
        },
      });

      if (decision !== "approved") {
        await createFraudAlert({
          eventId,
          userId: updated.userId,
          alertCode: decision === "rejected" ? "submission_rejected" : "submission_flagged",
          severity: decision === "rejected" ? "high" : "medium",
          payload: { reviewerId: auth.id, notes, batch: true },
        });
      }

      results.push({ eventId, decision, status: "ok" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      captureServerException(error, { route: "batch_review_post", eventId });
      results.push({ eventId, decision, status: "error", error: message });
    }
  }

  return jsonResponse({ results }, { status: 200 });
}
