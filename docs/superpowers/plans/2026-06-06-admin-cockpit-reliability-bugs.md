# Admin Cockpit Reliability & Access Bugs — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the 8 admin-login bugs tracked under epic `africandatalayer-8oz` so an admin can complete review, assignment, account-access, map-scope, history, and profile-photo workflows without 404s, 403s, 500s, or map reload loops.

**Architecture:** This is a Capacitor app — the iOS build wraps the React/TypeScript web app, so every bug lives in React components (`components/`) or Vercel serverless handlers (`api/`, `lib/server/`). The unifying root cause for the *admin cluster* (Account Access, map scope, history, assignments) is that the **bootstrap `ADMIN_EMAIL` account authenticates without ever creating a `user_profiles` row** (`lib/server/auth/handler.ts:203` returns `{ id, name:"Admin", email }` with no upsert). Consequently `GET /api/user` calls `getUserProfile(auth.id)`, gets `null`, and returns **404 "Profile not found"** (`api/user/index.ts:426`). The whole Profile screen then fails to render its admin-gated sections. Task 1 fixes this lynchpin; later tasks address the standalone UI/server bugs.

**Tech Stack:** React 19 + TS, Vercel serverless (`pg`, no ORM), `@auth/core` (Auth.js), `@vercel/blob`, Leaflet/React-Leaflet. Tests: `node --test` + `tsx` (handler/unit level via dependency injection — there is **no** React Testing Library/jsdom, so component bugs are fixed in code + verified on device).

**Login context (confirmed with user):** Admin logs in via the **`ADMIN_EMAIL` bootstrap account** (token `isAdmin=true` unconditionally). Verification is **code-only + automated tests**; the user builds/runs the iOS app to confirm UI fixes. No live DB/app access during implementation.

**Conventions to follow:**
- Server responses use `lib/server/http.ts` builders / the local `errorResponse`/`jsonResponse` helpers already in `api/user/index.ts`.
- Bilingual UI strings use the `t = (en, fr) => language === 'fr' ? fr : en` pattern.
- File path references in chat: workspace-relative, no leading slash, `:line` suffix.
- Run `npm test` after each server task; run `npm run test:ci` (lint + typecheck + test + build) before the final review.
- One beads ticket per task. `bd update <id> --claim` at start, `bd close <id>` at end. Commit per task.

---

## File Structure

| File | Responsibility | Tasks |
|------|----------------|-------|
| `lib/server/adminProfileProvisioning.ts` | **NEW.** Pure, injectable helpers: `buildBootstrapAdminProfile(userId)` and `resolveOrProvisionProfile(deps, userId, isAdmin)`. Testable without DB. | 1 |
| `tests/adminProfileProvisioning.test.ts` | **NEW.** Unit tests for provisioning logic. | 1 |
| `api/user/index.ts` | Wire provisioning into `GET` default path; harden assignments error surfacing; harden blob upload error mapping. | 1, 4, 8 |
| `lib/server/profileImageUpload.ts` | **NEW.** Extract `parseProfileImagePayload` + a `classifyBlobUploadError` helper so the 500→clear-error mapping is unit-testable. | 8 |
| `tests/profileImageUpload.test.ts` | **NEW.** Unit tests for payload parsing + error classification. | 8 |
| `tests/assignmentsLoad.test.ts` | **NEW.** Regression for planner-context error shape. | 4 |
| `components/Screens/AdminQueue.tsx` | Stabilize the wobbly cockpit *mode* selector; ensure weekly assignment rows render. | 6, 5 |
| `components/Screens/Home.tsx` / `components/Screens/HomeMap.tsx` | Keep map mounted / cache tiles to stop reload-on-every-visit; honor admin global map scope toggle. | 7, 2 |
| `components/Screens/Profile.tsx` | Contribution-history visibility for admin + own account. | 3 |

---

## Task 1: Admin bootstrap profile auto-provisioning (ticket `africandatalayer-oi2`)

Fixes the lynchpin: bootstrap admin has no `user_profiles` row → `GET /api/user` 404 → Account Access, map-scope toggle, and history all vanish. Tasks 2, 3, 5, 6 depend on this.

**Files:**
- Create: `lib/server/adminProfileProvisioning.ts`
- Create: `tests/adminProfileProvisioning.test.ts`
- Modify: `api/user/index.ts` (GET default path, ~424-444; add import)

- [ ] **Step 1: Write the failing test**

Create `tests/adminProfileProvisioning.test.ts`:

