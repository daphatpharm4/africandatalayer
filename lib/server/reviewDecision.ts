import { query } from "./db.js";
import { getUserProfile } from "./storage/index.js";
import { reconcileUserProfileXp } from "./xp.js";
import { adjustTrustOnReview, updateUserTrust } from "./userTrust.js";

export type ReviewDecision = "approved" | "rejected" | "flagged";

export interface ReviewResult {
  eventId: string;
  decision: ReviewDecision;
  reviewStatus: string;
  xpAwarded: number;
  userId: string;
}

function isMissingDbObjectError(error: unknown): boolean {
  const pg = error as { code?: unknown; message?: unknown } | null;
  const code = typeof pg?.code === "string" ? pg.code : "";
  if (code === "42P01" || code === "42703") return true;
  const message = typeof pg?.message === "string" ? pg.message.toLowerCase() : "";
  return message.includes("does not exist") || message.includes("undefined table") || message.includes("undefined column");
}

export async function applyReviewDecision(params: {
  eventId: string;
  reviewerId: string;
  decision: ReviewDecision;
  notes: string | null;
}): Promise<ReviewResult> {
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
  const plannedXpAwarded =
    typeof details.plannedXpAwarded === "number" && Number.isFinite(details.plannedXpAwarded)
      ? Math.max(0, Math.round(details.plannedXpAwarded))
      : 0;
  const nextXpAwarded = params.decision === "approved" ? plannedXpAwarded : 0;
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

  // Use centralized trust adjustment
  await adjustTrustOnReview({ userId: row.user_id, decision: params.decision });
  // Apply suspension for rejected submissions from restricted agents
  if (params.decision === "rejected") {
    const currentProfile = await getUserProfile(row.user_id);
    if (currentProfile && (currentProfile.trustScore ?? 50) <= 20) {
      await updateUserTrust({
        userId: row.user_id,
        suspendedUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      });
    }
  }

  return {
    eventId: params.eventId,
    decision: params.decision,
    reviewStatus,
    xpAwarded: nextXpAwarded,
    userId: row.user_id,
  };
}
