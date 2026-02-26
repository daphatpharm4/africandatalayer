import type {
  LegacySubmission,
  PointEvent,
  PointEventType,
  ProjectedPoint,
  SubmissionCategory,
  SubmissionDetails,
  SubmissionLocation,
} from "../../shared/types.js";

type GapRules = Record<SubmissionCategory, readonly string[]>;

const ENRICHABLE_FIELDS: GapRules = {
  pharmacy: ["openingHours", "isOpenNow", "isOnDuty"],
  mobile_money: ["merchantIdByProvider", "paymentMethods", "openingHours", "providers"],
  fuel_station: ["fuelTypes", "pricesByFuel", "quality", "paymentMethods", "openingHours", "hasFuelAvailable"],
};

const CREATE_REQUIRED_FIELDS: GapRules = {
  pharmacy: ["name", "isOpenNow"],
  mobile_money: ["providers"],
  fuel_station: ["name", "hasFuelAvailable"],
};

function hasValue(input: unknown): boolean {
  if (typeof input === "string") return Boolean(input.trim());
  if (typeof input === "number") return Number.isFinite(input);
  if (typeof input === "boolean") return true;
  if (Array.isArray(input)) return input.length > 0;
  if (input && typeof input === "object") return Object.keys(input as object).length > 0;
  return false;
}

function trimString(input: unknown): string | undefined {
  if (typeof input !== "string") return undefined;
  const trimmed = input.trim();
  return trimmed || undefined;
}

function normalizeBoolean(input: unknown): boolean | undefined {
  if (typeof input === "boolean") return input;
  if (typeof input === "number") {
    if (input === 1) return true;
    if (input === 0) return false;
    return undefined;
  }
  if (typeof input !== "string") return undefined;
  const normalized = input.trim().toLowerCase();
  if (!normalized) return undefined;
  if (["true", "yes", "y", "1", "open", "available", "oui"].includes(normalized)) return true;
  if (["false", "no", "n", "0", "closed", "unavailable", "non"].includes(normalized)) return false;
  return undefined;
}

function normalizeProviders(input: unknown): string[] | undefined {
  if (Array.isArray(input)) {
    const list = input
      .map((value) => trimString(value))
      .filter((value): value is string => Boolean(value));
    return list.length ? Array.from(new Set(list)) : undefined;
  }
  const single = trimString(input);
  return single ? [single] : undefined;
}

function normalizeDetailsForCategory(category: SubmissionCategory, raw: SubmissionDetails): SubmissionDetails {
  const details: SubmissionDetails = { ...raw };
  const name = trimString(details.name) ?? trimString(details.siteName);
  if (name) {
    details.name = name;
    details.siteName = name;
  }

  const openingHours = trimString((details as Record<string, unknown>).opening_hours) ?? trimString(details.openingHours);
  if (openingHours) details.openingHours = openingHours;

  if (category === "mobile_money") {
    const providers = normalizeProviders(details.providers ?? details.provider);
    if (providers) details.providers = providers;
    const cashThreshold =
      normalizeBoolean(details.hasMin50000XafAvailable) ??
      normalizeBoolean(details.hasCashAvailable) ??
      (typeof details.availability === "string" ? !details.availability.toLowerCase().includes("out") : undefined);
    if (typeof cashThreshold === "boolean") {
      details.hasMin50000XafAvailable = cashThreshold;
    }
    if ("hasCashAvailable" in details) {
      delete details.hasCashAvailable;
    }
    if (details.merchantId && providers?.length && !details.merchantIdByProvider) {
      details.merchantIdByProvider = { [providers[0]]: details.merchantId };
    }
  }

  if (category === "fuel_station") {
    const fuelType = trimString(details.fuelType);
    if (fuelType && !details.fuelTypes?.length) details.fuelTypes = [fuelType];
    const parsedPrice =
      typeof details.fuelPrice === "number"
        ? details.fuelPrice
        : typeof details.price === "number"
          ? details.price
          : undefined;
    if (typeof details.hasFuelAvailable !== "boolean" && typeof details.availability === "string") {
      details.hasFuelAvailable = !details.availability.toLowerCase().includes("out");
    }
    if (parsedPrice !== undefined) {
      const priceKey = fuelType ?? "super";
      details.pricesByFuel = { ...(details.pricesByFuel ?? {}), [priceKey]: parsedPrice };
      details.fuelPrice = parsedPrice;
      details.price = parsedPrice;
    }
  }

  if (category === "pharmacy" && typeof details.isOpenNow !== "boolean" && typeof details.availability === "string") {
    const normalized = details.availability.toLowerCase();
    details.isOpenNow = !normalized.includes("out") && !normalized.includes("closed");
  }

  if (category === "pharmacy") {
    const raw = details as Record<string, unknown>;
    const isOnDuty = normalizeBoolean(raw.isOnDuty ?? raw.isOnCall ?? raw.onDuty ?? raw.pharmacyDeGarde);
    if (typeof isOnDuty === "boolean") details.isOnDuty = isOnDuty;

    if (typeof details.isOnDuty !== "boolean" && typeof details.availability === "string") {
      const normalized = details.availability.toLowerCase();
      if (normalized.includes("on-call") || normalized.includes("on call") || normalized.includes("garde")) {
        details.isOnDuty = true;
      }
    }
  }

  return details;
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
  return ENRICHABLE_FIELDS[category].filter((field) => !hasValue(normalized[field]));
}

export function listCreateMissingFields(category: SubmissionCategory, details: SubmissionDetails): string[] {
  const normalized = normalizeDetailsForCategory(category, details);
  return CREATE_REQUIRED_FIELDS[category].filter((field) => !hasValue(normalized[field]));
}

export function isEnrichFieldAllowed(category: SubmissionCategory, field: string): boolean {
  const canonicalField =
    field === "merchantId"
      ? "merchantIdByProvider"
      : field === "hasCashAvailable"
        ? "hasMin50000XafAvailable"
      : field === "hours"
        ? "openingHours"
        : field === "isOnCall" || field === "onDuty"
          ? "isOnDuty"
          : field;
  return ENRICHABLE_FIELDS[category].includes(canonicalField);
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
