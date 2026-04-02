# ADL Multi-Agent Modernization Master Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Dispatch parallel subagents for independent sub-projects within each phase.

**Goal:** Transform ADL from fragmented primitives into one coherent operations-grade field mission system — secure, gamified, reliable, and production-ready.

**Architecture:** 6 phases, 23 sub-projects, ~120 tasks. Security gates all other work. Each sub-project is independently deployable via PR. Phases 0-1 serial; Phases 2-5 can parallelize after gates pass.

**Tech Stack:** React 19, TypeScript, Vite, Tailwind CSS 3, Vitest + React Testing Library (new), PostgreSQL (Supabase), Vercel serverless, Auth.js v5

**Decisions locked:**
- Test framework: Vitest + Testing Library for component tests
- Mission system: Code-defined templates in `shared/missions.ts`, lightweight DB for progress only
- Execution: Subagent-driven development with parallel agents per independent sub-project

**April 2, 2026 execution adjustment:**
- Do not implement this plan as one uninterrupted phase march.
- Start with a reconciliation PR that compares the plan to the current repo state.
- Several security items from Phase 0 are already partially implemented in the repo and should be verified before rework.
- All new gamification or schema-backed product work should ship behind feature flags until verified on preview and production.

---

## Context

ADL is a field-data collection platform for Cameroonian agents. It has strong primitives (offline queue, XP, badges, streaks, trust, fraud detection, admin review, delta analytics) but they are fragmented across screens with no unified motivation system. Security audit found CRITICAL issues (admin single-point-of-failure, user enumeration, photo URL injection). The goal is to unify gamification into a mission-driven progression system while hardening security, improving reliability, and achieving production readiness.

**What this plan does NOT do:**
- Rewrite the app from scratch (incremental improvement)
- Add new verticals (7 existing verticals are sufficient)
- Build a mobile native app (PWA improvements only)
- Implement dark mode (documented as future goal)

---

## Safe Execution Policy

If the goal is to improve the app without breaking the current production flow, follow these rules for every sub-project:

1. One deployable PR at a time
   - no cross-phase mega-branches
   - every PR must be safe to deploy independently

2. Additive first, destructive later
   - add new tables, APIs, components, and flags before replacing old paths
   - do not rename or remove working paths in the same PR that introduces a new implementation

3. Flag all new product behavior
   - recommended env flags:
     - `ENABLE_MISSIONS`
     - `ENABLE_NEXT_ACTION`
     - `ENABLE_QUALITY_WEIGHTED_LEADERBOARD`
     - `ENABLE_REWARDS_BACKEND`
   - default all of them to `false`

4. Schema changes must fail closed
   - if a new feature depends on a new table, keep the feature disabled until the migration is applied
   - no route should crash because a new migration has not been run yet

5. Vercel and Supabase are separate rollout steps
   - deploy app code
   - run `npm run migrate:dry`
   - run `npm run migrate` when needed
   - only then enable the related feature flag

6. Delay risky refactors
   - do not start Phase 3 decomposition work until Phase 2 features are stable behind flags and test coverage has improved

7. Preserve current behavior while validating new behavior
   - keep current Home, Profile, Analytics, and ContributionFlow behavior working until the replacement path is verified in preview

---

## Current Repo Reconciliation (April 2, 2026)

Before executing any checklist below, reconcile the plan against the repository as it exists now.

### Already present in the repo

- public projected submission reads are sanitized via `lib/server/privacy.ts` and `api/submissions/index.ts`
- legacy `PUT /api/submissions/:id` already returns `405`
- registration already uses `createRegisterHandler(...)`
- AI search and registration already use `extractRateLimitIp(...)`
- the public-table RLS migration already exists at `supabase/migrations/20260401_enable_public_rls.sql`

### PR0 status matrix

| Sub-project | Current status | PR0 action |
|---|---|---|
| `0A` Admin auth hardening | `pending` | keep as real implementation work |
| `0B` User enumeration fix | `pending` | registration still returns `409`; keep as real implementation work |
| `0C` Photo URL injection regression test | `partial` | endpoint is already disabled, but regression test is still missing |
| `0D` Offline queue integrity hash | `pending` | no queue integrity hash present yet |
| `0E` AI search rate limit | `landed` | convert to verification + coverage only |
| `0F` Submission mutation path audit | `partial` | admin-only gates and `PUT=405` are in place; DELETE audit logging still needs verification/addition |
| `1D` RLS documentation and verification | `partial` | migration exists; documentation and verification steps still needed |

### Evidence snapshot for PR0

- `api/auth/register.ts` still returns `409` for existing identifiers
- `tests/registerApi.test.ts` currently asserts the `409` behavior
- `api/ai/search.ts` already contains per-user and per-IP rate limiting
- `tests/aiSearchApi.test.ts` already contains `429` coverage
- `api/submissions/[id].ts` already enforces admin-only `PATCH` and `DELETE`, and `PUT` returns `405`
- `api/submissions/[id].ts` review decisions are logged, but delete operations are not yet logged
- `supabase/migrations/20260401_enable_public_rls.sql` already exists

### Therefore, treat these as verify-or-extend work, not blind reimplementation

- Sub-project `0B` user enumeration fix
- Sub-project `0C` photo URL injection regression test
- Sub-project `0E` AI search rate limiting
- Sub-project `1D` RLS documentation and verification

### Reconciliation PR required first

Create a first PR that does only this:

- mark already-landed work in this document as verified, partial, or still pending
- correct any stale assumptions in Phase 0
- add missing regression tests for already-fixed paths
- do not introduce new UX or mission behavior in this PR

### PR0 deliverables

PR0 should result in:

1. this plan updated with the current repo status
2. stale Phase 0 assumptions corrected
3. missing regression tests queued or implemented for already-landed security fixes
4. no schema changes
5. no new gamification behavior
6. no refactors outside documentation and regression coverage

This reconciliation PR is the real starting point for safe implementation.

---

## PHASE 0: Security Hardening

**Gate:** All CRITICAL/HIGH security issues closed. Zero regression in existing 29 tests.
**Deployment:** Each sub-project = 1 PR. No UX changes in this phase.

