interface CacheEntry<T> {
  promise: Promise<T>;
  storedAtMs: number;
}

export interface PrefetchCache<T> {
  prefetch(id: string, fetcher: (id: string) => Promise<T>): Promise<void>;
  take(id: string): Promise<T | null>;
}

export function createPrefetchCache<T>(options: { ttlMs: number; nowFn?: () => number }): PrefetchCache<T> {
  const now = options.nowFn ?? Date.now;
  const entries = new Map<string, CacheEntry<T>>();

  function fresh(entry: CacheEntry<T> | undefined): entry is CacheEntry<T> {
    return !!entry && now() - entry.storedAtMs <= options.ttlMs;
  }

  return {
    async prefetch(id, fetcher) {
      const existing = entries.get(id);
      if (fresh(existing)) return;
      const promise = fetcher(id).catch((error) => {
        entries.delete(id); // failed prefetch should not poison the cache
        throw error;
      });
      entries.set(id, { promise, storedAtMs: now() });
      void promise.catch(() => undefined); // swallow unhandled rejection; consumers re-fetch
    },
    async take(id) {
      const entry = entries.get(id);
      if (!fresh(entry)) {
        entries.delete(id);
        return null;
      }
      try {
        return await entry.promise;
      } catch {
        entries.delete(id);
        return null;
      }
    },
  };
}
