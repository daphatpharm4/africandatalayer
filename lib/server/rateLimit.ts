import { createHash } from "node:crypto";
import { query } from "./db.js";
import { logSecurityEvent } from "./securityAudit.js";
import { evaluateLeakyBucket, type LeakyBucketState } from "./rateLimit/leakyBucket.js";
import type { BucketStore } from "./rateLimit/store.js";

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

export type BucketStrategy = "token" | "leaky";

export interface ConsumeBucketInput {
  store: BucketStore;
  route: string;
  key: string;
  strategy: BucketStrategy;
  capacity: number;
  /** token strategy only */
  refillPerSec?: number;
  /** leaky strategy only */
  leakPerSec?: number;
  nowFn?: () => number;
}

export interface ConsumeBucketResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

function bucketStorageKey(route: string, key: string, strategy: BucketStrategy): string {
  return `rl:${strategy}:${route}:${hashKey(key)}`;
}

export async function consumeBucket(input: ConsumeBucketInput): Promise<ConsumeBucketResult> {
  const now = (input.nowFn ?? Date.now)();
  const storageKey = bucketStorageKey(input.route, input.key, input.strategy);

  if (input.strategy === "token") {
    const rate = input.refillPerSec ?? 1;
    const ttl = Math.ceil(input.capacity / rate) + 1;
    // Atomic single-op consume — avoids the read-modify-write race that get/set
    // suffers across concurrent requests and Fluid Compute instances (bd-4jl).
    const result = await input.store.consumeTokenBucket(storageKey, {
      capacity: input.capacity,
      refillPerSec: rate,
      nowMs: now,
      ttlSeconds: ttl,
    });
    return { allowed: result.allowed, retryAfterSeconds: result.retryAfterSeconds };
  }

  // Leaky strategy retains get/set (no caller today; documented best-effort).
  const prev = await input.store.get(storageKey);
  const leak = input.leakPerSec ?? 1;
  const result = evaluateLeakyBucket(
    prev as unknown as LeakyBucketState | null,
    { capacity: input.capacity, leakPerSec: leak },
    now,
  );
  const ttl = Math.ceil(input.capacity / leak) + 1;
  await input.store.set(storageKey, result.state as unknown as Record<string, number>, ttl);
  return { allowed: result.allowed, retryAfterSeconds: result.retryAfterSeconds };
}

/** Resolves the active bucket store: Redis when configured, else in-memory. */
let cachedStore: BucketStore | null = null;
let warnedNoRedisInProd = false;
export async function resolveBucketStore(): Promise<BucketStore> {
  if (cachedStore) return cachedStore;
  const { createRedisBucketStore, createInMemoryBucketStore } = await import("./rateLimit/store.js");
  const redis = await createRedisBucketStore();
  if (!redis && !warnedNoRedisInProd) {
    const isProd = process.env.VERCEL_ENV === "production" || process.env.NODE_ENV === "production";
    if (isProd) {
      warnedNoRedisInProd = true;
      // bd-4jl: in-memory buckets are per-instance heap; under Fluid Compute the
      // effective limit becomes (instances × capacity). Upstash is REQUIRED in
      // prod for a globally-consistent limit — surface its absence loudly.
      console.warn(
        "[rateLimit] UPSTASH_REDIS_REST_URL/_TOKEN unset in production — token-bucket limits are per-instance (best-effort) and will under-enforce across instances. Provision Upstash Redis.",
      );
    }
  }
  cachedStore = redis ?? createInMemoryBucketStore();
  return cachedStore;
}
