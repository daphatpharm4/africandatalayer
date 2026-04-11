import { requireUser } from "../../lib/auth.js";
import { query } from "../../lib/server/db.js";
import { jsonResponse, errorResponse } from "../../lib/server/http.js";
import { computeMovingAverage } from "../../lib/server/snapshotEngine.js";
import { getSpatialIntelligence } from "../../lib/server/spatialIntelligence.js";
import type { SpatialIntelligenceSort } from "../../shared/types.js";

export const maxDuration = 60;

const VALID_METRICS = new Set([
  "total_points",
  "completion_rate",
  "new_count",
  "removed_count",
  "avg_price",
  "week_over_week_growth",
]);

const VALID_SPATIAL_SORTS = new Set<SpatialIntelligenceSort>([
  "opportunity_score",
  "coverage_gap_score",
  "change_signal_score",
]);

export interface CronDispatchSchedule {
  weeklySnapshot: boolean;
  monthlyRollup: boolean;
  dailyRoadSnapshot: boolean;
  dailyTrustDecay: boolean;
  dailyGpsAnomaly: boolean;
}

type CronJobSummaryStatus = "skipped" | "ok" | "error";

interface CronJobSummary {
  due: boolean;
  status: CronJobSummaryStatus;
  message?: string;
  result?: unknown;
}

interface CronDispatchSummary {
  evaluatedAtUtc: string;
  schedule: CronDispatchSchedule;
  executedAnyJob: boolean;
  hasFailures: boolean;
  jobs: {
    weeklySnapshot: CronJobSummary;
    monthlyRollup: CronJobSummary;
    dailyRoadSnapshot: CronJobSummary;
    dailyTrustDecay: CronJobSummary;
    dailyGpsAnomaly: CronJobSummary;
  };
}

function isCronRequestAuthorized(request: Request): boolean {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  return Boolean(cronSecret && authHeader === `Bearer ${cronSecret}`);
}

function requireCronAuthorization(request: Request): Response | null {
  if (isCronRequestAuthorized(request)) return null;
  return errorResponse("Unauthorized", 401);
}

function asErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function getCronDispatchSchedule(now: Date): CronDispatchSchedule {
  const hour = now.getUTCHours();
  const dayOfWeek = now.getUTCDay();
  const dayOfMonth = now.getUTCDate();
  // Vercel cron has up to ~5 min jitter; accept the entire 6:XX hour
  const isDailyCronWindow = hour === 6;

  return {
    weeklySnapshot: isDailyCronWindow && dayOfWeek === 1,
    monthlyRollup: isDailyCronWindow && dayOfMonth === 1,
    dailyRoadSnapshot: isDailyCronWindow,
    dailyTrustDecay: isDailyCronWindow,
    dailyGpsAnomaly: isDailyCronWindow,
  };
}

