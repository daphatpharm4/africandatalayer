import { getVertical } from "../../shared/verticals.js";
import type {
  SpatialIntelligenceCell,
  SpatialIntelligenceResponse,
  SpatialInsightDriver,
  SpatialIntelligenceSort,
  SubmissionDetails,
  SubmissionLocation,
} from "../../shared/types.js";
import { query } from "./db.js";
import { encodeGeohash, extractGeohash } from "../shared/pointId.js";

export interface SpatialSnapshotRow {
  pointId: string;
  latitude: number;
  longitude: number;
  details: SubmissionDetails;
  gaps: string[];
  eventsCount: number;
  photoUrl: string | null;
}

export interface SpatialDeltaPointRow {
  pointId: string;
  hasPublishable: boolean;
  hasNew: boolean;
  hasRemoved: boolean;
  hasChanged: boolean;
}

interface CellAccumulator {
  cellId: string;
  verticalId: string;
  snapshotDate: string;
  latitudes: number[];
  longitudes: number[];
  totalPoints: number;
  completedPoints: number;
  confidenceScores: number[];
  photoCount: number;
  recentCount: number;
  freshnessDays: number[];
  operatorTokens: Set<string>;
  publishableChangeCount: number;
  newCount: number;
  removedCount: number;
  changedCount: number;
}

function round(value: number, digits = 2): number {
  if (!Number.isFinite(value)) return 0;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const midpoint = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[midpoint - 1]! + sorted[midpoint]!) / 2;
  }
  return sorted[midpoint]!;
}

function percentileRank(values: number[], value: number): number {
  if (values.length <= 1) return 1;
  const sorted = [...values].sort((a, b) => a - b);
  let lessThan = 0;
  let equalTo = 0;

  for (const item of sorted) {
    if (item < value) lessThan += 1;
    else if (item === value) equalTo += 1;
  }

  return (lessThan + Math.max(0, equalTo - 1) / 2) / (sorted.length - 1);
}

