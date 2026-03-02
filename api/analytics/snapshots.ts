import { requireUser } from "../../lib/auth.js";
import { query } from "../../lib/server/db.js";
import { jsonResponse, errorResponse } from "../../lib/server/http.js";

export async function GET(request: Request): Promise<Response> {
  const user = await requireUser(request);
  if (!user) return errorResponse("Unauthorized", 401);

  const url = new URL(request.url);
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