### Sub-project 0A: Admin Auth Hardening

**PR0 status:** still pending. No evidence yet that DB-backed multi-admin auth has replaced the env-var-first branch.
**PR1 outcome (April 2, 2026):** implemented locally and verified. Credentials auth is now DB-admin-first with env bootstrap fallback, and JWT claims now preserve DB-admin privileges. Coverage now explicitly includes locked-admin rejection, failed-login counter increments, fifth-failure account lockout, and pre-auth rate-limit rejection. Verification completed with `node --import tsx --test tests/adminAuth.test.ts` and `npm run test:ci`.

**Problem:** Single shared `ADMIN_EMAIL` + `ADMIN_PASSWORD` env var. Admin auth is a special branch before normal user lookup (handler.ts:107-131). No multi-admin support.

**Files:**
- Modify: `lib/server/auth/handler.ts:107-131`
- Modify: `tests/authConfig.test.ts`
- Create: `tests/adminAuth.test.ts`

- [ ] **Step 1: Write failing test — admin login via DB profile with role='admin'**

```typescript
// tests/adminAuth.test.ts
import { describe, it } from "node:test";
import assert from "node:assert/strict";

describe("admin auth from DB", () => {
  it("should authenticate admin user from user_profiles with role=admin", async () => {
    // Test: a user_profiles row with role='admin' and valid password_hash
    // should be able to login via credentials, even if their email !== ADMIN_EMAIL env var
    // This validates the DB-first lookup path
  });

  it("should still allow env-var bootstrap admin when no DB admin exists", async () => {
    // Test: ADMIN_EMAIL + ADMIN_PASSWORD env var login still works for initial setup
  });

  it("should prefer DB admin over env-var admin for same email", async () => {
    // Test: if email matches both DB admin and env var, DB wins
  });
});
```

Run: `node --import tsx --test tests/adminAuth.test.ts`
Expected: FAIL (functions not yet modified)

- [ ] **Step 2: Modify handler.ts — DB-first admin lookup**

Restructure `authorize()` in `handler.ts:107-131`:
```typescript
// 1. Always look up profile from DB first
const profile = await getUserProfile(identifier);

// 2. If profile exists with role='admin', authenticate against DB password
if (profile?.role === 'admin' && profile.passwordHash) {
  const match = await bcrypt.compare(password, profile.passwordHash);
  if (match) {
    await logSecurityEvent({ eventType: "login_success", userId: profile.id, request, details: { method: "credentials_admin_db" } });
    return { id: profile.id, name: profile.name ?? "Admin", email: identifier };
  }
  // Fall through to lockout logic below
}

// 3. Env-var bootstrap fallback (only if no DB admin matched)
if (!profile?.role || profile.role !== 'admin') {
  const adminEmail = normalizeEmail(process.env.ADMIN_EMAIL);
  const adminPassword = process.env.ADMIN_PASSWORD ?? "";
  if (adminEmail && adminPassword && identifier === adminEmail) {
    if (!isBcryptHash(adminPassword)) {
      logWarn("auth.admin_password_invalid_format", { userId: identifier });
      return null;
    }
    const adminMatch = await bcrypt.compare(password, adminPassword);
    if (adminMatch) {
      await logSecurityEvent({ eventType: "login_success", userId: identifier, request, details: { method: "credentials_admin_env_bootstrap" } });
      return { id: identifier, name: "Admin", email: identifier };
    }
  }
}

// 4. Normal user auth flow continues (existing code from line 133+)
```

- [ ] **Step 3: Run tests to verify pass**

Run: `node --import tsx --test tests/adminAuth.test.ts`
Expected: PASS

- [ ] **Step 4: Run full suite**

Run: `npm run test:ci`
Expected: All 29+ tests pass, typecheck passes, build passes

- [ ] **Step 5: Commit**

```bash
git add lib/server/auth/handler.ts tests/adminAuth.test.ts
git commit -m "feat(auth): support multi-admin via DB role lookup with env-var bootstrap fallback"
```

---

### Sub-project 0B: User Enumeration Fix

**April 2 note:** The repo already contains a refactored `createRegisterHandler(...)` path and associated tests. Start by verifying whether duplicate registration still leaks account existence. If the behavior is already fixed, convert this sub-project into regression coverage + documentation instead of reimplementing the handler.

**PR0 outcome:** verified as still open. `api/auth/register.ts` still returns `409` on duplicate identifiers, so this remains real implementation work for the next PR.

**Problem:** Registration returns 409 revealing account existence (register.ts:82-85).

**Files:**
- Modify: `api/auth/register.ts:82-85`
- Modify: `tests/registerApi.test.ts`

- [ ] **Step 1: Write failing test — duplicate registration returns 201 not 409**

```typescript
// In tests/registerApi.test.ts, add:
it("should return 201 for duplicate registration (not 409)", async () => {
  // Mock getUserProfile to return an existing user
  // Call register handler
  // Assert: status 201, body { ok: true }
  // Assert: no new profile created
});
```

Run: `node --import tsx --test tests/registerApi.test.ts`
Expected: FAIL (still returns `409` today; update the test in the implementation PR)

- [ ] **Step 2: Modify register.ts — silent 201 for duplicates**

```typescript
// register.ts:82-85, change:
if (existing) {
  await logSecurityEvent({
    eventType: "registration_duplicate",
    userId: normalizedIdentifier.value,
    request,
    details: { identifier: normalizedIdentifier.value },
  });
  return jsonResponse({ ok: true }, { status: 201 });
}
```

- [ ] **Step 3: Verify tests pass**

Run: `node --import tsx --test tests/registerApi.test.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add api/auth/register.ts tests/registerApi.test.ts
git commit -m "fix(auth): prevent user enumeration via registration endpoint"
```

---

### Sub-project 0C: Photo URL Injection Regression Test

**April 2 note:** `PUT /api/submissions/:id` is already disabled. This sub-project should stay test-focused unless the submission schema or POST flow still accepts unsafe fields.

**PR0 outcome:** partial. Underlying behavior looks safe enough to keep test-only scope, but the dedicated regression test is still missing.

**Problem:** PUT on submissions/[id] was flagged but already returns 405. POST uses server-side upload. Need a regression test.

