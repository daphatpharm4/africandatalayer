import { createHash } from "node:crypto";
import { query } from "./db.js";
import { logSecurityEvent } from "./securityAudit.js";
import { evaluateTokenBucket, type TokenBucketState } from "./rateLimit/tokenBucket.js";
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
  const prev = await input.store.get(storageKey);

  if (input.strategy === "token") {
    const rate = input.refillPerSec ?? 1;
    const result = evaluateTokenBucket(
      prev as unknown as TokenBucketState | null,
      { capacity: input.capacity, refillPerSec: rate },
      now,
    );
    const ttl = Math.ceil(input.capacity / rate) + 1;
    await input.store.set(storageKey, result.state as unknown as Record<string, number>, ttl);
    return { allowed: result.allowed, retryAfterSeconds: result.retryAfterSeconds };
  }

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
export async function resolveBucketStore(): Promise<BucketStore> {
  if (cachedStore) return cachedStore;
  const { createRedisBucketStore, createInMemoryBucketStore } = await import("./rateLimit/store.js");
  cachedStore = (await createRedisBucketStore()) ?? createInMemoryBucketStore();
  return cachedStore;
}
