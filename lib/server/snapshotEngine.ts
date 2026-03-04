import { query } from "./db.js";
import { getPointEvents, getLegacySubmissions } from "./storage/index.js";
import {
  projectPointsFromEvents,
  mergePointEventsWithLegacy,
} from "./pointProjection.js";
import { computeConfidenceScore } from "./confidenceScore.js";
import type {
  ProjectedPoint,
  PointEvent,
  DeltaType,
  DeltaDirection,
  DeltaSignificance,
  AnomalyFlag,
} from "../../shared/types.js";

const SCORE_THRESHOLD_PUBLISHABLE = 40;
const PARTIAL_SNAPSHOT_THRESHOLD = 50;

// Fields to skip when comparing details between snapshots.
const SKIP_FIELDS = new Set([
  "fraudCheck",
  "clientDevice",
  "source",
  "externalId",
  "isImported",
  "hasPhoto",
  "hasSecondaryPhoto",
  "secondPhotoUrl",
  "confidenceScore",
  "lastSeenAt",
]);

const DELTA_SIGNIFICANCE: Record<string, Record<string, DeltaSignificance>> = {
  pharmacy: {
    isOpenNow: "high",
    isOnDuty: "high",
    openingHours: "medium",
    isLicensed: "medium",
    availability: "medium",
    phone: "low",
    website: "low",
    name: "low",
    siteName: "low",
  },
  fuel_station: {
    hasFuelAvailable: "high",
    pricesByFuel: "high",
    fuelPrice: "high",
    fuelTypes: "medium",
    queueLength: "medium",
    quality: "medium",
    paymentMethods: "low",
    openingHours: "low",
    operator: "low",
  },
  mobile_money: {
    providers: "high",
    hasMin50000XafAvailable: "high",
    isActive: "high",
    agentType: "medium",
    merchantIdByProvider: "medium",
    openingHours: "low",
    paymentMethods: "low",
  },
  alcohol_outlet: {
    isFormal: "high",
    outletType: "medium",
    brandsAvailable: "medium",
    priceRange: "medium",
    operatingPeriod: "medium",
    servesFood: "low",
    hasSeating: "low",
    paymentMethods: "low",
  },
  billboard: {
    isOccupied: "high",
    advertiserBrand: "high",
    condition: "high",
    advertiserCategory: "medium",
    billboardType: "medium",
    isLit: "low",
    facing: "low",
    size: "low",
  },
  transport_road: {
    isBlocked: "high",
    condition: "high",
    blockageType: "high",
    blockageSeverity: "high",
    surfaceType: "medium",
    passableBy: "medium",
    trafficLevel: "medium",
    hasStreetLight: "low",
    hasSidewalk: "low",
    estimatedWidth: "low",
  },
  census_proxy: {
    occupancyStatus: "high",
    storeyCount: "medium",
    estimatedUnits: "medium",
    hasCommercialGround: "medium",
    constructionMaterial: "low",
    roofMaterial: "low",
    hasElectricity: "low",
  },
};

// Statistical helpers

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

// Delta computation

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
  significance: DeltaSignificance;
  isPublishable: boolean;
  isFromPartialSnapshot: boolean;
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

function classifyDelta(row: Pick<DeltaRow, "deltaType" | "verticalId" | "deltaField">): DeltaSignificance {
  if (row.deltaType === "new" || row.deltaType === "removed") return "high";
  if (row.deltaType === "unchanged") return "low";
  const verticalMap = DELTA_SIGNIFICANCE[row.verticalId];
  if (!verticalMap || !row.deltaField) return "medium";
  return verticalMap[row.deltaField] ?? "medium";
}

function parseJsonBoolean(value: string | null): boolean | null {
  if (value === null) return null;
  try {
    const parsed = JSON.parse(value);
    return typeof parsed === "boolean" ? parsed : null;
  } catch {
    return null;
  }
}

function getPointConfidence(point: ProjectedPoint | undefined): number {
  if (!point) return 0;
  const score = point.details.confidenceScore;
  return typeof score === "number" && Number.isFinite(score) ? score : 0;
}

