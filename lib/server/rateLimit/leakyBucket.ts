export interface LeakyBucketState {
  level: number;
  lastLeakMs: number;
}

export interface LeakyBucketOptions {
  /** Bucket size — max queued requests before overflow. */
  capacity: number;
  /** Requests drained per second. */
  leakPerSec: number;
}

export interface LeakyBucketResult {
  allowed: boolean;
  retryAfterSeconds: number;
  state: LeakyBucketState;
}

export function evaluateLeakyBucket(
  prev: LeakyBucketState | null,
  options: LeakyBucketOptions,
  now: number,
): LeakyBucketResult {
  const last = prev ?? { level: 0, lastLeakMs: now };
  const elapsedSec = Math.max(0, (now - last.lastLeakMs) / 1000);
  const leaked = Math.max(0, last.level - elapsedSec * options.leakPerSec);

  if (leaked + 1 <= options.capacity) {
    return {
      allowed: true,
      retryAfterSeconds: 0,
      state: { level: leaked + 1, lastLeakMs: now },
    };
  }

  const overflowBy = leaked + 1 - options.capacity;
  const retryAfterSeconds = Math.max(1, Math.ceil(overflowBy / options.leakPerSec));
  return {
    allowed: false,
    retryAfterSeconds,
    state: { level: leaked, lastLeakMs: now },
  };
}