```ts
import assert from "node:assert/strict";
import test from "node:test";
import {
  buildBootstrapAdminProfile,
  resolveOrProvisionProfile,
} from "../lib/server/adminProfileProvisioning.ts";

test("buildBootstrapAdminProfile returns an admin, global-scope profile", () => {
  const p = buildBootstrapAdminProfile("admin@example.com");
  assert.equal(p.id, "admin@example.com");
  assert.equal(p.email, "admin@example.com");
  assert.equal(p.isAdmin, true);
  assert.equal(p.role, "admin");
  assert.equal(p.mapScope, "global");
  assert.equal(p.trustScore, 50);
  assert.equal(p.XP, 0);
});

test("buildBootstrapAdminProfile treats non-email id as phone-less, name-defaulted", () => {
  const p = buildBootstrapAdminProfile("+237600000000");
  assert.equal(p.email, null);
  assert.equal(p.phone, "+237600000000");
  assert.ok(p.name && p.name.length > 0);
});

test("resolveOrProvisionProfile provisions when admin has no row", async () => {
  const store = new Map<string, unknown>();
  const upserts: string[] = [];
  const result = await resolveOrProvisionProfile(
    {
      getProfile: async (id) => (store.get(id) as never) ?? null,
      upsertProfile: async (id, p) => { store.set(id, p); upserts.push(id); },
    },
    "admin@example.com",
    true,
  );
  assert.ok(result);
  assert.equal(result!.isAdmin, true);
  assert.equal(result!.mapScope, "global");
  assert.deepEqual(upserts, ["admin@example.com"]);
});

test("resolveOrProvisionProfile does NOT provision for a non-admin missing row", async () => {
  const result = await resolveOrProvisionProfile(
    { getProfile: async () => null, upsertProfile: async () => { throw new Error("should not upsert"); } },
    "agent@example.com",
    false,
  );
  assert.equal(result, null);
});

test("resolveOrProvisionProfile upgrades an existing admin-token row to admin access", async () => {
  const existing = { id: "admin@example.com", role: "agent", isAdmin: false, mapScope: "bonamoussadi", XP: 7 };
  const store = new Map<string, unknown>([["admin@example.com", existing]]);
  let upserted = false;
  const result = await resolveOrProvisionProfile(
    {
      getProfile: async (id) => (store.get(id) as never) ?? null,
      upsertProfile: async (id, p) => { store.set(id, p); upserted = true; },
    },
    "admin@example.com",
    true,
  );
  assert.equal(result!.isAdmin, true);
  assert.equal(result!.role, "admin");
  assert.equal(result!.mapScope, "global");
  assert.equal(result!.XP, 7); // preserves existing data
  assert.equal(upserted, true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test tests/adminProfileProvisioning.test.ts`
Expected: FAIL — `Cannot find module '../lib/server/adminProfileProvisioning.ts'`.

- [ ] **Step 3: Write minimal implementation**

Create `lib/server/adminProfileProvisioning.ts`:

```ts
import type { MapScope, UserProfile } from "../../shared/types.ts";
import { DEFAULT_AVATAR_PRESET, encodeAvatarPresetImage } from "../../shared/avatarPresets.ts";

function inferName(userId: string): string {
  const handle = userId.includes("@") ? userId.split("@")[0] : userId;
  const cleaned = handle.replace(/[._-]+/g, " ").trim();
  if (!cleaned) return "Admin";
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

/** Build a fresh, fully-formed admin profile for the bootstrap ADMIN_EMAIL account
 *  that authenticated without a stored user_profiles row. */
export function buildBootstrapAdminProfile(userId: string): UserProfile {
  const isEmail = userId.includes("@");
  return {
    id: userId,
    name: inferName(userId),
    email: isEmail ? userId : null,
    phone: isEmail ? null : userId,
    image: encodeAvatarPresetImage(DEFAULT_AVATAR_PRESET),
    avatarPreset: DEFAULT_AVATAR_PRESET,
    occupation: "",
    XP: 0,
    isAdmin: true,
    role: "admin",
    mapScope: "global" as MapScope,
    trustScore: 50,
    trustTier: "standard",
    failedLoginCount: 0,
    lockedUntil: null,
    wipeRequested: false,
    suspendedUntil: null,
  } as UserProfile;
}

export interface ProvisionDeps {
  getProfile: (id: string) => Promise<UserProfile | null>;
  upsertProfile: (id: string, profile: UserProfile) => Promise<void>;
}

/** Returns the viewer's profile, provisioning/upgrading an admin one when the
 *  authenticated token is admin. Returns null only for a non-admin with no row. */
export async function resolveOrProvisionProfile(
  deps: ProvisionDeps,
  userId: string,
  isAdmin: boolean,
): Promise<UserProfile | null> {
  const existing = await deps.getProfile(userId);
  if (existing) {
    if (isAdmin) {
      let changed = false;
      if (existing.role !== "admin") { existing.role = "admin"; changed = true; }
      if (existing.isAdmin !== true) { existing.isAdmin = true; changed = true; }
      if (existing.mapScope !== "global") { existing.mapScope = "global" as MapScope; changed = true; }
      if (changed) await deps.upsertProfile(userId, existing);
    }
    return existing;
  }
  if (!isAdmin) return null;
  const provisioned = buildBootstrapAdminProfile(userId);
  await deps.upsertProfile(userId, provisioned);
  return provisioned;
}
```

