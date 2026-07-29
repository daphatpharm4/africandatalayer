import "../../lib/server/sentry.js";
import { errorResponse, jsonResponse } from "../../lib/server/http.js";
import { runDailyMissionGenerationCron } from "../../lib/server/platform/missionsCron.js";

function isCronRequestAuthorized(request: Request): boolean {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  return Boolean(cronSecret && authHeader === `Bearer ${cronSecret}`);
}

export async function GET(request: Request): Promise<Response> {
  if (!isCronRequestAuthorized(request)) {
    return errorResponse("Unauthorized", 401);
  }
  try {
    const summary = await runDailyMissionGenerationCron();
    return jsonResponse(summary, { status: summary.hasFailures ? 500 : 200 });
  } catch (error) {
    console.error("Daily mission generation cron failed:", error);
    return errorResponse(error instanceof Error ? error.message : "Daily mission generation failed", 500);
  }
}
