import { query } from "./db.js";

/**
 * Resolve a retention window (in days) from an env override, falling back to a
 * default when unset/invalid. Pure + unit-tested; the DELETEs below can't run in
 * CI without a database, so this is the testable seam.
 */
export function resolveRetentionDays(envValue: string | undefined, fallbackDays: number): number {
  const parsed = Number(envValue);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallbackDays;
}

export interface PurgeResult {
  apiIdempotencyKeys: number;
  submissionIdempotencyKeys: number;
  apiRateLimits: number;
  retentionDays: { idempotency: number; rateLimit: number };
}

/**
 * Delete aged rows from the limiter/idempotency bookkeeping tables so they don't
 * grow unbounded (bd-2zm). Idempotency keys are kept well past their reservation
 * TTL + replay usefulness; rate-limit rows are useless once their window closes.
 * Run daily from the cron dispatcher.
 */
export async function purgeExpiredMaintenanceRecords(): Promise<PurgeResult> {
  const idempotencyDays = resolveRetentionDays(process.env.IDEMPOTENCY_RETENTION_DAYS, 7);
  const rateLimitDays = resolveRetentionDays(process.env.RATE_LIMIT_RETENTION_DAYS, 2);

  const apiIdem = await query(
    `DELETE FROM api_idempotency_keys WHERE created_at < NOW() - make_interval(days => $1)`,
    [idempotencyDays],
  );
  const submissionIdem = await query(
    `DELETE FROM submission_idempotency_keys WHERE created_at < NOW() - make_interval(days => $1)`,
    [idempotencyDays],
  );
  const rateLimits = await query(
    `DELETE FROM api_rate_limits WHERE window_start < NOW() - make_interval(days => $1)`,
    [rateLimitDays],
  );

  return {
    apiIdempotencyKeys: apiIdem.rowCount ?? 0,
    submissionIdempotencyKeys: submissionIdem.rowCount ?? 0,
    apiRateLimits: rateLimits.rowCount ?? 0,
    retentionDays: { idempotency: idempotencyDays, rateLimit: rateLimitDays },
  };
}