> Note: confirm `MapScope`, `UserProfile` are exported from `shared/types.ts` and `encodeAvatarPresetImage`/`DEFAULT_AVATAR_PRESET` from `shared/avatarPresets.ts` (they are already imported by `api/user/index.ts:25`). If the `UserProfile` type rejects any field above, align field names to the existing type rather than casting — remove the `as UserProfile` once it type-checks cleanly.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test tests/adminProfileProvisioning.test.ts`
Expected: PASS (5/5).

- [ ] **Step 5: Wire into the GET handler**

In `api/user/index.ts`, add the import near the other server imports:

```ts
import { resolveOrProvisionProfile } from "../../lib/server/adminProfileProvisioning";
```

Replace the GET default-path block (currently `api/user/index.ts:424-444`, beginning `const profile = await getUserProfile(auth.id);` and the `if (!profile) return errorResponse("Profile not found", 404);`) with:

```ts
  try {
    const profile = await resolveOrProvisionProfile(
      { getProfile: getUserProfile, upsertProfile: upsertUserProfile },
      auth.id,
      authIsAdmin,
    );
    if (!profile) return errorResponse("Profile not found", 404);

    let shouldPersist = false;
    if (authIsAdmin && applyAdminProfileAccess(profile)) {
      shouldPersist = true;
    }

    const events = await buildContributionEvents();
    const canonicalXp = computeCanonicalUserXp(events, auth.id);
    if ((profile.XP ?? 0) !== canonicalXp) {
      profile.XP = canonicalXp;
      shouldPersist = true;
    }

    if (shouldPersist) {
      await upsertUserProfile(auth.id, profile);
    }

    return jsonResponse(sanitizeProfile(profile), { status: 200 });
  } catch (error) {
    if (isStorageUnavailableError(error)) {
      return errorResponse("Storage service temporarily unavailable", 503, { code: "storage_unavailable" });
    }
    throw error;
  }
```

(The non-admin path is unchanged: `resolveOrProvisionProfile` returns the existing row, or `null` → the same 404 as before. Only an admin token with no row now gets provisioned.)

- [ ] **Step 6: Run the full suite + typecheck**

Run: `npm run typecheck && npm test`
Expected: typecheck clean; all tests pass including the new file.

- [ ] **Step 7: Commit**

```bash
git add lib/server/adminProfileProvisioning.ts tests/adminProfileProvisioning.test.ts api/user/index.ts
git commit -m "fix(admin): provision bootstrap admin profile so /api/user returns isAdmin (Refs africandatalayer-oi2)"
```

- [ ] **Step 8: Device verification note for the ticket**

Add to `bd update africandatalayer-oi2 --notes`: "Log in as ADMIN_EMAIL → open Profile. Expect: Account Access card + 'Unlock worldwide map' card now render (previously hidden because GET /api/user 404'd)."

---

## Task 2: Admin worldwide / Douala map scope (ticket `africandatalayer-fji`)

**Depends on Task 1** (admin profile must load with `mapScope: "global"`). Server already enforces scope (`api/user/index.ts:508-515` lets admins set any scope; non-admins are locked to `bonamoussadi`). The remaining work: confirm the Profile toggle PUTs the scope and that `HomeMap` actually expands bounds when scope is `global` instead of clamping to the Bonamoussadi geofence.

**Files:**
- Modify: `components/Screens/HomeMap.tsx` (bounds/clamp logic)
- Modify: `components/Screens/Home.tsx` (passes scope to map) — confirm prop wiring
- Reference: `shared/geofence.ts` (Bonamoussadi + Cameroon bounds), `components/Screens/Profile.tsx:692-714` (toggle)

- [ ] **Step 1: Diagnose — locate the clamp**

Run: `grep -n "mapScope\|maxBounds\|setMaxBounds\|fitBounds\|BONAMOUSSADI\|CAMEROON\|bounds\|global" components/Screens/HomeMap.tsx components/Screens/Home.tsx shared/geofence.ts`
Read every match. Identify (a) whether `HomeMap` receives a `mapScope`/`scope` prop, and (b) where Leaflet `maxBounds`/`fitBounds` is set from a hard-coded Bonamoussadi rectangle. Write the findings into `bd update africandatalayer-fji --notes`.

- [ ] **Step 2: Apply the fix**

In `components/Screens/HomeMap.tsx`, make the bounds conditional on scope. Replace the hard-coded `maxBounds`/initial-bounds usage with a scope-aware value. Example shape (adapt prop/identifier names to what Step 1 found):

```tsx
// props
type HomeMapProps = { /* ...existing... */ mapScope?: 'bonamoussadi' | 'douala' | 'global' };

// inside the component, where bounds are computed:
const scopeBounds =
  mapScope === 'global'
    ? undefined                       // no clamp — worldwide pan/zoom
    : mapScope === 'douala'
      ? DOUALA_BOUNDS                  // city-wide
      : BONAMOUSSADI_BOUNDS;           // neighborhood (default)

// when configuring the map:
// - if scopeBounds is undefined, do NOT call map.setMaxBounds(...) (or call map.setMaxBounds(null))
// - only fitBounds/clamp when scopeBounds is defined
```

If `shared/geofence.ts` has no `DOUALA_BOUNDS`, add one alongside the existing Cameroon bounds (Douala approx SW `[3.95, 9.65]`, NE `[4.12, 9.82]` — verify against existing geofence coordinate ordering `[lat, lng]` vs `[lng, lat]` before committing).

In `components/Screens/Home.tsx`, ensure the active profile's `mapScope` is threaded into `<HomeMap mapScope={...} />`. If Home does not already have the profile/scope in scope, read it from the same source Profile uses (the `/api/user` GET response / app-level profile state).

- [ ] **Step 3: Typecheck + build**

Run: `npm run typecheck && npm run build`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add components/Screens/HomeMap.tsx components/Screens/Home.tsx shared/geofence.ts
git commit -m "fix(map): honor admin global/Douala map scope instead of clamping to Bonamoussadi (Refs africandatalayer-fji)"
```

