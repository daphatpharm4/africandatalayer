# Rate Limiting, Idempotency, Preloading & CDN — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add production-grade token-bucket & leaky-bucket rate limiting (Redis-backed) plus generalized idempotency, frontend optimistic preloading, and consistent CDN cache headers to African Data Layer.

**Architecture:** Four independent phases, each shippable on its own. Pure deterministic algorithm functions (clock-injected) are unit-tested with zero infrastructure; storage adapters (Redis / Postgres / in-memory) sit behind a small interface so tests run offline. Existing `consumeRateLimit` (fixed-window, Postgres) and `reserveIdempotencyKey` (submissions) stay intact for back-compat.

**Tech Stack:** TypeScript 5.8, Node native test runner (`node --import tsx --test`), `pg` driver, `@upstash/redis` (Vercel Marketplace), React 19, Vercel serverless + CDN.

**Test command (single file):** `node --import tsx --test tests/<file>.test.ts`
**Full suite:** `npm test`

---

## File Structure

| Phase | Files | Responsibility |
|-------|-------|----------------|
| 1 | `lib/server/rateLimit/tokenBucket.ts` | Pure token-bucket evaluation |
| 1 | `lib/server/rateLimit/leakyBucket.ts` | Pure leaky-bucket evaluation |
| 1 | `lib/server/rateLimit/store.ts` | Bucket-state store interface + in-memory + Redis adapters |
| 1 | `lib/server/rateLimit.ts` (modify) | Add `consumeBucket()`; keep `consumeRateLimit()` |
| 2 | `lib/server/idempotencyGeneric.ts` | Scoped, response-storing idempotency wrapper |
| 2 | `supabase/migrations/20260601_api_idempotency_keys.sql` | New generic idempotency table |
| 2 | `api/user/index.ts` (modify) | Wire idempotency into PUT |
| 3 | `lib/client/prefetch.ts` | Client-side prefetch cache |
| 3 | `components/Screens/HomeMap.tsx` (modify) | Trigger prefetch on marker intent |
| 3 | `components/Screens/Details.tsx` (modify) | Read prefetched point first |
| 4 | `lib/server/http.ts` (modify) | Add `cachedJsonResponse()` + ETag helper |
| 4 | `api/analytics/index.ts` (modify) | Use `cachedJsonResponse` |

Each phase ends shippable. Recommended commit cadence: one commit per step group as marked.

---

# Phase 1 — Token Bucket + Leaky Bucket + Redis

### Task 1.1: Pure token-bucket evaluator

**Files:**
- Create: `lib/server/rateLimit/tokenBucket.ts`
- Test: `tests/rateLimitTokenBucket.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/rateLimitTokenBucket.test.ts
import assert from "node:assert/strict";
import test from "node:test";
import { evaluateTokenBucket, type TokenBucketState } from "../lib/server/rateLimit/tokenBucket.ts";

test("first request on empty state is allowed and consumes one token", () => {
  const now = 1_000_000;
  const result = evaluateTokenBucket(null, { capacity: 5, refillPerSec: 1 }, now);
  assert.equal(result.allowed, true);
  assert.equal(result.state.tokens, 4);
  assert.equal(result.state.lastRefillMs, now);
  assert.equal(result.retryAfterSeconds, 0);
});

test("burst up to capacity then denial", () => {
  const opts = { capacity: 3, refillPerSec: 1 };
  let state: TokenBucketState | null = null;
  const now = 2_000_000;
  for (let i = 0; i < 3; i++) {
    const r = evaluateTokenBucket(state, opts, now);
    assert.equal(r.allowed, true, `req ${i} should pass`);
    state = r.state;
  }
  const denied = evaluateTokenBucket(state, opts, now);
  assert.equal(denied.allowed, false);
  assert.equal(denied.retryAfterSeconds, 1);
});

test("tokens refill over elapsed time, capped at capacity", () => {
  const opts = { capacity: 10, refillPerSec: 2 };
  const start = 5_000_000;
  const drained = evaluateTokenBucket({ tokens: 0, lastRefillMs: start }, opts, start);
  assert.equal(drained.allowed, false);
  // 3 seconds later → 6 tokens refilled, one consumed → 5 remain
  const later = evaluateTokenBucket({ tokens: 0, lastRefillMs: start }, opts, start + 3000);
  assert.equal(later.allowed, true);
  assert.equal(later.state.tokens, 5);
  // huge gap caps at capacity-1 after consuming one
  const capped = evaluateTokenBucket({ tokens: 0, lastRefillMs: start }, opts, start + 1_000_000);
  assert.equal(capped.state.tokens, 9);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --import tsx --test tests/rateLimitTokenBucket.test.ts`
Expected: FAIL — `Cannot find module '../lib/server/rateLimit/tokenBucket.ts'`

- [ ] **Step 3: Write minimal implementation**

```typescript
// lib/server/rateLimit/tokenBucket.ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --import tsx --test tests/rateLimitTokenBucket.test.ts`
Expected: PASS — 3 tests

- [ ] **Step 5: Commit**

```bash
git add lib/server/rateLimit/tokenBucket.ts tests/rateLimitTokenBucket.test.ts
git commit -m "feat(ratelimit): add pure token-bucket evaluator"
```

---

### Task 1.2: Pure leaky-bucket evaluator