function hasPublishingEvidence(point: ProjectedPoint | undefined): boolean {
  if (!point) return false;
  const hasPhoto = Boolean(point.photoUrl);
  const hasTwoEvents = point.eventsCount >= 2;
  const hasThreeEvents = point.eventsCount >= 3;
  return hasPhoto || hasTwoEvents || hasThreeEvents;
}

function isTransportRoadBlockagePriority(row: DeltaRow, point: ProjectedPoint | undefined): boolean {
  if (row.verticalId !== "transport_road") return false;
  if (row.deltaType !== "changed" || row.deltaField !== "isBlocked") return false;
  const blocked = parseJsonBoolean(row.currentValue);
  if (blocked !== true) return false;
  return Boolean(point?.photoUrl);
}

function isDeltaPublishable(row: DeltaRow, point: ProjectedPoint | undefined): boolean {
  if (isTransportRoadBlockagePriority(row, point)) return true;
  if (row.significance === "low") return false;
  if (getPointConfidence(point) < SCORE_THRESHOLD_PUBLISHABLE) return false;
  return hasPublishingEvidence(point);
}

function toDeltaRow(
  base: Omit<DeltaRow, "significance" | "isPublishable" | "isFromPartialSnapshot">,
  point: ProjectedPoint | undefined,
  completionRateByVertical: Map<string, number>,
): DeltaRow {
  const significance = classifyDelta(base);
  const completionRate = completionRateByVertical.get(base.verticalId) ?? 100;
  const isFromPartialSnapshot = completionRate < PARTIAL_SNAPSHOT_THRESHOLD;
  const provisional: DeltaRow = {
    ...base,
    significance,
    isPublishable: false,
    isFromPartialSnapshot,
  };
  provisional.isPublishable = isDeltaPublishable(provisional, point);
  return provisional;
}

export function computeDeltas(
  currentMap: Map<string, ProjectedPoint>,
  previousMap: Map<string, ProjectedPoint>,
  snapshotDate: string,
  baselineDate: string,
  completionRateByVertical: Map<string, number> = new Map(),
): DeltaRow[] {
  const deltas: DeltaRow[] = [];

  for (const [pointId, point] of currentMap) {
    if (!previousMap.has(pointId)) {
      deltas.push(
        toDeltaRow(
          {
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
          },
          point,
          completionRateByVertical,
        ),
      );
    }
  }

  for (const [pointId, point] of previousMap) {
    if (!currentMap.has(pointId)) {
      deltas.push(
        toDeltaRow(
          {
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
          },
          point,
          completionRateByVertical,
        ),
      );
    }
  }

  for (const [pointId, current] of currentMap) {
    const previous = previousMap.get(pointId);
    if (!previous) continue;

    const changes = detectChangedFields(
      current.details as Record<string, unknown>,
      previous.details as Record<string, unknown>,
    );

    if (changes.length === 0) {
      deltas.push(
        toDeltaRow(
          {
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
          },
          current,
          completionRateByVertical,
        ),
      );
    } else {
      for (const change of changes) {
        const pctStr =
          change.magnitude !== null && change.direction !== "not_applicable"
            ? ` (${change.direction === "increase" ? "+" : ""}${change.magnitude})`
            : "";
        deltas.push(
          toDeltaRow(
            {
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
              deltaSummary: `${change.field} changed: ${change.prev} -> ${change.curr}${pctStr}`,
            },
            current,
            completionRateByVertical,
          ),
        );
      }
    }
  }

  return deltas;
}

// Snapshot rows

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
  const referenceDate = new Date(`${snapshotDate}T23:59:59.999Z`);
  return points.map((point) => {
    const confidenceScore = computeConfidenceScore(point, referenceDate);
    const detailsWithScore = {
      ...point.details,
      confidenceScore,
      lastSeenAt: point.updatedAt,
    };
    return {
      snapshotDate,
      verticalId: point.category,
      pointId: point.pointId,
      category: point.category,
      siteName: (detailsWithScore.siteName as string) ?? (detailsWithScore.name as string) ?? null,
      latitude: point.location.latitude,
      longitude: point.location.longitude,
      details: detailsWithScore as Record<string, unknown>,
      gaps: point.gaps,
      eventsCount: point.eventsCount,
      photoUrl: point.photoUrl ?? null,
      source: point.source ?? null,
      externalId: point.externalId ?? null,
    };
  });
}

