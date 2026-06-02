/**
 * Pure SQL builder for the point_events read path.
 *
 * Historically the read path materialized the entire point_events table and
 * filtered in JS (per-event geofence). This pushes the spatial bounding-box and
 * time-window filters down to Postgres so a map load no longer scans every row.
 *
 * The builder is intentionally side-effect-free (no `pg` import) so it can be
 * unit-tested without a database — that is the seam CI exercises.
 */

export interface PointEventBbox {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

export interface PointEventFilter {
  /** Geographic bounding box. Events outside it are excluded by Postgres. */
  bbox?: PointEventBbox;
  /** ISO timestamp lower bound — only events at/after this are returned. */
  since?: string;
}

export const POINT_EVENT_COLUMNS =
  "id, point_id, event_type, user_id, category, latitude, longitude, details, photo_url, created_at, source, external_id, consent_status, consent_recorded_at, erased_at, erased_by, erasure_reason";

function isFiniteBbox(bbox: PointEventBbox | undefined): bbox is PointEventBbox {
  return (
    !!bbox &&
    Number.isFinite(bbox.minLat) &&
    Number.isFinite(bbox.maxLat) &&
    Number.isFinite(bbox.minLng) &&
    Number.isFinite(bbox.maxLng)
  );
}

export function buildPointEventsQuery(filter?: PointEventFilter): { text: string; values: unknown[] } {
  const where: string[] = [];
  const values: unknown[] = [];

  if (isFiniteBbox(filter?.bbox)) {
    const { minLat, maxLat, minLng, maxLng } = filter.bbox;
    values.push(minLat, maxLat, minLng, maxLng);
    const n = values.length;
    where.push(
      `latitude >= $${n - 3} and latitude <= $${n - 2} and longitude >= $${n - 1} and longitude <= $${n}`,
    );
  }

  if (typeof filter?.since === "string" && filter.since.trim()) {
    values.push(filter.since);
    where.push(`created_at >= $${values.length}::timestamptz`);
  }

  let text = `select ${POINT_EVENT_COLUMNS} from point_events`;
  if (where.length) text += ` where ${where.join(" and ")}`;
  text += " order by created_at asc";

  return { text, values };
}
