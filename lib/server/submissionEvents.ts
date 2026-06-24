import { BONAMOUSSADI_CURATED_SEED_EVENTS } from "../../shared/bonamoussadiSeedEvents.js";
import type { LegacySubmission, PointEvent, ProjectedPoint } from "../../shared/types.js";
import { mergePointEventsWithLegacy, projectPointById } from "./pointProjection.js";
import { getLegacySubmissions, getPointEvents } from "./storage/index.js";
import type { PointEventFilter } from "./storage/pointEventsQuery.js";

const INLINE_PHOTO_PREFIX = "data:image/";

export function stripInlinePhotoData(event: PointEvent): PointEvent {
  if (typeof event.photoUrl !== "string" || !event.photoUrl.startsWith(INLINE_PHOTO_PREFIX)) return event;
  const rest = { ...event };
  delete rest.photoUrl;
  const details = { ...(event.details ?? {}), hasPhoto: true };
  return { ...rest, details };
}

export async function buildContributionEvents(filter?: PointEventFilter): Promise<PointEvent[]> {
  const pointEvents = (await getPointEvents(filter)).map(stripInlinePhotoData);
  const legacySubmissions = await getLegacySubmissions();
  return mergePointEventsWithLegacy(pointEvents, legacySubmissions);
}

export async function buildReadableEvents(filter?: PointEventFilter): Promise<PointEvent[]> {
  const merged = await buildContributionEvents(filter);
  const seenExternalIds = new Set(
    merged
      .map((event) => (typeof event.externalId === "string" ? event.externalId.trim() : ""))
      .filter((value) => value.length > 0),
  );
  const seenPointIds = new Set(merged.map((event) => event.pointId));
  for (const seedEvent of BONAMOUSSADI_CURATED_SEED_EVENTS) {
    const externalId = typeof seedEvent.externalId === "string" ? seedEvent.externalId.trim() : "";
    if (externalId && seenExternalIds.has(externalId)) continue;
    if (seenPointIds.has(seedEvent.pointId)) continue;
    merged.push(seedEvent);
    if (externalId) seenExternalIds.add(externalId);
    seenPointIds.add(seedEvent.pointId);
  }
  return merged;
}

export type ReadablePointSource =
  | { kind: "point_event" }
  | { kind: "legacy_submission"; submissionId: string }
  | { kind: "curated_seed"; eventId: string };

export interface ReadableProjectedPoint {
  point: ProjectedPoint;
  source: ReadablePointSource;
}

export interface ReadablePointLookupDeps {
  getPointEventsFn?: (filter?: PointEventFilter) => Promise<PointEvent[]>;
  getLegacySubmissionsFn?: () => Promise<LegacySubmission[]>;
  seedEvents?: readonly PointEvent[];
}

export async function findReadableProjectedPoint(
  pointId: string,
  deps: ReadablePointLookupDeps = {},
): Promise<ReadableProjectedPoint | null> {
  const normalizedPointId = pointId.trim();
  if (!normalizedPointId) return null;

  const getPointEventsFn = deps.getPointEventsFn ?? getPointEvents;
  const getLegacySubmissionsFn = deps.getLegacySubmissionsFn ?? getLegacySubmissions;
  const seedEvents = deps.seedEvents ?? BONAMOUSSADI_CURATED_SEED_EVENTS;
  const pointEvents = (await getPointEventsFn({ pointId: normalizedPointId }))
    .filter((event) => event.pointId === normalizedPointId)
    .map(stripInlinePhotoData);
  const legacySubmission = (await getLegacySubmissionsFn()).find(
    (submission) => submission.id === normalizedPointId,
  );

  if (pointEvents.length > 0) {
    const canonicalEvents = mergePointEventsWithLegacy(
      pointEvents,
      legacySubmission ? [legacySubmission] : [],
    );
    const point = projectPointById(canonicalEvents, normalizedPointId);
    return point ? { point, source: { kind: "point_event" } } : null;
  }

  if (legacySubmission) {
    const point = projectPointById(
      mergePointEventsWithLegacy([], [legacySubmission]),
      normalizedPointId,
    );
    return point
      ? {
          point,
          source: {
            kind: "legacy_submission",
            submissionId: legacySubmission.id,
          },
        }
      : null;
  }

  const seedEvent = seedEvents.find(
    (event) => event.pointId === normalizedPointId,
  );
  if (!seedEvent) return null;
  const point = projectPointById([stripInlinePhotoData(seedEvent)], normalizedPointId);
  return point
    ? {
        point,
        source: { kind: "curated_seed", eventId: seedEvent.id },
      }
    : null;
}
