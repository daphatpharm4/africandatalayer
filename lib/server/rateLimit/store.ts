import { evaluateTokenBucket, type TokenBucketState } from "./tokenBucket.js";

export interface TokenBucketConsumeParams {
  capacity: number;
  refillPerSec: number;
  cost?: number;
  /** Current time in epoch ms (injected for deterministic tests). */
  nowMs: number;
  /** Seconds the bucket state should live before eviction. */
  ttlSeconds: number;
}

export interface TokenBucketConsumeResult {
  allowed: boolean;
  retryAfterSeconds: number;
  tokens: number;
}

export interface BucketStore {
  get(key: string): Promise<Record<string, number> | null>;
  set(key: string, value: Record<string, number>, ttlSeconds: number): Promise<void>;
  /**
   * Atomic token-bucket consume: read state, evaluate, and write the new state
   * as a single indivisible operation. Cross-instance-safe on Redis (Lua eval);
   * synchronous and yield-free in-memory. Use this instead of get/set+evaluate,
   * which has a read-modify-write race across concurrent requests/instances.
   */
  consumeTokenBucket(key: string, params: TokenBucketConsumeParams): Promise<TokenBucketConsumeResult>;
}

interface MemoryEntry {
  value: Record<string, number>;
  expiresAtMs: number;
}

export function createInMemoryBucketStore(nowFn: () => number = Date.now): BucketStore {
  const map = new Map<string, MemoryEntry>();
  function readFresh(key: string): Record<string, number> | null {
    const entry = map.get(key);
    if (!entry) return null;
    if (entry.expiresAtMs <= nowFn()) {
      map.delete(key);
      return null;
    }
    return entry.value;
  }
  return {
    async get(key) {
      return readFresh(key);
    },
    async set(key, value, ttlSeconds) {
      map.set(key, { value, expiresAtMs: nowFn() + ttlSeconds * 1000 });
    },
    // NOTE: no `await` before the map write — the read+evaluate+write run
    // synchronously, so concurrent calls cannot interleave (atomic per-process).
    async consumeTokenBucket(key, params) {
      const prev = readFresh(key) as unknown as TokenBucketState | null;
      const result = evaluateTokenBucket(
        prev,
        { capacity: params.capacity, refillPerSec: params.refillPerSec, cost: params.cost },
        params.nowMs,
      );
      map.set(key, {
        value: result.state as unknown as Record<string, number>,
        expiresAtMs: nowFn() + params.ttlSeconds * 1000,
      });
      return { allowed: result.allowed, retryAfterSeconds: result.retryAfterSeconds, tokens: result.state.tokens };
    },
  };
}

/**
 * Atomic token-bucket evaluation in Lua. Mirrors evaluateTokenBucket() exactly
 * (refill = min(capacity, tokens + elapsedSec * refillPerSec); consume `cost`;
 * retryAfter = ceil(deficit / refillPerSec)). Runs server-side so the read,
 * decision, and write are a single atomic step across all instances.
 * Returns {allowed(0|1), retryAfterSeconds, tokens*1000-as-int} — tokens are
 * scaled to an integer to survive the REST numeric round-trip cleanly.
 *
 * SAFETY: this is a fixed, hard-coded Redis Lua script (server-side, not JS
 * eval). All inputs are passed as numeric ARGV — no user-controlled code or
 * string interpolation enters the script, so there is no injection surface.
 */
const TOKEN_BUCKET_LUA = `
local raw = redis.call('GET', KEYS[1])
local capacity = tonumber(ARGV[1])
local refill = tonumber(ARGV[2])
local cost = tonumber(ARGV[3])
local now = tonumber(ARGV[4])
local ttl = tonumber(ARGV[5])
local tokens = capacity
local last = now
if raw then
  local s = cjson.decode(raw)
  tokens = s.tokens
  last = s.lastRefillMs
end
local elapsed = (now - last) / 1000
if elapsed < 0 then elapsed = 0 end
local refilled = tokens + elapsed * refill
if refilled > capacity then refilled = capacity end
local allowed = 0
local retry = 0
if refilled >= cost then
  allowed = 1
  refilled = refilled - cost
else
  local deficit = cost - refilled
  retry = math.ceil(deficit / refill)
  if retry < 1 then retry = 1 end
end
redis.call('SET', KEYS[1], cjson.encode({tokens = refilled, lastRefillMs = now}), 'EX', ttl)
return {allowed, retry, math.floor(refilled * 1000)}
`;

type UpstashRedis = {
  get<T>(k: string): Promise<T | null>;
  set(k: string, v: unknown, o: { ex: number }): Promise<unknown>;
  eval(script: string, keys: string[], args: (string | number)[]): Promise<unknown>;
};

/**
 * Redis-backed store via Upstash REST. Activated only when UPSTASH_REDIS_REST_URL
 * is configured; otherwise callers fall back to the in-memory store.
 * Lazily imports @upstash/redis so unit tests never load it.
 */
export async function createRedisBucketStore(): Promise<BucketStore | null> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;

  const { Redis } = (await import("@upstash/redis" as string)) as {
    Redis: new (cfg: { url: string; token: string }) => UpstashRedis;
  };
  const redis = new Redis({ url, token });
  return {
    async get(key) {
      return (await redis.get<Record<string, number>>(key)) ?? null;
    },
    async set(key, value, ttlSeconds) {
      await redis.set(key, value, { ex: Math.max(1, Math.ceil(ttlSeconds)) });
    },
    async consumeTokenBucket(key, params) {
      const out = (await redis.eval(
        TOKEN_BUCKET_LUA,
        [key],
        [
          params.capacity,
          params.refillPerSec,
          params.cost ?? 1,
          params.nowMs,
          Math.max(1, Math.ceil(params.ttlSeconds)),
        ],
      )) as [number, number, number];
      return { allowed: out[0] === 1, retryAfterSeconds: Number(out[1]), tokens: Number(out[2]) / 1000 };
    },
  };
}
