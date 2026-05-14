import type { ExternalPoiMatchStatus, ProjectedPoint } from "../../../shared/types.js";
import { buildDedupCandidates } from "../dedup.js";
import type { NormalizedPoiDraft } from "./normalizePoi.js";

const EXISTING_MATCH_THRESHOLD = 0.85;

export interface PoiMatchResult {
  matchStatus: ExternalPoiMatchStatus;
  matchedPointId: string | null;
  matchScore: number;
  needsFieldVerification: boolean;
}

export function matchPoiCandidate(candidate: NormalizedPoiDraft, points: ProjectedPoint[]): PoiMatchResult {
  const dedup = buildDedupCandidates(candidate.category, candidate.location, candidate.normalized, points);
  const best = dedup.candidates[0];
  const matchScore = best?.matchScore ?? 0;

  if (best && matchScore >= EXISTING_MATCH_THRESHOLD) {
    return {
      matchStatus: "matched_to_existing",
      matchedPointId: best.pointId,
      matchScore,
      needsFieldVerification: false,
    };
  }

  return {
    matchStatus: "needs_field_verification",
    matchedPointId: null,
    matchScore,
    needsFieldVerification: true,
  };
}
