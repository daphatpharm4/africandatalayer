import { createPrefetchCache, type PrefetchCache } from "./prefetch.js";

const POINT_TTL_MS = 30_000;
let cache: PrefetchCache<unknown> = createPrefetchCache<unknown>({ ttlMs: POINT_TTL_MS });

export function prefetchPoint(id: string, fetcher: (id: string) => Promise<unknown>): void {
  void cache.prefetch(id, fetcher);
}

export async function takePrefetchedPoint<T>(id: string): Promise<T | null> {
  return (await cache.take(id)) as T | null;
}

/** Test-only: reset the module-level cache between cases. */
export function __resetPointPrefetchForTest(): void {
  cache = createPrefetchCache<unknown>({ ttlMs: POINT_TTL_MS });
}
