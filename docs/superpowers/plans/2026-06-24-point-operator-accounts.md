# Point Operator Accounts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add admin-created `point_operator` accounts linked one-to-one to verified points, with a two-tab offline-first status/profile experience on web/Android and native iOS.

**Architecture:** Keep point data event-sourced. Dedicated operator endpoints resolve the active point assignment server-side and create constrained `ENRICH_EVENT`s carrying operator-signal metadata; projection skips rejected events and omits expired signal values. A separate assignment service owns account↔point lifecycle, while web and iOS clients expose only Status and Profile for this role.

**Tech Stack:** TypeScript, React 19, Vite, Auth.js JWT sessions, Zod, Postgres/Supabase migrations, IndexedDB, SwiftUI, URLSession, local JSON persistence, Node test runner, Playwright, Xcode.

---

## Scope and delivery order

This is one integrated vertical slice. Do not ship UI before server authorization and assignment constraints exist.

1. Shared role and database contract.
2. Vertical signal configuration and expiry semantics.
3. Assignment lifecycle service.
4. Admin and operator APIs.
5. Auth/password-change enforcement.
6. Projection, review, provenance, and public consumption.
7. Web/Android offline client and two-tab shell.
8. Admin web workflow.
9. Native iOS models, services, queue, shell, and admin workflow.
10. Cross-platform verification and rollout guard.

## File structure

### Shared contracts

- Modify `shared/types.ts`: add `point_operator`, assignment/signal types, new detail fields, and password-change flag.
- Modify `shared/verticals.ts`: define 1–3 operator controls per vertical and canonical normalization.
- Modify `types.ts`: expose operator signal data to responsive UI models.

### Database and server

- Create `supabase/migrations/20260624_point_operator_accounts.sql`: role constraint, password flag, assignments table, indexes, audit types.
- Create `lib/server/pointOperatorConfig.ts`: server-safe control lookup and expiry helpers.
- Create `lib/server/pointOperatorStore.ts`: assignment persistence and point lookup.
- Create `lib/server/pointOperatorService.ts`: lifecycle, status/photo event creation, anomaly classification.
- Create `api/point-operator/index.ts`: dedicated admin/operator handlers.
- Modify `api/user/index.ts`: prevent generic role editor from creating an unlinked operator.
- Modify `lib/server/validation.ts`: request schemas.
- Modify `lib/server/securityAudit.ts`: audit event union.
- Modify `lib/server/auth/handler.ts`: role/password claims.
- Modify `lib/auth.ts`: typed claims.
- Modify `lib/server/submissionAccess.ts`: fail closed for operator on agent actions.
- Modify `lib/server/pointProjection.ts`: rejection and expiry semantics, provenance.
- Modify `lib/server/submissionDetails.ts`: internal metadata filtering.
- Modify `lib/server/snapshotEngine.ts`: consume expiry-aware projection.

### Responsive web / Android

- Create `lib/client/pointOperatorApi.ts`: load assignment, submit status/photo, change password.
- Create `lib/client/pointOperatorQueue.ts`: IndexedDB mutation queue and replay.
- Create `lib/client/pointOperatorUi.ts`: pure role-routing and signal-display helpers.
- Modify `lib/client/auth.ts`: typed operator role and password-change session claim.
- Create `components/Screens/PointOperatorStatus.tsx`: status-first controls.
- Create `components/Screens/PointOperatorProfile.tsx`: photo and settings.
- Create `components/Screens/PointOperatorPasswordChange.tsx`: mandatory first-login gate.
- Create `components/PointOperatorNavigation.tsx`: exactly two tabs.
- Modify `App.tsx`, `components/Navigation.tsx`, `components/Screens/Profile.tsx`, `components/Screens/Details.tsx`.

### Native iOS

- Modify `ios/App/App/Native/ADLModels.swift`: role, routes, DTOs, controls, signal state.
- Modify `ios/App/App/Native/ADLServices.swift`: API methods, auth flag, durable operator queue.
- Modify `ios/App/App/Native/ADLViews.swift`: status/profile/password/admin assignment views.

### Tests and docs

- Create focused Node tests named in each task.
- Modify `e2e/fixtures/mockApi.ts`.
- Create `e2e/smoke/point-operator.smoke.spec.ts`.
- Modify `e2e/smoke/admin-access-controls.smoke.spec.ts`.
- Modify `lib/docs/helpCenter.ts`.

---

### Task 1: Add role, assignment schema, and shared types

**Files:**
- Create: `supabase/migrations/20260624_point_operator_accounts.sql`
- Modify: `shared/types.ts`
- Modify: `lib/server/storage/postgresStore.ts`
- Test: `tests/pointOperatorMigrationContract.test.ts`

- [ ] **Step 1: Write the failing migration-contract test**

Create `tests/pointOperatorMigrationContract.test.ts`:

```ts
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationPath = new URL(
  "../supabase/migrations/20260624_point_operator_accounts.sql",
  import.meta.url,
);

test("point operator migration defines role, password gate, and active uniqueness", async () => {
  const sql = await readFile(migrationPath, "utf8");
  assert.match(sql, /point_operator/);
  assert.match(sql, /must_change_password boolean not null default false/);
  assert.match(sql, /create table if not exists public\.point_operator_assignments/);
  assert.match(sql, /where status = 'active'/);
  assert.match(sql, /operator_user_id/);
  assert.match(sql, /point_id/);
});
```

- [ ] **Step 2: Run the test and verify failure**

Run:

```bash
node --import tsx --test tests/pointOperatorMigrationContract.test.ts
```

Expected: FAIL with `ENOENT` for the missing migration.

- [ ] **Step 3: Create the migration**

Create `supabase/migrations/20260624_point_operator_accounts.sql`:

```sql
ALTER TABLE public.user_profiles
  DROP CONSTRAINT IF EXISTS user_profiles_role_check;

ALTER TABLE public.user_profiles
  ADD CONSTRAINT user_profiles_role_check
  CHECK (role IN ('agent', 'admin', 'client', 'point_operator'));

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.point_operator_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operator_user_id text NOT NULL REFERENCES public.user_profiles(id),
  point_id text NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
  granted_by text NOT NULL REFERENCES public.user_profiles(id),
  granted_at timestamptz NOT NULL DEFAULT now(),
  revoked_by text REFERENCES public.user_profiles(id),
  revoked_at timestamptz,
  revoke_reason text,
  CHECK (
    (status = 'active' AND revoked_by IS NULL AND revoked_at IS NULL)
    OR
    (status = 'revoked' AND revoked_by IS NOT NULL AND revoked_at IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS point_operator_one_active_per_user
  ON public.point_operator_assignments(operator_user_id)
  WHERE status = 'active';

CREATE UNIQUE INDEX IF NOT EXISTS point_operator_one_active_per_point
  ON public.point_operator_assignments(point_id)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS point_operator_assignments_point_history
  ON public.point_operator_assignments(point_id, granted_at DESC);
```

