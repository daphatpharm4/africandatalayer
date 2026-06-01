export interface TokenBucketState {
  tokens: number;
  lastRefillMs: number;
}

export interface TokenBucketOptions {
  /** Maximum tokens the bucket can hold (max burst). */
  capacity: number;
  /** Tokens added per second. */
  refillPerSec: number;
  /** Tokens consumed by this request. Defaults to 1. */
  cost?: number;
}

export interface TokenBucketResult {
  allowed: boolean;
  retryAfterSeconds: number;
  state: TokenBucketState;
}

export function evaluateTokenBucket(
  prev: TokenBucketState | null,
  options: TokenBucketOptions,
  now: number,
): TokenBucketResult {
  const cost = options.cost ?? 1;
  const last = prev ?? { tokens: options.capacity, lastRefillMs: now };
  const elapsedSec = Math.max(0, (now - last.lastRefillMs) / 1000);
  const refilled = Math.min(options.capacity, last.tokens + elapsedSec * options.refillPerSec);

  if (refilled >= cost) {
    return {
      allowed: true,
      retryAfterSeconds: 0,
      state: { tokens: refilled - cost, lastRefillMs: now },
    };
  }

  const deficit = cost - refilled;
  const retryAfterSeconds = Math.max(1, Math.ceil(deficit / options.refillPerSec));
  return {
    allowed: false,
    retryAfterSeconds,
    state: { tokens: refilled, lastRefillMs: now },
  };
}
