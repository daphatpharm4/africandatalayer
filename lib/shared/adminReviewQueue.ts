import type {
  AdminSubmissionEvent,
  PointEvent,
  SubmissionDetails,
  SubmissionPhotoMetadata,
  TrustTier,
} from "../../shared/types.js";

export type AdminRiskBucket = "flagged" | "pending" | "low_risk";
export type AdminRiskFilter = "all" | AdminRiskBucket;

export interface AdminSubmissionGroupPhoto {
  url: string;
  eventType: string;
  createdAt: string;
  metadata: SubmissionPhotoMetadata | null;
}

export interface AdminSubmissionGroupSummary {
  riskScore: number;
  reviewStatus: string;
  riskBucket: AdminRiskBucket;
  contributorCount: number;
  evidenceCount: number;
  staleHours: number;
  submissionDistanceKm: number | null;
  ipDistanceKm: number | null;
  hasSubmissionMismatch: boolean;
  hasIpMismatch: boolean;
  trustScore: number | null;
  trustTier: TrustTier | null;
  isLowEndDevice: boolean;
}

export interface AdminSubmissionGroup {
  pointId: string;
  events: AdminSubmissionEvent[];
  category: AdminSubmissionEvent["event"]["category"];
  siteName: string | null;
  latestEvent: AdminSubmissionEvent;
  createdEvent: AdminSubmissionEvent | null;
  enrichEvents: AdminSubmissionEvent[];
  allPhotos: AdminSubmissionGroupPhoto[];
  summary: AdminSubmissionGroupSummary;
}

export interface AdminReviewerOption {
  id: string;
  name: string;
}

export interface AdminReviewQueueStats {
  all: number;
  flagged: number;
  pending: number;
  lowRisk: number;
  eligible: number;
}

export interface AdminReviewQueueResponse {
  groups: AdminSubmissionGroup[];
  reviewers: AdminReviewerOption[];
  stats: AdminReviewQueueStats;
  page: number;
  totalPages: number;
  totalGroups: number;
  limit: number;
}

export interface AdminReviewSortFields {
  pointId: string;
  latestCreatedAt: string;
  reviewStatus: string;
  riskScore: number;
}

const DEFAULT_REVIEW_STATS: AdminReviewQueueStats = {
  all: 0,
  flagged: 0,
  pending: 0,
  lowRisk: 0,
  eligible: 0,
};

function asDetails(input: SubmissionDetails | Record<string, unknown> | null | undefined): SubmissionDetails {
  return (input ?? {}) as SubmissionDetails;
}

export function createEmptyAdminReviewStats(): AdminReviewQueueStats {
  return { ...DEFAULT_REVIEW_STATS };
}

export function getAdminSiteNameFromDetails(details: SubmissionDetails | Record<string, unknown> | null | undefined): string | null {
  const safe = asDetails(details);
  if (typeof safe.siteName === "string" && safe.siteName.trim()) return safe.siteName.trim();
  if (typeof safe.name === "string" && safe.name.trim()) return safe.name.trim();
  return null;
}

export function getAdminRiskScoreFromDetails(details: SubmissionDetails | Record<string, unknown> | null | undefined): number {
  const safe = asDetails(details);
  return typeof safe.riskScore === "number" && Number.isFinite(safe.riskScore) ? safe.riskScore : 0;
}

export function getAdminReviewStatusFromDetails(details: SubmissionDetails | Record<string, unknown> | null | undefined): string {
  const safe = asDetails(details);
  return typeof safe.reviewStatus === "string" && safe.reviewStatus.trim()
    ? safe.reviewStatus.trim().toLowerCase()
    : "auto_approved";
}

export function getAdminRiskBucket(riskScore: number, reviewStatus: string): AdminRiskBucket {
  if (riskScore >= 60) return "flagged";
  if (reviewStatus === "pending_review") return "pending";
  return "low_risk";
}

export function getAdminRiskBucketFromDetails(details: SubmissionDetails | Record<string, unknown> | null | undefined): AdminRiskBucket {
  const riskScore = getAdminRiskScoreFromDetails(details);
  const reviewStatus = getAdminReviewStatusFromDetails(details);
  return getAdminRiskBucket(riskScore, reviewStatus);
}

export function compareAdminReviewSort(a: AdminReviewSortFields, b: AdminReviewSortFields): number {
  const riskDelta = b.riskScore - a.riskScore;
  if (riskDelta !== 0) return riskDelta;
  const reviewPriority = (value: string) => (value === "pending_review" ? 1 : 0);
  const reviewDelta = reviewPriority(b.reviewStatus) - reviewPriority(a.reviewStatus);
  if (reviewDelta !== 0) return reviewDelta;
  const createdAtDelta = new Date(b.latestCreatedAt).getTime() - new Date(a.latestCreatedAt).getTime();
  if (createdAtDelta !== 0) return createdAtDelta;
  return a.pointId.localeCompare(b.pointId);
}

export function parseAdminReviewPage(input: string | null | undefined): number {
  const page = Number.parseInt(input ?? "", 10);
  return Number.isFinite(page) && page > 0 ? page : 1;
}

export function parseAdminReviewLimit(input: string | null | undefined, defaultLimit = 24, maxLimit = 48): number {
  const limit = Number.parseInt(input ?? "", 10);
  if (!Number.isFinite(limit) || limit <= 0) return defaultLimit;
  return Math.min(limit, maxLimit);
}

function getEventLowEndFlag(item: AdminSubmissionEvent): boolean {
  const details = asDetails(item.event.details);
  const device = details.clientDevice;
  return Boolean(device && typeof device === "object" && device.isLowEnd === true);
}