**Files:**
- Create: `lib/server/rateLimit/leakyBucket.ts`
- Test: `tests/rateLimitLeakyBucket.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/rateLimitLeakyBucket.test.ts
import assert from "node:assert/strict";
import test from "node:test";
import { evaluateLeakyBucket, type LeakyBucketState } from "../lib/server/rateLimit/leakyBucket.ts";

test("first drop is admitted into an empty bucket", () => {
  const now = 1_000_000;
  const r = evaluateLeakyBucket(null, { capacity: 5, leakPerSec: 1 }, now);
  assert.equal(r.allowed, true);
  assert.equal(r.state.level, 1);
  assert.equal(r.state.lastLeakMs, now);
});

test("bucket overflows when filled beyond capacity", () => {
  const opts = { capacity: 2, leakPerSec: 1 };
  const now = 3_000_000;
  let state: LeakyBucketState | null = null;
  for (let i = 0; i < 2; i++) {
    const r = evaluateLeakyBucket(state, opts, now);
    assert.equal(r.allowed, true);
    state = r.state;
  }
  const overflow = evaluateLeakyBucket(state, opts, now);
  assert.equal(overflow.allowed, false);
  assert.equal(overflow.retryAfterSeconds, 1);
  // level must not exceed capacity on denial
  assert.equal(overflow.state.level, 2);
});

test("level leaks down over elapsed time", () => {
  const opts = { capacity: 10, leakPerSec: 2 };
  const start = 7_000_000;
  // 2.5s later → leaks 5, from level 6 → 1, then +1 drop = 2
  const r = evaluateLeakyBucket({ level: 6, lastLeakMs: start }, opts, start + 2500);
  assert.equal(r.allowed, true);
  assert.equal(r.state.level, 2);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --import tsx --test tests/rateLimitLeakyBucket.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```typescript
// lib/server/rateLimit/leakyBucket.ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --import tsx --test tests/rateLimitLeakyBucket.test.ts`
Expected: PASS — 3 tests

- [ ] **Step 5: Commit**

```bash
git add lib/server/rateLimit/leakyBucket.ts tests/rateLimitLeakyBucket.test.ts
git commit -m "feat(ratelimit): add pure leaky-bucket evaluator"
```

---

### Task 1.3: Bucket-state store (interface + in-memory)

**Files:**
- Create: `lib/server/rateLimit/store.ts`
- Test: `tests/rateLimitStore.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/rateLimitStore.test.ts
import assert from "node:assert/strict";
import test from "node:test";
import { createInMemoryBucketStore } from "../lib/server/rateLimit/store.ts";

test("in-memory store returns null for unseen key", async () => {
  const store = createInMemoryBucketStore();
  assert.equal(await store.get("missing"), null);
});

test("in-memory store round-trips state", async () => {
  const store = createInMemoryBucketStore();
  await store.set("k1", { a: 1, b: 2 }, 60);
  assert.deepEqual(await store.get("k1"), { a: 1, b: 2 });
});

test("in-memory store expires entries past ttl", async () => {
  let clock = 1000;
  const store = createInMemoryBucketStore(() => clock);
  await store.set("k2", { x: 1 }, 1); // 1 second ttl
  clock += 2000;
  assert.equal(await store.get("k2"), null);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --import tsx --test tests/rateLimitStore.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```typescript
// lib/server/rateLimit/store.ts
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

  const { Redis } = await import("@upstash/redis");
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
```

> NOTE: `@upstash/redis` is added to `package.json` in Task 1.5. Until then, `createRedisBucketStore` returns `null` whenever env vars are unset, so this file imports cleanly without the dependency installed.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --import tsx --test tests/rateLimitStore.test.ts`
Expected: PASS — 3 tests

- [ ] **Step 5: Commit**

```bash
git add lib/server/rateLimit/store.ts tests/rateLimitStore.test.ts
git commit -m "feat(ratelimit): add bucket-state store with in-memory + redis adapters"
```

---

### Task 1.4: `consumeBucket()` orchestrator

**Files:**
- Modify: `lib/server/rateLimit.ts` (append exports; do not touch existing `consumeRateLimit`)
- Test: `tests/rateLimitConsumeBucket.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/rateLimitConsumeBucket.test.ts
import assert from "node:assert/strict";
import test from "node:test";
import { consumeBucket } from "../lib/server/rateLimit.ts";
import { createInMemoryBucketStore } from "../lib/server/rateLimit/store.ts";

test("token strategy allows burst then denies", async () => {
  const store = createInMemoryBucketStore();
  let now = 1_000_000;
  const base = {
    store,
    route: "test:token",
    key: "user-1",
    strategy: "token" as const,
    capacity: 2,
    refillPerSec: 1,
    nowFn: () => now,
  };
  assert.equal((await consumeBucket(base)).allowed, true);
  assert.equal((await consumeBucket(base)).allowed, true);
  const denied = await consumeBucket(base);
  assert.equal(denied.allowed, false);
  assert.equal(denied.retryAfterSeconds, 1);
});

test("leaky strategy admits after leak window", async () => {
  const store = createInMemoryBucketStore();
  let now = 2_000_000;
  const base = {
    store,
    route: "test:leaky",
    key: "user-2",
    strategy: "leaky" as const,
    capacity: 1,
    leakPerSec: 1,
    nowFn: () => now,
  };
  assert.equal((await consumeBucket(base)).allowed, true);
  assert.equal((await consumeBucket(base)).allowed, false);
  now += 1000;
  assert.equal((await consumeBucket(base)).allowed, true);
});

test("different keys use independent buckets", async () => {
  const store = createInMemoryBucketStore();
  const now = 3_000_000;
  const make = (key: string) => ({
    store, route: "test:iso", key, strategy: "token" as const,
    capacity: 1, refillPerSec: 1, nowFn: () => now,
  });
  assert.equal((await consumeBucket(make("a"))).allowed, true);
  assert.equal((await consumeBucket(make("b"))).allowed, true);
  assert.equal((await consumeBucket(make("a"))).allowed, false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --import tsx --test tests/rateLimitConsumeBucket.test.ts`
