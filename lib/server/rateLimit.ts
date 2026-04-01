import { createHash } from "node:crypto";
import { query } from "./db.js";
import { logSecurityEvent } from "./securityAudit.js";

function hashKey(input: string): string {
  return createHash("sha256").update(input.trim()).digest("hex");
}

function windowStartIso(windowSeconds: number, now = Date.now()): string {
  const bucket = Math.floor(now / (windowSeconds * 1000)) * windowSeconds * 1000;
  return new Date(bucket).toISOString();
}

export function extractRateLimitIp(request: Request | null | undefined): string | null {
  if (!request) return null;
  const rawIp =
    request.headers.get("x-vercel-forwarded-for") ??
    request.headers.get("x-forwarded-for") ??
    request.headers.get("x-real-ip");
  const ip = rawIp?.split(",")[0]?.trim();
  return ip || null;
}

export async function consumeRateLimit(input: {
  route: string;
  key: string;
  windowSeconds: number;
  max: number;
  request?: Request | null;
  userId?: string | null;
}): Promise<{ allowed: boolean; remaining: number; retryAfterSeconds: number; count: number }> {
  const route = input.route.trim();
  const keyHash = hashKey(input.key);
  const startedAt = windowStartIso(input.windowSeconds);
  const result = await query<{ request_count: number }>(
    `INSERT INTO api_rate_limits (route, key_hash, window_start, request_count, updated_at)
     VALUES ($1, $2, $3::timestamptz, 1, NOW())
     ON CONFLICT (route, key_hash, window_start)
     DO UPDATE SET
       request_count = api_rate_limits.request_count + 1,
       updated_at = NOW()
     RETURNING request_count`,
    [route, keyHash, startedAt],
  );

  const count = Number(result.rows[0]?.request_count ?? 0);
  const allowed = count <= input.max;
  const elapsedSeconds = Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000);
  const retryAfterSeconds = Math.max(1, input.windowSeconds - elapsedSeconds);

  if (!allowed) {
    await logSecurityEvent({
      eventType: "api_rate_limited",
      userId: input.userId ?? null,
      request: input.request,
      details: {
        route,
        limit: input.max,
        count,
        retryAfterSeconds,
      },
    });
  }

  return {
    allowed,
    remaining: Math.max(0, input.max - count),
    retryAfterSeconds,
    count,
  };
}
