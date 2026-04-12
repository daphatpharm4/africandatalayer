import type {
  DedupCandidate,
  DedupCheckResult,
  ProjectedPoint,
  SubmissionCategory,
  SubmissionDetails,
  SubmissionLocation,
} from "../../shared/types.js";
import { haversineKm } from "./submissionFraud.js";

export const DEDUP_RADIUS_METERS = 25;
export const DEDUP_RADIUS_ROAD_METERS = 50;

const MAX_CANDIDATES = 5;
const NAME_SIMILARITY_PROMPT_THRESHOLD = 0.7;
const STRICT_DISTANCE_PROMPT_METERS = 25;
const VERY_CLOSE_DISTANCE_PROMPT_METERS = 8;
const HIGH_MATCH_SCORE_PROMPT_THRESHOLD = 0.85;

function dedupRadiusMeters(category: SubmissionCategory): number {
  return category === "transport_road" ? DEDUP_RADIUS_ROAD_METERS : DEDUP_RADIUS_METERS;
}

function normalizeName(input: unknown): string {
  if (typeof input !== "string") return "";
  return input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeBrand(input: unknown): string {
  if (typeof input !== "string") return "";
  return input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

function brandMatchScore(sourceBrand: string, candidateBrand: string): number {
  // Unknown on either side → neutral (neither reward nor penalty)
  if (!sourceBrand || !candidateBrand) return 0.5;
  return sourceBrand === candidateBrand ? 1.0 : 0.0;
}

function detailsName(details: SubmissionDetails): string {
  return (
    normalizeName(details.siteName) ||
    normalizeName(details.name) ||
    normalizeName(details.roadName) ||
    normalizeName(details.brand)
  );
}

function pointName(point: ProjectedPoint): string {
  const details = point.details ?? {};
  return (
    normalizeName(details.siteName) ||
    normalizeName(details.name) ||
    normalizeName(details.roadName) ||
    normalizeName(details.brand)
  );
}

function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const prev = new Array<number>(b.length + 1);
  const curr = new Array<number>(b.length + 1);
  for (let j = 0; j <= b.length; j += 1) prev[j] = j;
  for (let i = 1; i <= a.length; i += 1) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        curr[j - 1] + 1,
        prev[j] + 1,
        prev[j - 1] + cost,
      );
    }
    for (let j = 0; j <= b.length; j += 1) prev[j] = curr[j];
  }
  return prev[b.length];
}

function similarityScore(sourceName: string, candidateName: string): number {
  if (!sourceName && !candidateName) return 0.5;
  if (!sourceName || !candidateName) return 0.35;
  const distance = levenshteinDistance(sourceName, candidateName);
  const maxLen = Math.max(sourceName.length, candidateName.length);
  return Math.max(0, Math.min(1, 1 - distance / maxLen));
}

function displayName(point: ProjectedPoint): string | null {
  const details = point.details ?? {};
  const raw =
    (typeof details.siteName === "string" && details.siteName.trim()) ||
    (typeof details.name === "string" && details.name.trim()) ||
    (typeof details.roadName === "string" && details.roadName.trim()) ||
    null;
  return raw;
}

export function buildDedupCandidates(
  category: SubmissionCategory,
  location: SubmissionLocation,
  incomingDetails: SubmissionDetails,
  points: ProjectedPoint[],
): DedupCheckResult {
  const radiusMeters = dedupRadiusMeters(category);
  const sourceName = detailsName(incomingDetails);
  const sourceBrand = normalizeBrand(incomingDetails.brand ?? incomingDetails.operator);
  const candidates: DedupCandidate[] = points
    .filter((point) => point.category === category)
    .map((point) => {
      const distanceMeters = haversineKm(location, point.location) * 1000;
      const candidateName = pointName(point);
      const candidateBrand = normalizeBrand(point.details?.brand ?? point.details?.operator);
      const nameScore = similarityScore(sourceName, candidateName);
      const distanceScore = Math.max(0, 1 - distanceMeters / radiusMeters);
      const bScore = brandMatchScore(sourceBrand, candidateBrand);
      // Weights: name 55% · distance 35% · brand 10%
      // Brand is a tiebreaker: matching brands reward, explicit conflicts penalise.
      const matchScore = Math.max(0, Math.min(1, nameScore * 0.55 + distanceScore * 0.35 + bScore * 0.10));
      return {
        pointId: point.pointId,
        category: point.category,
        siteName: displayName(point),
        latitude: point.location.latitude,
        longitude: point.location.longitude,
        distanceMeters: Math.round(distanceMeters * 10) / 10,
        similarityScore: Math.round(nameScore * 1000) / 1000,
        matchScore: Math.round(matchScore * 1000) / 1000,
      };
    })
    .filter((candidate) => candidate.distanceMeters <= radiusMeters)
    .sort((a, b) => b.matchScore - a.matchScore || a.distanceMeters - b.distanceMeters)
    .slice(0, MAX_CANDIDATES);

  const best = candidates[0];
  const shouldPrompt = Boolean(
    best && (
      (best.similarityScore >= NAME_SIMILARITY_PROMPT_THRESHOLD && best.distanceMeters <= STRICT_DISTANCE_PROMPT_METERS) ||
      best.distanceMeters <= VERY_CLOSE_DISTANCE_PROMPT_METERS ||
      best.matchScore >= HIGH_MATCH_SCORE_PROMPT_THRESHOLD
    ),
  );

  return {
    shouldPrompt,
    radiusMeters,
    bestCandidatePointId: best?.pointId ?? null,
    candidates,
  };
}