function resolveCronDispatchInstant(input: string | null): Date | null {
  if (!input) return new Date();
  const parsed = new Date(input);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

async function runWeeklySnapshotCron(dateOverride?: string): Promise<unknown> {
  const { runWeeklySnapshot } = await import("../../lib/server/snapshotEngine.js");
  return runWeeklySnapshot(dateOverride);
}

async function runMonthlyRollupCron(dateOverride?: string): Promise<unknown> {
  const { runMonthlyRollup } = await import("../../lib/server/snapshotEngine.js");
  return runMonthlyRollup(dateOverride);
}

async function runDailyRoadSnapshotCron(dateOverride?: string): Promise<unknown> {
  const { runDailyRoadSnapshot } = await import("../../lib/server/snapshotEngine.js");
  return runDailyRoadSnapshot(dateOverride);
}

async function runDailyTrustDecayCron(): Promise<unknown> {
  const { decayInactiveTrust } = await import("../../lib/server/userTrust.js");
  return decayInactiveTrust();
}

async function runDailyGpsAnomalyCron(): Promise<unknown> {
  const { analyzeAgentMovementPatterns } = await import("../../lib/server/gpsAnomalyDetection.js");
  return analyzeAgentMovementPatterns();
}

async function handleCronDispatch(url: URL): Promise<Response> {
  const now = resolveCronDispatchInstant(url.searchParams.get("at"));
  if (!now) {
    return errorResponse("Invalid at timestamp. Use ISO-8601 UTC format.", 400);
  }

  const dateOverride = url.searchParams.get("date") ?? undefined;
  const schedule = getCronDispatchSchedule(now);
  const jobs: CronDispatchSummary["jobs"] = {
    weeklySnapshot: { due: schedule.weeklySnapshot, status: "skipped", message: "Not scheduled for this run" },
    monthlyRollup: { due: schedule.monthlyRollup, status: "skipped", message: "Not scheduled for this run" },
    dailyRoadSnapshot: { due: schedule.dailyRoadSnapshot, status: "skipped", message: "Not scheduled for this run" },
    dailyTrustDecay: { due: schedule.dailyTrustDecay, status: "skipped", message: "Not scheduled for this run" },
    dailyGpsAnomaly: { due: schedule.dailyGpsAnomaly, status: "skipped", message: "Not scheduled for this run" },
  };

  let hasFailures = false;

  if (schedule.weeklySnapshot) {
    try {
      jobs.weeklySnapshot = {
        due: true,
        status: "ok",
        message: "Weekly snapshot executed",
        result: await runWeeklySnapshotCron(dateOverride),
      };
    } catch (error) {
      hasFailures = true;
      jobs.weeklySnapshot = {
        due: true,
        status: "error",
        message: asErrorMessage(error),
      };
      console.error("Cron dispatch weekly snapshot failed:", error);
    }
  }

  if (schedule.monthlyRollup) {
    try {
      jobs.monthlyRollup = {
        due: true,
        status: "ok",
        message: "Monthly rollup executed",
        result: await runMonthlyRollupCron(dateOverride),
      };
    } catch (error) {
      hasFailures = true;
      jobs.monthlyRollup = {
        due: true,
        status: "error",
        message: asErrorMessage(error),
      };
      console.error("Cron dispatch monthly rollup failed:", error);
    }
  }

  if (schedule.dailyRoadSnapshot) {
    try {
      jobs.dailyRoadSnapshot = {
        due: true,
        status: "ok",
        message: "Daily road snapshot executed",
        result: await runDailyRoadSnapshotCron(dateOverride),
      };
    } catch (error) {
      hasFailures = true;
      jobs.dailyRoadSnapshot = {
        due: true,
        status: "error",
        message: asErrorMessage(error),
      };
      console.error("Cron dispatch daily road snapshot failed:", error);
    }
  }

  if (schedule.dailyTrustDecay) {
    try {
      jobs.dailyTrustDecay = {
        due: true,
        status: "ok",
        message: "Daily trust decay executed",
        result: await runDailyTrustDecayCron(),
      };
    } catch (error) {
      hasFailures = true;
      jobs.dailyTrustDecay = {
        due: true,
        status: "error",
        message: asErrorMessage(error),
      };
      console.error("Cron dispatch daily trust decay failed:", error);
    }
  }

  if (schedule.dailyGpsAnomaly) {
    try {
      jobs.dailyGpsAnomaly = {
        due: true,
        status: "ok",
        message: "Daily GPS anomaly detection executed",
        result: await runDailyGpsAnomalyCron(),
      };
    } catch (error) {
      hasFailures = true;
      jobs.dailyGpsAnomaly = {
        due: true,
        status: "error",
        message: asErrorMessage(error),
      };
      console.error("Cron dispatch daily GPS anomaly detection failed:", error);
    }
  }

  const summary: CronDispatchSummary = {
    evaluatedAtUtc: now.toISOString(),
    schedule,
    executedAnyJob: schedule.weeklySnapshot || schedule.monthlyRollup || schedule.dailyRoadSnapshot || schedule.dailyTrustDecay || schedule.dailyGpsAnomaly,
    hasFailures,
    jobs,
  };

  return jsonResponse(summary, { status: hasFailures ? 500 : 200 });
}

export async function handleAnalyticsCronDispatchRequest(request: Request): Promise<Response> {
  const unauthorizedResponse = requireCronAuthorization(request);
  if (unauthorizedResponse) return unauthorizedResponse;
  return handleCronDispatch(new URL(request.url));
}

function isMissingDbObjectError(error: unknown): boolean {
  const pg = error as { code?: unknown; message?: unknown } | null;
  const code = typeof pg?.code === "string" ? pg.code : "";
  if (code === "42P01" || code === "42703") return true;
  const message = typeof pg?.message === "string" ? pg.message.toLowerCase() : "";
  return message.includes("does not exist") || message.includes("undefined table") || message.includes("undefined column");
}

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const view = url.searchParams.get("view") ?? "snapshots";

  // Daily cron dispatcher (Hobby-compatible) - authenticated via CRON_SECRET.
  if (view === "cron_dispatch") {
    return handleAnalyticsCronDispatchRequest(request);
  }

  // Weekly snapshot cron trigger - authenticated via CRON_SECRET.
  if (view === "cron") {
    const unauthorizedResponse = requireCronAuthorization(request);
    if (unauthorizedResponse) return unauthorizedResponse;
    try {
      const dateOverride = url.searchParams.get("date") ?? undefined;
      const result = await runWeeklySnapshotCron(dateOverride);
      return jsonResponse(result);
    } catch (error) {
      console.error("Snapshot cron failed:", error);
      return errorResponse(
        error instanceof Error ? error.message : "Snapshot failed",
        500,
      );
    }
  }

  // Monthly rollup cron trigger - authenticated via CRON_SECRET.
  if (view === "cron_monthly") {
    const unauthorizedResponse = requireCronAuthorization(request);
    if (unauthorizedResponse) return unauthorizedResponse;
    try {
      const dateOverride = url.searchParams.get("date") ?? undefined;
      const result = await runMonthlyRollupCron(dateOverride);
      return jsonResponse(result);
    } catch (error) {
      console.error("Monthly rollup cron failed:", error);
      return errorResponse(
        error instanceof Error ? error.message : "Monthly rollup failed",
        500,
      );
    }
  }

  // Daily transport-road summary cron trigger - authenticated via CRON_SECRET.
  if (view === "cron_daily_road") {
    const unauthorizedResponse = requireCronAuthorization(request);
    if (unauthorizedResponse) return unauthorizedResponse;
    try {
      const dateOverride = url.searchParams.get("date") ?? undefined;
      const result = await runDailyRoadSnapshotCron(dateOverride);
      return jsonResponse(result);
    } catch (error) {
      console.error("Daily road snapshot cron failed:", error);
      return errorResponse(
        error instanceof Error ? error.message : "Daily road snapshot failed",
        500,
      );
    }
  }

  // All other views require authenticated user
  const user = await requireUser(request);
  if (!user) return errorResponse("Unauthorized", 401);

  switch (view) {
    case "snapshots":
      return handleSnapshots(url);
    case "deltas":
      return handleDeltas(url);
    case "monthly":
      return handleMonthly(url);
    case "trends":
      return handleTrends(url);
    case "anomalies":
      return handleAnomalies();
    case "spatial_intelligence":
      return handleSpatialIntelligence(url);
    case "kpi_summary":
      return handleKpiSummary();
    case "kpi_weekly":
      return handleKpiWeekly(url);
    default:
      return errorResponse(
        `Invalid view: ${view}. Valid: snapshots, deltas, monthly, trends, anomalies, spatial_intelligence, kpi_summary, kpi_weekly, cron_dispatch, cron, cron_monthly, cron_daily_road, cron_daily_trust_decay, cron_daily_gps_anomaly`,
        400,
      );
  }
}

