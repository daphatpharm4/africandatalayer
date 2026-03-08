import type { PointEvent, SubmissionDetails } from "./types.js";

export const BASE_EVENT_XP = 5;

function getDetails(input: Pick<PointEvent, "details"> | SubmissionDetails | null | undefined): SubmissionDetails {
  if (!input) return {};
  if ("details" in input) return (input.details ?? {}) as SubmissionDetails;
  return input;
}

function normalizeReviewStatus(details: SubmissionDetails): string {
  const value = details.reviewStatus;
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function normalizeReviewDecision(details: SubmissionDetails): string {
  const value = details.reviewDecision;
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function hasRejectedFlag(details: SubmissionDetails): boolean {
  const flags = details.reviewFlags;
  if (!Array.isArray(flags)) return false;
  return flags.some((flag) => typeof flag === "string" && flag.trim().toLowerCase() === "rejected_by_admin");
}

function normalizeUserId(userId: string): string {
  return userId.trim().toLowerCase();
}

export function isRejectedSubmission(input: Pick<PointEvent, "details"> | SubmissionDetails | null | undefined): boolean {
  const details = getDetails(input);
  return normalizeReviewDecision(details) === "rejected" || hasRejectedFlag(details);
}

export function getEffectiveEventXp(input: Pick<PointEvent, "details"> | SubmissionDetails | null | undefined): number {
  const details = getDetails(input);
  if (isRejectedSubmission(details)) return 0;

  const rawXp = details.xpAwarded;
  if (typeof rawXp === "number" && Number.isFinite(rawXp)) {
    return Math.max(0, Math.round(rawXp));
  }

  if (normalizeReviewStatus(details) === "pending_review") return 0;
  return BASE_EVENT_XP;
}

export function getUserXpFromEvents(events: readonly PointEvent[], userId: string): number {
  const normalizedUserId = normalizeUserId(userId);
  return events.reduce((total, event) => {
    if (normalizeUserId(event.userId) !== normalizedUserId) return total;
    return total + getEffectiveEventXp(event);
  }, 0);
}
