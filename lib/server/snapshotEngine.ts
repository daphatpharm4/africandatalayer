import { query } from "./db.js";
import { getPointEvents, getLegacySubmissions } from "./storage/index.js";
import {
  projectPointsFromEvents,
  mergePointEventsWithLegacy,
} from "./pointProjection.js";
import type {
  ProjectedPoint,
  DeltaType,
  DeltaDirection,
  AnomalyFlag,
} from "../../shared/types.js";

// Fields to skip when comparing details between snapshots
const SKIP_FIELDS = new Set([
  "fraudCheck",
  "clientDevice",
  "source",
  "externalId",
  "isImported",
  "hasPhoto",
  "hasSecondaryPhoto",
  "secondPhotoUrl",
]);

// ── Statistical helpers ───────────────────────────────────────────────

export function computeMovingAverage(
  values: number[],
  windowSize: number,
): number | null {
  if (values.length === 0) return null;
  const window = values.slice(-windowSize);
  return window.reduce((a, b) => a + b, 0) / window.length;
}

export function computeZScore(
  value: number,
  historicalValues: number[],
): number | null {
  if (historicalValues.length < 3) return null;
  const mean =
    historicalValues.reduce((a, b) => a + b, 0) / historicalValues.length;
  const variance =
    historicalValues.reduce((sum, v) => sum + (v - mean) ** 2, 0) /
    historicalValues.length;
  const stddev = Math.sqrt(variance);
  if (stddev === 0) return 0;
  return (value - mean) / stddev;
}

export function detectAnomalies(
  value: number,
  history: number[],
  metricName: string,
  threshold = 2,
): AnomalyFlag | null {
  const z = computeZScore(value, history);
  if (z === null || Math.abs(z) <= threshold) return null;
  return {
    metric: metricName,
    zScore: Math.round(z * 100) / 100,
    direction: z > 0 ? "increase" : "decrease",
  };
}

// ── Delta computation ─────────────────────────────────────────────────

interface DeltaRow {
  snapshotDate: string;
  baselineSnapshotDate: string;
  verticalId: string;
  pointId: string;
  deltaType: DeltaType;
  deltaField: string | null;
  previousValue: string | null;
  currentValue: string | null;
  deltaMagnitude: number | null;
  deltaDirection: DeltaDirection;
  deltaSummary: string | null;
}

function detectChangedFields(
  current: Record<string, unknown>,
  previous: Record<string, unknown>,
): Array<{
  field: string;
  prev: string;
  curr: string;
  magnitude: number | null;
  direction: DeltaDirection;
}> {
  const changes: Array<{
    field: string;
    prev: string;
    curr: string;
    magnitude: number | null;
    direction: DeltaDirection;
  }> = [];

  const allKeys = new Set([...Object.keys(current), ...Object.keys(previous)]);
  for (const key of allKeys) {
    if (SKIP_FIELDS.has(key)) continue;
    const cv = current[key];
    const pv = previous[key];
    const cs = JSON.stringify(cv ?? null);
    const ps = JSON.stringify(pv ?? null);
    if (cs === ps) continue;

    let magnitude: number | null = null;
    let direction: DeltaDirection = "not_applicable";
    if (typeof cv === "number" && typeof pv === "number") {
      magnitude = cv - pv;
      direction = cv > pv ? "increase" : cv < pv ? "decrease" : "stable";
    }

    changes.push({
      field: key,
      prev: ps,
      curr: cs,
      magnitude,
      direction,
    });
  }
  return changes;
}

