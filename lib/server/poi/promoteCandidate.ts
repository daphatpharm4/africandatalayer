import type { ExternalPoiCandidate, PointEvent } from "../../../shared/types.js";
import { generateImportPointId } from "../../shared/pointId.js";

export interface PromoteCandidateOptions {
  now?: () => Date;
  eventId?: string;
}

export function buildPointEventFromVerifiedCandidate(
  candidate: ExternalPoiCandidate,
  actorUserId: string,
  options: PromoteCandidateOptions = {},
): PointEvent {
  if (candidate.matchStatus !== "verified") {
    throw new Error("Candidate must be verified before promotion");
  }

  const pointId = candidate.matchedPointId ?? generateImportPointId(candidate.source, candidate.externalId);
  const now = options.now ?? (() => new Date());

  return {
    id: options.eventId ?? candidate.id,
    pointId,
    eventType: "CREATE_EVENT",
    userId: actorUserId,
    category: candidate.category,
    location: candidate.location,
    details: {
      ...candidate.normalized,
      source: candidate.source,
      externalId: candidate.externalId,
      sourceLicense: candidate.sourceLicense,
      sourceAttribution: candidate.sourceAttribution,
      isImported: true,
      reviewerApproved: true,
    },
    createdAt: now().toISOString(),
    source: candidate.source,
    externalId: candidate.externalId,
    consentStatus: "not_required",
  };
}