**Files:**
- Create: `tests/photoUrlInjection.test.ts`
- Verify: `lib/server/validation.ts` (submissionInputSchema uses .strict())

- [ ] **Step 1: Write regression test**

```typescript
// tests/photoUrlInjection.test.ts
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { submissionInputSchema } from "../lib/server/validation.js";

describe("photo URL injection prevention", () => {
  it("should reject photoUrl in submission body", () => {
    const result = submissionInputSchema.safeParse({
      category: "pharmacy",
      latitude: 4.05,
      longitude: 9.7,
      photoUrl: "https://evil.com/image.jpg",
      details: { name: "Test" },
    });
    assert.equal(result.success, false);
  });
});
```

Run: `node --import tsx --test tests/photoUrlInjection.test.ts`
Expected: PASS (schema already uses .strict())

- [ ] **Step 2: Commit**

```bash
git add tests/photoUrlInjection.test.ts
git commit -m "test(security): add regression test for photo URL injection prevention"
```

---

### Sub-project 0D: Offline Queue Integrity Hash

**Risk level:** medium-high. This changes offline queue semantics and request payload shape. Keep this isolated in its own PR and do not combine it with mission work.

**PR0 outcome:** still pending. No evidence of `payloadHash` or equivalent queue attestation exists in the current repo.

**Problem:** Client can modify GPS/photos in IndexedDB between capture and sync.

**Files:**
- Create: `shared/stableSort.ts` (extract from `lib/server/idempotency.ts`)
- Modify: `lib/client/offlineQueue.ts`
- Modify: `lib/server/idempotency.ts` (import from shared)
- Modify: `api/submissions/index.ts`
- Create: `tests/queueIntegrity.test.ts`

- [ ] **Step 1: Extract `stableSort` to shared module**

Extract `stableSort()` from `lib/server/idempotency.ts:4-9` to `shared/stableSort.ts`. Update idempotency.ts to import from shared.

- [ ] **Step 2: Write failing test — payload hash computed at enqueue time**

```typescript
// tests/queueIntegrity.test.ts
describe("queue payload integrity", () => {
  it("should compute SHA-256 hash of payload at enqueue time", () => {
    // Test: enqueueSubmission returns item with payloadHash field
    // Test: hash matches expected SHA-256 of JSON.stringify(stableSort(payload))
  });
});
```

Run: `node --import tsx --test tests/queueIntegrity.test.ts`
Expected: FAIL

- [ ] **Step 3: Add `payloadHash` to QueueItem in offlineQueue.ts**

In `offlineQueue.ts`, in the `QueueItem` interface (line 14-25), add:
```typescript
payloadHash?: string;
```

- [ ] **Step 4: Compute hash at enqueue time using Web Crypto API**

In `enqueueSubmission()`, before storing:
```typescript
const encoder = new TextEncoder();
const data = encoder.encode(JSON.stringify(stableSort(item.payload)));
const hashBuffer = await crypto.subtle.digest("SHA-256", data);
const hashArray = Array.from(new Uint8Array(hashBuffer));
item.payloadHash = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
```

- [ ] **Step 5: Include hash in sync request**

In `flushOfflineQueue()`, when calling `sendFn(payload)`, include `payloadHash` in the request body.

- [ ] **Step 6: Server-side verification in submissions POST**

In `api/submissions/index.ts`, after parsing body:
```typescript
if (body.payloadHash) {
  const serverHash = hashIdempotencyPayload(body);
  if (serverHash !== body.payloadHash) {
    // Don't block — add as fraud signal
    fraudFlags.push("payload_hash_mismatch");
  }
}
```

- [ ] **Step 7: Verify tests pass**

Run: `node --import tsx --test tests/queueIntegrity.test.ts`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add shared/stableSort.ts lib/client/offlineQueue.ts lib/server/idempotency.ts api/submissions/index.ts tests/queueIntegrity.test.ts
git commit -m "feat(security): add payload integrity hash to offline queue items"
```

---

### Sub-project 0E: Rate Limit on AI Search

**April 2 note:** Start by verifying the current handler. The repository already includes rate-limit plumbing for AI search and registration. This sub-project may become a coverage/threshold-tuning PR rather than a net-new implementation PR.

**PR0 outcome:** landed for handler behavior, partial for plan hygiene. `api/ai/search.ts` already enforces both per-user and per-IP limits, and `tests/aiSearchApi.test.ts` already covers the `429` path. Do not reimplement this sub-project; only extend coverage if needed.

**Problem:** `api/ai/search.ts` may lack rate limiting (flagged in security doc).

**Files:**
- Verify: `api/ai/search.ts`
- Modify if needed: add rate limit
- Create: `tests/aiSearchRateLimit.test.ts`

- [ ] **Step 1: Read `api/ai/search.ts` and check for rate limiting**

- [ ] **Step 2: If missing, add per-user rate limit (10 requests/minute)**

```typescript
const rateCheck = await consumeRateLimit({
  key: `ai_search:${auth.id}`,
  limit: 10,
  windowSeconds: 60,
});
if (!rateCheck.allowed) {
  return errorResponse("Too many search requests", 429);
}
```

- [ ] **Step 3: Write test and verify**

Run: `node --import tsx --test tests/aiSearchRateLimit.test.ts`

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(security): add rate limiting to AI search endpoint"
```

---

### Sub-project 0F: Submission Mutation Path Audit

**PR0 outcome:** partial. The dangerous `PUT` path is already disabled, and `PATCH`/`DELETE` are admin-gated. The remaining work is targeted regression coverage plus delete-path audit logging.

**Problem:** submissions/[id].ts PATCH for review and DELETE for events — verify admin-only gates.

**Files:**
- Verify: `api/submissions/[id].ts`
- Create: `tests/submissionMutation.test.ts`

- [ ] **Step 1: Write test — non-admin cannot PATCH review or DELETE event**

- [ ] **Step 2: Verify existing code enforces admin role**

- [ ] **Step 3: Add audit logging if missing for DELETE operations**

- [ ] **Step 4: Commit**

---

## PHASE 1: Reliability & Testing Foundation