- [ ] **Step 5: Device verification note**

`bd update africandatalayer-fji --notes`: "As admin, toggle 'Unlock worldwide map' in Profile → return to Home map. Expect: can pan/zoom beyond Bonamoussadi worldwide. Toggle off → re-clamps."

---

## Task 3: Contribution history visibility (ticket `africandatalayer-7uj`)

After Task 1, the admin's *own* history loads (Profile fetched `ownSubmissions` at `components/Screens/Profile.tsx:149-150`). The reported gap — "can't see contribution history even for accounts I'm sure have data" — means the admin wants to inspect *another* account's history via Account Access lookup, which currently only shows role/scope (`Profile.tsx:872`), not submissions.

**Files:**
- Modify: `components/Screens/Profile.tsx` (Account Access "Load account" result panel)
- Reference: `api/submissions/index.ts` (does it accept an admin `userId`/`agentUserId` filter?)

- [ ] **Step 1: Diagnose the submissions query capability**

Run: `grep -n "agentUserId\|userId\|view\|admin\|authIsAdmin\|reporterId\|submittedBy" api/submissions/index.ts | head -40`
Determine whether `GET /api/submissions` already supports an admin querying a specific user's submissions. Record the exact param name (or its absence) in `bd update africandatalayer-7uj --notes`.

- [ ] **Step 2a (if the API already supports per-user admin queries): wire the UI**

In `components/Screens/Profile.tsx`, after a successful "Load account" lookup (near line 872 where `managedAccount` is shown), fetch and render that account's recent submissions:

```tsx
const [managedHistory, setManagedHistory] = useState<typeof history>([]);

// after managedAccount is set (in the load-account success path):
try {
  const subs = await apiJson<RawSubmission[]>(
    `/api/submissions?agentUserId=${encodeURIComponent(managedAccount.id)}`, // use the exact param from Step 1
  );
  setManagedHistory(subs.map(submissionToHistory));
} catch {
  setManagedHistory([]);
}
```

Render `managedHistory` in the result panel with the same row markup used for `visibleHistory` (Profile.tsx:1089+), guarded by an empty-state string:

```tsx
{managedHistory.length === 0
  ? <p className="text-sm text-gray-400">{t('No contributions for this account.', 'Aucune contribution pour ce compte.')}</p>
  : managedHistory.map(/* same row JSX as visibleHistory */)}
```

- [ ] **Step 2b (if the API does NOT support it): add an admin filter to the submissions handler first**

In `api/submissions/index.ts` GET, accept `agentUserId` and, when the caller is admin (`isAdminToken`), scope the query to that user. Add a `node --test` regression in `tests/` asserting a non-admin caller cannot read another user's submissions (403/empty) and an admin can. Then do Step 2a.

- [ ] **Step 3: Typecheck + build (+ test if 2b ran)**

Run: `npm run typecheck && npm run build` (and `npm test` if Step 2b added a handler test).
Expected: clean / pass.

- [ ] **Step 4: Commit**

```bash
git add components/Screens/Profile.tsx api/submissions/index.ts tests/
git commit -m "feat(admin): show looked-up account contribution history in Account Access (Refs africandatalayer-7uj)"
```

- [ ] **Step 5: Device verification note**

`bd update africandatalayer-7uj --notes`: "As admin, Account Access → Load account by email of a known contributor → expect their recent submissions list renders. Also confirm own Profile history renders (Task 1 fix)."

---

## Task 4: Assignments fail to load (ticket `africandatalayer-7so`)

