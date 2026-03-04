import { getVertical } from "../../shared/verticals.js";
import type { ProjectedPoint, SubmissionDetails } from "../../shared/types.js";

export interface ConfidenceFactors {
  recency: number;
  sourceCount: number;
  photoEvidence: number;
  gpsAccuracy: number;
  reviewerApproval: number;
  fieldCompleteness: number;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function hasValue(input: unknown): boolean {
  if (typeof input === "string") return Boolean(input.trim());
  if (typeof input === "boolean") return true;
  if (typeof input === "number") return Number.isFinite(input);
  if (Array.isArray(input)) return input.length > 0;
  if (input && typeof input === "object") return Object.keys(input as object).length > 0;
  return false;
}

function toFiniteDate(input: string): Date | null {
  const parsed = new Date(input);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function clampScore(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, Math.round(value)));
}

function getRecencyScore(updatedAt: string, referenceDate: Date): number {
  const updatedDate = toFiniteDate(updatedAt);
  if (!updatedDate) return 0;
  const daysSinceUpdate = Math.max(0, (referenceDate.getTime() - updatedDate.getTime()) / MS_PER_DAY);

  if (daysSinceUpdate <= 7) return 25;
  if (daysSinceUpdate <= 14) return 22;
  if (daysSinceUpdate <= 30) return 18;
  if (daysSinceUpdate <= 60) return 12;
  if (daysSinceUpdate <= 90) return 6;
  return 0;
}

function getSourceCountScore(eventsCount: number): number {
  if (eventsCount >= 5) return 20;
  if (eventsCount >= 3) return 15;
  if (eventsCount >= 2) return 10;
  return 5;
}

function getPhotoEvidenceScore(point: ProjectedPoint): number {
  let score = 0;
  const details = point.details as SubmissionDetails;
  if (point.photoUrl) score += 10;
  if (details.hasSecondaryPhoto === true) score += 5;

  const fraudCheck = details.fraudCheck;
  if (fraudCheck?.primaryPhoto?.exifStatus === "ok") score += 5;
  return Math.min(20, score);
}

function getGpsAccuracyScore(point: ProjectedPoint): number {
  let score = 5;
  const fraudCheck = point.details.fraudCheck;
  if (fraudCheck?.primaryPhoto?.submissionGpsMatch === true) score += 5;
  if (fraudCheck?.primaryPhoto?.ipGpsMatch === true) score += 5;
  return Math.min(15, score);
}

function getReviewerApprovalScore(point: ProjectedPoint): number {
  const reviewerApproved = point.details.reviewerApproved === true;
  if (reviewerApproved) return 10;
  if (point.eventsCount >= 2) return 3;
  return 0;
}

function getFieldCompletenessScore(point: ProjectedPoint): number {
  const enrichable = getVertical(point.category).enrichableFields;
  if (enrichable.length === 0) return 0;
  const filled = enrichable.filter((field) => hasValue(point.details[field])).length;
  const ratio = filled / enrichable.length;
  return Math.round(ratio * 10);
}

export function computeConfidenceFactors(point: ProjectedPoint, referenceDate: Date): ConfidenceFactors {
  return {
    recency: getRecencyScore(point.updatedAt, referenceDate),
    sourceCount: getSourceCountScore(point.eventsCount),
    photoEvidence: getPhotoEvidenceScore(point),
    gpsAccuracy: getGpsAccuracyScore(point),
    reviewerApproval: getReviewerApprovalScore(point),
    fieldCompleteness: getFieldCompletenessScore(point),
  };
}

export function computeConfidenceScore(point: ProjectedPoint, referenceDate: Date): number {
  const factors = computeConfidenceFactors(point, referenceDate);
  const total = factors.recency
    + factors.sourceCount
    + factors.photoEvidence
    + factors.gpsAccuracy
    + factors.reviewerApproval
    + factors.fieldCompleteness;
  return clampScore(total);
}