**Gate:** CI pipeline runs typecheck + lint + server tests + component tests + build. Component tests cover 3 critical screens.
**Dependency:** Phase 0 complete.

### Sub-project 1A: Vitest + Testing Library Setup

**Files:**
- Modify: `package.json` (add vitest, @testing-library/react, @testing-library/jest-dom, jsdom)
- Modify: `vite.config.ts` (add test config)
- Create: `tests/setup.ts`
- Create: `tests/components/.gitkeep`

- [ ] **Step 1: Install vitest and testing deps**

```bash
npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom
```

- [ ] **Step 2: Add vitest config to vite.config.ts**

```typescript
/// <reference types="vitest" />
export default defineConfig({
  // ...existing config...
  test: {
    environment: 'jsdom',
    setupFiles: ['tests/setup.ts'],
    include: ['tests/components/**/*.test.{ts,tsx}'],
    globals: true,
  },
});
```

- [ ] **Step 3: Create test setup file**

```typescript
// tests/setup.ts
import '@testing-library/jest-dom';

// Mock IndexedDB
const mockIDB = { open: () => ({ result: {} }) };
Object.defineProperty(globalThis, 'indexedDB', { value: mockIDB });

// Mock navigator.geolocation
Object.defineProperty(navigator, 'geolocation', {
  value: { getCurrentPosition: vi.fn(), watchPosition: vi.fn() },
});
```

- [ ] **Step 4: Add npm scripts**

```json
"test:component": "vitest run",
"test:component:watch": "vitest",
"test:all": "npm run test && npm run test:component"
```

- [ ] **Step 5: Verify**

Run: `npm run test:component`
Expected: 0 tests, 0 failures (no component tests yet)

- [ ] **Step 6: Commit**

```bash
git commit -m "chore: add vitest + testing library for component tests"
```

---

### Sub-project 1B: Critical Screen Component Tests

**Files:**
- Create: `tests/components/ContributionFlow.test.tsx`
- Create: `tests/components/Home.test.tsx`
- Create: `tests/components/Profile.test.tsx`

- [ ] **Step 1: Write ContributionFlow smoke test**

```tsx
// tests/components/ContributionFlow.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

describe('ContributionFlow', () => {
  it('renders category selector on mount', () => {
    // Render with required props, verify category options visible
  });
});
```

- [ ] **Step 2: Write Home screen smoke test**

- [ ] **Step 3: Write Profile screen smoke test**

- [ ] **Step 4: Verify all pass**

Run: `npm run test:component`
Expected: 3+ tests pass

- [ ] **Step 5: Commit**

```bash
git commit -m "test: add component smoke tests for ContributionFlow, Home, Profile"
```

---

### Sub-project 1C: API Integration Tests

**Files:**
- Create: `tests/api/submissionsApi.test.ts`
- Create: `tests/api/userApi.test.ts`

- [ ] **Step 1: Test submission POST validation — malformed payload returns 400**
- [ ] **Step 2: Test submission GET — public map data returns sanitized points**
- [ ] **Step 3: Test user GET — agent can only see own profile**
- [ ] **Step 4: Test admin-only endpoints reject non-admin users**
- [ ] **Step 5: Commit**

---

### Sub-project 1D: RLS Policy Documentation & Verification

**Problem:** RLS enabled on all tables but no policies defined. App uses service-role `pg` connection which bypasses RLS. This is correct architecture but should be documented and verified.

**April 2 note:** The migration already exists. This sub-project should begin with docs and verification, not another schema change.

**PR0 outcome:** partial. Treat `1D` as documentation and verification work only unless the migration is missing in the target environment.

**Files:**
- Create: `docs/ops/rls-strategy.md`
- Verify: `supabase/migrations/20260401_enable_public_rls.sql`

- [ ] **Step 1: Document RLS strategy**

```markdown
# RLS Strategy

## Architecture
- App uses Vercel serverless functions with direct `pg` Pool connections
- Connection uses service-role credentials → bypasses RLS
- RLS provides defense-in-depth against Supabase client SDK misuse
- Primary access control is in API route handlers (submissionAccess.ts)

## Policy: Default Deny
- RLS is enabled on all public tables
- No policies exist for `anon` or `authenticated` roles → all access denied
- Service role bypasses RLS → API routes work normally
- If Supabase client SDK is ever used directly, it will be denied by default

## When to Add Policies
- Only if we introduce Supabase Realtime subscriptions
- Only if we add Supabase client-side SDK usage
- Each policy must be reviewed for data exposure
```

- [ ] **Step 2: Verify RLS is enabled**

Run: `npm run migrate:dry` — confirm migration `20260401_enable_public_rls.sql` is applied

- [ ] **Step 3: Commit**

```bash
git commit -m "docs: document RLS strategy and default-deny architecture"
```

---

## PHASE 2: Gamification Coherence

**Gate:** Mission system works end-to-end. Contributors see "next best action" on Home. XP/missions/badges/streaks are consistent.
**Dependency:** Phase 1 (test infra).

### Sub-project 2A: Mission System — Shared Types & Server Logic

**Problem:** No mission system. Agents don't know "what to do next."

**Files:**
- Create: `shared/missions.ts` (mission templates + types)
- Create: `lib/server/missions.ts` (progress tracking)
- Create: `supabase/migrations/20260406_mission_progress.sql`
- Create: `api/missions/index.ts`
- Create: `tests/missions.test.ts`

- [ ] **Step 1: Define mission types in `shared/missions.ts`**