Client requests `view=assignment_planner_context` (`components/Screens/AdminQueue.tsx:598`), which requires `authIsAdmin` (`api/user/index.ts:382` → 403 otherwise) and runs `getPlannerContext()` + `listAssignments()`. On any non-storage error the handler does `throw error` (`api/user/index.ts:377` and `:400`) → unhandled 500 → client shows "Impossible de charger les affectations". The fix: surface the real failure (so it's diagnosable) and harden the handler.

**Files:**
- Modify: `api/user/index.ts` (assignments + planner_context catch blocks ~365-401)
- Create: `tests/assignmentsLoad.test.ts`
- Reference: `lib/server/collectionAssignments.ts` (`listAssignments` :178, `getPlannerContext` :229)

- [ ] **Step 1: Write the failing test**

Create `tests/assignmentsLoad.test.ts` — assert the error-classification helper turns an unexpected error into a structured 500 with a code (not a bare throw). First add this exported helper to `api/user/index.ts` (or a small `lib/server/userViewErrors.ts` if you prefer pure testability):

```ts
import assert from "node:assert/strict";
import test from "node:test";
import { classifyUserViewError } from "../lib/server/userViewErrors.ts";

test("storage-unavailable errors map to 503", () => {
  const r = classifyUserViewError(new Error("storage unavailable: ECONNREFUSED"));
  assert.equal(r.status, 503);
  assert.equal(r.code, "storage_unavailable");
});

test("unexpected errors map to a 500 with assignments_failed code and a safe message", () => {
  const r = classifyUserViewError(new Error("relation \"collection_assignments\" does not exist"));
  assert.equal(r.status, 500);
  assert.equal(r.code, "assignments_failed");
  assert.ok(!/collection_assignments/.test(r.message)); // do not leak SQL internals to client
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx tsx --test tests/assignmentsLoad.test.ts`
Expected: FAIL — module/function not found.

- [ ] **Step 3: Implement the helper**

Create `lib/server/userViewErrors.ts`:

```ts
import { isStorageUnavailableError } from "./storage/index.ts"; // match the existing import path used in api/user/index.ts

export interface ViewError { status: number; code: string; message: string; }

export function classifyUserViewError(error: unknown): ViewError {
  if (isStorageUnavailableError(error)) {
    return { status: 503, code: "storage_unavailable", message: "Storage service temporarily unavailable" };
  }
  return { status: 500, code: "assignments_failed", message: "Unable to load assignments" };
}
```

> Confirm the correct import path/source for `isStorageUnavailableError` (grep its definition; it is already imported in `api/user/index.ts`). Reuse, don't duplicate.

- [ ] **Step 4: Run to verify it passes**

Run: `npx tsx --test tests/assignmentsLoad.test.ts`
Expected: PASS.

- [ ] **Step 5: Use the helper in the handler**

In `api/user/index.ts`, replace the two assignments-related catch blocks (the `view === "assignments"` block ~373-378 and the `view === "assignment_planner_context"` block ~396-401) so they log the real error server-side and return the classified response instead of `throw error`:

```ts
    } catch (error) {
      console.error("[api/user] assignments view failed", error);
      const v = classifyUserViewError(error);
      return errorResponse(v.message, v.status, { code: v.code });
    }
```

Add `import { classifyUserViewError } from "../../lib/server/userViewErrors";` at the top.

- [ ] **Step 6: Surface the code client-side for diagnosis**

In `components/Screens/AdminQueue.tsx` `loadAssignments` (the catch at ~609-614), keep the user-facing French message but also `console.error('[AdminQueue] assignments load failed', error)` so the on-device Safari/Xcode console shows the structured server message. This turns the opaque failure into a diagnosable one on the next device run.

- [ ] **Step 7: Typecheck + full suite**

Run: `npm run typecheck && npm test`
Expected: clean / pass.

- [ ] **Step 8: Commit**

```bash
git add lib/server/userViewErrors.ts tests/assignmentsLoad.test.ts api/user/index.ts components/Screens/AdminQueue.tsx
git commit -m "fix(admin): classify assignment-load failures instead of bare 500 throw (Refs africandatalayer-7so)"
```

- [ ] **Step 9: Device verification note**

`bd update africandatalayer-7so --notes`: "As admin, open cockpit → Assignments tab. If still failing, the device console now logs the classified server error (storage_unavailable vs assignments_failed) — capture it to pinpoint whether it's a missing migration (run supabase/migrations/20260304_system_design_collection_workflow.sql) or a query bug. Task 1 must be merged first (admin token required)."

---

## Task 5: Weekly assignments not showing (ticket `africandatalayer-5np`)

Builds on Task 4 (assignments must load at all). Once `assignments` populate, confirm the *weekly* grouping/section renders. The "weekly" view is the agent-facing assignment widget and/or the admin planner list.

**Files:**
- Modify: `components/Screens/AdminQueue.tsx` (assignments render) and/or `components/MissionCards.tsx`
- Reference: `components/Screens/Home.tsx`, `components/Screens/AgentPerformance.tsx`

- [ ] **Step 1: Diagnose where "weekly" renders**

Run: `grep -rn "week\|Week\|weekly\|Weekly\|assignments\b" components/Screens/AdminQueue.tsx components/MissionCards.tsx components/Screens/Home.tsx | head -40`
Determine the component + state that should list current-week assignments and whether it filters by date range or status. Record findings in `bd update africandatalayer-5np --notes`.

- [ ] **Step 2: Apply the fix**

Most likely cause given Task 4: the weekly list reads from the same `assignments` state that was empty because the fetch 500'd/403'd. After Task 1 + Task 4 it populates. If a date filter hides them (e.g. comparing `expiresAt`/`weekOf` with a stale boundary), correct the comparison. Apply the concrete change the Step-1 diagnosis identifies; if it is purely the empty-fetch cascade, add a regression assertion in `tests/assignmentsLoad.test.ts` that a populated assignment array survives the week-filter, e.g.:

```ts
test("current-week filter keeps an assignment expiring later this week", () => {
  const now = new Date("2026-06-06T00:00:00Z");
  const a = { id: "x", status: "active", expiresAt: "2026-06-08T00:00:00Z" };
  assert.equal(isWithinCurrentWeek(a, now), true); // import the filter fn you locate/extract
});
```

If the filter is inline JSX, extract it to a small pure function so the test above is real, then use it in the component.

- [ ] **Step 3: Typecheck + build + test**

Run: `npm run typecheck && npm run build && npm test`
Expected: clean / pass.

- [ ] **Step 4: Commit**

```bash
git add components/ tests/
git commit -m "fix(admin): render current-week assignments after load fix (Refs africandatalayer-5np)"
```

- [ ] **Step 5: Device verification note**

`bd update africandatalayer-5np --notes`: "Create an assignment for an agent this week (admin planner) → expect it appears in the weekly list for admin and agent. Depends on Tasks 1 + 4."

---

## Task 6: Cockpit dropdown wobble + filters + mass approve (ticket `africandatalayer-aew`)

**Already present:** risk filter (`FilterChipRow`, AdminQueue.tsx:1383), agent filter (`<select>`, :1396), and mass approve (`selectedForBulk` + bulk handler ending :970). The real bug is the **mode selector ("cockpit en liste déroulante") being visually unstable/wobbly**; the filters and mass-approve must be confirmed discoverable.

**Files:**
- Modify: `components/Screens/AdminQueue.tsx` (mode selector markup/layout)

- [ ] **Step 1: Diagnose the wobbly element**

Run: `grep -n "activeMode\|setActiveMode\|mode ===\|<select\|role=\"tablist\"\|review.*assignments.*automation\|communications" components/Screens/AdminQueue.tsx | head -40`
Identify the control that switches between review / assignments / automation / communications modes. "Wobbly" = layout shifts when its label/contents change width, or a `<select>` whose width is content-driven, or a tab row that reflows. Read its exact JSX + classes. Record in `bd update africandatalayer-aew --notes`.

- [ ] **Step 2: Stabilize the layout**

Apply fixed-dimension, non-reflowing styling to the mode control. For a `<select>`: give it a fixed width and the existing `h-12 rounded-xl` treatment so it matches the agent filter and can't resize:

```tsx
<select
  value={activeMode}
  onChange={(e) => setActiveMode(e.target.value as AdminMode)}
  className={`h-12 w-full sm:w-56 shrink-0 rounded-xl border border-gray-100 bg-page px-3 micro-label text-gray-700 appearance-none ${focusRingClass}`}
  aria-label={t('Cockpit section', 'Section du cockpit')}
>
  {/* existing options */}
</select>
```

For a tab-row implementation instead: wrap in a container with a fixed height (`h-12`) and `flex-nowrap overflow-x-auto no-scrollbar`, give each tab `shrink-0 whitespace-nowrap`, and reserve the active-state ring/border on *all* tabs (use a transparent border by default) so selecting one doesn't shift neighbors:

```tsx
<div className="h-12 flex flex-nowrap items-center gap-2 overflow-x-auto no-scrollbar">
  {modes.map((m) => (
    <button
      key={m.id}
      onClick={() => setActiveMode(m.id)}
      className={`shrink-0 whitespace-nowrap h-10 px-4 rounded-xl border transition-colors ${
        activeMode === m.id ? 'border-navy bg-navy text-white' : 'border-transparent bg-page text-gray-600'
      }`}
    >
      {m.label}
    </button>
  ))}
</div>
```

Use whichever pattern matches what Step 1 found; the invariant is **fixed height + no width reflow on selection** (kills the wobble).

- [ ] **Step 3: Typecheck + build**

Run: `npm run typecheck && npm run build`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add components/Screens/AdminQueue.tsx
git commit -m "fix(admin): stabilize cockpit mode selector layout, no wobble on switch (Refs africandatalayer-aew)"
```

- [ ] **Step 5: Device verification note**

`bd update africandatalayer-aew --notes`: "Open cockpit, switch modes repeatedly + scroll → selector must not jump/resize. In Review mode confirm risk chips + agent `<select>` filter the list and selecting rows enables mass approve (with confirm). Filters + mass-approve already implemented (AdminQueue.tsx:1383/1396/~960); this ticket is the layout stabilization + on-device confirmation."

---

## Task 7: Map reloads on every visit instead of cached state (ticket `africandatalayer-nh1`)

Screen-based nav (no router) unmounts `Home`/`HomeMap` on every tab switch, so Leaflet re-initializes and re-fetches tiles each visit. Fix: stop the remount (keep `Home` mounted and hidden when off-tab) and/or persist Leaflet view state + cache tiles.

**Files:**
- Modify: `App.tsx` (screen render — keep Home mounted) **or** `components/Screens/HomeMap.tsx` (persist center/zoom + tile cache)
- Reference: `components/Screens/Home.tsx`

- [ ] **Step 1: Diagnose the remount**

Run: `grep -n "currentScreen\|Screen.HOME\|lazy\|Suspense\|HomeMap\|key=" App.tsx components/Screens/Home.tsx components/Screens/HomeMap.tsx | head -40`
Confirm whether `Home` is conditionally rendered (`currentScreen === Screen.HOME && <Home/>`) — that unmounts it on every switch. Record in `bd update africandatalayer-nh1 --notes`.

- [ ] **Step 2: Apply the lowest-risk fix — keep Home mounted**

If App renders screens via `currentScreen === Screen.X && <Screen/>`, change the Home branch to stay mounted but visually hidden when inactive, so Leaflet keeps its instance and tiles:

```tsx
{/* Home stays mounted to preserve the Leaflet map + tile cache across tab switches */}
<div style={{ display: currentScreen === Screen.HOME ? 'contents' : 'none' }}>
  <Home /* ...existing props... */ />
</div>
```

> `display:none` on a wrapper keeps React state + the Leaflet DOM alive. Use a wrapper `div` (not `contents` when hidden — `none` on the wrapper is what hides it; `contents` when shown avoids adding a layout box). If `Home` must be lazy, keep the `<Suspense>` boundary outside this wrapper so it isn't torn down.
> Verify the map container has a stable size when hidden→shown; if Leaflet renders grey tiles after un-hiding, call `map.invalidateSize()` on becoming visible (add an effect in `HomeMap` keyed off an `isActive` prop).

- [ ] **Step 3: Persist view state as a safety net**

In `components/Screens/HomeMap.tsx`, persist center/zoom to `localStorage` on `moveend`/`zoomend` and restore on mount, so even a full remount resumes where the user left off:

```tsx
// on map ready:
map.on('moveend zoomend', () => {
  const c = map.getCenter();
  localStorage.setItem('adl_map_view', JSON.stringify({ lat: c.lat, lng: c.lng, z: map.getZoom() }));
});
// initial center/zoom:
const saved = (() => { try { return JSON.parse(localStorage.getItem('adl_map_view') || 'null'); } catch { return null; } })();
const initialCenter = saved ? [saved.lat, saved.lng] : DEFAULT_CENTER;
const initialZoom = saved?.z ?? DEFAULT_ZOOM;
```

- [ ] **Step 4: Typecheck + build**

Run: `npm run typecheck && npm run build`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add App.tsx components/Screens/HomeMap.tsx
git commit -m "fix(map): keep Home map mounted + persist view to stop reload on every visit (Refs africandatalayer-nh1)"
```

- [ ] **Step 6: Device verification note**

`bd update africandatalayer-nh1 --notes`: "Navigate Home → Profile → Home repeatedly. Expect: no white flash / tile reload; map stays at last position. On 2G the tiles must not re-download each visit."

---

## Task 8: Profile picture upload returns internal server error (ticket `africandatalayer-6ke`)

`PUT /api/user` with `imageBase64` calls `uploadProfilePhoto` → `@vercel/blob put` using `BLOB_READ_WRITE_TOKEN` (`api/user/index.ts:122-134`). The catch (`:537-544`) only maps errors whose message contains both "blob" and "token" to a clean 503; any other blob failure (missing token, network, size, content-type rejected by Blob) rethrows → opaque 500. Make the failure path explicit and testable, and validate the payload up front.

**Files:**
- Create: `lib/server/profileImageUpload.ts` (extract `parseProfileImagePayload` + `classifyBlobUploadError`)
- Create: `tests/profileImageUpload.test.ts`
- Modify: `api/user/index.ts` (use extracted helpers; guard missing token)

- [ ] **Step 1: Write the failing test**

Create `tests/profileImageUpload.test.ts`:

```ts
import assert from "node:assert/strict";
import test from "node:test";
import { parseProfileImagePayload, classifyBlobUploadError } from "../lib/server/profileImageUpload.ts";

const ONE_PX_PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

test("parses a valid png data URI", () => {
  const r = parseProfileImagePayload(ONE_PX_PNG, 5 * 1024 * 1024);
  assert.ok(r);
  assert.equal(r!.mime, "image/png");
  assert.equal(r!.ext, "png");
});

test("rejects a non-image data URI", () => {
  assert.equal(parseProfileImagePayload("data:text/plain;base64,aGk=", 5 * 1024 * 1024), null);
});

test("rejects payload over the size limit", () => {
  assert.equal(parseProfileImagePayload(ONE_PX_PNG, 4), null);
});

test("missing-token blob error classifies as 503 storage_unavailable", () => {
  const r = classifyBlobUploadError(new Error("No token found. Set BLOB_READ_WRITE_TOKEN"));
  assert.equal(r.status, 503);
  assert.equal(r.code, "storage_unavailable");
});

test("any other blob failure classifies as 502 upload_failed, no internal leak", () => {
  const r = classifyBlobUploadError(new Error("ENOTFOUND blob.vercel-storage.com"));
  assert.equal(r.status, 502);
  assert.equal(r.code, "upload_failed");
  assert.ok(!/ENOTFOUND/.test(r.message));
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx tsx --test tests/profileImageUpload.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the helpers**

Create `lib/server/profileImageUpload.ts` (move the regex/constants from `api/user/index.ts:44-45`, `96-120`):

```ts
const INLINE_PROFILE_IMAGE_REGEX = /^data:(image\/[a-z0-9.+-]+);base64,/i;
const ALLOWED_PROFILE_IMAGE_MIME = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);

