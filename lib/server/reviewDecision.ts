import { query } from "./db.js";
import { bulkUpsertPointEvents, getPointEvents, getUserProfile } from "./storage/index.js";
import { reconcileUserProfileXp } from "./xp.js";
import { adjustTrustOnReview, updateUserTrust } from "./userTrust.js";
import type { PointEvent } from "../../shared/types.js";
import {
  getAdminRiskBucketFromDetails,
  getAdminReviewStatusFromDetails,
  getReviewFinality,
  isAdminBulkApproveCandidate,
} from "../shared/adminReviewQueue.js";

export type ReviewDecision = "approved" | "rejected" | "flagged";

export interface ReviewResult {
  eventId: string;
  decision: ReviewDecision;
  reviewStatus: string;
  xpAwarded: number;
  userId: string;
}

export type BatchApproveSkipReason = "already_finalized" | "high_risk" | "ineligible";

export class ReviewDecisionSkippedError extends Error {
  eventId: string;
  reason: BatchApproveSkipReason;

  constructor(eventId: string, reason: BatchApproveSkipReason) {
    super(`Submission ${eventId} skipped: ${reason.replace(/_/g, " ")}`);
    this.name = "ReviewDecisionSkippedError";
    this.eventId = eventId;
    this.reason = reason;
  }
}

export async function runReviewSideEffect(label: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[review:${label}] side effect skipped`, message);
  }
}

interface ReviewTarget {
  userId: string;
  details: Record<string, unknown>;
  storageEvent: PointEvent;
}

async function loadReviewTarget(eventId: string): Promise<ReviewTarget> {
  const event = (await getPointEvents()).find((item) => item.id === eventId) ?? null;
  if (!event) {
    throw new Error("Submission event not found");
  }

  return {
    userId: event.userId,
    details: event.details && typeof event.details === "object" ? ({ ...event.details } as Record<string, unknown>) : {},
    storageEvent: event,
  };
}

async function persistReviewDetails(eventId: string, target: ReviewTarget, details: Record<string, unknown>): Promise<void> {
  await bulkUpsertPointEvents([{ ...target.storageEvent, id: eventId, details }]);
}

export async function applyReviewDecision(params: {
  eventId: string;
  reviewerId: string;
  decision: ReviewDecision;
  notes: string | null;
  enforceBulkApprovalEligibility?: boolean;
}): Promise<ReviewResult> {
  const target = await loadReviewTarget(params.eventId);
  const details = target.details;
  if (params.enforceBulkApprovalEligibility && params.decision === "approved") {
    const skipReason = getBatchApproveSkipReason(details);
    if (skipReason) {
      throw new ReviewDecisionSkippedError(params.eventId, skipReason);
    }
  }
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

  await persistReviewDetails(params.eventId, target, details);

  await runReviewSideEffect("admin_reviews", async () => {
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
  });

  await runReviewSideEffect("xp_reconcile", async () => {
    await reconcileUserProfileXp(target.userId);
  });

  await runReviewSideEffect("trust_adjust", async () => {
    await adjustTrustOnReview({ userId: target.userId, decision: params.decision });
  });
  // Apply suspension for rejected submissions from restricted agents
  if (params.decision === "rejected") {
    await runReviewSideEffect("restricted_agent_suspension", async () => {
      const currentProfile = await getUserProfile(target.userId);
      if (currentProfile && (currentProfile.trustScore ?? 50) <= 20) {
        await updateUserTrust({
          userId: target.userId,
          suspendedUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        });
      }
    });
  }

  return {
    eventId: params.eventId,
    decision: params.decision,
    reviewStatus,
    xpAwarded: nextXpAwarded,
    userId: target.userId,
  };
}

export function getBatchApproveSkipReason(
  details: Record<string, unknown> | null | undefined,
): BatchApproveSkipReason | null {
  const finality = getReviewFinality(details);
  if (finality.isFinalized) return "already_finalized";

  const riskBucket = getAdminRiskBucketFromDetails(details);
  if (riskBucket === "flagged") return "high_risk";

  if (
    !isAdminBulkApproveCandidate({
      riskBucket,
      details,
    })
  ) {
    return "ineligible";
  }

  if (getAdminReviewStatusFromDetails(details) !== "pending_review") return "ineligible";
  return null;
}