export function computeDeltas(
  currentMap: Map<string, ProjectedPoint>,
  previousMap: Map<string, ProjectedPoint>,
  snapshotDate: string,
  baselineDate: string,
): DeltaRow[] {
  const deltas: DeltaRow[] = [];

  // New points
  for (const [pointId, point] of currentMap) {
    if (!previousMap.has(pointId)) {
      deltas.push({
        snapshotDate,
        baselineSnapshotDate: baselineDate,
        verticalId: point.category,
        pointId,
        deltaType: "new",
        deltaField: null,
        previousValue: null,
        currentValue: null,
        deltaMagnitude: null,
        deltaDirection: "not_applicable",
        deltaSummary: `New ${point.category} point added`,
      });
    }
  }

  // Removed points
  for (const [pointId, point] of previousMap) {
    if (!currentMap.has(pointId)) {
      deltas.push({
        snapshotDate,
        baselineSnapshotDate: baselineDate,
        verticalId: point.category,
        pointId,
        deltaType: "removed",
        deltaField: null,
        previousValue: null,
        currentValue: null,
        deltaMagnitude: null,
        deltaDirection: "not_applicable",
        deltaSummary: `${point.category} point removed`,
      });
    }
  }

  // Changed / unchanged
  for (const [pointId, current] of currentMap) {
    const previous = previousMap.get(pointId);
    if (!previous) continue;

    const changes = detectChangedFields(
      current.details as Record<string, unknown>,
      previous.details as Record<string, unknown>,
    );

    if (changes.length === 0) {
      deltas.push({
        snapshotDate,
        baselineSnapshotDate: baselineDate,
        verticalId: current.category,
        pointId,
        deltaType: "unchanged",
        deltaField: null,
        previousValue: null,
        currentValue: null,
        deltaMagnitude: null,
        deltaDirection: "stable",
        deltaSummary: null,
      });
    } else {
      for (const change of changes) {
        const pctStr =
          change.magnitude !== null && change.direction !== "not_applicable"
            ? ` (${change.direction === "increase" ? "+" : ""}${change.magnitude})`
            : "";
        deltas.push({
          snapshotDate,
          baselineSnapshotDate: baselineDate,
          verticalId: current.category,
          pointId,
          deltaType: "changed",
          deltaField: change.field,
          previousValue: change.prev,
          currentValue: change.curr,
          deltaMagnitude: change.magnitude,
          deltaDirection: change.direction,
          deltaSummary: `${change.field} changed: ${change.prev} → ${change.curr}${pctStr}`,
        });
      }
    }
  }

  return deltas;
}

// ── Snapshot rows ─────────────────────────────────────────────────────

interface SnapshotRow {
  snapshotDate: string;
  verticalId: string;
  pointId: string;
  category: string;
  siteName: string | null;
  latitude: number;
  longitude: number;
  details: Record<string, unknown>;
  gaps: string[];
  eventsCount: number;
  photoUrl: string | null;
  source: string | null;
  externalId: string | null;
}

function buildSnapshotRows(
  snapshotDate: string,
  points: ProjectedPoint[],
): SnapshotRow[] {
  return points.map((p) => ({
    snapshotDate,
    verticalId: p.category,
    pointId: p.pointId,
    category: p.category,
    siteName: (p.details.siteName as string) ?? (p.details.name as string) ?? null,
    latitude: p.location.latitude,
    longitude: p.location.longitude,
    details: p.details as Record<string, unknown>,
    gaps: p.gaps,
    eventsCount: p.eventsCount,
    photoUrl: p.photoUrl ?? null,
    source: p.source ?? null,
    externalId: p.externalId ?? null,
  }));
}

// ── DB operations ─────────────────────────────────────────────────────

async function insertSnapshotRows(rows: SnapshotRow[]): Promise<number> {
  if (rows.length === 0) return 0;
  const batchSize = 200;
  let inserted = 0;
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const values: unknown[] = [];
    const placeholders = batch.map((row, idx) => {
      const base = idx * 13;
      values.push(
        row.snapshotDate,
        row.verticalId,
        row.pointId,
        row.category,
        row.siteName,
        row.latitude,
        row.longitude,
        JSON.stringify(row.details),
        row.gaps,
        row.eventsCount,
        row.photoUrl,
        row.source,
        row.externalId,
      );
      return `($${base + 1},$${base + 2},$${base + 3},$${base + 4},$${base + 5},$${base + 6},$${base + 7},$${base + 8},$${base + 9},$${base + 10},$${base + 11},$${base + 12},$${base + 13})`;
    });
    const result = await query(
      `INSERT INTO snapshots (snapshot_date, vertical_id, point_id, category, site_name, latitude, longitude, details, gaps, events_count, photo_url, source, external_id)
       VALUES ${placeholders.join(",")}
       ON CONFLICT (snapshot_date, point_id) DO NOTHING`,
      values,
    );
    inserted += result.rowCount ?? 0;
  }
  return inserted;
}

