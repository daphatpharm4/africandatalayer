import type { SubmissionCategory } from "../../../shared/types.js";
import { query } from "../db.js";
import type { AnalyticsFact } from "./analyticsAssistant.js";

type QueryFn = typeof query;

export interface AnalyticsFactFilters {
  vertical?: SubmissionCategory;
  zone?: string;
  dateRange?: {
    from: string;
    to: string;
  };
}

export interface AnalyticsQueryPlan {
  sources: string[];
  filters: {
    vertical: SubmissionCategory | null;
    zone: string | null;
    dateRange: AnalyticsFactFilters["dateRange"] | null;
  };
  identityPolicy: "aggregate_only";
}

function toNumber(input: unknown): number {
  if (typeof input === "number" && Number.isFinite(input)) return input;
  if (typeof input === "string") {
    const parsed = Number(input);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

function buildWhere(filters: AnalyticsFactFilters): { clause: string; values: unknown[] } {
  const conditions: string[] = [];
  const values: unknown[] = [];

  if (filters.vertical) {
    values.push(filters.vertical);
    conditions.push(`vertical_id = $${values.length}`);
  }
  if (filters.dateRange?.from) {
    values.push(filters.dateRange.from);
    conditions.push(`snapshot_date >= $${values.length}::date`);
  }
  if (filters.dateRange?.to) {
    values.push(filters.dateRange.to);
    conditions.push(`snapshot_date <= $${values.length}::date`);
  }

  return {
    clause: conditions.length ? `WHERE ${conditions.join(" AND ")}` : "",
    values,
  };
}

export function buildAnalyticsQueryPlan(filters: AnalyticsFactFilters): AnalyticsQueryPlan {
  return {
    sources: ["snapshot_stats", "snapshot_deltas"],
    filters: {
      vertical: filters.vertical ?? null,
      zone: filters.zone?.trim() || null,
      dateRange: filters.dateRange ?? null,
    },
    identityPolicy: "aggregate_only",
  };
}

export async function gatherAggregateAnalyticsFacts(
  filters: AnalyticsFactFilters,
  queryFn: QueryFn = query,
): Promise<AnalyticsFact[]> {
  const statsWhere = buildWhere(filters);
  const deltasWhere = buildWhere(filters);

  const [statsResult, deltasResult] = await Promise.all([
    queryFn<{
      snapshot_count: number;
      total_points: number | string | null;
      completed_points: number | string | null;
      avg_completion_rate: number | string | null;
      new_count: number | string | null;
      removed_count: number | string | null;
      changed_count: number | string | null;
      avg_price: number | string | null;
    }>(
      `SELECT
         COUNT(*)::int AS snapshot_count,
         COALESCE(SUM(total_points), 0) AS total_points,
         COALESCE(SUM(completed_points), 0) AS completed_points,
         COALESCE(ROUND(AVG(completion_rate)::numeric, 2), 0) AS avg_completion_rate,
         COALESCE(SUM(new_count), 0) AS new_count,
         COALESCE(SUM(removed_count), 0) AS removed_count,
         COALESCE(SUM(changed_count), 0) AS changed_count,
         ROUND(AVG(avg_price)::numeric, 2) AS avg_price
       FROM snapshot_stats
       ${statsWhere.clause}`,
      statsWhere.values,
    ),
    queryFn<{
      delta_type: string;
      total: number | string;
      publishable: number | string;
    }>(
      `SELECT
         delta_type,
         COUNT(*)::int AS total,
         COUNT(*) FILTER (WHERE is_publishable = true)::int AS publishable
       FROM snapshot_deltas
       ${deltasWhere.clause}
       GROUP BY delta_type
       ORDER BY delta_type`,
      deltasWhere.values,
    ),
  ]);

  const stats = statsResult.rows[0];
  const facts: AnalyticsFact[] = [];
  if (stats) {
    facts.push(
      { label: "Snapshots", value: toNumber(stats.snapshot_count), source: "snapshot_stats" },
      { label: "Total points", value: toNumber(stats.total_points), source: "snapshot_stats" },
      { label: "Completed points", value: toNumber(stats.completed_points), source: "snapshot_stats" },
      { label: "Average completion rate", value: toNumber(stats.avg_completion_rate), source: "snapshot_stats" },
      { label: "New points", value: toNumber(stats.new_count), source: "snapshot_stats" },
      { label: "Removed points", value: toNumber(stats.removed_count), source: "snapshot_stats" },
      { label: "Changed points", value: toNumber(stats.changed_count), source: "snapshot_stats" },
    );

    const avgPrice = toNumber(stats.avg_price);
    if (avgPrice > 0) {
      facts.push({ label: "Average price", value: avgPrice, source: "snapshot_stats" });
    }
  }

  for (const row of deltasResult.rows) {
    const type = typeof row.delta_type === "string" && row.delta_type.trim() ? row.delta_type.trim() : "unknown";
    facts.push(
      { label: `${type} deltas`, value: toNumber(row.total), source: "snapshot_deltas" },
      { label: `Publishable ${type} deltas`, value: toNumber(row.publishable), source: "snapshot_deltas" },
    );
  }

  if (filters.zone) {
    facts.push({
      label: "Zone filter",
      value: filters.zone,
      source: "request_context",
    });
  }

  return facts;
}