// DB operations

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
      const base = idx * 14;
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
        row.significance,
        row.isPublishable,
        row.isFromPartialSnapshot,
      );
      return `($${base + 1},$${base + 2},$${base + 3},$${base + 4},$${base + 5},$${base + 6},$${base + 7},$${base + 8},$${base + 9},$${base + 10},$${base + 11},$${base + 12},$${base + 13},$${base + 14})`;
    });
    const result = await query(
      `INSERT INTO snapshot_deltas (
        snapshot_date, baseline_snapshot_date, vertical_id, point_id,
        delta_type, delta_field, previous_value, current_value,
        delta_magnitude, delta_direction, delta_summary,
        significance, is_publishable, is_from_partial_snapshot
      ) VALUES ${placeholders.join(",")}`,
      values,
    );
    inserted += result.rowCount ?? 0;
  }
  return inserted;
}

async function getPreviousSnapshotDate(beforeDate: string): Promise<string | null> {
  const result = await query<{ snapshot_date: string }>(
    `SELECT DISTINCT snapshot_date FROM snapshots WHERE snapshot_date < $1 ORDER BY snapshot_date DESC LIMIT 1`,
    [beforeDate],
  );
  return result.rows[0]?.snapshot_date ?? null;
}

async function loadSnapshotAsMap(snapshotDate: string): Promise<Map<string, ProjectedPoint>> {
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

async function hasBaselineForVertical(verticalId: string): Promise<boolean> {
  const result = await query(
    `SELECT 1 FROM snapshot_stats WHERE vertical_id = $1 AND is_baseline = true LIMIT 1`,
    [verticalId],
  );
  return result.rowCount > 0;
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
  isBaseline: boolean;
}): Promise<void> {
  await query(
    `INSERT INTO snapshot_stats (
      snapshot_date, vertical_id, total_points, completed_points, completion_rate,
      new_count, removed_count, changed_count, unchanged_count,
      avg_price, week_over_week_growth, moving_avg_4w,
      z_score_total_points, z_score_new_count, z_score_removed_count,
      anomaly_flags, is_baseline
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
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
      anomaly_flags = EXCLUDED.anomaly_flags,
      is_baseline = snapshot_stats.is_baseline OR EXCLUDED.is_baseline`,
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
      row.isBaseline,
    ],
  );
}