async function insertDeltaRows(rows: DeltaRow[]): Promise<number> {
  if (rows.length === 0) return 0;
  const batchSize = 200;
  let inserted = 0;
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const values: unknown[] = [];
    const placeholders = batch.map((row, idx) => {
      const base = idx * 11;
      values.push(
        row.snapshotDate,
        row.baselineSnapshotDate,
        row.verticalId,
        row.pointId,
        row.deltaType,
        row.deltaField,
        row.previousValue,
        row.currentValue,
        row.deltaMagnitude,
        row.deltaDirection,
        row.deltaSummary,
      );
      return `($${base + 1},$${base + 2},$${base + 3},$${base + 4},$${base + 5},$${base + 6},$${base + 7},$${base + 8},$${base + 9},$${base + 10},$${base + 11})`;
    });
    const result = await query(
      `INSERT INTO snapshot_deltas (snapshot_date, baseline_snapshot_date, vertical_id, point_id, delta_type, delta_field, previous_value, current_value, delta_magnitude, delta_direction, delta_summary)
       VALUES ${placeholders.join(",")}`,
      values,
    );
    inserted += result.rowCount ?? 0;
  }
  return inserted;
}

async function getPreviousSnapshotDate(
  beforeDate: string,
): Promise<string | null> {
  const result = await query<{ snapshot_date: string }>(
    `SELECT DISTINCT snapshot_date FROM snapshots WHERE snapshot_date < $1 ORDER BY snapshot_date DESC LIMIT 1`,
    [beforeDate],
  );
  return result.rows[0]?.snapshot_date ?? null;
}

async function loadSnapshotAsMap(
  snapshotDate: string,
): Promise<Map<string, ProjectedPoint>> {
  const result = await query<{
    point_id: string;
    category: string;
    site_name: string | null;
    latitude: number;
    longitude: number;
    details: Record<string, unknown>;
    gaps: string[];
    events_count: number;
    photo_url: string | null;
    source: string | null;
    external_id: string | null;
  }>(
    `SELECT point_id, category, site_name, latitude, longitude, details, gaps, events_count, photo_url, source, external_id
     FROM snapshots WHERE snapshot_date = $1`,
    [snapshotDate],
  );

  const map = new Map<string, ProjectedPoint>();
  for (const row of result.rows) {
    map.set(row.point_id, {
      id: row.point_id,
      pointId: row.point_id,
      category: row.category as ProjectedPoint["category"],
      location: { latitude: row.latitude, longitude: row.longitude },
      details: row.details as ProjectedPoint["details"],
      photoUrl: row.photo_url ?? undefined,
      createdAt: "",
      updatedAt: "",
      source: row.source ?? undefined,
      externalId: row.external_id ?? undefined,
      gaps: row.gaps ?? [],
      eventsCount: row.events_count,
      eventIds: [],
    });
  }
  return map;
}

async function getHistoricalStats(
  verticalId: string,
  beforeDate: string,
  limit: number,
): Promise<
  Array<{
    total_points: number;
    new_count: number;
    removed_count: number;
  }>
> {
  const result = await query<{
    total_points: number;
    new_count: number;
    removed_count: number;
  }>(
    `SELECT total_points, new_count, removed_count FROM snapshot_stats
     WHERE vertical_id = $1 AND snapshot_date < $2
     ORDER BY snapshot_date DESC LIMIT $3`,
    [verticalId, beforeDate, limit],
  );
  return result.rows;
}