Expected: FAIL — `consumeBucket` is not exported.

- [ ] **Step 3: Write minimal implementation**

Append to the END of `lib/server/rateLimit.ts` (keep all existing code above unchanged):

```typescript
import { evaluateTokenBucket, type TokenBucketState } from "./rateLimit/tokenBucket.js";
import { evaluateLeakyBucket, type LeakyBucketState } from "./rateLimit/leakyBucket.js";
import type { BucketStore } from "./rateLimit/store.js";

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
      prev as TokenBucketState | null,
      { capacity: input.capacity, refillPerSec: rate },
      now,
    );
    const ttl = Math.ceil(input.capacity / rate) + 1;
    await input.store.set(storageKey, result.state as unknown as Record<string, number>, ttl);
    return { allowed: result.allowed, retryAfterSeconds: result.retryAfterSeconds };
  }

  const leak = input.leakPerSec ?? 1;
  const result = evaluateLeakyBucket(
    prev as LeakyBucketState | null,
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
```

> The existing `hashKey` function (defined at the top of `rateLimit.ts`) is reused — no new hash helper.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --import tsx --test tests/rateLimitConsumeBucket.test.ts`
Expected: PASS — 3 tests

- [ ] **Step 5: Typecheck + commit**

```bash
npm run typecheck
git add lib/server/rateLimit.ts tests/rateLimitConsumeBucket.test.ts
git commit -m "feat(ratelimit): add consumeBucket orchestrator over token/leaky strategies"
```

---

### Task 1.5: Wire `consumeBucket` into `/api/ai/search` + add dependency

**Files:**
- Modify: `package.json` (add `@upstash/redis`)
- Modify: `api/ai/search.ts:5,41` (add bucket guard alongside existing limiter)
- Test: `tests/aiSearchRateLimit.test.ts`

- [ ] **Step 1: Install dependency**

Run:
```bash
npm install @upstash/redis@^1.34.0
```
Expected: `package.json` + lockfile updated; `node_modules/@upstash/redis` present.

- [ ] **Step 2: Write the failing test**

```typescript
// tests/aiSearchRateLimit.test.ts
import assert from "node:assert/strict";
import test from "node:test";
import { consumeBucket } from "../lib/server/rateLimit.ts";
import { createInMemoryBucketStore } from "../lib/server/rateLimit/store.ts";

// Guards the burst policy AI search will enforce: 5 burst, 1/sec refill.
test("ai search burst policy: 5 immediate then throttle", async () => {
  const store = createInMemoryBucketStore();
  const now = 9_000_000;
  const cfg = {
    store, route: "ai:search", key: "ip:1.2.3.4", strategy: "token" as const,
    capacity: 5, refillPerSec: 1, nowFn: () => now,
  };
  for (let i = 0; i < 5; i++) {
    assert.equal((await consumeBucket(cfg)).allowed, true, `burst ${i}`);
  }
  const sixth = await consumeBucket(cfg);
  assert.equal(sixth.allowed, false);
  assert.ok(sixth.retryAfterSeconds >= 1);
});
```

- [ ] **Step 3: Run test to verify it passes (policy is already implemented by consumeBucket)**

Run: `node --import tsx --test tests/aiSearchRateLimit.test.ts`
Expected: PASS — 1 test. (This test locks the policy contract before wiring.)

- [ ] **Step 4: Wire into the handler**

In `api/ai/search.ts`, add the import near line 5:

```typescript
import { consumeBucket, resolveBucketStore } from "../../lib/server/rateLimit.js";
```

Then, immediately after the existing `consumeRateLimit` IP check inside the handler, add the burst guard (place it right after the IP is resolved via `extractRateLimitIp`):

```typescript
    const burstStore = await resolveBucketStore();
    const burst = await consumeBucket({
      store: burstStore,
      route: "ai:search",
      key: ip ?? "anon",
      strategy: "token",
      capacity: 5,
      refillPerSec: 1,
    });
    if (!burst.allowed) {
      return errorResponse("Too many requests, slow down", 429, { code: "rate_limited" });
    }
```

> Keep the existing `consumeRateLimit` window check — the token bucket adds burst smoothing on top of the fixed quota. `errorResponse` is already imported in this file.

- [ ] **Step 5: Verify build + full suite**

Run:
```bash
npm run typecheck && node --import tsx --test tests/aiSearchRateLimit.test.ts
```
Expected: typecheck clean, test PASS.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json api/ai/search.ts tests/aiSearchRateLimit.test.ts
git commit -m "feat(ratelimit): add Redis-backed token-bucket burst guard to ai/search"
```