async function handleSnapshots(url: URL): Promise<Response> {
  const vertical = url.searchParams.get("vertical");
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "12", 10), 52);

  const conditions: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  if (vertical) {
    conditions.push(`vertical_id = $${idx++}`);
    values.push(vertical);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  values.push(limit);

  const result = await query(
    `SELECT * FROM snapshot_stats ${where} ORDER BY snapshot_date DESC, vertical_id LIMIT $${idx}`,
    values,
  );

  return jsonResponse(result.rows);
}

async function handleDeltas(url: URL): Promise<Response> {
  const date = url.searchParams.get("date");
  const vertical = url.searchParams.get("vertical");
  const type = url.searchParams.get("type");
  const significance = url.searchParams.get("significance");
  const publishable = url.searchParams.get("publishable");
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "100", 10), 500);

  const conditions: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  if (date) {
    conditions.push(`snapshot_date = $${idx++}`);
    values.push(date);
  }
  if (vertical) {
    conditions.push(`vertical_id = $${idx++}`);
    values.push(vertical);
  }
  if (type) {
    conditions.push(`delta_type = $${idx++}`);
    values.push(type);
  }
  if (significance) {
    conditions.push(`significance = $${idx++}`);
    values.push(significance);
  }
  if (publishable === "true") {
    conditions.push(`is_publishable = true`);
  } else if (publishable === "false") {
    conditions.push(`is_publishable = false`);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const [dataResult, countResult] = await Promise.all([
    query(
      `SELECT * FROM snapshot_deltas ${where} ORDER BY snapshot_date DESC, delta_type, point_id LIMIT $${idx}`,
      [...values, limit],
    ),
    query(
      `SELECT COUNT(*)::int AS total FROM snapshot_deltas ${where}`,
      values,
    ),
  ]);

  return jsonResponse({
    deltas: dataResult.rows,
    total: (countResult.rows[0] as { total: number }).total,
  });
}