async function upsertStatsRow(row: {
  snapshotDate: string;
  verticalId: string;
  totalPoints: number;
  completedPoints: number;
  completionRate: number;
  newCount: number;
  removedCount: number;
  changedCount: number;
  unchangedCount: number;
  avgPrice: number | null;
  weekOverWeekGrowth: number | null;
  movingAvg4w: number | null;
  zScoreTotalPoints: number | null;
  zScoreNewCount: number | null;
  zScoreRemovedCount: number | null;
  anomalyFlags: AnomalyFlag[];
}): Promise<void> {
  await query(
    `INSERT INTO snapshot_stats (
      snapshot_date, vertical_id, total_points, completed_points, completion_rate,
      new_count, removed_count, changed_count, unchanged_count,
      avg_price, week_over_week_growth, moving_avg_4w,
      z_score_total_points, z_score_new_count, z_score_removed_count,
      anomaly_flags
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
    ON CONFLICT (snapshot_date, vertical_id) DO UPDATE SET
      total_points = EXCLUDED.total_points,
      completed_points = EXCLUDED.completed_points,
      completion_rate = EXCLUDED.completion_rate,
      new_count = EXCLUDED.new_count,
      removed_count = EXCLUDED.removed_count,
      changed_count = EXCLUDED.changed_count,
      unchanged_count = EXCLUDED.unchanged_count,
      avg_price = EXCLUDED.avg_price,
      week_over_week_growth = EXCLUDED.week_over_week_growth,
      moving_avg_4w = EXCLUDED.moving_avg_4w,
      z_score_total_points = EXCLUDED.z_score_total_points,
      z_score_new_count = EXCLUDED.z_score_new_count,
      z_score_removed_count = EXCLUDED.z_score_removed_count,
      anomaly_flags = EXCLUDED.anomaly_flags`,
    [
      row.snapshotDate,
      row.verticalId,
      row.totalPoints,
      row.completedPoints,
      row.completionRate,
      row.newCount,
      row.removedCount,
      row.changedCount,
      row.unchangedCount,
      row.avgPrice,
      row.weekOverWeekGrowth,
      row.movingAvg4w,
      row.zScoreTotalPoints,
      row.zScoreNewCount,
      row.zScoreRemovedCount,
      JSON.stringify(row.anomalyFlags),
    ],
  );
}

// ── Main engine ───────────────────────────────────────────────────────

export interface SnapshotResult {
  snapshotDate: string;
  snapshotsInserted: number;
  deltasInserted: number;
  statsComputed: number;
  baselineDate: string | null;
}

