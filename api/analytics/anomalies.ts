import { requireUser } from "../../lib/auth.js";
import { query } from "../../lib/server/db.js";
import { jsonResponse, errorResponse } from "../../lib/server/http.js";

export async function GET(request: Request): Promise<Response> {
  const user = await requireUser(request);
  if (!user) return errorResponse("Unauthorized", 401);

  const result = await query(
    `SELECT snapshot_date, vertical_id, total_points, anomaly_flags
     FROM snapshot_stats
     WHERE jsonb_array_length(anomaly_flags) > 0
     ORDER BY snapshot_date DESC
     LIMIT 50`,
  );

  return jsonResponse(result.rows);
}