Extend the migration’s `security_audit_log_event_type_check` list with:

```sql
'point_operator_account_created',
'point_operator_assignment_granted',
'point_operator_assignment_revoked',
'point_operator_assignment_replaced',
'point_operator_password_changed'
```

- [ ] **Step 4: Add shared types**

In `shared/types.ts`, use these exact contracts:

```ts
export type UserRole = "agent" | "admin" | "client" | "point_operator";

export type PointOperatorAssignmentStatus = "active" | "revoked";
export type PointOperatorReviewState = "auto_approved" | "pending_review" | "rejected";

export interface PointOperatorAssignment {
  id: string;
  operatorUserId: string;
  pointId: string;
  status: PointOperatorAssignmentStatus;
  grantedBy: string;
  grantedAt: string;
  revokedBy?: string | null;
  revokedAt?: string | null;
  revokeReason?: string | null;
}

export interface PointOperatorSignalState {
  field: string;
  value: boolean | null;
  reportedBy: "point_operator";
  reportedAt: string;
  expiresAt: string;
  isExpired: boolean;
  eventId: string;
  reviewState: PointOperatorReviewState;
}

export interface PointOperatorControlDefinition {
  field: string;
  labelEn: string;
  labelFr: string;
  expiryHours: number;
}

export interface PointOperatorMeResponse {
  assignment: PointOperatorAssignment;
  point: ProjectedPoint;
  controls: PointOperatorControlDefinition[];
  signals: Record<string, PointOperatorSignalState>;
}

export interface PointOperatorMutationResponse {
  eventId: string;
  point: ProjectedPoint;
  signal?: PointOperatorSignalState;
}
```

Add to `SubmissionDetails`:

```ts
hasEssentialMedicinesAvailable?: boolean;
isQueueBusy?: boolean;
isFoodAvailableNow?: boolean;
isSeatingAvailableNow?: boolean;
isOperational?: boolean;
isFlooded?: boolean;
hasWorkingStreetLight?: boolean;
operatorSignal?: {
  field: string;
  reportedAt: string;
  expiresAt: string;
  reviewState: PointOperatorReviewState;
};
operatorPhotoUpdate?: boolean;
```

Add to `ProjectedPoint`:

```ts
operatorSignals?: Record<string, PointOperatorSignalState>;
```

Add to `UserProfile`:

```ts
mustChangePassword?: boolean;
```

- [ ] **Step 5: Persist the new profile field and role**

In `lib/server/storage/postgresStore.ts`:

```ts
const VALID_ROLES: ReadonlySet<UserRole> = new Set([
  "agent",
  "admin",
  "client",
  "point_operator",
]);
```

Include `must_change_password` in profile SELECT/INSERT/UPDATE statements and map it with:

```ts
mustChangePassword: row.must_change_password === true,
```

- [ ] **Step 6: Run focused tests and typecheck**

Run:

```bash
node --import tsx --test tests/pointOperatorMigrationContract.test.ts
npm run typecheck
```

Expected: migration test PASS; typecheck PASS.

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/20260624_point_operator_accounts.sql shared/types.ts lib/server/storage/postgresStore.ts tests/pointOperatorMigrationContract.test.ts
git commit -m "feat(point-operator): add role and assignment schema"
```

---

### Task 2: Define vertical controls and expiry semantics

**Files:**
- Create: `lib/server/pointOperatorConfig.ts`
- Modify: `shared/verticals.ts`
- Test: `tests/pointOperatorConfig.test.ts`

- [ ] **Step 1: Write failing configuration tests**

Create `tests/pointOperatorConfig.test.ts`:

```ts
import assert from "node:assert/strict";
import test from "node:test";
import {
  getPointOperatorControls,
  resolvePointOperatorExpiry,
} from "../lib/server/pointOperatorConfig.js";

test("every vertical exposes between one and three operator controls", () => {
  for (const vertical of [
    "pharmacy",
    "mobile_money",
    "fuel_station",
    "alcohol_outlet",
    "billboard",
    "transport_road",
    "census_proxy",
  ] as const) {
    const controls = getPointOperatorControls(vertical);
    assert.ok(controls.length >= 1);
    assert.ok(controls.length <= 3);
    assert.equal(new Set(controls.map((control) => control.field)).size, controls.length);
  }
});

test("pharmacy open-now expires six hours after report time", () => {
  const expiry = resolvePointOperatorExpiry(
    "pharmacy",
    "isOpenNow",
    new Date("2026-06-24T08:00:00.000Z"),
  );
  assert.equal(expiry.toISOString(), "2026-06-24T14:00:00.000Z");
});

test("unsupported controls fail closed", () => {
  assert.throws(
    () => resolvePointOperatorExpiry("pharmacy", "hasFuelAvailable", new Date()),
    /not allowed/,
  );
});
```

- [ ] **Step 2: Run test and verify failure**

```bash
node --import tsx --test tests/pointOperatorConfig.test.ts
```

Expected: FAIL because `pointOperatorConfig.ts` does not exist.

- [ ] **Step 3: Extend vertical configuration**

In `shared/verticals.ts`, add:

```ts
export interface PointOperatorControl {
  field: string;
  labelEn: string;
  labelFr: string;
  expiryHours: number;
}

export interface VerticalConfig {
  // existing fields...
  operatorControls: readonly PointOperatorControl[];
}
```

Populate each vertical exactly as specified in the approved design. Example:

```ts
operatorControls: [
  { field: "isOpenNow", labelEn: "Open now", labelFr: "Ouvert maintenant", expiryHours: 6 },
  { field: "isOnDuty", labelEn: "On guard", labelFr: "De garde", expiryHours: 12 },
  {
    field: "hasEssentialMedicinesAvailable",
    labelEn: "Essential medicines available",
    labelFr: "Médicaments essentiels disponibles",
    expiryHours: 24,
  },
],
```

Add every operator field to the same vertical’s `enrichableFields` and normalize booleans in its normalizer.

- [ ] **Step 4: Implement server-safe lookup**

Create `lib/server/pointOperatorConfig.ts`:

```ts
import type { SubmissionCategory } from "../../shared/types.js";
import { getVertical } from "../../shared/verticals.js";

export function getPointOperatorControls(category: SubmissionCategory) {
  return [...getVertical(category).operatorControls];
}

export function getPointOperatorControl(category: SubmissionCategory, field: string) {
  return getPointOperatorControls(category).find((control) => control.field === field) ?? null;
}