export async function runWeeklySnapshot(
  dateOverride?: string,
): Promise<SnapshotResult> {
  const snapshotDate =
    dateOverride ?? new Date().toISOString().slice(0, 10);

  // Step 1: build current projection
  const [pointEvents, legacySubs] = await Promise.all([
    getPointEvents(),
    getLegacySubmissions(),
  ]);
  const allEvents = mergePointEventsWithLegacy(pointEvents, legacySubs);
  const projectedPoints = projectPointsFromEvents(allEvents);

  // Step 2: build snapshot rows
  const snapshotRows = buildSnapshotRows(snapshotDate, projectedPoints);

  // Step 3: insert snapshots
  const snapshotsInserted = await insertSnapshotRows(snapshotRows);

  // Step 4: compute deltas
  const baselineDate = await getPreviousSnapshotDate(snapshotDate);
  let deltasInserted = 0;

  const currentMap = new Map<string, ProjectedPoint>();
  for (const p of projectedPoints) currentMap.set(p.pointId, p);

  let deltasByVertical = new Map<string, { new: number; removed: number; changed: number; unchanged: number }>();

  if (baselineDate) {
    const previousMap = await loadSnapshotAsMap(baselineDate);
    const deltas = computeDeltas(
      currentMap,
      previousMap,
      snapshotDate,
      baselineDate,
    );
    deltasInserted = await insertDeltaRows(deltas);

    // Aggregate delta counts by vertical
    for (const d of deltas) {
      const counts = deltasByVertical.get(d.verticalId) ?? {
        new: 0,
        removed: 0,
        changed: 0,
        unchanged: 0,
      };
      if (d.deltaType === "new") counts.new++;
      else if (d.deltaType === "removed") counts.removed++;
      else if (d.deltaType === "changed") counts.changed++;
      else if (d.deltaType === "unchanged") counts.unchanged++;
      deltasByVertical.set(d.verticalId, counts);
    }
  }

  // Step 5: compute stats per vertical
  const verticalGroups = new Map<string, ProjectedPoint[]>();
  for (const p of projectedPoints) {
    const list = verticalGroups.get(p.category) ?? [];
    list.push(p);
    verticalGroups.set(p.category, list);
  }

  // Also include verticals with 0 current points but deltas (removed points)
  for (const vid of deltasByVertical.keys()) {
    if (!verticalGroups.has(vid)) verticalGroups.set(vid, []);
  }

  let statsComputed = 0;

  for (const [verticalId, points] of verticalGroups) {
    const totalPoints = points.length;
    const completedPoints = points.filter((p) => p.gaps.length === 0).length;
    const completionRate =
      totalPoints > 0
        ? Math.round((completedPoints / totalPoints) * 10000) / 100
        : 0;

    const dc = deltasByVertical.get(verticalId) ?? {
      new: 0,
      removed: 0,
      changed: 0,
      unchanged: 0,
    };

    // Average price for fuel verticals
    let avgPrice: number | null = null;
    if (verticalId === "fuel_station") {
      const prices = points
        .map((p) => p.details.fuelPrice)
        .filter((v): v is number => typeof v === "number" && v > 0);
      if (prices.length > 0) {
        avgPrice =
          Math.round(
            (prices.reduce((a, b) => a + b, 0) / prices.length) * 100,
          ) / 100;
      }
    }

    // Historical data for trends
    const history = await getHistoricalStats(verticalId, snapshotDate, 8);
    const histTotalPoints = history.map((h) => h.total_points);
    const histNewCount = history.map((h) => h.new_count);
    const histRemovedCount = history.map((h) => h.removed_count);

    // Week-over-week growth
    let weekOverWeekGrowth: number | null = null;
    if (history.length > 0 && history[0].total_points > 0) {
      weekOverWeekGrowth =
        Math.round(
          ((totalPoints - history[0].total_points) /
            history[0].total_points) *
            10000,
        ) / 100;
    }

    // Moving average (4-week)
    const movingAvg4w = computeMovingAverage(
      [...histTotalPoints.reverse(), totalPoints],
      4,
    );

    // Z-scores
    const zScoreTotalPoints = computeZScore(totalPoints, histTotalPoints);
    const zScoreNewCount = computeZScore(dc.new, histNewCount);
    const zScoreRemovedCount = computeZScore(dc.removed, histRemovedCount);

    // Anomaly detection
    const anomalyFlags: AnomalyFlag[] = [];
    const a1 = detectAnomalies(totalPoints, histTotalPoints, "total_points");
    if (a1) anomalyFlags.push(a1);
    const a2 = detectAnomalies(dc.new, histNewCount, "new_count");
    if (a2) anomalyFlags.push(a2);
    const a3 = detectAnomalies(dc.removed, histRemovedCount, "removed_count");
    if (a3) anomalyFlags.push(a3);

    await upsertStatsRow({
      snapshotDate,
      verticalId,
      totalPoints,
      completedPoints,
      completionRate,
      newCount: dc.new,
      removedCount: dc.removed,
      changedCount: dc.changed,
      unchangedCount: dc.unchanged,
      avgPrice,
      weekOverWeekGrowth,
      movingAvg4w: movingAvg4w !== null ? Math.round(movingAvg4w * 100) / 100 : null,
      zScoreTotalPoints: zScoreTotalPoints !== null ? Math.round(zScoreTotalPoints * 100) / 100 : null,
      zScoreNewCount: zScoreNewCount !== null ? Math.round(zScoreNewCount * 100) / 100 : null,
      zScoreRemovedCount: zScoreRemovedCount !== null ? Math.round(zScoreRemovedCount * 100) / 100 : null,
      anomalyFlags,
    });
    statsComputed++;
  }

  return {
    snapshotDate,
    snapshotsInserted,
    deltasInserted,
    statsComputed,
    baselineDate,
  };
}
