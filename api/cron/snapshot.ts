import { runWeeklySnapshot } from "../../lib/server/snapshotEngine.js";
import { jsonResponse, errorResponse } from "../../lib/server/http.js";

export const maxDuration = 60;

export async function GET(request: Request): Promise<Response> {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return errorResponse("Unauthorized", 401);
  }

  try {
    const url = new URL(request.url);
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