async function handleMonthly(url: URL): Promise<Response> {
  const vertical = url.searchParams.get("vertical");
  const month = url.searchParams.get("month");
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "24", 10), 120);

  const conditions: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  if (vertical) {
    conditions.push(`vertical_id = $${idx++}`);
    values.push(vertical);
  }
  if (month) {
    conditions.push(`month = $${idx++}`);
    values.push(month);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  values.push(limit);

  const result = await query(
    `SELECT * FROM monthly_stats ${where} ORDER BY month DESC, vertical_id LIMIT $${idx}`,
    values,
  );
  return jsonResponse(result.rows);
}

async function handleTrends(url: URL): Promise<Response> {
  const vertical = url.searchParams.get("vertical");
  const metric = url.searchParams.get("metric") ?? "total_points";
  const weeks = Math.min(parseInt(url.searchParams.get("weeks") ?? "12", 10), 52);

  if (!VALID_METRICS.has(metric)) {
    return errorResponse(`Invalid metric. Valid: ${[...VALID_METRICS].join(", ")}`, 400);
  }

  if (!vertical) {
    return errorResponse("vertical parameter is required", 400);
  }

  const result = await query<{ snapshot_date: string; [key: string]: unknown }>(
    `SELECT snapshot_date, ${metric} FROM snapshot_stats
     WHERE vertical_id = $1
     ORDER BY snapshot_date DESC
     LIMIT $2`,
    [vertical, weeks],
  );

  const rows = result.rows.reverse();
  const values = rows.map((r) => Number(r[metric]) || 0);

  const data = rows.map((row, i) => ({
    date: row.snapshot_date,
    value: Number(row[metric]) || 0,
    movingAvg: computeMovingAverage(values.slice(0, i + 1), 4),
  }));

  return jsonResponse({ data });
}

async function handleAnomalies(): Promise<Response> {
  const result = await query(
    `SELECT snapshot_date, vertical_id, total_points, anomaly_flags
     FROM snapshot_stats
     WHERE jsonb_array_length(anomaly_flags) > 0
     ORDER BY snapshot_date DESC
     LIMIT 50`,
  );

  return jsonResponse(result.rows);
}