export function resolvePointOperatorExpiry(
  category: SubmissionCategory,
  field: string,
  reportedAt: Date,
): Date {
  const control = getPointOperatorControl(category, field);
  if (!control) throw new Error(`Operator field '${field}' is not allowed for '${category}'`);
  return new Date(reportedAt.getTime() + control.expiryHours * 60 * 60 * 1000);
}
```

- [ ] **Step 5: Run tests**

```bash
node --import tsx --test tests/pointOperatorConfig.test.ts
npm run typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add shared/verticals.ts lib/server/pointOperatorConfig.ts tests/pointOperatorConfig.test.ts
git commit -m "feat(point-operator): define vertical status controls"
```

---

### Task 3: Build assignment persistence and lifecycle service

**Files:**
- Create: `lib/server/pointOperatorStore.ts`
- Create: `lib/server/pointOperatorService.ts`
- Test: `tests/pointOperatorAssignments.test.ts`

- [ ] **Step 1: Write failing lifecycle tests**

Create `tests/pointOperatorAssignments.test.ts` with injected store dependencies:

```ts
import assert from "node:assert/strict";
import test from "node:test";
import { createPointOperatorLifecycle } from "../lib/server/pointOperatorService.js";

test("grant rejects a missing verified point", async () => {
  const lifecycle = createPointOperatorLifecycle({
    getProjectedPointFn: async () => null,
    getActiveByOperatorFn: async () => null,
    getActiveByPointFn: async () => null,
    transactionFn: async () => {
      throw new Error("transaction must not run");
    },
  });

  await assert.rejects(
    lifecycle.grant({
      actorUserId: "admin@example.com",
      operatorUserId: "operator@example.com",
      pointId: "missing-point",
    }),
    /Verified point not found/,
  );
});

test("grant rejects a second active operator for one point", async () => {
  const lifecycle = createPointOperatorLifecycle({
    getProjectedPointFn: async () => ({ pointId: "p1" }) as never,
    getActiveByOperatorFn: async () => null,
    getActiveByPointFn: async () => ({ id: "existing" }) as never,
    transactionFn: async () => {
      throw new Error("transaction must not run");
    },
  });

  await assert.rejects(
    lifecycle.grant({
      actorUserId: "admin@example.com",
      operatorUserId: "operator@example.com",
      pointId: "p1",
    }),
    /already has an active operator/,
  );
});
```

- [ ] **Step 2: Run test and verify failure**

```bash
node --import tsx --test tests/pointOperatorAssignments.test.ts
```

Expected: FAIL because service does not exist.

- [ ] **Step 3: Implement store functions**

Create `lib/server/pointOperatorStore.ts` exporting:

```ts
export async function getActivePointOperatorAssignmentByUser(userId: string): Promise<PointOperatorAssignment | null>;
export async function getActivePointOperatorAssignmentByPoint(pointId: string): Promise<PointOperatorAssignment | null>;
export async function listPointOperatorAssignmentHistory(pointId: string): Promise<PointOperatorAssignment[]>;
export async function findProjectedPointForAssignment(pointId: string): Promise<ProjectedPoint | null>;
export async function grantPointOperatorAssignmentTx(input: GrantAssignmentInput): Promise<PointOperatorAssignment>;
export async function revokePointOperatorAssignmentTx(input: RevokeAssignmentInput): Promise<PointOperatorAssignment>;
```

`findProjectedPointForAssignment` must load point events and call `projectPointById`; do not trust a client-provided point summary.

- [ ] **Step 4: Implement lifecycle service**

Create `lib/server/pointOperatorService.ts`:

```ts
export function createPointOperatorLifecycle(deps: PointOperatorLifecycleDeps = defaultDeps) {
  return {
    async grant(input: GrantPointOperatorInput) {
      const point = await deps.getProjectedPointFn(input.pointId);
      if (!point) throw new Error("Verified point not found");
      if (await deps.getActiveByOperatorFn(input.operatorUserId)) {
        throw new Error("Operator already has an active point");
      }
      if (await deps.getActiveByPointFn(input.pointId)) {
        throw new Error("Point already has an active operator");
      }
      return await deps.transactionFn(input);
    },
    async revoke(input: RevokePointOperatorInput) {
      const active = await deps.getActiveByOperatorFn(input.operatorUserId);
      if (!active) throw new Error("Active operator assignment not found");
      return await deps.revokeFn(input);
    },
  };
}
```

The default transaction must update profile role/password gate and create assignment in one Postgres transaction.

- [ ] **Step 5: Add transaction/uniqueness tests and run**

Add tests for:

- one active point per operator;
- one active operator per point;
- revoke requires reason;
- revoked row remains in history;
- assigning existing admin fails;
- transactional failure leaves no profile-role change.

Run:

```bash
node --import tsx --test tests/pointOperatorAssignments.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/server/pointOperatorStore.ts lib/server/pointOperatorService.ts tests/pointOperatorAssignments.test.ts
git commit -m "feat(point-operator): add assignment lifecycle"
```

---

### Task 4: Add validation and dedicated admin/operator API

**Files:**
- Modify: `lib/server/validation.ts`
- Modify: `lib/server/securityAudit.ts`
- Create: `api/point-operator/index.ts`
- Modify: `api/user/index.ts`
- Test: `tests/pointOperatorApi.test.ts`

- [ ] **Step 1: Write failing API authorization tests**

Create `tests/pointOperatorApi.test.ts`:

```ts
import assert from "node:assert/strict";
import test from "node:test";
import { createPointOperatorHandler } from "../api/point-operator/index.js";

test("agent cannot create point operator account", async () => {
  const handler = createPointOperatorHandler({
    requireUserFn: async () => ({ id: "agent@example.com", token: {}, role: "agent" }),
  });
  const response = await handler(new Request("http://localhost/api/point-operator?view=admin_create", {
    method: "POST",
    body: JSON.stringify({}),
  }));
  assert.equal(response.status, 403);
});

test("operator status endpoint ignores client point id", async () => {
  let received: unknown;
  const handler = createPointOperatorHandler({
    requireUserFn: async () => ({ id: "op@example.com", token: {}, role: "point_operator" }),
    submitSignalFn: async (input) => {
      received = input;
      return { eventId: "event-1" };
    },
  });
  const response = await handler(new Request("http://localhost/api/point-operator?view=status", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Idempotency-Key": "key-1" },
    body: JSON.stringify({ field: "isOpenNow", value: true, pointId: "spoofed" }),
  }));
  assert.equal(response.status, 201);
  assert.deepEqual(received, {
    operatorUserId: "op@example.com",
    field: "isOpenNow",
    value: true,
    idempotencyKey: "key-1",
  });
});
```

- [ ] **Step 2: Run and verify failure**

```bash
node --import tsx --test tests/pointOperatorApi.test.ts
```

Expected: FAIL because API module is missing.

- [ ] **Step 3: Add schemas**

In `lib/server/validation.ts`:

```ts
export const pointOperatorCreateSchema = z.object({
  identifier: z.string().trim().min(3).max(160),
  name: z.string().trim().min(1).max(160),
  password: z.string().min(10).max(128),
  pointId: z.string().trim().min(1).max(200),
  note: z.string().trim().max(500).optional(),
}).strict();

