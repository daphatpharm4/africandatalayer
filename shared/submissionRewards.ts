import { BASE_EVENT_XP } from "./xp.js";
import type { PointEventType, SubmissionCategory, SubmissionDetails } from "./types.js";
import { getVertical } from "./verticals.js";

const THRESHOLD_BONUSES = new Map<number, number>([
  [70, 4],
  [85, 6],
  [95, 8],
]);

const PRIORITY_ENRICH_FIELDS: Record<SubmissionCategory, readonly string[]> = {
  pharmacy: ["openingHours", "isLicensed", "medicineCategories"],
  mobile_money: ["providers", "isActive", "hasFloat"],
  fuel_station: ["pricesByFuel", "fuelTypes", "hasFuelAvailable"],
  alcohol_outlet: ["brand", "outletType", "paymentMethods"],
  billboard: ["advertiserBrand", "condition", "billboardType"],
  transport_road: ["condition", "isBlocked", "surfaceType"],
  census_proxy: ["occupancyStatus", "storeyCount", "hasElectricity"],
};

export interface CompletionSummary {
  filled: number;
  missing: string[];
  percentage: number;
  total: number;
}

export interface SubmissionRewardBreakdown {
  baseXp: number;
  fieldBonus: number;
  comboBonus: number;
  verificationBonus: number;
  thresholdBonus: number;
  totalXp: number;
  filledMissingCount: number;
  thresholdsCrossed: number[];
  becameComplete: boolean;
}

export function hasMeaningfulValue(input: unknown): boolean {
  if (typeof input === "string") return Boolean(input.trim());
  if (typeof input === "number") return Number.isFinite(input);
  if (typeof input === "boolean") return true;
  if (Array.isArray(input)) return input.length > 0;
  if (input && typeof input === "object") return Object.keys(input as object).length > 0;
  return false;
}

export function computeMissingEnrichFields(
  category: SubmissionCategory,
  details: SubmissionDetails | Record<string, unknown> | null | undefined,
): string[] {
  const normalizedDetails = (details ?? {}) as Record<string, unknown>;
  return getVertical(category).enrichableFields.filter((field) => !hasMeaningfulValue(normalizedDetails[field]));
}

export function computeCompletionSummary(
  category: SubmissionCategory,
  details: SubmissionDetails | Record<string, unknown> | null | undefined,
): CompletionSummary {
  const missing = computeMissingEnrichFields(category, details);
  const total = getVertical(category).enrichableFields.length;
  const filled = Math.max(0, total - missing.length);
  const percentage = total > 0 ? Math.round((filled / total) * 100) : 100;
  return {
    filled,
    missing,
    percentage,
    total,
  };
}

export function prioritizeMissingFields(
  category: SubmissionCategory,
  missingFields: readonly string[],
  limit = 3,
): string[] {
  const available = new Set(missingFields);
  const ordered: string[] = [];

  for (const field of PRIORITY_ENRICH_FIELDS[category]) {
    if (!available.has(field)) continue;
    ordered.push(field);
    available.delete(field);
    if (ordered.length >= limit) return ordered;
  }

  for (const field of missingFields) {
    if (!available.has(field)) continue;
    ordered.push(field);
    available.delete(field);
    if (ordered.length >= limit) break;
  }

  return ordered;
}

export function calculateSubmissionRewardBreakdown(params: {
  eventType: PointEventType;
  previousGaps?: readonly string[];
  nextGaps?: readonly string[];
  previousScore?: number | null;
  nextScore?: number | null;
}): SubmissionRewardBreakdown {
  const previousGaps = Array.isArray(params.previousGaps) ? params.previousGaps : [];
  const nextGaps = Array.isArray(params.nextGaps) ? params.nextGaps : [];
  const nextGapSet = new Set(nextGaps);
  const filledMissingCount = previousGaps.filter((field) => !nextGapSet.has(field)).length;
  const becameComplete = previousGaps.length > 0 && nextGaps.length === 0;

  if (params.eventType === "CREATE_EVENT") {
    return {
      baseXp: BASE_EVENT_XP,
      fieldBonus: 0,
      comboBonus: 0,
      verificationBonus: 0,
      thresholdBonus: 0,
      totalXp: BASE_EVENT_XP,
      filledMissingCount: 0,
      thresholdsCrossed: [],
      becameComplete: false,
    };
  }

  const baseXp = filledMissingCount > 0 ? BASE_EVENT_XP : 0;
  const fieldBonus = filledMissingCount > 0 ? 3 + Math.max(0, filledMissingCount - 1) * 2 : 0;
  const comboBonus = filledMissingCount >= 3 ? 5 : 0;
  const verificationBonus = becameComplete ? 10 : 0;

  const previousScore = typeof params.previousScore === "number" && Number.isFinite(params.previousScore) ? params.previousScore : 0;
  const nextScore = typeof params.nextScore === "number" && Number.isFinite(params.nextScore) ? params.nextScore : 0;
  const thresholdsCrossed = Array.from(THRESHOLD_BONUSES.keys()).filter(
    (threshold) => previousScore < threshold && nextScore >= threshold,
  );
  const thresholdBonus = thresholdsCrossed.reduce((total, threshold) => total + (THRESHOLD_BONUSES.get(threshold) ?? 0), 0);

  return {
    baseXp,
    fieldBonus,
    comboBonus,
    verificationBonus,
    thresholdBonus,
    totalXp: baseXp + fieldBonus + comboBonus + verificationBonus + thresholdBonus,
    filledMissingCount,
    thresholdsCrossed,
    becameComplete,
  };
}