```typescript
export type MissionType = 'daily' | 'weekly' | 'one_time';
export type MissionAction = 'submit' | 'enrich' | 'streak' | 'assignment_complete' | 'cover_zone';

export interface MissionTemplate {
  id: string;
  type: MissionType;
  titleEn: string;
  titleFr: string;
  descriptionEn: string;
  descriptionFr: string;
  xpReward: number;
  action: MissionAction;
  criteria: MissionCriteria;
  priority: number; // lower = shown first
}

export interface MissionCriteria {
  action: MissionAction;
  category?: SubmissionCategory; // optional vertical filter
  count: number;
  minFields?: number; // for enrich missions
  minQuality?: number; // confidence score threshold
}

export interface MissionProgress {
  missionId: string;
  currentCount: number;
  targetCount: number;
  completedAt: string | null;
  claimedAt: string | null;
}

export const DAILY_MISSIONS: MissionTemplate[] = [
  {
    id: 'daily_map_3',
    type: 'daily',
    titleEn: 'Map 3 Points',
    titleFr: 'Cartographier 3 points',
    descriptionEn: 'Submit 3 new data points today',
    descriptionFr: 'Soumettez 3 nouveaux points de données aujourd\'hui',
    xpReward: 15,
    action: 'submit',
    criteria: { action: 'submit', count: 3 },
    priority: 1,
  },
  {
    id: 'daily_enrich_5',
    type: 'daily',
    titleEn: 'Enrich 5 Points',
    titleFr: 'Enrichir 5 points',
    descriptionEn: 'Add missing data to 5 existing points',
    descriptionFr: 'Ajoutez les données manquantes à 5 points existants',
    xpReward: 20,
    action: 'enrich',
    criteria: { action: 'enrich', count: 5 },
    priority: 2,
  },
  {
    id: 'daily_quality',
    type: 'daily',
    titleEn: 'Quality Capture',
    titleFr: 'Capture de qualité',
    descriptionEn: 'Submit 2 points with 90%+ quality',
    descriptionFr: 'Soumettez 2 points avec 90%+ de qualité',
    xpReward: 10,
    action: 'submit',
    criteria: { action: 'submit', count: 2, minQuality: 90 },
    priority: 3,
  },
];

export const WEEKLY_MISSIONS: MissionTemplate[] = [
  {
    id: 'weekly_assignment',
    type: 'weekly',
    titleEn: 'Complete Assignment',
    titleFr: 'Terminer la mission',
    descriptionEn: 'Finish your current zone assignment',
    descriptionFr: 'Terminez votre affectation de zone actuelle',
    xpReward: 50,
    action: 'assignment_complete',
    criteria: { action: 'assignment_complete', count: 1 },
    priority: 1,
  },
  {
    id: 'weekly_streak_5',
    type: 'weekly',
    titleEn: '5-Day Streak',
    titleFr: 'Série de 5 jours',
    descriptionEn: 'Contribute 5 consecutive days',
    descriptionFr: 'Contribuez pendant 5 jours consécutifs',
    xpReward: 30,
    action: 'streak',
    criteria: { action: 'streak', count: 5 },
    priority: 2,
  },
];

export const ALL_MISSIONS = [...DAILY_MISSIONS, ...WEEKLY_MISSIONS];
```

- [ ] **Step 2: Write failing test for mission progress tracking**

```typescript
// tests/missions.test.ts
describe("mission progress", () => {
  it("should advance daily_map_3 on submission", () => {
    const progress = advanceMission('daily_map_3', { action: 'submit' }, { currentCount: 1, targetCount: 3 });
    assert.equal(progress.currentCount, 2);
    assert.equal(progress.completedAt, null);
  });

  it("should mark mission complete when target reached", () => {
    const progress = advanceMission('daily_map_3', { action: 'submit' }, { currentCount: 2, targetCount: 3 });
    assert.equal(progress.currentCount, 3);
    assert.notEqual(progress.completedAt, null);
  });

  it("should not advance past target", () => {
    const progress = advanceMission('daily_map_3', { action: 'submit' }, { currentCount: 3, targetCount: 3, completedAt: '2026-04-01' });
    assert.equal(progress.currentCount, 3);
  });

  it("should match criteria with category filter", () => {
    const matches = doesEventMatchMission(
      { action: 'submit', category: 'pharmacy' },
      { action: 'submit', count: 3 }
    );
    assert.equal(matches, true);
  });
});
```

Run: `node --import tsx --test tests/missions.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement `lib/server/missions.ts`**

Key functions:
- `getActiveMissionsForUser(userId)` — returns ALL_MISSIONS with user's progress for each
- `advanceMission(missionId, event, currentProgress)` — returns updated progress
- `doesEventMatchMission(event, criteria)` — check if submission matches mission criteria
- `checkAndAdvanceAllMissions(userId, event)` — loop through active missions, advance matching ones
- `claimMissionReward(userId, missionId)` — award XP, mark as claimed
- `resetDailyMissions(userId)` — reset daily progress (called by cron or on first daily access)

- [ ] **Step 4: Create migration for `mission_progress` table**

```sql
-- supabase/migrations/20260406_mission_progress.sql
CREATE TABLE IF NOT EXISTS mission_progress (
  user_id TEXT NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  mission_id TEXT NOT NULL,
  period_key TEXT NOT NULL, -- 'daily:2026-04-01' or 'weekly:2026-W14' or 'one_time'
  current_count INTEGER NOT NULL DEFAULT 0,
  target_count INTEGER NOT NULL,
  completed_at TIMESTAMPTZ,
  claimed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, mission_id, period_key)
);

CREATE INDEX idx_mission_progress_user ON mission_progress (user_id, period_key);

