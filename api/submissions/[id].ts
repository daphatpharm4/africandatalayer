import { requireUser } from "../../lib/auth.js";
import { getPointEvents, getSubmissions, setPointEvents } from "../../lib/edgeConfig.js";
import { mergePointEventsWithLegacy, normalizeEnrichPayload, projectPointsFromEvents } from "../../lib/server/pointProjection.js";
import { errorResponse, jsonResponse } from "../../lib/server/http.js";
import { BONAMOUSSADI_CURATED_SEED_EVENTS } from "../../shared/bonamoussadiSeedEvents.js";
import type { PointEvent, SubmissionDetails } from "../../shared/types.js";

const MAX_EDGE_CONFIG_EVENTS_BYTES = Number(process.env.MAX_EDGE_CONFIG_EVENTS_BYTES ?? "1800000") || 1800000;

function estimateJsonBytes(input: unknown): number {
  return Buffer.byteLength(JSON.stringify(input), "utf8");
}

function compactEventsForStorage(events: PointEvent[]): PointEvent[] {
  if (estimateJsonBytes(events) <= MAX_EDGE_CONFIG_EVENTS_BYTES) return events;
  const sorted = [...events].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  while (sorted.length > 0 && estimateJsonBytes(sorted) > MAX_EDGE_CONFIG_EVENTS_BYTES) {
    sorted.pop();
  }
  return sorted;
}

async function getCombinedEvents(): Promise<PointEvent[]> {
  const pointEvents = await getPointEvents();
  const legacySubmissions = await getSubmissions();
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

  const url = new URL(request.url);
  const id = url.pathname.split("/").pop();
  const view = url.searchParams.get("view");
  if (!id) return errorResponse("Missing submission id", 400);

  const events = await getCombinedEvents();

  if (view === "event") {
    const event = events.find((item) => item.id === id);
    if (!event) return errorResponse("Submission event not found", 404);
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

  const rawPointEvents = await getPointEvents();
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

  rawPointEvents.push(newEvent);
  await setPointEvents(compactEventsForStorage(rawPointEvents));
  return jsonResponse(newEvent, { status: 200 });
}