async function handleSpatialIntelligence(url: URL): Promise<Response> {
  const vertical = url.searchParams.get("vertical");
  if (!vertical) {
    return errorResponse("vertical parameter is required", 400);
  }

  const sort = (url.searchParams.get("sort") ?? "opportunity_score") as SpatialIntelligenceSort;
  if (!VALID_SPATIAL_SORTS.has(sort)) {
    return errorResponse(
      `Invalid sort. Valid: ${[...VALID_SPATIAL_SORTS].join(", ")}`,
      400,
    );
  }

  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "12", 10), 50);
  const snapshotDate = url.searchParams.get("date") ?? undefined;

  try {
    const result = await getSpatialIntelligence({
      verticalId: vertical,
      snapshotDate,
      limit,
      sort,
    });
    return jsonResponse(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Spatial intelligence failed";
    if (message.startsWith("No snapshots found")) {
      return errorResponse(message, 404);
    }
    console.error("Spatial intelligence failed:", error);
    return errorResponse(message, 500);
  }
}

async function handleKpiSummary(): Promise<Response> {
  const [
    wacResult,
    verificationResult,
    freshnessResult,
    fraudResult,
    reviewResult,
    enrichmentResult,
  ] = await Promise.all([
    query<{ wac: number }>(
      `SELECT COUNT(DISTINCT user_id)::int AS wac
       FROM point_events
       WHERE created_at >= NOW() - INTERVAL '7 days'`,
    ),
    query<{ total_points: number; verified_points: number; verification_rate_pct: number }>(
      `WITH point_users AS (
         SELECT point_id, COUNT(DISTINCT user_id) AS distinct_users
         FROM point_events
         GROUP BY point_id
       )
       SELECT
         COUNT(*)::int AS total_points,
         COUNT(*) FILTER (WHERE distinct_users >= 2)::int AS verified_points,
         ROUND(
           100.0 * COUNT(*) FILTER (WHERE distinct_users >= 2) / GREATEST(COUNT(*), 1),
           1
         ) AS verification_rate_pct
       FROM point_users`,
    ),
    query<{ median_age_days: number; avg_age_days: number }>(
      `WITH latest_per_point AS (
         SELECT point_id, MAX(created_at) AS last_event_at
         FROM point_events
         GROUP BY point_id
       ),
       ages AS (
         SELECT EXTRACT(EPOCH FROM (NOW() - last_event_at)) / 86400.0 AS age_days
         FROM latest_per_point
       )
       SELECT
         ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY age_days)::numeric, 1) AS median_age_days,
         ROUND(AVG(age_days)::numeric, 1) AS avg_age_days
       FROM ages`,
    ),
    query<{ events_with_fraud_check: number; mismatch_events: number; fraud_rate_pct: number }>(
      `SELECT
         COUNT(*) FILTER (
           WHERE details #>> '{fraudCheck,primaryPhoto,submissionGpsMatch}' IS NOT NULL
         )::int AS events_with_fraud_check,
         COUNT(*) FILTER (
           WHERE details #>> '{fraudCheck,primaryPhoto,submissionGpsMatch}' = 'false'
         )::int AS mismatch_events,
         ROUND(
           100.0 * COUNT(*) FILTER (
             WHERE details #>> '{fraudCheck,primaryPhoto,submissionGpsMatch}' = 'false'
           ) / GREATEST(
             COUNT(*) FILTER (
               WHERE details #>> '{fraudCheck,primaryPhoto,submissionGpsMatch}' IS NOT NULL
             ),
             1
           ),
           1
         ) AS fraud_rate_pct
       FROM point_events
       WHERE created_at >= NOW() - INTERVAL '30 days'`,
    ),
    query<{ pending_review: number; high_risk_events: number }>(
      `SELECT
         COUNT(*) FILTER (WHERE COALESCE(details->>'reviewStatus', 'auto_approved') = 'pending_review')::int AS pending_review,
         COUNT(*) FILTER (
           WHERE (details->>'riskScore') ~ '^-?\\d+(\\.\\d+)?$'
             AND (details->>'riskScore')::numeric >= 60
         )::int AS high_risk_events
       FROM point_events`,
    ),
    query<{ enrichment_rate_pct: number }>(
      `WITH point_summary AS (
         SELECT
           point_id,
           BOOL_OR(event_type = 'CREATE_EVENT') AS has_create,
           BOOL_OR(event_type = 'ENRICH_EVENT') AS has_enrich
         FROM point_events
         GROUP BY point_id
       )
       SELECT ROUND(
         100.0 * COUNT(*) FILTER (WHERE has_enrich) / GREATEST(COUNT(*), 1),
         1
       ) AS enrichment_rate_pct
       FROM point_summary
       WHERE has_create`,
    ),
  ]);

  const payload = {
    generatedAt: new Date().toISOString(),
    weeklyActiveContributors: Number(wacResult.rows[0]?.wac ?? 0),
    verification: {
      totalPoints: Number(verificationResult.rows[0]?.total_points ?? 0),
      verifiedPoints: Number(verificationResult.rows[0]?.verified_points ?? 0),
      verificationRatePct: Number(verificationResult.rows[0]?.verification_rate_pct ?? 0),
    },
    freshness: {
      medianAgeDays: Number(freshnessResult.rows[0]?.median_age_days ?? 0),
      avgAgeDays: Number(freshnessResult.rows[0]?.avg_age_days ?? 0),
    },
    fraud: {
      eventsWithFraudCheck: Number(fraudResult.rows[0]?.events_with_fraud_check ?? 0),
      mismatchEvents: Number(fraudResult.rows[0]?.mismatch_events ?? 0),
      fraudRatePct: Number(fraudResult.rows[0]?.fraud_rate_pct ?? 0),
    },
    reviewQueue: {
      pendingReview: Number(reviewResult.rows[0]?.pending_review ?? 0),
      highRiskEvents: Number(reviewResult.rows[0]?.high_risk_events ?? 0),
    },
    enrichmentRatePct: Number(enrichmentResult.rows[0]?.enrichment_rate_pct ?? 0),
  };

  return jsonResponse(payload, { status: 200 });
}