> **CAP note for the implementer:** the in-memory store is per-instance (AP, no cross-instance consistency); Upstash Redis makes the limiter globally consistent (CP-leaning) at the cost of a network hop. This tradeoff is the practical CAP-theorem lesson — document which mode prod runs in.

---

# Phase 2 — Generalized Idempotency

### Task 2.1: Migration for generic idempotency table

**Files:**
- Create: `supabase/migrations/20260601_api_idempotency_keys.sql`

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/20260601_api_idempotency_keys.sql
CREATE TABLE IF NOT EXISTS api_idempotency_keys (
  scope            TEXT        NOT NULL,
  user_id          TEXT        NOT NULL,
  idempotency_key  TEXT        NOT NULL,
  request_hash     TEXT        NOT NULL,
  response_json    JSONB,
  response_status  INTEGER     NOT NULL DEFAULT 200,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (scope, user_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_api_idempotency_created_at
  ON api_idempotency_keys (created_at);
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/20260601_api_idempotency_keys.sql
git commit -m "feat(idempotency): add api_idempotency_keys table migration"
```

> Apply against the database out-of-band (same process used for prior `supabase/migrations/*.sql`). The code in Task 2.2 degrades gracefully if the table is absent only insofar as queries will error — apply the migration before deploying Task 2.3.

---

### Task 2.2: Generic idempotency module

**Files:**
- Create: `lib/server/idempotencyGeneric.ts`
- Test: `tests/idempotencyGeneric.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/idempotencyGeneric.test.ts
import assert from "node:assert/strict";
import test from "node:test";
import { resolveIdempotency, type IdempotencyStore } from "../lib/server/idempotencyGeneric.ts";

function fakeStore(): IdempotencyStore & { rows: Map<string, { requestHash: string; responseJson: unknown; responseStatus: number } | { requestHash: string; responseJson: null; responseStatus: 0 }> } {
  const rows = new Map<string, { requestHash: string; responseJson: unknown; responseStatus: number }>();
  return {
    rows,
    async find(scope, userId, key) {
      return rows.get(`${scope}:${userId}:${key}`) ?? null;
    },
    async insert(scope, userId, key, requestHash) {
      rows.set(`${scope}:${userId}:${key}`, { requestHash, responseJson: null, responseStatus: 0 });
    },
    async complete(scope, userId, key, responseJson, responseStatus) {
      rows.set(`${scope}:${userId}:${key}`, { requestHash: rows.get(`${scope}:${userId}:${key}`)!.requestHash, responseJson, responseStatus });
    },
  };
}

test("first call reserves the key", async () => {
  const store = fakeStore();
  const r = await resolveIdempotency(store, { scope: "user:put", userId: "u1", idempotencyKey: "k", requestHash: "h1" });
  assert.equal(r.status, "reserved");
});

test("replay returns stored response", async () => {
  const store = fakeStore();
  await resolveIdempotency(store, { scope: "user:put", userId: "u1", idempotencyKey: "k", requestHash: "h1" });
  await store.complete("user:put", "u1", "k", { ok: true }, 200);
  const r = await resolveIdempotency(store, { scope: "user:put", userId: "u1", idempotencyKey: "k", requestHash: "h1" });
  assert.equal(r.status, "replay");
  if (r.status === "replay") {
    assert.deepEqual(r.responseJson, { ok: true });
    assert.equal(r.responseStatus, 200);
  }
});

test("same key with different body is a conflict", async () => {
  const store = fakeStore();
  await resolveIdempotency(store, { scope: "user:put", userId: "u1", idempotencyKey: "k", requestHash: "h1" });
  const r = await resolveIdempotency(store, { scope: "user:put", userId: "u1", idempotencyKey: "k", requestHash: "DIFFERENT" });
  assert.equal(r.status, "conflict");
});

test("reserved-but-incomplete replay returns reserved", async () => {
  const store = fakeStore();
  await resolveIdempotency(store, { scope: "user:put", userId: "u1", idempotencyKey: "k", requestHash: "h1" });
  const r = await resolveIdempotency(store, { scope: "user:put", userId: "u1", idempotencyKey: "k", requestHash: "h1" });
  assert.equal(r.status, "reserved");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --import tsx --test tests/idempotencyGeneric.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```typescript
// lib/server/idempotencyGeneric.ts
import { createHash } from "node:crypto";
import { query } from "./db.js";

function stableSort(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableSort);
  if (!value || typeof value !== "object") return value;
  const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b));
  return Object.fromEntries(entries.map(([key, entry]) => [key, stableSort(entry)]));
}

export function hashRequestPayload(payload: unknown): string {
  return createHash("sha256").update(JSON.stringify(stableSort(payload))).digest("hex");
}

interface StoredRow {
  requestHash: string;
  responseJson: unknown;
  responseStatus: number;
}

export interface IdempotencyStore {
  find(scope: string, userId: string, key: string): Promise<StoredRow | null>;
  insert(scope: string, userId: string, key: string, requestHash: string): Promise<void>;
  complete(scope: string, userId: string, key: string, responseJson: unknown, responseStatus: number): Promise<void>;
}

export type IdempotencyResult =
  | { status: "reserved" }
  | { status: "replay"; responseJson: unknown; responseStatus: number }
  | { status: "conflict" };

export async function resolveIdempotency(
  store: IdempotencyStore,
  input: { scope: string; userId: string; idempotencyKey: string; requestHash: string },
): Promise<IdempotencyResult> {
  const existing = await store.find(input.scope, input.userId, input.idempotencyKey);
  if (existing) {
    if (existing.requestHash !== input.requestHash) return { status: "conflict" };
    if (existing.responseStatus === 0) return { status: "reserved" };
    return { status: "replay", responseJson: existing.responseJson, responseStatus: existing.responseStatus };
  }
  await store.insert(input.scope, input.userId, input.idempotencyKey, input.requestHash);
  return { status: "reserved" };
}

/** Postgres-backed store over api_idempotency_keys. */
export const postgresIdempotencyStore: IdempotencyStore = {
  async find(scope, userId, key) {
    const res = await query<{ request_hash: string; response_json: unknown; response_status: number }>(
      `SELECT request_hash, response_json, response_status
       FROM api_idempotency_keys
       WHERE scope = $1 AND user_id = $2 AND idempotency_key = $3
       LIMIT 1`,
      [scope, userId, key],
    );
    const row = res.rows[0];
    if (!row) return null;
    return { requestHash: row.request_hash, responseJson: row.response_json, responseStatus: Number(row.response_status ?? 0) };
  },
  async insert(scope, userId, key, requestHash) {
    await query(
      `INSERT INTO api_idempotency_keys (scope, user_id, idempotency_key, request_hash, response_status)
       VALUES ($1, $2, $3, $4, 0)
       ON CONFLICT (scope, user_id, idempotency_key) DO NOTHING`,
      [scope, userId, key, requestHash],
    );
  },
  async complete(scope, userId, key, responseJson, responseStatus) {
    await query(
      `UPDATE api_idempotency_keys
       SET response_json = $4::jsonb, response_status = $5, last_seen_at = NOW()
       WHERE scope = $1 AND user_id = $2 AND idempotency_key = $3`,
      [scope, userId, key, JSON.stringify(responseJson ?? null), responseStatus],
    );
  },
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --import tsx --test tests/idempotencyGeneric.test.ts`
Expected: PASS — 4 tests

- [ ] **Step 5: Commit**

```bash
git add lib/server/idempotencyGeneric.ts tests/idempotencyGeneric.test.ts
git commit -m "feat(idempotency): add generic scoped idempotency resolver + postgres store"
```

---

### Task 2.3: Wire idempotency into `/api/user` PUT

**Files:**
- Modify: `api/user/index.ts:306` (PUT handler)
- Test: `tests/userPutIdempotency.test.ts`

- [ ] **Step 1: Write the failing test (pure resolver contract for user:put scope)**

```typescript
// tests/userPutIdempotency.test.ts
import assert from "node:assert/strict";
import test from "node:test";
import { hashRequestPayload, resolveIdempotency, type IdempotencyStore } from "../lib/server/idempotencyGeneric.ts";

function memStore(): IdempotencyStore {
  const rows = new Map<string, { requestHash: string; responseJson: unknown; responseStatus: number }>();
  return {
    async find(s, u, k) { return rows.get(`${s}:${u}:${k}`) ?? null; },
    async insert(s, u, k, h) { rows.set(`${s}:${u}:${k}`, { requestHash: h, responseJson: null, responseStatus: 0 }); },
    async complete(s, u, k, j, st) { rows.set(`${s}:${u}:${k}`, { requestHash: rows.get(`${s}:${u}:${k}`)!.requestHash, responseJson: j, responseStatus: st }); },
  };
}

test("duplicate user PUT with same key+body replays the first response", async () => {
  const store = memStore();
  const body = { occupation: "vendor" };
  const hash = hashRequestPayload(body);
  const first = await resolveIdempotency(store, { scope: "user:put", userId: "u9", idempotencyKey: "abc", requestHash: hash });
  assert.equal(first.status, "reserved");
  await store.complete("user:put", "u9", "abc", { occupation: "vendor", saved: true }, 200);

  const second = await resolveIdempotency(store, { scope: "user:put", userId: "u9", idempotencyKey: "abc", requestHash: hash });
  assert.equal(second.status, "replay");
});
```

- [ ] **Step 2: Run test to verify it passes (resolver already implemented)**

Run: `node --import tsx --test tests/userPutIdempotency.test.ts`
Expected: PASS — 1 test (locks the contract before wiring the handler).

- [ ] **Step 3: Wire the handler**

In `api/user/index.ts`, add the import alongside other server imports near the top:

```typescript
import { hashRequestPayload, postgresIdempotencyStore, resolveIdempotency } from "../../lib/server/idempotencyGeneric.js";
```

Replace the body of `PUT` (starting at `api/user/index.ts:306`) so the idempotency check wraps the mutation. The new handler reads the `Idempotency-Key` header; when absent it behaves exactly as today.

```typescript
export async function PUT(request: Request): Promise<Response> {
  const auth = await requireUser(request);
  if (!auth) return errorResponse("Unauthorized", 401);

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return errorResponse("Invalid JSON body", 400);
  }

  const validation = userUpdateSchema.safeParse(rawBody);
  if (!validation.success) {
    return errorResponse(validation.error.issues[0]?.message ?? "Invalid request body", 400);
  }
  const body = validation.data;

  const idempotencyKey = request.headers.get("Idempotency-Key")?.trim() || null;
  if (idempotencyKey) {
    const requestHash = hashRequestPayload(body);
    const decision = await resolveIdempotency(postgresIdempotencyStore, {
      scope: "user:put",
      userId: auth.id,
      idempotencyKey,
      requestHash,
    });
    if (decision.status === "conflict") {
      return errorResponse("Idempotency-Key reused with a different body", 409, { code: "idempotency_conflict" });
    }
    if (decision.status === "replay") {
      return jsonResponse(decision.responseJson, { status: decision.responseStatus });
    }
  }

  try {
    const profile = await getUserProfile(auth.id);
    if (!profile) return errorResponse("Profile not found", 404);

    if (body?.occupation !== undefined) {
      if (typeof body.occupation !== "string") return errorResponse("Invalid occupation", 400);
      const normalized = body.occupation.trim();
      if (normalized.length > 120) return errorResponse("Occupation exceeds maximum length", 400);
      profile.occupation = normalized;
    }

    if (body?.mapScope !== undefined) {
      const nextScope = normalizeMapScope(body.mapScope);
      if (!nextScope) return errorResponse("Invalid mapScope", 400);
      if (!profile.isAdmin && nextScope !== "bonamoussadi") {
        return errorResponse("Only admin users can unlock map scope", 403);
      }
      profile.mapScope = nextScope;
    }

    if (body?.avatarPreset !== undefined) {
      profile.avatarPreset = body.avatarPreset;
      profile.image = encodeAvatarPresetImage(body.avatarPreset);
    }

    await upsertUserProfile(auth.id, profile);
    const sanitized = sanitizeProfile(profile);

    if (idempotencyKey) {
      await postgresIdempotencyStore.complete("user:put", auth.id, idempotencyKey, sanitized, 200);
    }
    return jsonResponse(sanitized, { status: 200 });
  } catch (error) {
    if (isStorageUnavailableError(error)) {
      return errorResponse("Storage service temporarily unavailable", 503, { code: "storage_unavailable" });
    }
    throw error;
  }
}
```

> All referenced helpers (`requireUser`, `userUpdateSchema`, `getUserProfile`, `normalizeMapScope`, `encodeAvatarPresetImage`, `upsertUserProfile`, `sanitizeProfile`, `isStorageUnavailableError`, `errorResponse`, `jsonResponse`) are already imported in `api/user/index.ts` — no new imports beyond the idempotency line.

- [ ] **Step 4: Typecheck + full suite**

Run:
```bash
npm run typecheck && node --import tsx --test tests/userPutIdempotency.test.ts
```
Expected: typecheck clean, test PASS.

- [ ] **Step 5: Commit**

```bash
git add api/user/index.ts tests/userPutIdempotency.test.ts
git commit -m "feat(idempotency): honor Idempotency-Key header on /api/user PUT"
```

---

# Phase 3 — Optimistic Preloading (Frontend)

### Task 3.1: Prefetch cache module

**Files:**
- Create: `lib/client/prefetch.ts`
- Test: `tests/prefetch.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/prefetch.test.ts
import assert from "node:assert/strict";
import test from "node:test";
import { createPrefetchCache } from "../lib/client/prefetch.ts";

test("prefetch stores and serves a fetched value once", async () => {
  let calls = 0;
  const cache = createPrefetchCache<{ id: string }>({ ttlMs: 10_000, nowFn: () => 1000 });
  const fetcher = async (id: string) => { calls++; return { id }; };

  cache.prefetch("p1", fetcher);
  await cache.prefetch("p1", fetcher); // de-dupes in-flight
  const value = await cache.take("p1");
  assert.deepEqual(value, { id: "p1" });
  assert.equal(calls, 1);
});

test("take returns null for unknown id", async () => {
  const cache = createPrefetchCache<{ id: string }>({ ttlMs: 10_000 });
  assert.equal(await cache.take("missing"), null);
});

test("expired prefetch is discarded", async () => {
  let clock = 1000;
  const cache = createPrefetchCache<{ id: string }>({ ttlMs: 1000, nowFn: () => clock });
  await cache.prefetch("p2", async (id) => ({ id }));
  clock += 2000;
  assert.equal(await cache.take("p2"), null);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --import tsx --test tests/prefetch.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```typescript
// lib/client/prefetch.ts
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
      // Swallow rejection here; consumers surface errors when they re-fetch.
      void promise.catch(() => undefined);
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --import tsx --test tests/prefetch.test.ts`
Expected: PASS — 3 tests

- [ ] **Step 5: Commit**

```bash
git add lib/client/prefetch.ts tests/prefetch.test.ts
git commit -m "feat(prefetch): add client-side optimistic prefetch cache"
```

---

### Task 3.2: Singleton point-prefetch helper

**Files:**
- Create: `lib/client/pointPrefetch.ts`
- Test: `tests/pointPrefetch.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/pointPrefetch.test.ts
import assert from "node:assert/strict";
import test from "node:test";
import { __resetPointPrefetchForTest, prefetchPoint, takePrefetchedPoint } from "../lib/client/pointPrefetch.ts";

test("prefetchPoint then takePrefetchedPoint returns the value", async () => {
  __resetPointPrefetchForTest();
  let calls = 0;
  const fetcher = async (id: string) => { calls++; return { id, name: "Pharmacie" }; };
  prefetchPoint("pt-1", fetcher);
  const value = await takePrefetchedPoint<{ id: string; name: string }>("pt-1");
  assert.deepEqual(value, { id: "pt-1", name: "Pharmacie" });
  assert.equal(calls, 1);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --import tsx --test tests/pointPrefetch.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```typescript
// lib/client/pointPrefetch.ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --import tsx --test tests/pointPrefetch.test.ts`
Expected: PASS — 1 test

- [ ] **Step 5: Commit**

```bash
git add lib/client/pointPrefetch.ts tests/pointPrefetch.test.ts
git commit -m "feat(prefetch): add singleton point prefetch helper"
```

---

### Task 3.3: Trigger prefetch on map-marker intent

**Files:**
- Modify: `components/Screens/HomeMap.tsx` (marker event handlers)
- Modify: `components/Screens/Details.tsx` (consume prefetched point)

> No new test file — this is wiring of already-tested units. Verify via typecheck + build. Do NOT introduce a UI test harness in this plan.

- [ ] **Step 1: Read the current marker render in HomeMap**

Run: `grep -n "Marker\|onClick\|eventHandlers\|navigateTo\|onSelect" components/Screens/HomeMap.tsx`
Expected: locate the `<Marker>` (react-leaflet) and its existing click/select handler that calls into the parent.

- [ ] **Step 2: Add the prefetch import to HomeMap**

At the top of `components/Screens/HomeMap.tsx`, with the other `lib/client` imports:

```typescript
import { prefetchPoint } from "@/lib/client/pointPrefetch";
import { apiJson } from "@/lib/client/api";
```

> If `apiJson` is already imported in this file, do not duplicate the import — add only `prefetchPoint`.

- [ ] **Step 3: Wire `mouseover` / `click` on the marker to prefetch**

On the `<Marker>` element, extend `eventHandlers` so hovering or pressing a marker warms the detail fetch. Use the point's id and the same endpoint `Details.tsx` uses (`/api/submissions/:id`):

```tsx
        eventHandlers={{
          mouseover: () => prefetchPoint(point.id, (id) => apiJson(`/api/submissions/${id}`)),
          click: () => {
            prefetchPoint(point.id, (id) => apiJson(`/api/submissions/${id}`));
            onSelectPoint(point); // existing handler — keep its real name from Step 1
          },
        }}
```

> Replace `onSelectPoint(point)` with whatever handler name Step 1 revealed. `point.id` is the `ProjectedPoint`/`PointEvent` id already rendered by the marker loop.

- [ ] **Step 4: Consume the prefetched value in Details**

Run: `grep -n "apiJson\|useEffect\|/api/submissions" components/Screens/Details.tsx`
Locate the effect that fetches the detail. Add the import:

```typescript
import { takePrefetchedPoint } from "@/lib/client/pointPrefetch";
```

In the detail-loading effect, check the prefetch cache before the network call:

```typescript
    let cancelled = false;
    (async () => {
      const warmed = await takePrefetchedPoint<typeof detailState>(point.id);
      if (warmed && !cancelled) {
        setDetailState(warmed);
        return; // served optimistically — skip the network round-trip
      }
      const fresh = await apiJson(`/api/submissions/${point.id}`);
      if (!cancelled) setDetailState(fresh);
    })();
    return () => { cancelled = true; };
```

> Adapt `detailState` / `setDetailState` / `point.id` to the actual state names in `Details.tsx` found in Step 4's grep. The shape returned by `apiJson` must match what `prefetchPoint` stored — both call `/api/submissions/:id`, so they align.

- [ ] **Step 5: Typecheck + build**

Run:
```bash
npm run typecheck && npm run build
```
Expected: clean typecheck, successful Vite build.

- [ ] **Step 6: Commit**

```bash
git add components/Screens/HomeMap.tsx components/Screens/Details.tsx
git commit -m "feat(prefetch): warm point detail on marker intent, serve optimistically in Details"
```

---

# Phase 4 — CDN Cache Headers

### Task 4.1: `cachedJsonResponse` + ETag helper

**Files:**
- Modify: `lib/server/http.ts`
- Test: `tests/httpCache.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/httpCache.test.ts
import assert from "node:assert/strict";
import test from "node:test";
import { cachedJsonResponse, computeWeakEtag } from "../lib/server/http.ts";

test("sets public CDN cache-control with s-maxage and stale-while-revalidate", () => {
  const res = cachedJsonResponse({ ok: true }, { sMaxAge: 300, staleWhileRevalidate: 600 });
  assert.equal(
    res.headers.get("cache-control"),
    "public, s-maxage=300, stale-while-revalidate=600",
  );
});

test("emits a weak ETag and returns 304 when If-None-Match matches", () => {
  const body = { value: 42 };
  const etag = computeWeakEtag(body);
  const res = cachedJsonResponse(body, { sMaxAge: 60, etag, ifNoneMatch: etag });
  assert.equal(res.status, 304);
  assert.equal(res.headers.get("etag"), etag);
});

test("returns 200 with body when If-None-Match differs", async () => {
  const body = { value: 42 };
  const etag = computeWeakEtag(body);
  const res = cachedJsonResponse(body, { sMaxAge: 60, etag, ifNoneMatch: '"stale"' });
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), body);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --import tsx --test tests/httpCache.test.ts`
Expected: FAIL — `cachedJsonResponse` / `computeWeakEtag` not exported.

- [ ] **Step 3: Add to `lib/server/http.ts` (append; keep existing exports)**

```typescript
import { createHash } from "node:crypto";

export function computeWeakEtag(body: unknown): string {
  const digest = createHash("sha256").update(JSON.stringify(body)).digest("hex").slice(0, 32);
  return `W/"${digest}"`;
}

export interface CachedJsonOptions {
  sMaxAge: number;
  staleWhileRevalidate?: number;
  etag?: string;
  ifNoneMatch?: string | null;
  status?: number;
}

export function cachedJsonResponse(body: unknown, options: CachedJsonOptions): Response {
  const parts = [`public`, `s-maxage=${options.sMaxAge}`];
  if (options.staleWhileRevalidate !== undefined) {
    parts.push(`stale-while-revalidate=${options.staleWhileRevalidate}`);
  }
  const headers = new Headers({ "cache-control": parts.join(", ") });
  if (options.etag) headers.set("etag", options.etag);

  if (options.etag && options.ifNoneMatch && options.ifNoneMatch === options.etag) {
    return new Response(null, { status: 304, headers });
  }

  headers.set("content-type", "application/json");
  return new Response(JSON.stringify(body), { status: options.status ?? 200, headers });
}
```

> Reuses the existing module style (`Headers`, `Response`). Does not modify `jsonResponse` / `errorResponse`.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --import tsx --test tests/httpCache.test.ts`
Expected: PASS — 3 tests

- [ ] **Step 5: Commit**

```bash
git add lib/server/http.ts tests/httpCache.test.ts
git commit -m "feat(cdn): add cachedJsonResponse with CDN headers + weak ETag 304 support"
```

---

### Task 4.2: Apply CDN headers + ETag to `/api/analytics`

**Files:**
- Modify: `api/analytics/index.ts`

> The analytics route is currently served with `Cache-Control: public, s-maxage=300, stale-while-revalidate=600` set in `vercel.json:125`. This task moves that into the handler so it can add a content-aware ETag (enabling 304 short-circuits), which the static header cannot do.

- [ ] **Step 1: Locate the analytics success response**

Run: `grep -n "jsonResponse\|return \|cache-control\|view ===" api/analytics/index.ts`
Identify the GET success path that returns the snapshot stats payload (the non-`campaign_drain` branch).

- [ ] **Step 2: Import the helpers**

At the top of `api/analytics/index.ts`, extend the existing http import:

```typescript
import { cachedJsonResponse, computeWeakEtag, errorResponse, jsonResponse } from "../../lib/server/http.js";
```

> Keep `jsonResponse`/`errorResponse` — they remain used by the `campaign_drain` and error branches. Add only the two new names.

- [ ] **Step 3: Replace the snapshot success return**

Where the handler currently returns the analytics payload via `jsonResponse(payload)` (the cached stats branch only — NOT `campaign_drain`, NOT error paths), replace with:

```typescript
    const etag = computeWeakEtag(payload);
    return cachedJsonResponse(payload, {
      sMaxAge: 300,
      staleWhileRevalidate: 600,
      etag,
      ifNoneMatch: request.headers.get("If-None-Match"),
    });
```

> `payload` is the existing analytics response object — keep its real variable name from Step 1. `request` is the handler's `Request` argument.

- [ ] **Step 4: Typecheck + full suite**

Run:
```bash
npm run typecheck && npm test
```
Expected: typecheck clean; all tests pass (new + existing).

- [ ] **Step 5: Commit**

```bash
git add api/analytics/index.ts
git commit -m "feat(cdn): serve analytics with handler-level CDN headers + ETag 304"
```

---

## Final Verification (all phases)

- [ ] **Run the full CI gate**

Run:
```bash
npm run test:ci
```
Expected: lint clean, typecheck clean, all tests pass, publisher tests pass, build succeeds.

- [ ] **Push**

```bash
git pull --rebase
git push
git status   # MUST show "up to date with origin"
```

---

## Self-Review Notes (author checklist — already applied)

- **Spec coverage:** Phase 1 → #4 Redis, #8 leaky, #9 token (+ CAP note). Phase 2 → #1 idempotency. Phase 3 → #5 optimistic preloading. Phase 4 → #10 CDN. Concepts #2 (system design), #3 (SQL order), #6 (ngrok), #7 (CAP) are learn-by-reading / dev-workflow — intentionally not code tasks (see plan intro and the CAP note in Task 1.5).
- **Type consistency:** `evaluateTokenBucket`/`evaluateLeakyBucket` signatures match their `consumeBucket` callers; `IdempotencyStore` interface identical across module + tests; `cachedJsonResponse`/`computeWeakEtag` names consistent between Phase 4 tasks; `prefetchPoint`/`takePrefetchedPoint` consistent across 3.2 → 3.3.
- **No placeholders:** every code step contains complete, runnable code. The three UI wiring steps (3.3, 4.2) name the exact grep to find the real local variable, because those identifiers live in files not fully reproduced here — adapt-in-place is explicit, not a TODO.
