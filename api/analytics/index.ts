import { requireUser } from "../../lib/auth.js";
import { query } from "../../lib/server/db.js";
import { jsonResponse, errorResponse } from "../../lib/server/http.js";
import { computeMovingAverage } from "../../lib/server/snapshotEngine.js";

export const maxDuration = 60;

const VALID_METRICS = new Set([
  "total_points",
  "completion_rate",
  "new_count",
  "removed_count",
  "avg_price",
  "week_over_week_growth",
]);

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const view = url.searchParams.get("view") ?? "snapshots";

  // Cron trigger — authenticated via CRON_SECRET, not user session
  if (view === "cron") {
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return errorResponse("Unauthorized", 401);
    }
    try {
      const { runWeeklySnapshot } = await import("../../lib/server/snapshotEngine.js");
      const dateOverride = url.searchParams.get("date") ?? undefined;
      const result = await runWeeklySnapshot(dateOverride);
      return jsonResponse(result);
    } catch (error) {
      console.error("Snapshot cron failed:", error);
      return errorResponse(
        error instanceof Error ? error.message : "Snapshot failed",
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
    case "trends":
      return handleTrends(url);
    case "anomalies":
      return handleAnomalies();
    default:
      return errorResponse(`Invalid view: ${view}. Valid: snapshots, deltas, trends, anomalies, cron`, 400);
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
