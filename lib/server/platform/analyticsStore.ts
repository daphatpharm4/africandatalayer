import { query } from "../db.js";
import { encodeGeohash } from "../../shared/pointId.js";
import type { QueryFn, StoreDeps } from "./orgStore.js";

function db(deps: StoreDeps): QueryFn {
  return deps.queryFn ?? (query as unknown as QueryFn);
}

function number(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function rounded(value: unknown, places = 1): number {
  const factor = 10 ** places;
  return Math.round(number(value) * factor) / factor;
}

function dateOnly(value: unknown): string {
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? String(value) : date.toISOString().slice(0, 10);
}

function companyDisplayName(userId: string): string {
  const normalized = userId.trim();
  if (!normalized) return "Contributor";
  if (normalized.includes("@")) {
    const prefix = normalized.split("@")[0]?.slice(0, 2) || "co";
    return `${prefix}***`;
  }
  return normalized.length > 6 ? `${normalized.slice(0, 3)}***` : normalized;
}

export interface OrganizationDeltaSnapshot {
  generatedAt: string;
  weeklyActiveContributors: number;
  verification: {
    totalPoints: number;
    verifiedPoints: number;
    verificationRatePct: number;
  };
  freshness: {
    medianAgeDays: number;
    avgAgeDays: number;
  };
  fraud: {
    eventsWithFraudCheck: number;
    mismatchEvents: number;
    fraudRatePct: number;
  };
  reviewQueue: {
    pendingReview: number;
    highRiskEvents: number;
  };
  enrichmentRatePct: number;
}

export async function getOrganizationDeltaSnapshot(
  organizationId: string,
  deps: StoreDeps = {},
): Promise<OrganizationDeltaSnapshot> {
  const result = await db(deps)(
    `SELECT
       COUNT(*)::int AS total_records,
       COUNT(*) FILTER (WHERE status = 'approved')::int AS approved_records,
       COUNT(DISTINCT captured_by) FILTER (WHERE created_at >= now() - interval '7 days')::int
         AS weekly_active_contributors,
       COALESCE(percentile_cont(0.5) WITHIN GROUP (
         ORDER BY EXTRACT(EPOCH FROM (now() - created_at)) / 86400
       ), 0)::float AS median_age_days,
       COALESCE(AVG(EXTRACT(EPOCH FROM (now() - created_at)) / 86400), 0)::float AS avg_age_days,
       COUNT(*) FILTER (WHERE evidence ? 'gpsIntegrity')::int AS events_with_fraud_check,
       COUNT(*) FILTER (
         WHERE CASE
           WHEN evidence #>> '{gpsIntegrity,riskScore}' ~ '^[0-9]+([.][0-9]+)?$'
             THEN (evidence #>> '{gpsIntegrity,riskScore}')::numeric
           ELSE 0
         END >= 70
            OR evidence #>> '{gpsIntegrity,status}' IN ('mismatch', 'failed', 'suspicious')
       )::int AS mismatch_events,
       COUNT(*) FILTER (WHERE status = 'pending_review')::int AS pending_review,
       COUNT(*) FILTER (WHERE CASE
         WHEN evidence #>> '{gpsIntegrity,riskScore}' ~ '^[0-9]+([.][0-9]+)?$'
           THEN (evidence #>> '{gpsIntegrity,riskScore}')::numeric
         ELSE 0
       END >= 70)::int AS high_risk_events,
       COUNT(*) FILTER (WHERE point_id IS NOT NULL)::int AS enriched_records
     FROM public.platform_records
     WHERE organization_id = $1`,
    [organizationId],
  );
  const row = result.rows[0] ?? {};
  const total = number(row.total_records);
  const approved = number(row.approved_records);
  const fraudChecked = number(row.events_with_fraud_check);
  const mismatches = number(row.mismatch_events);

  return {
    generatedAt: new Date().toISOString(),
    weeklyActiveContributors: number(row.weekly_active_contributors),
    verification: {
      totalPoints: total,
      verifiedPoints: approved,
      verificationRatePct: total > 0 ? rounded((approved / total) * 100) : 0,
    },
    freshness: {
      medianAgeDays: rounded(row.median_age_days),
      avgAgeDays: rounded(row.avg_age_days),
    },
    fraud: {
      eventsWithFraudCheck: fraudChecked,
      mismatchEvents: mismatches,
      fraudRatePct: fraudChecked > 0 ? rounded((mismatches / fraudChecked) * 100) : 0,
    },
    reviewQueue: {
      pendingReview: number(row.pending_review),
      highRiskEvents: number(row.high_risk_events),
    },
    enrichmentRatePct: total > 0 ? rounded((number(row.enriched_records) / total) * 100) : 0,
  };
}

export interface OrganizationWeeklyTrend {
  date: string;
  value: number;
  movingAvg: number | null;
}

export async function listOrganizationWeeklyTrends(
  input: { organizationId: string; recordTypeKey?: string; weeks: number },
  deps: StoreDeps = {},
): Promise<OrganizationWeeklyTrend[]> {
  const weeks = Math.min(52, Math.max(1, Math.floor(input.weeks)));
  const result = await db(deps)(
    `WITH weekly AS (
       SELECT date_trunc('week', created_at)::date AS week_start, COUNT(*)::int AS value
       FROM public.platform_records
       WHERE organization_id = $1
         AND ($2::text IS NULL OR record_type_key = $2)
         AND created_at >= date_trunc('week', now()) - make_interval(weeks => $3 - 1)
       GROUP BY 1
     )
     SELECT week_start, value,
       AVG(value) OVER (ORDER BY week_start ROWS BETWEEN 3 PRECEDING AND CURRENT ROW)::float AS moving_avg
     FROM weekly
     ORDER BY week_start`,
    [input.organizationId, input.recordTypeKey ?? null, weeks],
  );
  return result.rows.map((row) => ({
    date: dateOnly(row.week_start),
    value: number(row.value),
    movingAvg: row.moving_avg === null || row.moving_avg === undefined ? null : rounded(row.moving_avg),
  }));
}

export interface OrganizationCategoryBreakdown {
  category: string;
  count: number;
  percentage: number;
}

export async function listOrganizationCategoryBreakdown(
  organizationId: string,
  deps: StoreDeps = {},
): Promise<OrganizationCategoryBreakdown[]> {
  const result = await db(deps)(
    `SELECT record_type_key AS category, COUNT(*)::int AS count
     FROM public.platform_records
     WHERE organization_id = $1
     GROUP BY record_type_key
     ORDER BY count DESC, record_type_key`,
    [organizationId],
  );
  const total = result.rows.reduce((sum, row) => sum + number(row.count), 0);
  return result.rows.map((row) => ({
    category: String(row.category),
    count: number(row.count),
    percentage: total > 0 ? rounded((number(row.count) / total) * 100) : 0,
  }));
}

export interface OrganizationAgentPerformance {
  userId: string;
  displayName: string;
  submissions: number;
  approvalRate: number;
  flags: number;
  trustScore: number;
}

export async function listOrganizationAgentPerformance(
  organizationId: string,
  deps: StoreDeps = {},
): Promise<OrganizationAgentPerformance[]> {
  const result = await db(deps)(
    `SELECT captured_by,
       COUNT(*)::int AS submissions,
       COUNT(*) FILTER (WHERE status = 'approved')::int AS approved,
       COUNT(*) FILTER (
         WHERE status = 'rejected'
            OR CASE
              WHEN evidence #>> '{gpsIntegrity,riskScore}' ~ '^[0-9]+([.][0-9]+)?$'
                THEN (evidence #>> '{gpsIntegrity,riskScore}')::numeric
              ELSE 0
            END >= 70
       )::int AS flags
     FROM public.platform_records
     WHERE organization_id = $1
     GROUP BY captured_by
     ORDER BY approved DESC, submissions DESC, captured_by
     LIMIT 100`,
    [organizationId],
  );
  return result.rows.map((row) => {
    const submissions = number(row.submissions);
    const approved = number(row.approved);
    const approvalRate = submissions > 0 ? approved / submissions : 0;
    return {
      userId: String(row.captured_by),
      displayName: companyDisplayName(String(row.captured_by)),
      submissions,
      approvalRate: rounded(approvalRate, 3),
      flags: number(row.flags),
      trustScore: rounded(approvalRate * 100),
    };
  });
}

export interface OrganizationLeaderboardEntry {
  rank: number;
  userId: string;
  name: string;
  xp: number;
  contributions: number;
  lastContributionAt: string | null;
  lastLocation: string;
  averageQualityScore: number;
  rankingScore: number;
  verticalBreakdown: Record<string, number>;
}

export async function listOrganizationLeaderboard(
  organizationId: string,
  deps: StoreDeps = {},
): Promise<OrganizationLeaderboardEntry[]> {
  const result = await db(deps)(
    `WITH per_category AS (
       SELECT captured_by, record_type_key,
         COUNT(*)::int AS contributions,
         COUNT(*) FILTER (WHERE status = 'approved')::int AS approved,
         MAX(created_at) AS last_contribution_at
       FROM public.platform_records
       WHERE organization_id = $1
       GROUP BY captured_by, record_type_key
     )
     SELECT captured_by,
       SUM(contributions)::int AS contributions,
       SUM(approved)::int AS approved,
       MAX(last_contribution_at) AS last_contribution_at,
       jsonb_object_agg(record_type_key, contributions) AS vertical_breakdown
     FROM per_category
     GROUP BY captured_by
     ORDER BY approved DESC, contributions DESC, captured_by
     LIMIT 100`,
    [organizationId],
  );

  return result.rows.map((row, index) => {
    const contributions = number(row.contributions);
    const approved = number(row.approved);
    const averageQualityScore = contributions > 0 ? Math.round((approved / contributions) * 100) : 0;
    return {
      rank: index + 1,
      userId: companyDisplayName(String(row.captured_by)),
      name: companyDisplayName(String(row.captured_by)),
      xp: approved * 10,
      contributions,
      lastContributionAt: row.last_contribution_at ? new Date(row.last_contribution_at).toISOString() : null,
      lastLocation: "Company records",
      averageQualityScore,
      rankingScore: contributions * averageQualityScore,
      verticalBreakdown: object(row.vertical_breakdown) as Record<string, number>,
    };
  });
}

interface OrganizationSpatialRow {
  capture_lat: unknown;
  capture_lng: unknown;
  evidence: unknown;
  status: string;
  created_at: unknown;
  captured_by: string;
}

interface OrganizationSpatialCell {
  cellId: string;
  verticalId: string;
  snapshotDate: string;
  center: { latitude: number; longitude: number };
  totalPoints: number;
  completedPoints: number;
  completionRate: number;
  avgConfidenceScore: number;
  photoCoverageRate: number;
  recentActivityRate: number;
  medianFreshnessDays: number;
  publishableChangeCount: number;
  newCount: number;
  removedCount: number;
  changedCount: number;
  operatorDiversity: number;
  marketSignalScore: number;
  opportunityScore: number;
  coverageGapScore: number;
  changeSignalScore: number;
  drivers: Array<{ label: string; impact: "positive" | "negative" | "neutral"; score: number; evidence: string }>;
  caveats: string[];
  summary: string;
}

function object(value: unknown): Record<string, unknown> {
  if (!value) return {};
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }
  return typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2
    : sorted[middle] ?? 0;
}

