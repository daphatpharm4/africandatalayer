import { requireUser } from "../../lib/auth.js";
import { getLegacySubmissions, getPointEvents, insertPointEvent, isStorageUnavailableError } from "../../lib/server/storage/index.js";
import { mergePointEventsWithLegacy, normalizeEnrichPayload, projectPointsFromEvents } from "../../lib/server/pointProjection.js";
import { errorResponse, jsonResponse } from "../../lib/server/http.js";
import { canViewEventDetail, toSubmissionAuthContext } from "../../lib/server/submissionAccess.js";
import { BONAMOUSSADI_CURATED_SEED_EVENTS } from "../../shared/bonamoussadiSeedEvents.js";
import type { PointEvent, SubmissionDetails } from "../../shared/types.js";

async function getCombinedEvents(): Promise<PointEvent[]> {
  const pointEvents = await getPointEvents();
  const legacySubmissions = await getLegacySubmissions();
  const merged = mergePointEventsWithLegacy(pointEvents, legacySubmissions);
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

export async function GET(request: Request): Promise<Response> {
  const auth = await requireUser(request);
  if (!auth) return errorResponse("Unauthorized", 401);
  const viewer = toSubmissionAuthContext(auth);
  if (!viewer) return errorResponse("Unauthorized", 401);

  const url = new URL(request.url);
  const id = url.pathname.split("/").pop();
  const view = url.searchParams.get("view");
  if (!id) return errorResponse("Missing submission id", 400);

  let events: PointEvent[];
  try {
    events = await getCombinedEvents();
  } catch (error) {
    if (isStorageUnavailableError(error)) {
      return errorResponse("Storage service temporarily unavailable", 503, { code: "storage_unavailable" });
    }
    throw error;
  }

  if (view === "event") {
    const event = events.find((item) => item.id === id);
    if (!event) return errorResponse("Submission event not found", 404);
    if (!canViewEventDetail(event, viewer)) return errorResponse("Forbidden", 403);
    return jsonResponse(event, { status: 200 });
  }

  const points = projectPointsFromEvents(events);
  const point = points.find((item) => item.pointId === id || item.id === id);
  if (point) return jsonResponse(point, { status: 200 });

  const fallbackEvent = events.find((item) => item.id === id);
  if (fallbackEvent) return jsonResponse(fallbackEvent, { status: 200 });

  return errorResponse("Submission not found", 404);
}

export async function PUT(request: Request): Promise<Response> {
  const auth = await requireUser(request);
  if (!auth) return errorResponse("Unauthorized", 401);

  const url = new URL(request.url);
  const id = url.pathname.split("/").pop();
  if (!id) return errorResponse("Missing submission id", 400);

  let body: any;
  try {
    body = await request.json();
  } catch {
    return errorResponse("Invalid JSON body", 400);
  }

  const details = body?.details && typeof body.details === "object" ? ({ ...(body.details as SubmissionDetails) } as SubmissionDetails) : null;
  if (!details) return errorResponse("Missing details payload", 400);

  try {
    const combinedEvents = await getCombinedEvents();
    const points = projectPointsFromEvents(combinedEvents);
    const targetPoint = points.find((point) => point.pointId === id || point.id === id);
    if (!targetPoint) return errorResponse("Submission not found", 404);

    const newEvent: PointEvent = {
      id: crypto.randomUUID(),
      pointId: targetPoint.pointId,
      eventType: "ENRICH_EVENT",
      userId: auth.id,
      category: targetPoint.category,
      location: targetPoint.location,
      details: normalizeEnrichPayload(targetPoint.category, details),
      photoUrl: typeof body?.photoUrl === "string" ? body.photoUrl : undefined,
      createdAt: new Date().toISOString(),
      source: "compat_put",
    };

    await insertPointEvent(newEvent);
    return jsonResponse(newEvent, { status: 200 });
  } catch (error) {
    if (isStorageUnavailableError(error)) {
      return errorResponse("Storage service temporarily unavailable", 503, { code: "storage_unavailable" });
    }
    throw error;
  }
}