function toFiniteDate(input: string | null | undefined): Date | null {
  if (!input) return null;
  const parsed = new Date(input);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function daysBetween(referenceDate: Date, targetDate: Date | null): number {
  if (!targetDate) return 365;
  const diffMs = referenceDate.getTime() - targetDate.getTime();
  return Math.max(0, diffMs / (24 * 60 * 60 * 1000));
}

function clampRatio(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function resolveCellId(pointId: string, latitude: number, longitude: number): string {
  return extractGeohash(pointId) ?? encodeGeohash(latitude, longitude, 6);
}

function collectOperatorTokens(details: SubmissionDetails): string[] {
  const tokens = new Set<string>();
  const scalarCandidates = [
    details.brand,
    details.operator,
    details.advertiserBrand,
    details.provider,
  ];
  for (const candidate of scalarCandidates) {
    if (typeof candidate !== "string") continue;
    const normalized = candidate.trim().toLowerCase();
    if (normalized) tokens.add(normalized);
  }

  if (Array.isArray(details.providers)) {
    for (const provider of details.providers) {
      if (typeof provider !== "string") continue;
      const normalized = provider.trim().toLowerCase();
      if (normalized) tokens.add(normalized);
    }
  }

  return [...tokens];
}

function createCellAccumulator(
  cellId: string,
  verticalId: string,
  snapshotDate: string,
): CellAccumulator {
  return {
    cellId,
    verticalId,
    snapshotDate,
    latitudes: [],
    longitudes: [],
    totalPoints: 0,
    completedPoints: 0,
    confidenceScores: [],
    photoCount: 0,
    recentCount: 0,
    freshnessDays: [],
    operatorTokens: new Set<string>(),
    publishableChangeCount: 0,
    newCount: 0,
    removedCount: 0,
    changedCount: 0,
  };
}

function addDriver(
  target: SpatialInsightDriver[],
  label: string,
  impact: SpatialInsightDriver["impact"],
  score: number,
  evidence: string,
): void {
  target.push({
    label,
    impact,
    score: round(score, 1),
    evidence,
  });
}

export function buildSpatialIntelligenceCells(args: {
  snapshotDate: string;
  verticalId: string;
  snapshots: SpatialSnapshotRow[];
  deltas: SpatialDeltaPointRow[];
}): SpatialIntelligenceCell[] {
  const { snapshotDate, verticalId, snapshots, deltas } = args;
  const referenceDate = new Date(`${snapshotDate}T23:59:59.999Z`);
  const stalenessThresholdDays = getVertical(verticalId).stalenessThresholdDays;

  const pointToCell = new Map<string, string>();
  const cells = new Map<string, CellAccumulator>();

  for (const snapshot of snapshots) {
    const cellId = resolveCellId(snapshot.pointId, snapshot.latitude, snapshot.longitude);
    pointToCell.set(snapshot.pointId, cellId);
    const cell = cells.get(cellId) ?? createCellAccumulator(cellId, verticalId, snapshotDate);
    cells.set(cellId, cell);

    cell.latitudes.push(snapshot.latitude);
    cell.longitudes.push(snapshot.longitude);
    cell.totalPoints += 1;
    if ((snapshot.gaps ?? []).length === 0) cell.completedPoints += 1;

    const confidenceScore = typeof snapshot.details.confidenceScore === "number"
      ? snapshot.details.confidenceScore
      : 0;
    cell.confidenceScores.push(confidenceScore);

    if (snapshot.photoUrl) cell.photoCount += 1;

    const lastSeenAt = typeof snapshot.details.lastSeenAt === "string"
      ? snapshot.details.lastSeenAt
      : snapshotDate;
    const freshnessDays = daysBetween(referenceDate, toFiniteDate(lastSeenAt));
    cell.freshnessDays.push(freshnessDays);
    if (freshnessDays <= stalenessThresholdDays) cell.recentCount += 1;

    for (const token of collectOperatorTokens(snapshot.details)) {
      cell.operatorTokens.add(token);
    }
  }

  for (const delta of deltas) {
    const cellId = pointToCell.get(delta.pointId) ?? extractGeohash(delta.pointId);
    if (!cellId) continue;
    const cell = cells.get(cellId);
    if (!cell) continue;

    if (delta.hasPublishable && (delta.hasNew || delta.hasRemoved || delta.hasChanged)) {
      cell.publishableChangeCount += 1;
    }
    if (delta.hasNew) cell.newCount += 1;
    if (delta.hasRemoved) cell.removedCount += 1;
    if (delta.hasChanged) cell.changedCount += 1;
  }

  const accumulators = [...cells.values()].filter((cell) => cell.totalPoints > 0);
  const densityValues = accumulators.map((cell) => cell.totalPoints);
  const changeRatioValues = accumulators.map((cell) =>
    cell.totalPoints > 0 ? cell.publishableChangeCount / cell.totalPoints : 0,
  );
  const diversityValues = accumulators.map((cell) => cell.operatorTokens.size);

  return accumulators.map((cell) => {
    const completionRate = clampRatio(cell.completedPoints / cell.totalPoints);
    const avgConfidenceScore = round(average(cell.confidenceScores));
    const confidenceRatio = clampRatio(avgConfidenceScore / 100);
    const photoCoverageRate = clampRatio(cell.photoCount / cell.totalPoints);
    const recentActivityRate = clampRatio(cell.recentCount / cell.totalPoints);
    const medianFreshnessDays = round(median(cell.freshnessDays), 1);
    const operatorDiversity = cell.operatorTokens.size;
    const changeRatio = clampRatio(cell.publishableChangeCount / cell.totalPoints);

    const densityPercentile = percentileRank(densityValues, cell.totalPoints);
    const changePercentile = percentileRank(changeRatioValues, changeRatio);
    const diversityPercentile = percentileRank(diversityValues, operatorDiversity);

    const marketSignalScore = round(
      100 * (
        0.4 * densityPercentile +
        0.25 * changePercentile +
        0.2 * diversityPercentile +
        0.15 * recentActivityRate
      ),
    );
    const opportunityScore = round(
      100 * (
        0.35 * densityPercentile +
        0.25 * changePercentile +
        0.2 * confidenceRatio +
        0.1 * completionRate +
        0.1 * photoCoverageRate
      ),
    );
    const coverageGapScore = round(
      100 * (
        0.5 * (1 - completionRate) +
        0.3 * (1 - photoCoverageRate) +
        0.2 * (1 - confidenceRatio)
      ),
    );
    const changeSignalScore = round(
      100 * (
        0.65 * changePercentile +
        0.35 * recentActivityRate
      ),
    );

    const drivers: SpatialInsightDriver[] = [];
    const caveats: string[] = [];

    if (densityPercentile >= 0.7) {
      addDriver(
        drivers,
        "Above-average density",
        "positive",
        densityPercentile * 100,
        `${cell.totalPoints} mapped points in this cell`,
      );
    }
    if (changeRatio > 0 && changePercentile >= 0.6) {
      addDriver(
        drivers,
        "Elevated change activity",
        "positive",
        changePercentile * 100,
        `${cell.publishableChangeCount} publishable changing points since baseline`,
      );
    }
    if (avgConfidenceScore >= 70) {
      addDriver(
        drivers,
        "Strong evidence quality",
        "positive",
        avgConfidenceScore,
        `${avgConfidenceScore}/100 average confidence score`,
      );
    }
    if (completionRate >= 0.8) {
      addDriver(
        drivers,
        "High field completeness",
        "positive",
        completionRate * 100,
        `${round(completionRate * 100, 1)}% of mapped points have no remaining gaps`,
      );
    }
    if (operatorDiversity >= 2 && diversityPercentile >= 0.6) {
      addDriver(
        drivers,
        "Diverse operator mix",
        "positive",
        diversityPercentile * 100,
        `${operatorDiversity} distinct brands or operators observed`,
      );
    }

    if (avgConfidenceScore < 50) {
      caveats.push(`Average confidence is low at ${avgConfidenceScore}/100.`);
      addDriver(
        drivers,
        "Weak evidence quality",
        "negative",
        100 - avgConfidenceScore,
        `${avgConfidenceScore}/100 average confidence score`,
      );
    }
    if (completionRate < 0.6) {
      caveats.push(`Only ${round(completionRate * 100, 1)}% of points are complete.`);
      addDriver(
        drivers,
        "Low completeness",
        "negative",
        (1 - completionRate) * 100,
        `${cell.totalPoints - cell.completedPoints} of ${cell.totalPoints} points still have material gaps`,
      );
    }
    if (photoCoverageRate < 0.5) {
      caveats.push(`Photo coverage is limited at ${round(photoCoverageRate * 100, 1)}%.`);
      addDriver(
        drivers,
        "Limited photo evidence",
        "negative",
        (1 - photoCoverageRate) * 100,
        `${cell.photoCount} of ${cell.totalPoints} points have photos`,
      );
    }
    if (recentActivityRate < 0.4 || medianFreshnessDays > stalenessThresholdDays) {
      caveats.push(`Freshness is weak with a median age of ${medianFreshnessDays} days.`);
      addDriver(
        drivers,
        "Weak recent activity",
        "negative",
        Math.max(0, 100 - recentActivityRate * 100),
        `${round(recentActivityRate * 100, 1)}% of points are within the active freshness window`,
      );
    }

    drivers.sort((a, b) => b.score - a.score);
    const topPositive = drivers
      .filter((driver) => driver.impact === "positive")
      .slice(0, 2)
      .map((driver) => driver.label.toLowerCase());
    const strengthsText = topPositive.length > 0
      ? ` Strongest signals: ${topPositive.join(" and ")}.`
      : "";
    const caveatText = caveats[0] ? ` Watch-out: ${caveats[0]}` : "";

    return {
      cellId: cell.cellId,
      verticalId: cell.verticalId,
      snapshotDate: cell.snapshotDate,
      center: {
        latitude: round(average(cell.latitudes), 6),
        longitude: round(average(cell.longitudes), 6),
      } satisfies SubmissionLocation,
      totalPoints: cell.totalPoints,
      completedPoints: cell.completedPoints,
      completionRate: round(completionRate, 4),
      avgConfidenceScore,
      photoCoverageRate: round(photoCoverageRate, 4),
      recentActivityRate: round(recentActivityRate, 4),
      medianFreshnessDays,
      publishableChangeCount: cell.publishableChangeCount,
      newCount: cell.newCount,
      removedCount: cell.removedCount,
      changedCount: cell.changedCount,
      operatorDiversity,
      marketSignalScore,
      opportunityScore,
      coverageGapScore,
      changeSignalScore,
      drivers,
      caveats,
      summary:
        `${cell.cellId} stands out for ${verticalId} with ${cell.totalPoints} mapped points, ` +
        `${cell.publishableChangeCount} publishable changing points, and ${avgConfidenceScore}/100 average confidence.` +
        strengthsText +
        caveatText,
    } satisfies SpatialIntelligenceCell;
  });
}

export function buildSpatialIntelligenceNarrative(args: {
  verticalId: string;
  snapshotDate: string;
  cells: SpatialIntelligenceCell[];
}): string {
  const { verticalId, snapshotDate, cells } = args;
  if (cells.length === 0) {
    return `No spatial intelligence cells were generated for ${verticalId} on ${snapshotDate}.`;
  }

  const totalPoints = cells.reduce((sum, cell) => sum + cell.totalPoints, 0);
  const topOpportunity = [...cells].sort((a, b) => b.opportunityScore - a.opportunityScore)[0]!;
  const topCoverageGap = [...cells].sort((a, b) => b.coverageGapScore - a.coverageGapScore)[0]!;

  return (
    `${getVertical(verticalId).pluralEn} on ${snapshotDate} span ${cells.length} active cells and ${totalPoints} mapped points. ` +
    `The highest-opportunity cell is ${topOpportunity.cellId} with ${topOpportunity.totalPoints} points and an opportunity score of ${topOpportunity.opportunityScore}/100. ` +
    `The biggest evidence gap is ${topCoverageGap.cellId} with a coverage-gap score of ${topCoverageGap.coverageGapScore}/100.`
  );
}

async function resolveLatestSnapshotDate(verticalId: string): Promise<string | null> {
  const result = await query<{ snapshot_date: string | null }>(
    `SELECT MAX(snapshot_date)::text AS snapshot_date
     FROM snapshots
     WHERE vertical_id = $1`,
    [verticalId],
  );
  return result.rows[0]?.snapshot_date ?? null;
}

async function loadSpatialSnapshots(snapshotDate: string, verticalId: string): Promise<SpatialSnapshotRow[]> {
  const result = await query<{
    point_id: string;
    latitude: number;
    longitude: number;
    details: SubmissionDetails;
    gaps: string[] | null;
    events_count: number;
    photo_url: string | null;
  }>(
    `SELECT point_id, latitude, longitude, details, gaps, events_count, photo_url
     FROM snapshots
     WHERE snapshot_date = $1
       AND vertical_id = $2`,
    [snapshotDate, verticalId],
  );

  return result.rows.map((row) => ({
    pointId: row.point_id,
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    details: row.details ?? {},
    gaps: row.gaps ?? [],
    eventsCount: Number(row.events_count ?? 0),
    photoUrl: row.photo_url,
  }));
}

async function loadSpatialDeltas(snapshotDate: string, verticalId: string): Promise<SpatialDeltaPointRow[]> {
  const result = await query<{
    point_id: string;
    has_publishable: boolean;
    has_new: boolean;
    has_removed: boolean;
    has_changed: boolean;
  }>(
    `SELECT
       point_id,
       BOOL_OR(is_publishable) AS has_publishable,
       BOOL_OR(delta_type = 'new') AS has_new,
       BOOL_OR(delta_type = 'removed') AS has_removed,
       BOOL_OR(delta_type = 'changed') AS has_changed
     FROM snapshot_deltas
     WHERE snapshot_date = $1
       AND vertical_id = $2
     GROUP BY point_id`,
    [snapshotDate, verticalId],
  );

  return result.rows.map((row) => ({
    pointId: row.point_id,
    hasPublishable: Boolean(row.has_publishable),
    hasNew: Boolean(row.has_new),
    hasRemoved: Boolean(row.has_removed),
    hasChanged: Boolean(row.has_changed),
  }));
}

export async function getSpatialIntelligence(args: {
  verticalId: string;
  snapshotDate?: string;
  limit?: number;
  sort?: SpatialIntelligenceSort;
}): Promise<SpatialIntelligenceResponse> {
  const { verticalId, limit = 12, sort = "opportunity_score" } = args;
  const snapshotDate = args.snapshotDate ?? await resolveLatestSnapshotDate(verticalId);
  if (!snapshotDate) {
    throw new Error(`No snapshots found for vertical '${verticalId}'`);
  }

  const [snapshots, deltas] = await Promise.all([
    loadSpatialSnapshots(snapshotDate, verticalId),
    loadSpatialDeltas(snapshotDate, verticalId),
  ]);

  const cells = buildSpatialIntelligenceCells({
    snapshotDate,
    verticalId,
    snapshots,
    deltas,
  });

  const sorted = [...cells].sort((a, b) => {
    if (sort === "coverage_gap_score") return b.coverageGapScore - a.coverageGapScore;
    if (sort === "change_signal_score") return b.changeSignalScore - a.changeSignalScore;
    return b.opportunityScore - a.opportunityScore;
  });

  return {
    snapshotDate,
    verticalId,
    totalCells: cells.length,
    totalPoints: snapshots.length,
    cells: sorted.slice(0, Math.max(1, limit)),
    narrative: buildSpatialIntelligenceNarrative({ verticalId, snapshotDate, cells }),
  };
}
