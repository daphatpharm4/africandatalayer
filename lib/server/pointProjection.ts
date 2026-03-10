import type {
  LegacySubmission,
  PointEvent,
  PointEventType,
  ProjectedPoint,
  SubmissionCategory,
  SubmissionDetails,
} from "../../shared/types.js";
import { getVertical } from "../../shared/verticals.js";

function trimString(input: unknown): string | undefined {
  if (typeof input !== "string") return undefined;
  const trimmed = input.trim();
  return trimmed || undefined;
}

function hasValue(input: unknown): boolean {
  if (typeof input === "string") return Boolean(input.trim());
  if (typeof input === "number") return Number.isFinite(input);
  if (typeof input === "boolean") return true;
  if (Array.isArray(input)) return input.length > 0;
  if (input && typeof input === "object") return Object.keys(input as object).length > 0;
  return false;
}

function normalizeDetailsForCategory(category: SubmissionCategory, raw: SubmissionDetails): SubmissionDetails {
  return getVertical(category).normalizeDetails(raw);
}

export function canonicalizeEnrichField(field: string): string {
  return field === "merchantId"
    ? "merchantIdByProvider"
    : field === "hasCashAvailable"
      ? "hasMin50000XafAvailable"
      : field === "hours"
        ? "openingHours"
        : field === "isOnCall" || field === "onDuty"
          ? "isOnDuty"
          : field;
}

function mergeDetails(base: SubmissionDetails, incoming: SubmissionDetails): SubmissionDetails {
  const merged: SubmissionDetails = { ...base };
  const entries = Object.entries(incoming) as Array<[string, unknown]>;
  for (const [key, value] of entries) {
    if (!hasValue(value)) continue;
    if (Array.isArray(value)) {
      merged[key] = value;
      continue;
    }
    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      const prev = merged[key];
      if (typeof prev === "object" && prev !== null && !Array.isArray(prev)) {
        merged[key] = { ...(prev as Record<string, unknown>), ...(value as Record<string, unknown>) };
      } else {
        merged[key] = value;
      }
      continue;
    }
    merged[key] = value;
  }
  return merged;
}

export function listMissingFields(category: SubmissionCategory, details: SubmissionDetails): string[] {
  const normalized = normalizeDetailsForCategory(category, details);
  return getVertical(category).enrichableFields.filter((field) => !hasValue(normalized[field]));
}

export function listCreateMissingFields(category: SubmissionCategory, details: SubmissionDetails): string[] {
  const normalized = normalizeDetailsForCategory(category, details);
  return getVertical(category).createRequiredFields.filter((field) => !hasValue(normalized[field]));
}

export function isEnrichFieldAllowed(category: SubmissionCategory, field: string): boolean {
  const canonicalField = canonicalizeEnrichField(field);
  return getVertical(category).enrichableFields.includes(canonicalField);
}

export function filterEnrichDetails(category: SubmissionCategory, details: SubmissionDetails): SubmissionDetails {
  const filtered: SubmissionDetails = {};
  for (const [field, value] of Object.entries(details)) {
    if (!hasValue(value)) continue;
    if (!isEnrichFieldAllowed(category, field)) continue;
    filtered[field] = value;
  }
  return filtered;
}

export function eventToProjectedPoint(event: PointEvent): ProjectedPoint {
  const details = normalizeDetailsForCategory(event.category, event.details ?? {});
  const gaps = listMissingFields(event.category, details);
  return {
    id: event.pointId,
    pointId: event.pointId,
    category: event.category,
    location: event.location,
    details,
    photoUrl: event.photoUrl,
    createdAt: event.createdAt,
    updatedAt: event.createdAt,
    source: event.source,
    externalId: event.externalId,
    gaps,
    eventsCount: 1,
    eventIds: [event.id],
  };
}

export function projectPointsFromEvents(events: PointEvent[]): ProjectedPoint[] {
  const groups = new Map<string, ProjectedPoint>();
  const sorted = [...events].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  for (const event of sorted) {
    const normalizedDetails = normalizeDetailsForCategory(event.category, event.details ?? {});
    const existing = groups.get(event.pointId);
    if (!existing) {
      groups.set(
        event.pointId,
        {
          id: event.pointId,
          pointId: event.pointId,
          category: event.category,
          location: event.location,
          details: normalizedDetails,
          photoUrl: event.photoUrl,
          createdAt: event.createdAt,
          updatedAt: event.createdAt,
          source: event.source,
          externalId: event.externalId,
          gaps: listMissingFields(event.category, normalizedDetails),
          eventsCount: 1,
          eventIds: [event.id],
        },
      );
      continue;
    }

    existing.category = event.category;
    existing.location = event.location ?? existing.location;
    existing.details = mergeDetails(existing.details, normalizedDetails);
    existing.updatedAt = event.createdAt;
    existing.eventsCount += 1;
    existing.eventIds.push(event.id);
    if (event.photoUrl) existing.photoUrl = event.photoUrl;
    if (event.source) existing.source = event.source;
    if (event.externalId) existing.externalId = event.externalId;
    existing.gaps = listMissingFields(existing.category, existing.details);
  }

  return Array.from(groups.values()).sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );
}

export function projectPointById(events: PointEvent[], pointId: string): ProjectedPoint | null {
  return projectPointsFromEvents(events).find((point) => point.pointId === pointId) ?? null;
}

export function legacySubmissionToCreateEvent(submission: LegacySubmission): PointEvent {
  const eventType: PointEventType = "CREATE_EVENT";
  const details = normalizeDetailsForCategory(submission.category, submission.details ?? {});
  const source = trimString(details.source) ?? "legacy_submission";
  const externalId = trimString(details.externalId) ?? `legacy:${submission.id}`;
  return {
    id: `legacy-event-${submission.id}`,
    pointId: submission.id,
    eventType,
    userId: submission.userId,
    category: submission.category,
    location: submission.location,
    details,
    photoUrl: submission.photoUrl,
    createdAt: submission.createdAt,
    source,
    externalId,
  };
}

export function mergePointEventsWithLegacy(pointEvents: PointEvent[], legacySubmissions: LegacySubmission[]): PointEvent[] {
  const merged = [...pointEvents];
  const seen = new Set(merged.map((item) => item.id));
  for (const legacy of legacySubmissions) {
    const converted = legacySubmissionToCreateEvent(legacy);
    if (seen.has(converted.id)) continue;
    merged.push(converted);
    seen.add(converted.id);
  }
  return merged;
}

export function normalizeEnrichPayload(category: SubmissionCategory, details: SubmissionDetails): SubmissionDetails {
  const normalized = normalizeDetailsForCategory(category, details);
  if (normalized.hours && !normalized.openingHours) normalized.openingHours = String(normalized.hours);
  return normalized;
}