export const pointOperatorSignalSchema = z.object({
  field: z.string().trim().min(1).max(80),
  value: z.boolean(),
  capturedAt: z.string().datetime().optional(),
}).strict();

export const pointOperatorRevokeSchema = z.object({
  operatorUserId: z.string().trim().min(1).max(160),
  reason: z.string().trim().min(3).max(500),
}).strict();

export const pointOperatorPhotoSchema = z.object({
  imageData: z.string().min(1).max(10_000_000),
  capturedAt: z.string().datetime().optional(),
}).strict();

export const pointOperatorPasswordSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: z.string()
    .min(10)
    .max(128)
    .regex(/[A-Z]/)
    .regex(/[a-z]/)
    .regex(/[0-9]/),
}).strict();
```

- [ ] **Step 4: Implement endpoint routing**

Create `api/point-operator/index.ts` with explicit views:

```ts
type PointOperatorView =
  | "admin_search_points"
  | "admin_create"
  | "admin_assignment"
  | "admin_revoke"
  | "me"
  | "status"
  | "photo"
  | "password";
```

Rules:

- `admin_*`: require `role === "admin"` or admin claim.
- `me`, `status`, `photo`, `password`: require `role === "point_operator"`.
- `status`: body contains only field/value/capturedAt; assignment and category resolve server-side.
- all writes require idempotency handling.
- return controlled `401`, `403`, `404`, `409`, `422`, `503`.

- [ ] **Step 5: Prevent unlinked generic role changes**

In `api/user/index.ts`, reject `point_operator` in the existing generic account-create/access handlers. Keep `adminAccountCreateSchema` limited to:

```ts
role: z.enum(["agent", "admin", "client"]).default("client")
```

Only `api/point-operator` may grant the operator role.

- [ ] **Step 6: Add audit event names**

In `lib/server/securityAudit.ts`, add all five approved point-operator event types.

- [ ] **Step 7: Complete API tests**

Cover:

- admin create succeeds and returns assignment;
- duplicate point/operator returns `409`;
- point search excludes nonexistent/projected-away points;
- operator loads only assigned point;
- missing/revoked assignment returns `403`;
- spoofed point/category fields are rejected by strict schema;
- agent/client/admin cannot call operator status endpoint.

Run:

```bash
node --import tsx --test tests/pointOperatorApi.test.ts
npm run typecheck
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add lib/server/validation.ts lib/server/securityAudit.ts api/point-operator/index.ts api/user/index.ts tests/pointOperatorApi.test.ts
git commit -m "feat(point-operator): add dedicated APIs"
```

---

### Task 5: Create constrained events, anomaly review, expiry-aware projection

**Files:**
- Modify: `lib/server/pointOperatorService.ts`
- Modify: `lib/server/pointProjection.ts`
- Modify: `lib/server/submissionDetails.ts`
- Modify: `lib/server/snapshotEngine.ts`
- Modify: `shared/xp.ts`
- Test: `tests/pointOperatorEvents.test.ts`
- Test: `tests/pointOperatorProjection.test.ts`

- [ ] **Step 1: Write failing event tests**

Create `tests/pointOperatorEvents.test.ts`:

```ts
import assert from "node:assert/strict";
import test from "node:test";
import { buildPointOperatorSignalEvent } from "../lib/server/pointOperatorService.js";

test("operator status becomes a single-field enrich event", () => {
  const event = buildPointOperatorSignalEvent({
    eventId: "00000000-0000-4000-8000-000000000001",
    operatorUserId: "op@example.com",
    point: {
      pointId: "pharmacy-s16gdp-a1",
      category: "pharmacy",
      location: { latitude: 4.08, longitude: 9.74 },
    },
    field: "isOpenNow",
    value: true,
    reportedAt: new Date("2026-06-24T08:00:00.000Z"),
    reviewState: "auto_approved",
  });

  assert.equal(event.eventType, "ENRICH_EVENT");
  assert.equal(event.source, "point_operator");
  assert.deepEqual(event.details.isOpenNow, true);
  assert.equal(event.details.operatorSignal?.field, "isOpenNow");
  assert.equal(event.details.operatorSignal?.expiresAt, "2026-06-24T14:00:00.000Z");
});
```

- [ ] **Step 2: Write failing projection tests**

Create `tests/pointOperatorProjection.test.ts` testing:

```ts
test("expired operator value projects as unknown", () => {
  const point = projectPointsFromEvents([freshCreate, expiredOperatorEvent], {
    now: new Date("2026-06-25T00:00:00.000Z"),
  })[0]!;
  assert.equal(point.details.isOpenNow, undefined);
  assert.equal(point.operatorSignals?.isOpenNow?.isExpired, true);
  assert.equal(point.operatorSignals?.isOpenNow?.value, null);
});

