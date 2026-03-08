import { BONAMOUSSADI_CURATED_SEED_EVENTS } from "../../shared/bonamoussadiSeedEvents.js";
import type { PointEvent } from "../../shared/types.js";
import { mergePointEventsWithLegacy } from "./pointProjection.js";
import { getLegacySubmissions, getPointEvents } from "./storage/index.js";

const INLINE_PHOTO_PREFIX = "data:image/";

export function stripInlinePhotoData(event: PointEvent): PointEvent {
  if (typeof event.photoUrl !== "string" || !event.photoUrl.startsWith(INLINE_PHOTO_PREFIX)) return event;
  const { photoUrl: _photoUrl, ...rest } = event;
  const details = { ...(event.details ?? {}), hasPhoto: true };
  return { ...rest, details };
}

export async function buildContributionEvents(): Promise<PointEvent[]> {
  const pointEvents = (await getPointEvents()).map(stripInlinePhotoData);
  const legacySubmissions = await getLegacySubmissions();
  return mergePointEventsWithLegacy(pointEvents, legacySubmissions);
}

export async function buildReadableEvents(): Promise<PointEvent[]> {
  const merged = await buildContributionEvents();
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
