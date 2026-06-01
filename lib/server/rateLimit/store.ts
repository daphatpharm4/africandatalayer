export interface BucketStore {
  get(key: string): Promise<Record<string, number> | null>;
  set(key: string, value: Record<string, number>, ttlSeconds: number): Promise<void>;
}

interface MemoryEntry {
  value: Record<string, number>;
  expiresAtMs: number;
}

export function createInMemoryBucketStore(nowFn: () => number = Date.now): BucketStore {
  const map = new Map<string, MemoryEntry>();
  return {
    async get(key) {
      const entry = map.get(key);
      if (!entry) return null;
      if (entry.expiresAtMs <= nowFn()) {
        map.delete(key);
        return null;
      }
      return entry.value;
    },
    async set(key, value, ttlSeconds) {
      map.set(key, { value, expiresAtMs: nowFn() + ttlSeconds * 1000 });
    },
  };
}

/**
 * Redis-backed store via Upstash REST. Activated only when UPSTASH_REDIS_REST_URL
 * is configured; otherwise callers fall back to the in-memory store.
 * Lazily imports @upstash/redis so unit tests never load it.
 */
export async function createRedisBucketStore(): Promise<BucketStore | null> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;

  const { Redis } = await import("@upstash/redis" as string) as { Redis: new (cfg: { url: string; token: string }) => { get<T>(k: string): Promise<T | null>; set(k: string, v: unknown, o: { ex: number }): Promise<unknown> } };
  const redis = new Redis({ url, token });
  return {
    async get(key) {
      return (await redis.get<Record<string, number>>(key)) ?? null;
    },
    async set(key, value, ttlSeconds) {
      await redis.set(key, value, { ex: Math.max(1, Math.ceil(ttlSeconds)) });
    },
  };
}