export function mimeToExtension(mime: string): string {
  switch (mime) {
    case "image/png": return "png";
    case "image/webp": return "webp";
    default: return "jpg";
  }
}

export function parseProfileImagePayload(
  imageBase64: string,
  maxBytes: number,
): { imageBuffer: Buffer; mime: string; ext: string } | null {
  const match = imageBase64.match(INLINE_PROFILE_IMAGE_REGEX);
  if (!match) return null;
  const mime = match[1]?.toLowerCase() ?? "";
  if (!ALLOWED_PROFILE_IMAGE_MIME.has(mime)) return null;
  const commaIndex = imageBase64.indexOf(",");
  const base64 = commaIndex === -1 ? imageBase64 : imageBase64.slice(commaIndex + 1);
  const imageBuffer = Buffer.from(base64, "base64");
  if (!imageBuffer.length || imageBuffer.byteLength > maxBytes) return null;
  return { imageBuffer, mime, ext: mimeToExtension(mime) };
}

export interface UploadError { status: number; code: string; message: string; }

export function classifyBlobUploadError(error: unknown): UploadError {
  const msg = (error instanceof Error ? error.message : String(error)).toLowerCase();
  if (msg.includes("token")) {
    return { status: 503, code: "storage_unavailable", message: "Photo storage is not configured" };
  }
  return { status: 502, code: "upload_failed", message: "Could not upload the photo, please try again" };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx tsx --test tests/profileImageUpload.test.ts`
Expected: PASS (5/5).

- [ ] **Step 5: Use helpers + guard in the handler**

In `api/user/index.ts`: delete the now-duplicated `INLINE_PROFILE_IMAGE_REGEX`, `ALLOWED_PROFILE_IMAGE_MIME`, `mimeToExtension`, `parseProfileImagePayload` definitions and import from the new module:

```ts
import { parseProfileImagePayload, classifyBlobUploadError } from "../../lib/server/profileImageUpload";
```

Update the call site (`:522-528`) to pass the byte limit and wrap the blob upload so failures classify instead of 500:

```ts
    const profileImageBase64 = body?.imageBase64 ?? body?.imagebase64;
    if (profileImageBase64 !== undefined) {
      const parsedImage = parseProfileImagePayload(profileImageBase64, MAX_PROFILE_IMAGE_BYTES);
      if (!parsedImage) return errorResponse("Invalid profile image", 400);
      try {
        profile.image = await uploadProfilePhoto(auth.id, parsedImage.imageBuffer, parsedImage.mime, parsedImage.ext);
      } catch (uploadError) {
        console.error("[api/user] profile photo upload failed", uploadError);
        const u = classifyBlobUploadError(uploadError);
        return errorResponse(u.message, u.status, { code: u.code });
      }
      profile.avatarPreset = undefined;
    }
```

Also, in `uploadProfilePhoto` (`:122-134`), fail fast with a clear error when the token is absent so it classifies as 503 rather than letting `put` throw an opaque error:

```ts
async function uploadProfilePhoto(userId: string, imageBuffer: Buffer, mime: string, ext: string): Promise<string> {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) throw new Error("Missing BLOB_READ_WRITE_TOKEN token for blob upload");
  const { put } = await import("@vercel/blob");
  const safeUserId = userId.replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 96) || "user";
  const pathname = `profiles/${safeUserId}-${Date.now()}.${ext}`;
  const uploaded = await put(pathname, imageBuffer, {
    access: "public",
    contentType: mime,
    addRandomSuffix: false,
    token,
  });
  return uploaded.url;
}
```

(Confirm `MAX_PROFILE_IMAGE_BYTES` is still defined in `api/user/index.ts`; keep it there.)

- [ ] **Step 6: Typecheck + full suite**

Run: `npm run typecheck && npm test`
Expected: clean / pass.

- [ ] **Step 7: Commit**

```bash
git add lib/server/profileImageUpload.ts tests/profileImageUpload.test.ts api/user/index.ts
git commit -m "fix(profile): classify blob upload failures so photo upload no longer 500s (Refs africandatalayer-6ke)"
```

- [ ] **Step 8: Device verification note**

`bd update africandatalayer-6ke --notes`: "Upload a profile photo on device. If it now returns a clear message instead of 500: 503/storage_unavailable ⇒ BLOB_READ_WRITE_TOKEN missing in the env the app hits (set it in Vercel); 502/upload_failed ⇒ network/Blob issue (capture device console). Root cause was opaque 500 masking a missing/failing blob token."

---

## Final Review (after all 8 tasks)

- [ ] **Run the full CI gate**

Run: `npm run test:ci`
Expected: lint + typecheck + test + build all green.

- [ ] **Dispatch a final code review** over the whole branch diff (superpowers:requesting-code-review).

- [ ] **Close tickets** as each is verified on device; the epic `africandatalayer-8oz` closes when all 8 children are done.

- [ ] **Push** (per CLAUDE.md session-close protocol):

```bash
git pull --rebase
bd dolt push
git push
git status   # MUST show up to date with origin/ios
```

---

## Self-Review (author checklist — completed)

**Spec coverage:** aew→T6, 7so→T4, oi2→T1, nh1→T7, fji→T2, 5np→T5, 7uj→T3, 6ke→T8. All 8 epic children mapped. ✅

**Cross-task dependency:** T2/T3/T5/T6 assume T1 merged (admin profile loads). T5 assumes T4. Stated in each task. ✅

**Placeholder scan:** Server tasks (1, 4, 8) ship full exact code + real tests. UI/diagnostic tasks (2, 3, 5, 6, 7) carry a mandated *read-current-code* diagnostic first step (legitimate for bug-fix work where exact lines must be confirmed at edit time, since there is no component test harness) plus concrete fix code and explicit device-verification steps — not "TODO/implement later". ✅

**Type consistency:** `resolveOrProvisionProfile` / `buildBootstrapAdminProfile` (T1), `classifyUserViewError` (T4), `parseProfileImagePayload(payload, maxBytes)` / `classifyBlobUploadError` (T8) names are used identically in their tests and call sites. ✅

**Known runtime-confirmation items (code-only constraint):** T4/T5 may surface a missing `collection_assignments` migration; T8 may surface a missing `BLOB_READ_WRITE_TOKEN` — both now produce a *diagnosable classified error* on device instead of an opaque 500, with the next action documented in the ticket notes.