test("rejected operator photo falls back to previous accepted photo", () => {
  const point = projectPointsFromEvents([createWithPhoto, rejectedPhotoEvent])[0]!;
  assert.equal(point.photoUrl, createWithPhoto.photoUrl);
});
```

- [ ] **Step 3: Run tests and verify failure**

```bash
node --import tsx --test tests/pointOperatorEvents.test.ts tests/pointOperatorProjection.test.ts
```

Expected: FAIL.

- [ ] **Step 4: Build status/photo events**

In `lib/server/pointOperatorService.ts`, implement:

```ts
export function buildPointOperatorSignalEvent(input: BuildSignalEventInput): PointEvent;
export function buildPointOperatorPhotoEvent(input: BuildPhotoEventInput): PointEvent;
export async function submitPointOperatorSignal(input: SubmitSignalInput): Promise<PointEvent>;
export async function submitPointOperatorPhoto(input: SubmitPhotoInput): Promise<PointEvent>;
```

Event details must include:

```ts
operatorSignal: {
  field,
  reportedAt: reportedAt.toISOString(),
  expiresAt: resolvePointOperatorExpiry(category, field, reportedAt).toISOString(),
  reviewState,
},
reviewStatus: reviewState === "pending_review" ? "pending_review" : "auto_approved",
xpAwarded: 0,
```

Photo events use:

```ts
details: {
  operatorPhotoUpdate: true,
  reviewStatus: "pending_review",
  xpAwarded: 0,
}
```

- [ ] **Step 5: Add anomaly classification**

Implement a focused classifier:

```ts
export function classifyPointOperatorSignal(input: {
  field: string;
  recentSameFieldEvents: PointEvent[];
  value: boolean;
  capturedAt: Date;
  recentVerifiedAgentValue?: boolean;
}): "auto_approved" | "pending_review" {
  const lastHour = input.recentSameFieldEvents.filter(
    (event) => input.capturedAt.getTime() - new Date(event.createdAt).getTime() <= 60 * 60 * 1000,
  );
  const flips = lastHour.filter(
    (event) => event.details[input.field] !== input.value,
  );
  if (lastHour.length >= 6 || flips.length >= 3) return "pending_review";
  if (
    typeof input.recentVerifiedAgentValue === "boolean" &&
    input.recentVerifiedAgentValue !== input.value
  ) return "pending_review";
  return "auto_approved";
}
```

- [ ] **Step 6: Make projection review- and expiry-aware**

Change signature:

```ts
export function projectPointsFromEvents(
  events: PointEvent[],
  options: { now?: Date } = {},
): ProjectedPoint[]
```

Before applying an event:

```ts
if (isRejectedReviewEvent(event.details)) continue;
```

For operator signals:

```ts
const metadata = event.details.operatorSignal;
const isExpired = new Date(metadata.expiresAt).getTime() <= now.getTime();
projected.operatorSignals ??= {};
projected.operatorSignals[metadata.field] = {
  field: metadata.field,
  value: isExpired ? null : Boolean(event.details[metadata.field]),
  reportedBy: "point_operator",
  reportedAt: metadata.reportedAt,
  expiresAt: metadata.expiresAt,
  isExpired,
  eventId: event.id,
  reviewState: metadata.reviewState,
};
if (isExpired) delete projected.details[metadata.field];
```

Rejected photo events must not replace `photoUrl`.

- [ ] **Step 7: Exclude metadata and XP**

- Add `operatorSignal` and `operatorPhotoUpdate` to internal detail keys in `lib/server/submissionDetails.ts`.
- In `shared/xp.ts`, return zero for `event.source === "point_operator"`.
- Ensure snapshot generation calls expiry-aware projection with the snapshot run time.

- [ ] **Step 8: Run tests**

```bash
node --import tsx --test tests/pointOperatorEvents.test.ts tests/pointOperatorProjection.test.ts tests/xp.test.ts
npm run typecheck
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add lib/server/pointOperatorService.ts lib/server/pointProjection.ts lib/server/submissionDetails.ts lib/server/snapshotEngine.ts shared/xp.ts tests/pointOperatorEvents.test.ts tests/pointOperatorProjection.test.ts tests/xp.test.ts
git commit -m "feat(point-operator): project trusted live signals"
```

---

### Task 6: Enforce temporary-password replacement and session invalidation

**Files:**
- Modify: `lib/server/auth/handler.ts`
- Modify: `lib/auth.ts`
- Modify: `api/point-operator/index.ts`
- Modify: `lib/server/submissionAccess.ts`
- Test: `tests/pointOperatorAuth.test.ts`

- [ ] **Step 1: Write failing claim and permission tests**

Create `tests/pointOperatorAuth.test.ts`:

```ts
import assert from "node:assert/strict";
import test from "node:test";
import { applyRoleClaimsToToken } from "../lib/server/auth/handler.js";
import { canPerformAction } from "../lib/server/submissionAccess.js";

test("operator token carries password-change gate", async () => {
  const token = await applyRoleClaimsToToken({}, { id: "op@example.com" }, {
    getUserProfileFn: async () => ({
      id: "op@example.com",
      email: "op@example.com",
      name: "Operator",
      XP: 0,
      role: "point_operator",
      mustChangePassword: true,
    }),
  });
  assert.equal(token.role, "point_operator");
  assert.equal(token.mustChangePassword, true);
});

test("operator cannot use generic submission action", () => {
  assert.equal(canPerformAction("point_operator", "submit"), false);
  assert.equal(canPerformAction("point_operator", "read"), true);
});
```

- [ ] **Step 2: Run and verify failure**

```bash
node --import tsx --test tests/pointOperatorAuth.test.ts
```

Expected: FAIL because claim is absent and unknown roles currently fall back to agent permissions.

- [ ] **Step 3: Add JWT claim**

Extend token/session types with:

```ts
mustChangePassword?: boolean;
sessionVersion?: number;
```

In `applyRoleClaimsToToken`, always refresh profile role and password gate when a user signs in:

```ts
token.role = profile.role ?? "agent";
token.mustChangePassword = profile.mustChangePassword === true;
```

Do not let `point_operator` fall back to agent.

- [ ] **Step 4: Fail closed in RBAC**

In `lib/server/submissionAccess.ts`:

```ts
const ROLE_PERMISSIONS: Record<string, ReadonlySet<RbacAction>> = {
  agent: new Set(["submit", "read"]),
  client: new Set(["read"]),
  point_operator: new Set(["read"]),
  admin: new Set(["submit", "read", "review", "manage_users", "delete"]),
};

export function canPerformAction(role: string, action: RbacAction): boolean {
  return ROLE_PERMISSIONS[role]?.has(action) ?? false;
}
```

- [ ] **Step 5: Implement password endpoint**

`POST /api/point-operator?view=password`:

- verifies current temporary password;
- validates replacement with existing password rules;
- hashes with bcrypt cost 12;
- sets `mustChangePassword = false`;
- increments session version or updates an equivalent revocation marker;
- audits `point_operator_password_changed`.

Response:

```ts
return jsonResponse({ changed: true, reauthenticate: true }, { status: 200 });
```

- [ ] **Step 6: Run tests**

```bash
node --import tsx --test tests/pointOperatorAuth.test.ts
npm run typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add lib/server/auth/handler.ts lib/auth.ts api/point-operator/index.ts lib/server/submissionAccess.ts tests/pointOperatorAuth.test.ts
git commit -m "feat(point-operator): enforce first-login password change"
```

---

### Task 7: Add responsive client API and durable offline queue

**Files:**
- Create: `lib/client/pointOperatorApi.ts`
- Create: `lib/client/pointOperatorQueue.ts`
- Test: `tests/pointOperatorQueue.test.ts`

- [ ] **Step 1: Write failing queue tests**

Create `tests/pointOperatorQueue.test.ts` using the same fake IndexedDB setup as existing offline queue tests:

```ts
test("queued signal replays with stable idempotency key", async () => {
  const item = await enqueuePointOperatorMutation({
    kind: "signal",
    field: "isOpenNow",
    value: true,
    capturedAt: "2026-06-24T08:00:00.000Z",
  });
  const calls: Array<{ key: string; field: string }> = [];
  const result = await flushPointOperatorQueue(async (mutation, options) => {
    calls.push({ key: options.idempotencyKey, field: mutation.field! });
  });
  assert.equal(result.synced, 1);
  assert.deepEqual(calls, [{ key: item.idempotencyKey, field: "isOpenNow" }]);
});
```

Add tests for retryable failure, permanent `403`, duplicate replay, and queue capacity.

- [ ] **Step 2: Run and verify failure**

```bash
node --import tsx --test tests/pointOperatorQueue.test.ts
```

Expected: FAIL because queue module is missing.

- [ ] **Step 3: Implement API client**

Create `lib/client/pointOperatorApi.ts` exporting:

```ts
export async function fetchPointOperatorMe(): Promise<PointOperatorMeResponse>;
export async function submitPointOperatorSignal(
  payload: { field: string; value: boolean; capturedAt: string },
  options: { idempotencyKey: string },
): Promise<PointOperatorMutationResponse>;
export async function submitPointOperatorPhoto(
  payload: { imageData: string; capturedAt: string },
  options: { idempotencyKey: string },
): Promise<PointOperatorMutationResponse>;
export async function changePointOperatorPassword(
  payload: { currentPassword: string; newPassword: string },
): Promise<{ changed: true; reauthenticate: true }>;
```

Use `apiJson`, `Idempotency-Key`, and existing retryable error conventions.

- [ ] **Step 4: Implement dedicated IndexedDB queue**

Create `lib/client/pointOperatorQueue.ts` with:

```ts
export type PointOperatorMutation =
  | { kind: "signal"; field: string; value: boolean; capturedAt: string }
  | { kind: "photo"; imageData: string; capturedAt: string };