ALTER TABLE mission_progress ENABLE ROW LEVEL SECURITY;
```

- [ ] **Step 5: Create API endpoint `api/missions/index.ts`**

- GET: Return active missions + user progress (requires auth)
- POST: Claim completed mission reward (requires auth, validates completion)

- [ ] **Step 6: Hook into submission POST handler**

In `api/submissions/index.ts`, after successful submission insert, call:
```typescript
await checkAndAdvanceAllMissions(auth.id, {
  action: isEnrich ? 'enrich' : 'submit',
  category: body.category,
  qualityScore: confidenceScore,
});
```

- [ ] **Step 7: Verify all tests pass**

Run: `node --import tsx --test tests/missions.test.ts`
Run: `npm run test:ci`

- [ ] **Step 8: Commit**

```bash
git commit -m "feat(gamification): add mission system with daily/weekly templates and progress tracking"
```

---

### Sub-project 2B: Mission UI on Home & Profile

**Execution note:** Ship this behind `ENABLE_MISSIONS`. Home and Profile must continue to work without mission data when the flag is off.

**Files:**
- Create: `components/Missions/MissionCard.tsx`
- Create: `components/Missions/MissionStrip.tsx`
- Modify: `components/Screens/Home.tsx`
- Modify: `components/Screens/Profile.tsx`
- Create: `tests/components/MissionCard.test.tsx`

- [ ] **Step 1: Create `MissionCard` component**

Small card showing: icon + title + progress bar + XP reward + claim button (if complete).
Use existing design tokens: `card` class, `micro-label`, terra accent for CTA.

- [ ] **Step 2: Create `MissionStrip` component**

Horizontal scrollable strip of MissionCards. Fetches from `/api/missions` on mount.
Shows "Today's Missions" header (daily) and "This Week" (weekly).

- [ ] **Step 3: Add MissionStrip to Home screen**

Insert below sync status bar, above map/list toggle. Should be visible on first load.

- [ ] **Step 4: Add mission progress to Profile**

Add "Missions" tab/section between Badges and Streak sections.

- [ ] **Step 5: Component test for MissionCard**

- [ ] **Step 6: Commit**

```bash
git commit -m "feat(ui): add mission cards to Home and Profile screens"
```

---

### Sub-project 2C: "Next Best Action" Engine

**Execution note:** Ship this behind `ENABLE_NEXT_ACTION`. If the endpoint fails or the feature is disabled, Home should silently fall back to the current experience.

**Files:**
- Create: `lib/server/nextAction.ts`
- Create: `shared/nextAction.ts` (types)
- Modify: `api/user/index.ts` (add ?view=next-action)
- Create: `tests/nextAction.test.ts`

- [ ] **Step 1: Define NextAction types**

```typescript
export type ActionType = 'mission' | 'enrich' | 'assignment' | 'sync_queue' | 'stale_refresh';

export interface NextAction {
  type: ActionType;
  titleEn: string;
  titleFr: string;
  priority: number;
  metadata: Record<string, unknown>;
}
```

- [ ] **Step 2: Implement `computeNextActions(userId)` function**

Logic:
1. Check queue status → if pending items, suggest "Sync X queued submissions"
2. Check active assignment → if in_progress, suggest "Continue assignment in Zone X"
3. Check daily missions → if incomplete, suggest highest-priority incomplete mission
4. Check nearby stale points → if any within 500m, suggest "Refresh stale point X"
5. Check enrichment opportunities → suggest points with most missing fields

Return top 3 actions sorted by priority.

- [ ] **Step 3: Add API endpoint**
- [ ] **Step 4: Write tests**
- [ ] **Step 5: Commit**

---

### Sub-project 2D: Rewards Redemption Backend

**Execution note:** Ship this behind `ENABLE_REWARDS_BACKEND`. Do not switch `RewardsCatalog.tsx` to the real backend until migration, API, and transactional tests all pass.

**Problem:** RewardsCatalog.tsx is UI-only.

**Files:**
- Create: `supabase/migrations/20260407_rewards.sql`
- Create: `lib/server/rewards.ts`
- Create: `api/rewards/index.ts`
- Modify: `components/Screens/RewardsCatalog.tsx`
- Create: `tests/rewards.test.ts`

- [ ] **Step 1: Create migration**

```sql
CREATE TABLE IF NOT EXISTS rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title_en TEXT NOT NULL,
  title_fr TEXT NOT NULL,
  description_en TEXT,
  description_fr TEXT,
  xp_cost INTEGER NOT NULL CHECK (xp_cost > 0),
  stock INTEGER NOT NULL DEFAULT 0,
  image_url TEXT,
  category TEXT NOT NULL DEFAULT 'general',
  is_active BOOLEAN NOT NULL DEFAULT true,
  min_trust_tier TEXT DEFAULT 'standard',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS reward_redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES user_profiles(id),
  reward_id UUID NOT NULL REFERENCES rewards(id),
  xp_spent INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'fulfilled', 'cancelled')),
  redeemed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  fulfilled_at TIMESTAMPTZ
);