export async function listOrganizationSpatialCells(
  input: { organizationId: string; recordTypeKey?: string },
  deps: StoreDeps = {},
): Promise<OrganizationSpatialCell[]> {
  const result = await db(deps)(
    `SELECT capture_lat, capture_lng, evidence, status, created_at, captured_by
     FROM public.platform_records
     WHERE organization_id = $1
       AND ($2::text IS NULL OR record_type_key = $2)
     ORDER BY created_at DESC
     LIMIT 10000`,
    [input.organizationId, input.recordTypeKey ?? null],
  );

  const now = Date.now();
  const grouped = new Map<string, {
    latitudes: number[];
    longitudes: number[];
    statuses: string[];
    photoCount: number;
    freshnessDays: number[];
    recentCount: number;
    contributors: Set<string>;
  }>();

  for (const rawRow of result.rows as OrganizationSpatialRow[]) {
    const evidence = object(rawRow.evidence);
    const gps = object(evidence.gps);
    const latitude = Number(rawRow.capture_lat ?? gps.latitude);
    const longitude = Number(rawRow.capture_lng ?? gps.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) continue;
    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) continue;

    const cellId = encodeGeohash(latitude, longitude, 6);
    const cell = grouped.get(cellId) ?? {
      latitudes: [],
      longitudes: [],
      statuses: [],
      photoCount: 0,
      freshnessDays: [],
      recentCount: 0,
      contributors: new Set<string>(),
    };
    grouped.set(cellId, cell);
    cell.latitudes.push(latitude);
    cell.longitudes.push(longitude);
    cell.statuses.push(rawRow.status);
    if (Array.isArray(evidence.photos) && evidence.photos.length > 0) cell.photoCount += 1;
    const createdAt = new Date(String(rawRow.created_at)).getTime();
    const ageDays = Number.isFinite(createdAt) ? Math.max(0, (now - createdAt) / 86_400_000) : 365;
    cell.freshnessDays.push(ageDays);
    if (ageDays <= 30) cell.recentCount += 1;
    if (rawRow.captured_by) cell.contributors.add(rawRow.captured_by);
  }

  const verticalId = input.recordTypeKey ?? "all";
  const snapshotDate = new Date().toISOString().slice(0, 10);
  return [...grouped.entries()].map(([cellId, cell]) => {
    const total = cell.statuses.length;
    const approved = cell.statuses.filter((status) => status === "approved").length;
    const pending = cell.statuses.filter((status) => status === "pending_review").length;
    const rejected = cell.statuses.filter((status) => status === "rejected").length;
    const completionRate = total > 0 ? approved / total : 0;
    const photoCoverageRate = total > 0 ? cell.photoCount / total : 0;
    const recentActivityRate = total > 0 ? cell.recentCount / total : 0;
    const coverageGapScore = total > 0 ? (pending / total) * 100 : 0;
    const changeSignalScore = recentActivityRate * 100;
    const marketSignalScore = completionRate * 100;
    const opportunityScore = Math.min(
      100,
      total * 8 + recentActivityRate * 30 + completionRate * 20 + photoCoverageRate * 10,
    );
    const caveats = pending > 0 ? [`${pending} records are pending review.`] : [];
    if (rejected > 0) caveats.push(`${rejected} records were rejected.`);
    return {
      cellId,
      verticalId,
      snapshotDate,
      center: {
        latitude: rounded(cell.latitudes.reduce((sum, value) => sum + value, 0) / total, 6),
        longitude: rounded(cell.longitudes.reduce((sum, value) => sum + value, 0) / total, 6),
      },
      totalPoints: total,
      completedPoints: approved,
      completionRate: rounded(completionRate, 4),
      avgConfidenceScore: rounded(completionRate * 100),
      photoCoverageRate: rounded(photoCoverageRate, 4),
      recentActivityRate: rounded(recentActivityRate, 4),
      medianFreshnessDays: rounded(median(cell.freshnessDays)),
      publishableChangeCount: approved,
      newCount: total,
      removedCount: rejected,
      changedCount: pending,
      operatorDiversity: cell.contributors.size,
      marketSignalScore: rounded(marketSignalScore),
      opportunityScore: rounded(opportunityScore),
      coverageGapScore: rounded(coverageGapScore),
      changeSignalScore: rounded(changeSignalScore),
      drivers: [{
        label: "Company record density",
        impact: "positive" as const,
        score: rounded(Math.min(100, total * 10)),
        evidence: `${total} company records in this cell`,
      }],
      caveats,
      summary: `${cellId} contains ${total} company records from ${cell.contributors.size} contributors.`,
    };
  }).sort((left, right) => right.opportunityScore - left.opportunityScore);
}