function getPhotoEntries(item: AdminSubmissionEvent): AdminSubmissionGroupPhoto[] {
  const photos: AdminSubmissionGroupPhoto[] = [];
  if (typeof item.event.photoUrl === "string" && item.event.photoUrl.trim()) {
    photos.push({
      url: item.event.photoUrl,
      eventType: item.event.eventType,
      createdAt: item.event.createdAt,
      metadata: item.fraudCheck?.primaryPhoto ?? null,
    });
  }

  const details = asDetails(item.event.details);
  const secondPhotoUrl = typeof details.secondPhotoUrl === "string" ? details.secondPhotoUrl.trim() : "";
  if (secondPhotoUrl) {
    photos.push({
      url: secondPhotoUrl,
      eventType: `${item.event.eventType} (secondary)`,
      createdAt: item.event.createdAt,
      metadata: item.fraudCheck?.secondaryPhoto ?? null,
    });
  }

  return photos;
}

function summarizeAdminSubmissionGroup(
  items: AdminSubmissionEvent[],
  allPhotos: AdminSubmissionGroupPhoto[],
  latestEvent: AdminSubmissionEvent,
): AdminSubmissionGroupSummary {
  const riskScore = getAdminRiskScoreFromDetails(latestEvent.event.details);
  const reviewStatus = getAdminReviewStatusFromDetails(latestEvent.event.details);
  const riskBucket = getAdminRiskBucket(riskScore, reviewStatus);
  const contributorCount = new Set(items.map((item) => item.user.id)).size;
  const submissionDistances = allPhotos
    .map((photo) => photo.metadata?.submissionDistanceKm)
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  const ipDistances = allPhotos
    .map((photo) => photo.metadata?.ipDistanceKm)
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  const createdAt = new Date(latestEvent.event.createdAt).getTime();
  const staleHours = Number.isFinite(createdAt) ? Math.max(0, Math.floor((Date.now() - createdAt) / 3_600_000)) : 0;

  return {
    riskScore,
    reviewStatus,
    riskBucket,
    contributorCount,
    evidenceCount: allPhotos.length,
    staleHours,
    submissionDistanceKm: submissionDistances.length > 0 ? Math.max(...submissionDistances) : null,
    ipDistanceKm: ipDistances.length > 0 ? Math.max(...ipDistances) : null,
    hasSubmissionMismatch: allPhotos.some((photo) => photo.metadata?.submissionGpsMatch === false),
    hasIpMismatch: allPhotos.some((photo) => photo.metadata?.ipGpsMatch === false),
    trustScore: typeof latestEvent.user.trustScore === "number" ? latestEvent.user.trustScore : null,
    trustTier: latestEvent.user.trustTier ?? null,
    isLowEndDevice: items.some(getEventLowEndFlag),
  };
}

export function buildAdminSubmissionGroups(items: AdminSubmissionEvent[]): AdminSubmissionGroup[] {
  const groups = new Map<string, AdminSubmissionEvent[]>();
  for (const item of items) {
    const pointId = item.event.pointId;
    const existing = groups.get(pointId);
    if (existing) {
      existing.push(item);
    } else {
      groups.set(pointId, [item]);
    }
  }

  const output: AdminSubmissionGroup[] = [];
  for (const [pointId, groupItems] of groups) {
    const events = [...groupItems].sort(
      (a, b) => new Date(a.event.createdAt).getTime() - new Date(b.event.createdAt).getTime(),
    );
    const latestEvent = events[events.length - 1]!;
    const createdEvent = events.find((item) => item.event.eventType === "CREATE_EVENT") ?? null;
    const enrichEvents = events.filter((item) => item.event.eventType === "ENRICH_EVENT");
    const allPhotos = events.flatMap(getPhotoEntries);

    output.push({
      pointId,
      events,
      category: latestEvent.event.category,
      siteName: getAdminSiteNameFromDetails((createdEvent ?? latestEvent).event.details),
      latestEvent,
      createdEvent,
      enrichEvents,
      allPhotos,
      summary: summarizeAdminSubmissionGroup(events, allPhotos, latestEvent),
    });
  }

  return output.sort((a, b) =>
    compareAdminReviewSort(
      {
        pointId: a.pointId,
        latestCreatedAt: a.latestEvent.event.createdAt,
        reviewStatus: a.summary.reviewStatus,
        riskScore: a.summary.riskScore,
      },
      {
        pointId: b.pointId,
        latestCreatedAt: b.latestEvent.event.createdAt,
        reviewStatus: b.summary.reviewStatus,
        riskScore: b.summary.riskScore,
      },
    ),
  );
}

export function buildAdminReviewStatsFromPoints(
  points: Array<{ riskScore: number; reviewStatus: string }>,
): AdminReviewQueueStats {
  const stats = createEmptyAdminReviewStats();
  stats.all = points.length;

  for (const point of points) {
    const bucket = getAdminRiskBucket(point.riskScore, point.reviewStatus);
    if (bucket === "flagged") stats.flagged += 1;
    if (bucket === "pending") stats.pending += 1;
    if (bucket === "low_risk") stats.lowRisk += 1;
    if ((bucket === "pending" || bucket === "low_risk") && point.reviewStatus === "pending_review") {
      stats.eligible += 1;
    }
  }

  return stats;
}

export function getPointEventReviewSortFields(event: PointEvent): AdminReviewSortFields {
  return {
    pointId: event.pointId,
    latestCreatedAt: event.createdAt,
    reviewStatus: getAdminReviewStatusFromDetails(event.details),
    riskScore: getAdminRiskScoreFromDetails(event.details),
  };
}