async function handleKpiWeekly(url: URL): Promise<Response> {
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "24", 10), 104);

  try {
    const result = await query(
      `SELECT week_start, category, total_events, total_creates, total_enrichments, unique_users,
              unique_points, new_users, verified_points, fraud_flags, avg_completeness_pct, median_freshness_days
       FROM analytics_weekly
       ORDER BY week_start DESC, category
       LIMIT $1`,
      [limit],
    );
    return jsonResponse(result.rows, { status: 200 });
  } catch (error) {
    if (!isMissingDbObjectError(error)) throw error;
  }

  const fallback = await query(
    `WITH per_week AS (
       SELECT
         DATE_TRUNC('week', created_at)::date AS week_start,
         category,
         COUNT(*)::int AS total_events,
         COUNT(*) FILTER (WHERE event_type = 'CREATE_EVENT')::int AS total_creates,
         COUNT(*) FILTER (WHERE event_type = 'ENRICH_EVENT')::int AS total_enrichments,
         COUNT(DISTINCT user_id)::int AS unique_users,
         COUNT(DISTINCT point_id)::int AS unique_points,
         COUNT(*) FILTER (
           WHERE details #>> '{fraudCheck,primaryPhoto,submissionGpsMatch}' = 'false'
         )::int AS fraud_flags
       FROM point_events
       GROUP BY DATE_TRUNC('week', created_at)::date, category
     )
     SELECT
       week_start,
       category,
       total_events,
       total_creates,
       total_enrichments,
       unique_users,
       unique_points,
       0::int AS new_users,
       0::int AS verified_points,
       fraud_flags,
       NULL::numeric AS avg_completeness_pct,
       NULL::numeric AS median_freshness_days
     FROM per_week
     ORDER BY week_start DESC, category
     LIMIT $1`,
    [limit],
  );

  return jsonResponse(fallback.rows, { status: 200 });
}