export interface PointOperatorQueueItem {
  id: string;
  idempotencyKey: string;
  mutation: PointOperatorMutation;
  status: "pending" | "syncing" | "failed";
  retryCount: number;
  nextRetryAt?: string;
  lastError?: string;
  createdAt: string;
}
```

Follow existing queue retry/backoff rules. Use a separate object store so operator mutations never enter the generic submission endpoint.

- [ ] **Step 5: Run tests**

```bash
node --import tsx --test tests/pointOperatorQueue.test.ts
npm run typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/client/pointOperatorApi.ts lib/client/pointOperatorQueue.ts tests/pointOperatorQueue.test.ts
git commit -m "feat(point-operator): add offline mutation client"
```

---

### Task 8: Build responsive two-tab operator application

**Files:**
- Create: `components/PointOperatorNavigation.tsx`
- Create: `components/Screens/PointOperatorStatus.tsx`
- Create: `components/Screens/PointOperatorProfile.tsx`
- Create: `components/Screens/PointOperatorPasswordChange.tsx`
- Modify: `App.tsx`
- Modify: `components/Navigation.tsx`
- Modify: `types.ts`
- Create: `lib/client/pointOperatorUi.ts`
- Modify: `lib/client/auth.ts`
- Test: `tests/pointOperatorUiState.test.ts`

- [ ] **Step 1: Add pure UI-state tests**

Create `tests/pointOperatorUiState.test.ts` for a helper exported from `lib/client/pointOperatorUi.ts`:

```ts
assert.deepEqual(routesForRole("point_operator"), [
  Screen.POINT_OPERATOR_STATUS,
  Screen.POINT_OPERATOR_PROFILE,
]);
assert.equal(defaultScreenForRole("point_operator"), Screen.POINT_OPERATOR_STATUS);
assert.equal(resolveOperatorSignalLabel({ isExpired: true, value: true }), "unknown");
```

Create `lib/client/pointOperatorUi.ts`:

```ts
import { Screen } from "../../types.js";
import type { PointOperatorSignalState, UserRole } from "../../shared/types.js";

export function routesForRole(role: UserRole): Screen[] {
  if (role === "point_operator") {
    return [Screen.POINT_OPERATOR_STATUS, Screen.POINT_OPERATOR_PROFILE];
  }
  if (role === "admin") {
    return [Screen.ADMIN, Screen.HOME, Screen.DELTA_DASHBOARD, Screen.AGENT_PERFORMANCE, Screen.PROFILE];
  }
  if (role === "client") {
    return [Screen.DELTA_DASHBOARD, Screen.INVESTOR_DASHBOARD, Screen.HOME, Screen.CLIENT_INSIGHTS, Screen.PROFILE];
  }
  return [Screen.HOME, Screen.CONTRIBUTE, Screen.ANALYTICS, Screen.PROFILE];
}

export function defaultScreenForRole(role: UserRole): Screen {
  return routesForRole(role)[0]!;
}