function extractIsoDatePart(input: string): string | null {
  const parsed = new Date(input);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

function buildCompletionRateByVertical(
  projectedPoints: ProjectedPoint[],
  allEvents: PointEvent[],
  baselineDate: string | null,
  snapshotDate: string,
): Map<string, number> {
  const rateByVertical = new Map<string, number>();
  const pointsByVertical = new Map<string, ProjectedPoint[]>();
  for (const point of projectedPoints) {
    const list = pointsByVertical.get(point.category) ?? [];
    list.push(point);
    pointsByVertical.set(point.category, list);
  }

  if (!baselineDate) {
    for (const [verticalId, points] of pointsByVertical) {
      rateByVertical.set(verticalId, points.length > 0 ? 100 : 0);
    }
    return rateByVertical;
  }

  const touchedByVertical = new Map<string, Set<string>>();
  for (const event of allEvents) {
    const eventDate = extractIsoDatePart(event.createdAt);
    if (!eventDate) continue;
    if (eventDate <= baselineDate || eventDate > snapshotDate) continue;
    const set = touchedByVertical.get(event.category) ?? new Set<string>();
    set.add(event.pointId);
    touchedByVertical.set(event.category, set);
  }

  for (const [verticalId, points] of pointsByVertical) {
    const touchedSet = touchedByVertical.get(verticalId) ?? new Set<string>();
    const touchedCount = points.reduce((count, point) => (touchedSet.has(point.pointId) ? count + 1 : count), 0);
    const rate = points.length > 0 ? Math.round((touchedCount / points.length) * 10000) / 100 : 0;
    rateByVertical.set(verticalId, rate);
  }

  return rateByVertical;
}

function computePhotoCoverage(points: ProjectedPoint[]): number {
  if (points.length === 0) return 0;
  const withPhoto = points.filter((point) => Boolean(point.photoUrl)).length;
  return (withPhoto / points.length) * 100;
}

// Main engine

export interface SnapshotResult {
  snapshotDate: string;
  snapshotsInserted: number;
  deltasInserted: number;
  statsComputed: number;
  baselineDate: string | null;
}

export async function runWeeklySnapshot(dateOverride?: string): Promise<SnapshotResult> {
  const snapshotDate = dateOverride ?? new Date().toISOString().slice(0, 10);
  const baselineDate = await getPreviousSnapshotDate(snapshotDate);

  // Step 1: build current projection.
  const [pointEvents, legacySubs] = await Promise.all([
    getPointEvents(),
    getLegacySubmissions(),
  ]);
  const allEvents = mergePointEventsWithLegacy(pointEvents, legacySubs);
  const projectedPoints = projectPointsFromEvents(allEvents);

  // Step 2: build snapshot rows with freshly computed confidence.
  const snapshotRows = buildSnapshotRows(snapshotDate, projectedPoints);

  // Step 3: insert snapshots.
  const snapshotsInserted = await insertSnapshotRows(snapshotRows);

  // Step 4: compute deltas.
  const currentMap = new Map<string, ProjectedPoint>();
  for (const point of projectedPoints) currentMap.set(point.pointId, point);

  const completionRateByVertical = buildCompletionRateByVertical(projectedPoints, allEvents, baselineDate, snapshotDate);
  const deltasByVertical = new Map<string, { new: number; removed: number; changed: number; unchanged: number }>();
  let deltasInserted = 0;

  if (baselineDate) {
    const previousMap = await loadSnapshotAsMap(baselineDate);
    const deltas = computeDeltas(
      currentMap,
      previousMap,
      snapshotDate,
      baselineDate,
      completionRateByVertical,
    );
    deltasInserted = await insertDeltaRows(deltas);

    for (const delta of deltas) {
      const counts = deltasByVertical.get(delta.verticalId) ?? {
        new: 0,
        removed: 0,
        changed: 0,
        unchanged: 0,
      };
      if (delta.deltaType === "new") counts.new += 1;
      else if (delta.deltaType === "removed") counts.removed += 1;
      else if (delta.deltaType === "changed") counts.changed += 1;
      else if (delta.deltaType === "unchanged") counts.unchanged += 1;
      deltasByVertical.set(delta.verticalId, counts);
    }
  }

  // Step 5: compute stats per vertical.
  const verticalGroups = new Map<string, ProjectedPoint[]>();
  for (const point of projectedPoints) {
    const list = verticalGroups.get(point.category) ?? [];
    list.push(point);
    verticalGroups.set(point.category, list);
  }

  for (const verticalId of deltasByVertical.keys()) {
    if (!verticalGroups.has(verticalId)) verticalGroups.set(verticalId, []);
  }

  let statsComputed = 0;

  for (const [verticalId, points] of verticalGroups) {
    const totalPoints = points.length;
    const completedPoints = points.filter((point) => point.gaps.length === 0).length;
    const completionRate = completionRateByVertical.get(verticalId) ?? (totalPoints > 0 ? 100 : 0);

    const dc = deltasByVertical.get(verticalId) ?? {
      new: 0,
      removed: 0,
      changed: 0,
      unchanged: 0,
    };

    let avgPrice: number | null = null;
    if (verticalId === "fuel_station") {
      const prices = points
        .map((point) => point.details.fuelPrice)
        .filter((value): value is number => typeof value === "number" && value > 0);
      if (prices.length > 0) {
        avgPrice = Math.round((prices.reduce((sum, value) => sum + value, 0) / prices.length) * 100) / 100;
      }
    }

    const history = await getHistoricalStats(verticalId, snapshotDate, 8);
    const histTotalPoints = history.map((h) => h.total_points);
    const histNewCount = history.map((h) => h.new_count);
    const histRemovedCount = history.map((h) => h.removed_count);

    let weekOverWeekGrowth: number | null = null;
    if (history.length > 0 && history[0].total_points > 0) {
      weekOverWeekGrowth =
        Math.round(((totalPoints - history[0].total_points) / history[0].total_points) * 10000) / 100;
    }

    const movingAvg4w = computeMovingAverage([...histTotalPoints.reverse(), totalPoints], 4);
    const zScoreTotalPoints = computeZScore(totalPoints, histTotalPoints);
    const zScoreNewCount = computeZScore(dc.new, histNewCount);
    const zScoreRemovedCount = computeZScore(dc.removed, histRemovedCount);

    const anomalyFlags: AnomalyFlag[] = [];
    const a1 = detectAnomalies(totalPoints, histTotalPoints, "total_points");
    if (a1) anomalyFlags.push(a1);
    const a2 = detectAnomalies(dc.new, histNewCount, "new_count");
    if (a2) anomalyFlags.push(a2);
    const a3 = detectAnomalies(dc.removed, histRemovedCount, "removed_count");
    if (a3) anomalyFlags.push(a3);

    const hasBaseline = await hasBaselineForVertical(verticalId);
    const qualityCompletion = totalPoints > 0 ? completedPoints / totalPoints : 0;
    const photoCoverage = computePhotoCoverage(points);
    const meetsBaselineCriteria =
      totalPoints > 0 &&
      completionRate >= 80 &&
      qualityCompletion >= 0.6 &&
      photoCoverage >= 90;

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
      isBaseline: !hasBaseline && meetsBaselineCriteria,
    });
    statsComputed += 1;
  }

  return {
    snapshotDate,
    snapshotsInserted,
    deltasInserted,
    statsComputed,
    baselineDate,
  };
}

