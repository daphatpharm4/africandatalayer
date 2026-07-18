// Read-side lookup of public projected points for the tenant platform.
// Points are projected from events on demand — no projection table exists.
import type { ProjectedPoint } from "../../../shared/types.js";
import type { PlatformNearbyPoint } from "../../../shared/platformTypes.js";
import { projectPointById, projectPointsFromEvents } from "../pointProjection.js";
import { toPublicProjectedPoint } from "../privacy.js";
import { buildReadableEvents } from "../submissionEvents.js";
import { haversineKm } from "../submissionFraud.js";

export interface PointLookupDeps {
  loadEventsFn?: typeof buildReadableEvents;
}

export async function findActivePoint(
  pointId: string,
  deps: PointLookupDeps = {},
): Promise<ProjectedPoint | null> {
  const loadEvents = deps.loadEventsFn ?? buildReadableEvents;
  return projectPointById(await loadEvents(), pointId);
}

export async function listNearbyPoints(
  input: { latitude: number; longitude: number; radiusMeters: number; limit: number },
  deps: PointLookupDeps = {},
): Promise<PlatformNearbyPoint[]> {
  const loadEvents = deps.loadEventsFn ?? buildReadableEvents;
  const origin = { latitude: input.latitude, longitude: input.longitude };
  return projectPointsFromEvents(await loadEvents())
    .map(toPublicProjectedPoint)
    .map((point) => ({
      pointId: point.pointId,
      category: point.category,
      name: point.details?.name ?? point.details?.siteName ?? null,
      location: point.location,
      details: point.details,
      photoUrl: point.photoUrl,
      createdAt: point.createdAt,
      updatedAt: point.updatedAt,
      gaps: point.gaps,
      eventsCount: point.eventsCount,
      operatorSignals: point.operatorSignals,
      distanceMeters: Math.round(haversineKm(origin, point.location) * 1000),
    }))
    .filter((point) => point.distanceMeters <= input.radiusMeters)
    .sort((a, b) => a.distanceMeters - b.distanceMeters)
    .slice(0, input.limit);
}