ALTER TABLE rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE reward_redemptions ENABLE ROW LEVEL SECURITY;
```

- [ ] **Step 2: Implement redemption logic with atomic XP deduction**

```typescript
// lib/server/rewards.ts
export async function redeemReward(userId: string, rewardId: string): Promise<RedemptionResult> {
  // Use SELECT FOR UPDATE to prevent race conditions
  // 1. Verify reward exists, is active, has stock
  // 2. Verify user has enough XP and meets trust tier requirement
  // 3. Deduct XP from user_profiles
  // 4. Decrement reward stock
  // 5. Insert reward_redemption record
  // All in a single transaction
}
```

- [ ] **Step 3: Create API endpoint**
- [ ] **Step 4: Modify RewardsCatalog.tsx to use real backend**
- [ ] **Step 5: Write tests**
- [ ] **Step 6: Commit**

---

### Sub-project 2E: Quality-Weighted Leaderboard Improvements

**Execution note:** Ship this behind `ENABLE_QUALITY_WEIGHTED_LEADERBOARD`. Keep the current leaderboard formula as the fallback until the new ranking is verified in preview.

**Files:**
- Modify: `api/leaderboard/index.ts`
- Modify: `components/Screens/Analytics.tsx`
- Create: `tests/leaderboard.test.ts`

- [ ] **Step 1: Add rank movement tracking**

Show rank change vs previous week (↑3, ↓1, →).

- [ ] **Step 2: Add quality emphasis in UI**

Show "Quality Score" prominently alongside rank. Add quality-weighted formula explanation.

- [ ] **Step 3: Write tests**
- [ ] **Step 4: Commit**

---

## PHASE 3: UX & Performance

**Gate:** ContributionFlow decomposed. State management via Context. Bundle size monitored.
**Dependency:** Phase 2 (gamification hooks needed in decomposed components).

### Sub-project 3A: ContributionFlow Decomposition

**Problem:** 2,489 lines in one file. Extract into focused sub-components.

**Files to create:**
- `components/Contribution/CategoryPicker.tsx`
- `components/Contribution/PhotoCapture.tsx`
- `components/Contribution/LocationConfirm.tsx`
- `components/Contribution/DetailForm.tsx`
- `components/Contribution/ReviewSubmit.tsx`
- `components/Contribution/SuccessFeedback.tsx`
- `components/Contribution/ContributionContext.tsx` (local context)

**Approach:** Extract ONE component at a time in its own commit. Keep ContributionFlow.tsx as orchestrator. Use a local ContributionContext to share state between sub-components instead of prop-drilling dozens of props.

**Do not start this sub-project until:**
- mission APIs are stable
- Home/Profile mission UI is stable behind flags
- component tests exist for ContributionFlow, Home, and Profile
- manual capture smoke tests pass on preview

- [ ] **Step 1: Create ContributionContext with shared state**
- [ ] **Step 2: Extract CategoryPicker** (vertical selector + icons)
- [ ] **Step 3: Extract PhotoCapture** (camera, EXIF, compression)
- [ ] **Step 4: Extract LocationConfirm** (GPS, manual entry)
- [ ] **Step 5: Extract DetailForm** (per-vertical fields)
- [ ] **Step 6: Extract ReviewSubmit** (quality preview, submit button)
- [ ] **Step 7: Extract SuccessFeedback** (XP popup, level up, batch continue)
- [ ] **Step 8: Slim ContributionFlow.tsx to orchestrator** (~200-300 lines)
- [ ] **Step 9: Verify all existing behavior preserved**

Run: `npm run test:ci` + manual smoke test

---

### Sub-project 3B: App-Level State via React Context

**Risk level:** high. This is architecture work, not feature work. Defer until after 3A or skip entirely if the app remains stable without it.

**Files:**
- Create: `lib/client/contexts/AuthContext.tsx`
- Create: `lib/client/contexts/QueueContext.tsx`
- Create: `lib/client/contexts/NavigationContext.tsx`
- Modify: `App.tsx`

**Approach:** One context per domain. App.tsx becomes a provider tree. Each screen receives state via useContext instead of props.

- [ ] **Step 1: Create AuthContext** (user, role, isAdmin, login/logout)
- [ ] **Step 2: Create QueueContext** (snapshot, sync, queue stats)
- [ ] **Step 3: Create NavigationContext** (screen, history, navigate, goBack)
- [ ] **Step 4: Refactor App.tsx** to use providers
- [ ] **Step 5: Migrate screens to useContext** (one screen per commit)
- [ ] **Step 6: Verify no regressions**

---

### Sub-project 3C: Performance Monitoring

**Files:**
- Modify: `vite.config.ts` (add rollup-plugin-visualizer)
- Modify: `package.json` (add budget check script)

- [ ] **Step 1: Add bundle analyzer**
- [ ] **Step 2: Add size budget to CI** (fail if main bundle > 300KB gzipped)
- [ ] **Step 3: Add skeleton loaders** for lazy-loaded screens
- [ ] **Step 4: Verify ContributionFlow chunk is < 50KB gzipped** (after 3A decomposition)
- [ ] **Step 5: Commit**

---

### Sub-project 3D: Accessibility Audit & Fixes

**Files:** Multiple screens

- [ ] **Step 1: Audit touch targets** — ensure all buttons ≥ 44×44px
- [ ] **Step 2: Add aria-labels** to icon-only buttons
- [ ] **Step 3: Fix color contrast** on micro-labels (11px text needs 4.5:1 ratio)
- [ ] **Step 4: Add reduced-motion respect** to XP popup animations
- [ ] **Step 5: Verify with axe-core** in component tests
- [ ] **Step 6: Commit**

---

## PHASE 4: Admin Velocity & Client Reporting

**Gate:** Admin review faster. Coaching feedback loop closed. Client dashboard functional.
**Dependency:** Phase 2 (missions feed admin views).

### Sub-project 4A: Admin Review Coaching Feedback

**Files:**
- Create: `supabase/migrations/20260408_coaching_messages.sql`
- Modify: `api/submissions/[id].ts` (generate coaching on reject/flag)
- Modify: `components/Screens/Profile.tsx` (show coaching messages)

- [ ] **Step 1: Create `coaching_messages` table**
- [ ] **Step 2: Generate coaching messages on admin review decisions**
- [ ] **Step 3: Show coaching in agent Profile** (new "Feedback" section)
- [ ] **Step 4: Write tests**
- [ ] **Step 5: Commit**

### Sub-project 4B: Admin Bulk Actions

**Files:**
- Modify: `components/Screens/AdminQueue.tsx`

- [ ] **Step 1: Add checkbox selection to queue items**
- [ ] **Step 2: Add "Approve Selected" / "Reject Selected" bulk actions**
- [ ] **Step 3: Add keyboard shortcuts** (a = approve, r = reject, n = next)
- [ ] **Step 4: Write tests**
- [ ] **Step 5: Commit**

### Sub-project 4C: Client Dashboard Enhancements

**Files:**
- Modify: `components/Screens/DeltaDashboard.tsx`
- Create: `components/Export/ExportButton.tsx`

- [ ] **Step 1: Add CSV export button** for delta data
- [ ] **Step 2: Add trust/confidence indicators** inline with reports
- [ ] **Step 3: Add coverage map** (heatmap of point density per zone)
- [ ] **Step 4: Write tests**
- [ ] **Step 5: Commit**

---

## PHASE 5: Production Readiness

**Gate:** Observability in place. Deployment runbook complete. Risk register documented.
**Dependency:** All prior phases substantially complete.

### Sub-project 5A: Observability & Structured Logging

**Files:**
- Modify: `lib/server/logger.ts`
- Modify: API routes (add request ID propagation)
- Modify: `api/health/index.ts` (add DB latency, queue depth)

- [ ] **Step 1: Add `x-request-id` generation and propagation**
- [ ] **Step 2: Structured log format** (JSON with timestamp, requestId, level, message)
- [ ] **Step 3: Enhance health check** with DB latency and migration version
- [ ] **Step 4: Add Sentry performance tracing** to API routes
- [ ] **Step 5: Commit**

### Sub-project 5B: Deployment Safety

**Files:**
- Modify: `package.json` (add migrate:verify script)
- Create: `docs/ops/deployment-runbook.md`
- Create: `docs/ops/rollback-guide.md`

- [ ] **Step 1: Add `migrate:verify`** script that checks migration status
- [ ] **Step 2: Add migration dry-run to CI** (before deploy)
- [ ] **Step 3: Write deployment runbook** (Vercel deploy + Supabase migration steps)
- [ ] **Step 4: Write rollback guide** (per-migration rollback instructions)
- [ ] **Step 5: Commit**

### Sub-project 5C: Documentation

**Files:**
- Create: `docs/api/README.md` (API reference)
- Create: `docs/architecture/README.md` (system overview)
- Modify: `README.md` (project overview, getting started)

- [ ] **Step 1: Generate API reference** from route files + Zod schemas
- [ ] **Step 2: Write architecture overview** (component diagram, data flow)
- [ ] **Step 3: Update README** with setup, dev workflow, test commands
- [ ] **Step 4: Commit**

### Sub-project 5D: Residual Risk Register & Ship Decision

**Files:**
- Create: `docs/ops/risk-register.md`

- [ ] **Step 1: Document remaining risks** with severity + mitigation status
- [ ] **Step 2: Document known technical debt** from each phase
- [ ] **Step 3: Produce "ship / do not ship" recommendation** with evidence
- [ ] **Step 4: Commit**

---

## Dependency Graph

```
Phase 0 (Security) ─── all 6 sub-projects can parallelize
  │
  ▼