export function resolveOperatorSignalLabel(
  signal: Pick<PointOperatorSignalState, "isExpired" | "value">,
): "on" | "off" | "unknown" {
  if (signal.isExpired || signal.value === null) return "unknown";
  return signal.value ? "on" : "off";
}
```

- [ ] **Step 2: Add routes and role handling**

In `types.ts`:

```ts
POINT_OPERATOR_STATUS = "POINT_OPERATOR_STATUS",
POINT_OPERATOR_PROFILE = "POINT_OPERATOR_PROFILE",
POINT_OPERATOR_PASSWORD = "POINT_OPERATOR_PASSWORD",
```

Update all web `UserRole` unions, including `lib/client/auth.ts`, to include `"point_operator"`. Add `mustChangePassword?: boolean` to the client session user type.

In `App.tsx`:

```ts
const isPointOperator = userRole === "point_operator";
```

Bootstrap routing:

```ts
if (session?.user?.mustChangePassword) {
  setCurrentScreen(Screen.POINT_OPERATOR_PASSWORD);
} else if (role === "point_operator") {
  setCurrentScreen(Screen.POINT_OPERATOR_STATUS);
}
```

- [ ] **Step 3: Build operator navigation**

`components/PointOperatorNavigation.tsx` contains exactly:

```ts
[
  { id: Screen.POINT_OPERATOR_STATUS, en: "Status", fr: "Statut", icon: ToggleRight },
  { id: Screen.POINT_OPERATOR_PROFILE, en: "Profile", fr: "Profil", icon: User },
]
```

Do not render generic `Navigation` for this role.

- [ ] **Step 4: Build Status screen**

`PointOperatorStatus.tsx` must:

- load `/api/point-operator?view=me`;
- render verified point header;
- render 1–3 server-provided controls;
- use 48 px+ cards with explicit On/Off/Unknown;
- optimistically update and queue on network failure;
- show Saved/Pending sync/Syncing/error;
- display expiry/freshness.

Core mutation:

```ts
const updateSignal = async (field: string, value: boolean) => {
  const capturedAt = new Date().toISOString();
  setOptimistic(field, value, "syncing");
  const item = await enqueuePointOperatorMutation({ kind: "signal", field, value, capturedAt });
  try {
    await submitPointOperatorSignal(
      { field, value, capturedAt },
      { idempotencyKey: item.idempotencyKey },
    );
    await removePointOperatorQueueItem(item.id);
    setOptimistic(field, value, "saved");
  } catch (error) {
    if (!isRetryableApiError(error)) {
      await removePointOperatorQueueItem(item.id);
      await reload();
      setError(toOperatorError(error));
      return;
    }
    setOptimistic(field, value, "pending");
  }
};
```

- [ ] **Step 5: Build Profile and password screens**

Profile:

- point photo and update action;
- read-only name/vertical/locality/point ID;
- language, change password, help/privacy, sign out.

Password screen:

- no tab bar;
- current/new/confirm fields;
- sign out fallback;
- successful change signs out and returns to auth.

- [ ] **Step 6: Run tests/build**

```bash
node --import tsx --test tests/pointOperatorUiState.test.ts
npm run typecheck
npm run build
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add components/PointOperatorNavigation.tsx components/Screens/PointOperatorStatus.tsx components/Screens/PointOperatorProfile.tsx components/Screens/PointOperatorPasswordChange.tsx App.tsx components/Navigation.tsx types.ts lib/client/pointOperatorUi.ts lib/client/auth.ts tests/pointOperatorUiState.test.ts
git commit -m "feat(point-operator): add responsive two-tab app"
```

---

### Task 9: Extend responsive admin workflow and public provenance

**Files:**
- Modify: `components/Screens/Profile.tsx`
- Modify: `components/Screens/Details.tsx`
- Modify: `e2e/fixtures/mockApi.ts`
- Modify: `e2e/smoke/admin-access-controls.smoke.spec.ts`
- Create: `e2e/smoke/point-operator.smoke.spec.ts`

- [ ] **Step 1: Add failing Playwright admin scenario**

Extend `admin-access-controls.smoke.spec.ts`:

```ts
test("admin creates and links a point operator", async ({ page }) => {
  await signInAsAdmin(page);
  await page.getByRole("button", { name: /profile|profil/i }).click();
  await page.getByRole("button", { name: /point operator|opérateur du point/i }).click();
  await page.getByLabel(/email or phone|email ou téléphone/i).fill("operator@example.com");
  await page.getByLabel(/display name|nom affiché/i).fill("Market Operator");
  await page.getByLabel(/temporary password|mot de passe temporaire/i).fill("OperatorPass123!");
  await page.getByLabel(/search verified point|rechercher un point vérifié/i).fill("Pharmacie du Marché");
  await page.getByRole("option", { name: /Pharmacie du Marché/ }).click();
  await page.getByRole("button", { name: /create and link|créer et lier/i }).click();
  await expect(page.getByText(/operator linked|opérateur lié/i)).toBeVisible();
});
```

- [ ] **Step 2: Build dedicated admin card**

In `components/Screens/Profile.tsx`, add `PointOperatorAccessCard` separate from the generic role card.

It supports:

- point search;
- create-and-link;
- load active assignment;
- revoke with mandatory reason;
- replacement after revocation;
- active operator, grant date, last update, recent events.

Do not add `point_operator` to ordinary role dropdowns.

- [ ] **Step 3: Add public provenance**

In `components/Screens/Details.tsx`, render each operator signal:

```tsx
<p>
  {t("Reported by point operator", "Signalé par l’opérateur du point")}
  {" · "}
  {signal.isExpired
    ? t("Unknown", "Inconnu")
    : formatRelativeTime(signal.reportedAt, language)}
</p>
```

Never display an expired `true` as current.

- [ ] **Step 4: Add mock API and operator smoke test**

`point-operator.smoke.spec.ts` covers:

- forced password change;
- exactly two tabs;
- three configured pharmacy controls;
- offline toggle becomes Pending sync;
- reconnect flushes once;
- Profile identity fields are read-only;
- photo update shows review-pending provenance;
- revoked assignment shows restricted state.

- [ ] **Step 5: Run responsive tests**

```bash
npm run test:e2e -- e2e/smoke/admin-access-controls.smoke.spec.ts e2e/smoke/point-operator.smoke.spec.ts
npm run typecheck
npm run build
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add components/Screens/Profile.tsx components/Screens/Details.tsx e2e/fixtures/mockApi.ts e2e/smoke/admin-access-controls.smoke.spec.ts e2e/smoke/point-operator.smoke.spec.ts
git commit -m "feat(point-operator): add admin lifecycle and provenance"
```

---

### Task 10: Add native iOS models, API, and durable queue

**Files:**
- Modify: `ios/App/App/Native/ADLModels.swift`
- Modify: `ios/App/App/Native/ADLServices.swift`
- Test: compile-time verification through Xcode build

- [ ] **Step 1: Add native role/routes and DTOs**

In `ADLModels.swift`:

```swift
enum UserRole: String, CaseIterable, Codable, Identifiable {
    case agent
    case admin
    case client
    case pointOperator = "point_operator"
}

enum AppRoute: String, CaseIterable, Hashable, Identifiable {
    // existing
    case pointOperatorStatus
    case pointOperatorProfile
}
```

Route rules:

```swift
case .pointOperator: return .pointOperatorStatus
// ...
case .pointOperator: return [.pointOperatorStatus, .pointOperatorProfile]
```

Add Codable DTOs:

```swift
struct PointOperatorControlDTO: Codable, Identifiable {
    let field: String
    let labelEn: String
    let labelFr: String
    let expiryHours: Int
    var id: String { field }
}

struct PointOperatorMeDTO: Codable {
    let assignment: PointOperatorAssignmentDTO
    let point: DataPoint
    let controls: [PointOperatorControlDTO]
    let signals: [String: PointOperatorSignalDTO]
}
```

- [ ] **Step 2: Add native API methods**

In `ADLServices.swift`, add:

```swift
func fetchPointOperatorMe() async throws -> PointOperatorMeDTO
func submitPointOperatorSignal(
    field: String,
    value: Bool,
    capturedAt: Date,
    idempotencyKey: UUID
) async throws -> PointOperatorMutationDTO
func submitPointOperatorPhoto(
    imageDataURL: String,
    capturedAt: Date,
    idempotencyKey: UUID
) async throws -> PointOperatorMutationDTO
func changePointOperatorPassword(
    currentPassword: String,
    newPassword: String
) async throws
```

- [ ] **Step 3: Add dedicated durable queue**

Add `PointOperatorQueueStore` using Application Support JSON persistence:

```swift
struct QueuedPointOperatorMutation: Codable, Identifiable {
    enum Kind: String, Codable { case signal, photo }
    let id: UUID
    let idempotencyKey: UUID
    let kind: Kind
    let field: String?
    let value: Bool?
    let imageDataURL: String?
    let capturedAt: Date
    var retryCount: Int
    var nextRetryAt: Date?
}
```

Queue constraints:

- max 75 signal items;
- photo item only if safely persisted;
- exponential retry;
- permanent 401/403/422 removes item and triggers server reload;
- stable idempotency key.

- [ ] **Step 4: Build native target**

```bash
xcodebuild -project ios/App/App.xcodeproj -scheme App -destination 'platform=iOS Simulator,name=iPhone 17 Pro,OS=26.5' -configuration Debug CODE_SIGNING_ALLOWED=NO build
```

Expected: `BUILD SUCCEEDED`.

- [ ] **Step 5: Commit**

```bash
git add ios/App/App/Native/ADLModels.swift ios/App/App/Native/ADLServices.swift
git commit -m "feat(ios): add point operator data layer"
```

---

### Task 11: Build native iOS operator and admin screens

**Files:**
- Modify: `ios/App/App/Native/ADLViews.swift`

- [ ] **Step 1: Route operator screens**

In `AppShellView.screen(for:)`:

```swift
case .pointOperatorStatus:
    PointOperatorStatusView()
