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

// Secret-gated trigger to confirm server-side Sentry delivery end-to-end. Requires
// the CRON_SECRET bearer (same gate as the cron routes) so it is not publicly
// invocable. Captures a uniquely-marked error through the real capture+flush path
// and reports whether it flushed, so an operator can confirm the marker landed in
// the Sentry dashboard.
async function handleSentryTest(request: Request): Promise<Response> {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  }

  const marker = `sentry-test-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const dsnConfigured = Boolean(process.env.SENTRY_DSN);
  const captured = await captureServerException(new Error(`Sentry server capture test — ${marker}`), {
    route: "sentry_test",
    marker,
    triggeredAt: new Date().toISOString(),
  });

  return new Response(
    JSON.stringify({
      ok: true,
      dsnConfigured,
      captured,
      marker,
      note: captured
        ? "Event captured and flushed to Sentry. Search the Sentry project for the marker."
        : dsnConfigured
          ? "SENTRY_DSN is set but the event was not confirmed flushed — check DSN validity / transport."
          : "SENTRY_DSN is not configured on the server; nothing was sent.",
    }),
    { status: 200, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } },
  );
}

export async function GET(request: Request): Promise<Response> {
  if (new URL(request.url).searchParams.get("view") === "sentry-test") {
    return handleSentryTest(request);
  }

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
    await captureServerException(error, { route: "health" });
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
