import { query } from "../../lib/server/db.js";
import { captureServerException } from "../../lib/server/sentry.js";

type HealthStatus = "ok" | "error";

function isMissingDbObjectError(error: unknown): boolean {
  const pg = error as { code?: unknown; message?: unknown } | null;
  const code = typeof pg?.code === "string" ? pg.code : "";
  if (code === "42P01" || code === "42703") return true;
  const message = typeof pg?.message === "string" ? pg.message.toLowerCase() : "";
  return message.includes("does not exist") || message.includes("undefined table") || message.includes("undefined column");
}

async function resolveLatestTimestamp(sql: string): Promise<string | null> {
  try {
    const result = await query<{ ts: string | null }>(sql);
    const value = result.rows[0]?.ts;
    return typeof value === "string" ? value : null;
  } catch (error) {
    if (isMissingDbObjectError(error)) return null;
    throw error;
  }
}

export async function GET(): Promise<Response> {
  let dbStatus: HealthStatus = "error";
  let storageStatus: HealthStatus = "error";
  let httpStatus = 503;
  const version = process.env.npm_package_version ?? "0.0.0";
  const commitSha = process.env.VERCEL_GIT_COMMIT_SHA ?? null;
  const env = process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "development";

  try {
    await query("SELECT 1");
    dbStatus = "ok";
    storageStatus = process.env.BLOB_READ_WRITE_TOKEN ? "ok" : "error";
    httpStatus = storageStatus === "ok" ? 200 : 503;
    const latestWeeklySnapshotAt = await resolveLatestTimestamp(
      "SELECT MAX(snapshot_date)::text AS ts FROM snapshot_stats",
    );
    const latestAnalyticsRollupAt = await resolveLatestTimestamp(
      "SELECT MAX(week_start)::text AS ts FROM analytics_weekly",
    );

    const body = JSON.stringify({
      status: httpStatus === 200 ? "ok" : "error",
      db: dbStatus,
      storage: storageStatus,
      version,
      env,
      commitSha,
      lastCron: {
        weeklySnapshotAt: latestWeeklySnapshotAt,
        analyticsRollupAt: latestAnalyticsRollupAt,
      },
      ts: new Date().toISOString(),
    });
    return new Response(body, {
      status: httpStatus,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    captureServerException(error, { route: "health" });
  }

  const body = JSON.stringify({
    status: "error",
    db: dbStatus,
    storage: storageStatus,
    version,
    env,
    commitSha,
    ts: new Date().toISOString(),
  });
  return new Response(body, {
    status: httpStatus,
    headers: { "Content-Type": "application/json" },
  });
}
