import { requireUser } from "../../lib/auth.js";
import { query } from "../../lib/server/db.js";
import { jsonResponse, errorResponse } from "../../lib/server/http.js";

export async function GET(request: Request): Promise<Response> {
  const user = await requireUser(request);
  if (!user) return errorResponse("Unauthorized", 401);

  const url = new URL(request.url);
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