case .pointOperatorProfile:
    PointOperatorProfileView()
```

Update tab labels/icons:

```swift
case .pointOperatorStatus: return appState.t("Status", "Statut")
case .pointOperatorProfile: return appState.t("Profile", "Profil")
```

- [ ] **Step 2: Add first-login password gate**

In `RootView`, before `AppShellView`:

```swift
if appState.mustChangePassword && appState.selectedRole == .pointOperator {
    PointOperatorPasswordChangeView()
} else {
    AppShellView()
}
```

Success signs out and returns to Auth.

- [ ] **Step 3: Build Status view**

`PointOperatorStatusView`:

- verified point header;
- one to three 48 px+ toggle cards;
- explicit On/Off/Unknown;
- independent mutation;
- Saved/Pending sync/Syncing/error;
- freshness text;
- reduced-motion-safe feedback.

Mutation pattern:

```swift
private func update(_ control: PointOperatorControlDTO, to value: Bool) {
    let mutation = QueuedPointOperatorMutation.signal(field: control.field, value: value)
    queueStore.enqueue(mutation)
    optimistic[control.field] = .pending(value)
    Task { await appState.flushPointOperatorQueue() }
}
```

- [ ] **Step 4: Build Profile view**

`PointOperatorProfileView`:

- point photo and source picker;
- compress with existing profile-image helper limits;
- queue/upload photo;
- read-only name, vertical, locality, abbreviated point ID;
- language, password, help/privacy, sign out.

- [ ] **Step 5: Extend native admin Account Access**

Add a separate Point Operator section to `AdminAccountAccessCard`:

- verified-point search;
- account identifier/name/password;
- create-and-link;
- active assignment details;
- revoke reason;
- replace after revoke.

Do not add `.pointOperator` to the generic `roleMenu`.

- [ ] **Step 6: Build twice**

Run:

```bash
xcodebuild -project ios/App/App.xcodeproj -scheme App -destination 'platform=iOS Simulator,name=iPhone 17 Pro,OS=26.5' -configuration Debug CODE_SIGNING_ALLOWED=NO clean build
```

Expected: `BUILD SUCCEEDED`, no asset or storyboard warnings.

- [ ] **Step 7: Commit**

```bash
git add ios/App/App/Native/ADLViews.swift
git commit -m "feat(ios): add point operator two-tab experience"
```

---

### Task 12: Add help content, regression coverage, and rollout verification

**Files:**
- Modify: `lib/docs/helpCenter.ts`
- Modify: relevant existing role/navigation tests
- Create: `tests/pointOperatorRegression.test.ts`
- Modify: `docs/superpowers/specs/2026-06-24-point-operator-accounts-design.md` only if implementation decisions require a factual correction

- [ ] **Step 1: Add regression tests**

Create `tests/pointOperatorRegression.test.ts`:

```ts
test("existing roles retain their current navigation", () => {
  assert.deepEqual(routesForRole("agent"), existingAgentRoutes);
  assert.deepEqual(routesForRole("admin"), existingAdminRoutes);
  assert.deepEqual(routesForRole("client"), existingClientRoutes);
});

test("operator events never count as XP contributions", () => {
  assert.equal(calculateEventXp(makeEvent({ source: "point_operator" })), 0);
});

test("unknown role has no permissions", () => {
  assert.equal(canPerformAction("unknown", "read"), false);
});
```

- [ ] **Step 2: Add bilingual help**

Document:

- what a Point Operator is;
- Status/Profile workflow;
- freshness and Unknown state;
- offline Pending sync;
- photo review;
- password reset/change;
- revocation contact path;
- admin create/link/revoke/replace process.

- [ ] **Step 3: Run full quality gates**

```bash
npm run lint
npm run typecheck
npm run test
npm run build
npm run test:e2e -- e2e/smoke/admin-access-controls.smoke.spec.ts e2e/smoke/point-operator.smoke.spec.ts
xcodebuild -project ios/App/App.xcodeproj -scheme App -destination 'platform=iOS Simulator,name=iPhone 17 Pro,OS=26.5' -configuration Debug CODE_SIGNING_ALLOWED=NO build
```

Expected: all commands PASS.

- [ ] **Step 4: Run migration dry-run**

```bash
npm run migrate:dry
```

Expected: migration `20260624_point_operator_accounts.sql` listed as pending and valid.

- [ ] **Step 5: Manual simulator/browser checks**

Verify:

1. Admin creates operator and links a verified point.
2. First login forces password change.
3. Operator sees exactly Status/Profile.
4. Offline status displays Pending sync and replays once.
5. Public point displays provenance and freshness.
6. Expired signal displays Unknown.
7. Photo publishes and appears in admin review.
8. Admin rejection restores prior photo/value.
9. Revocation blocks operator immediately.
10. Agent/admin/client navigation remains unchanged.

- [ ] **Step 6: Close issue and commit**

```bash
bd close africandatalayer-aek --reason "Point Operator accounts shipped across API, responsive web/Android, and native iOS with offline status, review, provenance, and admin lifecycle." --json
git add lib/docs/helpCenter.ts tests/pointOperatorRegression.test.ts
git commit -m "test(point-operator): complete rollout coverage"
```

- [ ] **Step 7: Mandatory session completion**

```bash
git pull --rebase
bd dolt push
git push
git status
```

Expected: push succeeds and branch is up to date with origin.

---

## Implementation cautions

- Never authorize operator writes from a client-supplied point ID or category.
- Never add `point_operator` to generic public registration.
- Never treat expired `true` as `false`; project it as unknown.
- Never award XP or assignment credit for operator events.
- Never overwrite historical photos/events during rejection.
- Never rely on hidden tabs for security.
- Keep operator queues separate from generic agent submissions.
- Preserve unrelated dirty-worktree files.
