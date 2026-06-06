import type { SubmissionDetails } from "../../shared/types.js";

export const SERVER_OWNED_SUBMISSION_DETAIL_KEYS = new Set([
  "agentTrustScore",
  "agentTrustTier",
  "confidenceScore",
  "contentHash",
  "exifTrustScore",
  "fraudCheck",
  "hasPhoto",
  "hasSecondaryPhoto",
  "imageSha256",
  "ipHash",
  "ipReputation",
  "lastSeenAt",
  "plannedXpAwarded",
  "reviewDecision",
  "reviewedAt",
  "reviewedBy",
  "reviewerApproved",
  "reviewFlags",
  "reviewNotes",
  "reviewStatus",
  "riskComponents",
  "riskScore",
  "secondPhotoUrl",
  "velocitySignals",
  "xpAction",
  "xpAwarded",
  "xpBreakdown",
  "xpEscrow",
]);

export function stripServerOwnedSubmissionDetails(details: SubmissionDetails): SubmissionDetails {
  const sanitized: SubmissionDetails = { ...details };
  for (const key of SERVER_OWNED_SUBMISSION_DETAIL_KEYS) {
    delete sanitized[key];
  }
  return sanitized;
}
