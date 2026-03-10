import type { PointEventType, SubmissionDetails } from "../../shared/types.js";

export interface ContributionActivity {
  createdAt: string | Date;
  eventType?: PointEventType | null;
  details?: SubmissionDetails | Record<string, unknown> | null;
}

export interface QueuedContributionActivityInput {
  createdAt: string | Date;
  status?: string | null;
  payload?: {
    eventType?: PointEventType | null;
    details?: SubmissionDetails | Record<string, unknown> | null;
  } | null;
}

export interface ContributionSummary {
  submissionsToday: number;
  enrichmentsToday: number;
  streakDays: number;
  activeWeekdays: boolean[];
}

const QUEUED_STATUSES = new Set(["pending", "syncing", "failed"]);

function normalizeEventType(input: PointEventType | null | undefined): PointEventType {
  return input === "ENRICH_EVENT" ? "ENRICH_EVENT" : "CREATE_EVENT";
}

function getLocale(language: "en" | "fr"): string {
  return language === "fr" ? "fr-FR" : "en-US";
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function toContributionDate(input: string | Date): Date | null {
  if (input instanceof Date) {
    if (Number.isNaN(input.getTime())) return null;
    return new Date(input.getTime());
  }

  if (typeof input !== "string") return null;
  const parsed = new Date(input);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

export function getLocalDateKey(input: string | Date): string | null {
  const date = toContributionDate(input);
  if (!date) return null;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getStartOfCurrentWeek(referenceDate: string | Date = new Date()): Date {
  const reference = toContributionDate(referenceDate) ?? new Date();
  const dayStart = startOfDay(reference);
  const weekday = dayStart.getDay();
  const mondayOffset = weekday === 0 ? 6 : weekday - 1;
  return addDays(dayStart, -mondayOffset);
}

export function mapQueuedItemsToContributionActivities(
  items: readonly QueuedContributionActivityInput[],
): ContributionActivity[] {
  return items
    .filter((item) => QUEUED_STATUSES.has(item.status ?? ""))
    .map((item) => ({
      createdAt: item.createdAt,
      eventType: normalizeEventType(item.payload?.eventType ?? undefined),
      details: item.payload?.details ?? {},
    }));
}

export function computeContributionSummary(
  activities: readonly ContributionActivity[],
  options: { referenceDate?: string | Date } = {},
): ContributionSummary {
  const reference = toContributionDate(options.referenceDate ?? new Date()) ?? new Date();
  const todayStart = startOfDay(reference);
  const tomorrowStart = addDays(todayStart, 1);
  const weekStart = getStartOfCurrentWeek(reference);
  const contributionDays = new Set<string>();
  let submissionsToday = 0;
  let enrichmentsToday = 0;

  for (const activity of activities) {
    const createdAt = toContributionDate(activity.createdAt);
    if (!createdAt) continue;

    if (createdAt >= todayStart && createdAt < tomorrowStart) {
      if (normalizeEventType(activity.eventType ?? undefined) === "ENRICH_EVENT") {
        enrichmentsToday += 1;
      } else {
        submissionsToday += 1;
      }
    }

    const dayKey = getLocalDateKey(createdAt);
    if (dayKey) contributionDays.add(dayKey);
  }

  let streakDays = 0;
  for (let cursor = todayStart; ; cursor = addDays(cursor, -1)) {
    const dayKey = getLocalDateKey(cursor);
    if (!dayKey || !contributionDays.has(dayKey)) break;
    streakDays += 1;
  }

  const activeWeekdays = Array.from({ length: 7 }, (_, index) => {
    const dayKey = getLocalDateKey(addDays(weekStart, index));
    return dayKey ? contributionDays.has(dayKey) : false;
  });

  return {
    submissionsToday,
    enrichmentsToday,
    streakDays,
    activeWeekdays,
  };
}

export function computeAverageQualityForToday(
  activities: readonly ContributionActivity[],
  options: { referenceDate?: string | Date } = {},
): number {
  const reference = toContributionDate(options.referenceDate ?? new Date()) ?? new Date();
  const todayStart = startOfDay(reference);
  const tomorrowStart = addDays(todayStart, 1);
  let total = 0;
  let count = 0;

  for (const activity of activities) {
    const createdAt = toContributionDate(activity.createdAt);
    if (!createdAt || createdAt < todayStart || createdAt >= tomorrowStart) continue;
    const details = (activity.details ?? {}) as Record<string, unknown>;
    if (typeof details.confidenceScore !== "number" || !Number.isFinite(details.confidenceScore)) continue;
    total += details.confidenceScore;
    count += 1;
  }

  if (count === 0) return 0;
  return Math.round(total / count);
}

export function countActivitiesInCurrentWeek(
  activities: readonly ContributionActivity[],
  options: { referenceDate?: string | Date } = {},
): number {
  const weekStart = getStartOfCurrentWeek(options.referenceDate ?? new Date());
  const nextWeekStart = addDays(weekStart, 7);

  return activities.reduce((count, activity) => {
    const createdAt = toContributionDate(activity.createdAt);
    if (!createdAt || createdAt < weekStart || createdAt >= nextWeekStart) return count;
    return count + 1;
  }, 0);
}

export function formatContributionHistoryDate(
  input: string | Date,
  language: "en" | "fr",
  options: { referenceDate?: string | Date } = {},
): string {
  const date = toContributionDate(input);
  if (!date) return language === "fr" ? "Inconnu" : "Unknown";

  const reference = toContributionDate(options.referenceDate ?? new Date()) ?? new Date();
  const locale = getLocale(language);
  const todayStart = startOfDay(reference);
  const yesterdayStart = addDays(todayStart, -1);
  const dateStart = startOfDay(date);
  const timeLabel = date.toLocaleTimeString(locale, {
    hour: "2-digit",
    minute: "2-digit",
  });

  if (dateStart.getTime() === todayStart.getTime()) {
    return language === "fr" ? `Aujourd'hui • ${timeLabel}` : `Today • ${timeLabel}`;
  }

  if (dateStart.getTime() === yesterdayStart.getTime()) {
    return language === "fr" ? `Hier • ${timeLabel}` : `Yesterday • ${timeLabel}`;
  }

  return `${date.toLocaleDateString(locale, { month: "short", day: "2-digit" })} • ${timeLabel}`;
}