export interface MonthlyRollupResult {
  month: string;
  rowsUpserted: number;
}

export async function runMonthlyRollup(referenceDateOverride?: string): Promise<MonthlyRollupResult> {
  const referenceDate = referenceDateOverride
    ? new Date(`${referenceDateOverride}T00:00:00.000Z`)
    : new Date();
  if (Number.isNaN(referenceDate.getTime())) {
    throw new Error("Invalid date for monthly rollup");
  }

  // Roll up the previous full month.
  const targetMonthStart = new Date(Date.UTC(referenceDate.getUTCFullYear(), referenceDate.getUTCMonth() - 1, 1));
  const targetMonthEnd = new Date(Date.UTC(targetMonthStart.getUTCFullYear(), targetMonthStart.getUTCMonth() + 1, 1));
  const monthStart = targetMonthStart.toISOString().slice(0, 10);
  const monthEnd = targetMonthEnd.toISOString().slice(0, 10);

  const result = await query(
    `INSERT INTO monthly_stats (month, vertical_id, avg_total_points, total_new, total_removed, total_changed, net_growth, churn_rate, avg_completion_rate)
     SELECT
       date_trunc('month', snapshot_date)::date AS month,
       vertical_id,
       ROUND(AVG(total_points), 1),
       SUM(new_count),
       SUM(removed_count),
       SUM(changed_count),
       SUM(new_count) - SUM(removed_count),
       CASE WHEN AVG(total_points) > 0
         THEN ROUND(SUM(removed_count)::numeric / AVG(total_points) * 100, 2)
         ELSE 0
       END,
       ROUND(AVG(completion_rate), 1)
     FROM snapshot_stats
     WHERE snapshot_date >= $1::date
       AND snapshot_date < $2::date
     GROUP BY date_trunc('month', snapshot_date), vertical_id
     ON CONFLICT (month, vertical_id) DO UPDATE SET
       avg_total_points = EXCLUDED.avg_total_points,
       total_new = EXCLUDED.total_new,
       total_removed = EXCLUDED.total_removed,
       total_changed = EXCLUDED.total_changed,
       net_growth = EXCLUDED.net_growth,
       churn_rate = EXCLUDED.churn_rate,
       avg_completion_rate = EXCLUDED.avg_completion_rate`,
    [monthStart, monthEnd],
  );

  return {
    month: monthStart,
    rowsUpserted: result.rowCount ?? 0,
  };
}
