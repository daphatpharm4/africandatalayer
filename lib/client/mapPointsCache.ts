import type { MapScope, ProjectedPoint } from "../../shared/types";

const CACHE_VERSION = "v1";
const DEFAULT_TTL_MS = 5 * 60 * 1000;

interface CacheEntry {
  cachedAt: number;
  points: ProjectedPoint[];
}

interface CacheOptions {
  authKey?: string;
  now?: () => number;
  storage?: Storage | null;
  ttlMs?: number;
}

const memoryCache = new Map<string, CacheEntry>();

function makeCacheKey(scope: MapScope, authKey = "public"): string {
  return `adl-map-points:${CACHE_VERSION}:${authKey}:${scope}`;
}

function readStorage(storage: Storage | null | undefined, key: string): CacheEntry | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CacheEntry>;
    if (!Array.isArray(parsed.points) || typeof parsed.cachedAt !== "number") return null;
    return { cachedAt: parsed.cachedAt, points: parsed.points as ProjectedPoint[] };
  } catch {
    return null;
  }
}

function writeStorage(storage: Storage | null | undefined, key: string, entry: CacheEntry): void {
  if (!storage) return;
  try {
    storage.setItem(key, JSON.stringify(entry));
  } catch {
    // Best effort cache: storage quota/private mode should never block map loading.
  }
}

function isFresh(entry: CacheEntry, now: number, ttlMs: number): boolean {
  return entry.cachedAt > 0 && now - entry.cachedAt <= ttlMs;
}

export function readCachedMapPoints(scope: MapScope, options: CacheOptions = {}): ProjectedPoint[] | null {
  const now = options.now?.() ?? Date.now();
  const ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;
  const key = makeCacheKey(scope, options.authKey);
  const memoryEntry = memoryCache.get(key);
  if (memoryEntry && isFresh(memoryEntry, now, ttlMs)) return memoryEntry.points;

  const storageEntry = readStorage(options.storage ?? globalThis.localStorage, key);
  if (storageEntry && isFresh(storageEntry, now, ttlMs)) {
    memoryCache.set(key, storageEntry);
    return storageEntry.points;
  }

  return null;
}

export function writeCachedMapPoints(scope: MapScope, points: ProjectedPoint[], options: CacheOptions = {}): void {
  const entry = {
    cachedAt: options.now?.() ?? Date.now(),
    points,
  };
  const key = makeCacheKey(scope, options.authKey);
  memoryCache.set(key, entry);
  writeStorage(options.storage ?? globalThis.localStorage, key, entry);
}

export function __resetMapPointsCacheForTest(): void {
  memoryCache.clear();
}
