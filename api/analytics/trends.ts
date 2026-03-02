import { requireUser } from "../../lib/auth.js";
import { query } from "../../lib/server/db.js";
import { jsonResponse, errorResponse } from "../../lib/server/http.js";
import { computeMovingAverage } from "../../lib/server/snapshotEngine.js";

const VALID_METRICS = new Set([
  "total_points",
  "completion_rate",
  "new_count",
  "removed_count",
  "avg_price",
  "week_over_week_growth",
]);

export async function GET(request: Request): Promise<Response> {
  const user = await requireUser(request);
  if (!user) return errorResponse("Unauthorized", 401);

  const url = new URL(request.url);
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

  // Reverse to chronological order
  const rows = result.rows.reverse();
  const values = rows.map((r) => Number(r[metric]) || 0);

  const data = rows.map((row, i) => ({
    date: row.snapshot_date,
    value: Number(row[metric]) || 0,
    movingAvg: computeMovingAverage(values.slice(0, i + 1), 4),
  }));

  return jsonResponse({ data });
}