Phase 1 (Reliability) ─── 1A first, then 1B/1C/1D parallel
  │
  ▼
Phase 2 (Gamification) ─── 2A first, then 2B/2C/2D/2E parallel
  │
  ├──▶ Phase 3 (UX/Perf) ─── 3A/3B/3C/3D can parallelize
  ├──▶ Phase 4 (Admin/Client) ─── 4A/4B/4C can parallelize
  └──▶ Phase 5 (Production) ─── 5A/5B/5C/5D can parallelize
```

---

## Recommended PR-By-PR Order

Use this order if the priority is "improve the app without breaking it."

### PR 0: Plan reconciliation and status update

- update this plan to reflect the current repo state
- add any missing regression tests for already-fixed security paths
- no product behavior changes

### PR 1: Admin auth hardening

- execute `0A`
- keep scope limited to admin credential flow and tests

### PR 2: Remaining Phase 0 regression coverage

- execute `0C` and `0F`
- fold in `0B` or `0E` only if they are still genuinely incomplete after verification

### PR 3: Offline queue integrity hash

- execute `0D`
- keep it isolated because it changes client-server submission semantics

### PR 4: Test infrastructure

- execute `1A`
- do not combine with product changes

### PR 5: Critical screen and API tests

- execute `1B` and `1C`
- increase confidence before adding missions

### PR 6: RLS docs and deploy safety docs

- execute `1D`
- add `docs/ops/rls-strategy.md`
- start `5B` docs if helpful, but do not mix with feature changes

### PR 7: Mission backend behind flag

- execute `2A`
- add migration, server logic, and API
- keep `ENABLE_MISSIONS=false` in production until verified

### PR 8: Mission UI behind flag

- execute `2B`
- Home and Profile should render normally when missions are disabled or unavailable

### PR 9: Next-best-action behind flag

- execute `2C`
- Home should degrade gracefully if no next-action data is returned

### PR 10: Quality-weighted leaderboard behind flag

- execute `2E`
- preserve the current leaderboard as fallback

### PR 11: Rewards backend behind flag

- execute `2D`
- only switch `RewardsCatalog.tsx` after transactional behavior is verified

### PR 12: ContributionFlow decomposition

- execute `3A`
- one extracted component per commit
- no parallel architecture rewrite in the same PR

### PR 13: Optional app-wide context refactor

- execute `3B` only if still justified after 3A
- skip if the complexity cost exceeds the benefit

### PR 14+: Accessibility, performance, admin/client, and production hardening

- execute `3C`, `3D`, `4A-4C`, and `5A-5D` in bounded PRs
- prefer documentation and runbook PRs to be separate from behavior changes

---

## Per-PR Rollout Checklist

Before merge:

- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`
- `npm run migrate:dry` if schema changed
- preview deploy smoke test

Before production flag enablement:

- related migration applied
- preview manually tested
- fallback behavior confirmed with flag off
- rollback path written down

After deploy:

- agent login smoke test
- submission create/enrich smoke test
- offline queue smoke test if queue-related changes landed
- admin review smoke test for review-path changes
- analytics/leaderboard smoke test for ranking changes

## Verification

After each phase, run:
```bash
npm run typecheck       # TypeScript compilation
npm run lint            # ESLint
npm run test            # Server/utility tests (29+ files)
npm run test:component  # Component tests (after Phase 1A)
npm run build           # Vite production build
npm run migrate:dry     # Verify migrations (if schema changes)
```

After all phases:
- Manual smoke test: agent login → create submission → verify XP + mission progress → check leaderboard
- Manual admin test: review submission → verify coaching message → check trust adjustment
- Offline test: submit while offline → go online → verify sync + mission advancement
- Security: run `npm run test` with auth boundary tests → verify no IDOR, no enumeration

## Key Files Reference

| File | Lines | Role |
|------|-------|------|
| `App.tsx` | 442 | Routing, state, sync orchestration |
| `ContributionFlow.tsx` | 2,489 | Contribution wizard (decompose in 3A) |
| `Profile.tsx` | 652 | Gamification hub |
| `Analytics.tsx` | 482 | Leaderboard |
| `Home.tsx` | 500+ | Map/list + mission strip (2B) |
| `AdminQueue.tsx` | ~1,500 | Admin review |
| `offlineQueue.ts` | 507 | Offline sync |
| `handler.ts` | ~180 | Auth logic (modify in 0A) |
| `register.ts` | ~130 | Registration (modify in 0B) |
| `submissionRisk.ts` | ~940 | Fraud detection |
| `userTrust.ts` | ~140 | Trust scoring |
| `idempotency.ts` | 79 | Idempotency (already solid) |
| `shared/xp.ts` | 56 | XP calculation |
| `shared/submissionRewards.ts` | 149 | Reward breakdown |
| `shared/missions.ts` | NEW | Mission templates (2A) |
| `shared/verticals.ts` | 378 | Vertical configs |
