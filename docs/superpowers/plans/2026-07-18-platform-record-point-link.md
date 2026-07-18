# Platform Record Point Enrichment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let company (tenant) collectors attach schema-versioned records to existing public projected points — a private, org-scoped enrichment overlay with anti-abuse gates.

**Architecture:** Add nullable `point_id` (+ denormalized capture GPS) to `platform_records`. `record_create` validates point existence, GPS proximity, and a per-collector cooldown when `pointId` is present. A new `platform_point_nearby` view powers a picker in `PlatformCollectionFlow` that surfaces point staleness. Read-time join only — the core projection engine is untouched.

**Tech Stack:** TypeScript, Zod, raw SQL via `pg`, node `--test` + `tsx`, React 19.

**Spec:** `docs/superpowers/specs/2026-07-18-platform-record-point-link-design.md`

## Global Constraints

- Collector's capture GPS is the existing `evidence.gps` field — **required when `pointId` is present** (spec's "captureLocation" maps to `evidence.gps`; no new API field). Server denormalizes it into `capture_lat`/`capture_lng` columns.
- Proximity env var: `PLATFORM_ENRICH_MAX_DISTANCE_M`, default `250` (meters).
- Cooldown: max 1 record per (collector, point, recordType) per **24 hours**.
- Error codes exactly: `platform_enrich_gps_required` (422), `platform_point_not_found` (409), `platform_enrich_too_far` (422), `platform_enrich_cooldown` (429).
- Nearby endpoint: default radius `2000` m, max `5000` m, max `25` points, sorted by distance ascending.
- Staleness: a point is "stale" when `updatedAt` older than **30 days**.
- All user-facing copy bilingual EN/FR via the file-local `t(en, fr)` pattern.
- Platform views route through `GET|POST /api/user?view=platform_<name>`; new view name is `platform_point_nearby`.
- Tests: node native runner. Run a file with `npx tsx --test tests/<file>.test.ts`.
- Standalone records (no `pointId`) must keep working exactly as before.
- Commit messages: conventional (`feat:`, `test:`), each ending with `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.

---

### Task 1: Migration + contract test

**Files:**
- Create: `supabase/migrations/20260721_platform_record_point_link.sql`
- Create: `tests/platformRecordPointLinkMigrationContract.test.ts`

**Interfaces:**
- Produces: columns `point_id text NULL`, `capture_lat double precision NULL`, `capture_lng double precision NULL` on `public.platform_records`; index `platform_records_point_overlay`.

- [ ] **Step 1: Write the failing contract test** (mirror the style of `tests/platformRecordMigrationContract.test.ts` — it reads the SQL file and asserts on its content):

```ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const sql = readFileSync("supabase/migrations/20260721_platform_record_point_link.sql", "utf8");

test("platform record point link migration adds nullable point columns", () => {
  assert.match(sql, /ALTER TABLE public\.platform_records\s+ADD COLUMN IF NOT EXISTS point_id text/);
  assert.match(sql, /ADD COLUMN IF NOT EXISTS capture_lat double precision/);
  assert.match(sql, /ADD COLUMN IF NOT EXISTS capture_lng double precision/);
  assert.doesNotMatch(sql, /point_id text NOT NULL/);
});

test("platform record point link migration indexes the org point overlay", () => {
  assert.match(sql, /CREATE INDEX IF NOT EXISTS platform_records_point_overlay/);
  assert.match(sql, /ON public\.platform_records\s*\(organization_id, point_id, status\)/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test tests/platformRecordPointLinkMigrationContract.test.ts`
Expected: FAIL (`ENOENT` — migration file missing)

- [ ] **Step 3: Write the migration**

```sql
-- Link tenant records to public projected points (private org overlay).
-- point_id has no FK: projection identity lives in events, not a table.
ALTER TABLE public.platform_records
  ADD COLUMN IF NOT EXISTS point_id text NULL;
ALTER TABLE public.platform_records
  ADD COLUMN IF NOT EXISTS capture_lat double precision NULL;
ALTER TABLE public.platform_records
  ADD COLUMN IF NOT EXISTS capture_lng double precision NULL;

CREATE INDEX IF NOT EXISTS platform_records_point_overlay
  ON public.platform_records (organization_id, point_id, status);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test tests/platformRecordPointLinkMigrationContract.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260721_platform_record_point_link.sql tests/platformRecordPointLinkMigrationContract.test.ts
git commit -m "feat: add point link columns to platform_records"
```

---

### Task 2: Shared types + request validation

**Files:**
- Modify: `shared/platformTypes.ts` (add `pointId` to `PlatformRecord`; add `PlatformNearbyPoint`)
- Modify: `lib/server/platform/validation.ts` (extend `recordCreateSchema`)
- Modify: `tests/platformRequestValidation.test.ts` (add cases)

**Interfaces:**
- Produces:
  - `PlatformRecord.pointId?: string | null`
  - `interface PlatformNearbyPoint { pointId: string; category: string; name: string | null; location: { latitude: number; longitude: number }; updatedAt: string; distanceMeters: number }`
  - `recordCreateSchema` accepts optional `pointId: string` (trimmed, 4–80 chars) and rejects `pointId` without `evidence.gps`.

- [ ] **Step 1: Write failing validation tests** — append to `tests/platformRequestValidation.test.ts` (follow its existing import/test style):

```ts
test("recordCreateSchema accepts an optional pointId with gps evidence", () => {
  const parsed = recordCreateSchema.safeParse({
    projectId: "5a2f8f18-0000-4000-8000-000000000001",
    schemaVersionId: "5a2f8f18-0000-4000-8000-000000000002",
    recordTypeKey: "retail_outlet",
    data: {},
    evidence: { gps: { latitude: 4.05, longitude: 9.7 }, photos: [] },
    pointId: "pt_bonamoussadi_001",
  });
  assert.equal(parsed.success, true);
});

test("recordCreateSchema rejects pointId without gps evidence", () => {
  const parsed = recordCreateSchema.safeParse({
    projectId: "5a2f8f18-0000-4000-8000-000000000001",
    schemaVersionId: "5a2f8f18-0000-4000-8000-000000000002",
    recordTypeKey: "retail_outlet",
    data: {},
    evidence: { photos: [] },
    pointId: "pt_bonamoussadi_001",
  });
  assert.equal(parsed.success, false);
});
```

(If the file doesn't already import `recordCreateSchema`, add it to the existing import from `../lib/server/platform/validation.js`.)

- [ ] **Step 2: Run to verify failure**

Run: `npx tsx --test tests/platformRequestValidation.test.ts`
Expected: FAIL (`pointId` unrecognized / first test fails)

- [ ] **Step 3: Implement**

In `lib/server/platform/validation.ts`, change `recordCreateSchema` (currently a plain `z.object`) to add `pointId` and a `superRefine`:

```ts
export const recordCreateSchema = z.object({
  projectId: uuid,
  schemaVersionId: uuid,
  recordTypeKey: z.string().regex(/^[a-z][a-z0-9_]{1,39}$/),
  pointId: z.string().trim().min(4).max(80).optional(),
  data: z.record(z.string(), z.unknown()),
  evidence: z.object({
    // ... keep the existing evidence object EXACTLY as-is ...
  }),
}).superRefine((value, context) => {
  if (value.pointId && !value.evidence.gps) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["evidence", "gps"],
      message: "GPS evidence is required when attaching to an existing point",
    });
  }
});
```

In `shared/platformTypes.ts`, add to `PlatformRecord`:

```ts
  pointId?: string | null;
```

and add after `PlatformRecordSummary`:

```ts
export interface PlatformNearbyPoint {
  pointId: string;
  category: string;
  name: string | null;
  location: { latitude: number; longitude: number };
  updatedAt: string;
  distanceMeters: number;
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx tsx --test tests/platformRequestValidation.test.ts`
Expected: PASS (all tests including the 2 new)

- [ ] **Step 5: Commit**

```bash
git add shared/platformTypes.ts lib/server/platform/validation.ts tests/platformRequestValidation.test.ts
git commit -m "feat: accept pointId in platform record validation and types"
```

---

### Task 3: Record store — persist point link, cooldown query

**Files:**
- Modify: `lib/server/platform/recordStore.ts`
- Modify: `tests/platformRecordStore.test.ts` (add cases, keep existing)

**Interfaces:**
- Consumes: Task 1 columns.
- Produces:
  - `createRecord` input gains `pointId?: string | null`, `captureLat?: number | null`, `captureLng?: number | null`; persists them; returned `PlatformRecord` includes `pointId`.
  - `listRecords` / `reviewRecord` rows include `pointId`; `listRecords` input gains optional `pointId?: string` filter.
  - `hasRecentRecordForPoint(input: { organizationId: string; pointId: string; capturedBy: string; recordTypeKey: string; withinHours: number }, deps?): Promise<boolean>`

- [ ] **Step 1: Write failing store tests** — append to `tests/platformRecordStore.test.ts`, following its existing fake-`queryFn` pattern (capture `sql`/`params`, return canned rows):

```ts
test("createRecord persists point link and capture coordinates", async () => {
  const calls: Array<{ sql: string; params: unknown[] }> = [];
  const queryFn = async (sql: string, params: unknown[]) => {
    calls.push({ sql, params });
    return { rows: [{ id: "r1", organization_id: "o1", project_id: "p1", schema_version_id: "s1", record_type_key: "audit", data: {}, evidence: { photos: [] }, status: "pending_review", captured_by: "u1", created_at: new Date(), point_id: "pt_1", capture_lat: 4.05, capture_lng: 9.7 }] };
  };
  const record = await createRecord({
    organizationId: "o1", projectId: "p1", schemaVersionId: "s1", recordTypeKey: "audit",
    data: {}, evidence: { photos: [] }, capturedBy: "u1", idempotencyKey: "k".repeat(8), requestHash: "a".repeat(64),
    pointId: "pt_1", captureLat: 4.05, captureLng: 9.7,
  }, { queryFn: queryFn as any });
  assert.match(calls[0].sql, /point_id/);
  assert.match(calls[0].sql, /capture_lat/);
  assert.ok(calls[0].params.includes("pt_1"));
  assert.equal(record.pointId, "pt_1");
});

test("hasRecentRecordForPoint returns the EXISTS result", async () => {
  const calls: Array<{ sql: string; params: unknown[] }> = [];
  const queryFn = async (sql: string, params: unknown[]) => {
    calls.push({ sql, params });
    return { rows: [{ present: true }] };
  };
  const result = await hasRecentRecordForPoint(
    { organizationId: "o1", pointId: "pt_1", capturedBy: "u1", recordTypeKey: "audit", withinHours: 24 },
    { queryFn: queryFn as any },
  );
  assert.equal(result, true);
  assert.match(calls[0].sql, /point_id = \$2/);
  assert.ok(calls[0].params.includes(24));
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx tsx --test tests/platformRecordStore.test.ts`
Expected: FAIL (`hasRecentRecordForPoint` not exported; SQL lacks `point_id`)

- [ ] **Step 3: Implement in `recordStore.ts`**

1. `rowToRecord`: add `pointId: row.point_id ?? null,`.
2. `createRecord` input type: add `pointId?: string | null; captureLat?: number | null; captureLng?: number | null;`. Extend the INSERT column list with `point_id, capture_lat, capture_lng`, placeholders `$10, $11, $12`, params `input.pointId ?? null, input.captureLat ?? null, input.captureLng ?? null`. Add `point_id, capture_lat, capture_lng` to the `RETURNING` list.
3. Add `point_id` to the SELECT list in `listRecords` and the `RETURNING` list in `reviewRecord`.
4. `listRecords` input type gains `pointId?: string`; extend its WHERE clause with `AND ($4::text IS NULL OR point_id = $4)` (renumber the LIMIT placeholder to `$5`) and pass `input.pointId ?? null` in the params. Add a store test asserting the param lands: fake `queryFn`, call `listRecords({ organizationId: "o1", pointId: "pt_1" }, ...)`, assert `calls[0].params.includes("pt_1")` and `calls[0].sql` matches `/point_id = \$4/`.
5. New function:

```ts
export async function hasRecentRecordForPoint(
  input: { organizationId: string; pointId: string; capturedBy: string; recordTypeKey: string; withinHours: number },
  deps: StoreDeps = {},
): Promise<boolean> {
  const result = await db(deps)(
    `SELECT EXISTS(
       SELECT 1 FROM public.platform_records
       WHERE organization_id = $1
         AND point_id = $2
         AND captured_by = $3
         AND record_type_key = $4
         AND created_at >= now() - make_interval(hours => $5)
     ) AS present`,
    [input.organizationId, input.pointId, input.capturedBy, input.recordTypeKey, input.withinHours],
  );
  return Boolean(result.rows[0]?.present);
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx tsx --test tests/platformRecordStore.test.ts`
Expected: PASS (all, including 2 new)

- [ ] **Step 5: Commit**

```bash
git add lib/server/platform/recordStore.ts tests/platformRecordStore.test.ts
git commit -m "feat: persist platform record point link and add cooldown query"
```

---

### Task 4: Point lookup service + API gates + nearby endpoint

**Files:**
- Create: `lib/server/platform/pointLookup.ts`
- Modify: `lib/server/platform/api.ts`
- Modify: `.env.example` (add `PLATFORM_ENRICH_MAX_DISTANCE_M=250` near the other `FRAUD_*`/limit vars, with a one-line comment)
- Create: `tests/platformPointLookup.test.ts`
- Modify: `tests/platformApi.test.ts` (add cases)

**Interfaces:**
- Consumes: `hasRecentRecordForPoint` (Task 3), `PlatformNearbyPoint` (Task 2), `buildReadableEvents` (`lib/server/submissionEvents.ts`), `projectPointById`/`projectPointsFromEvents` (`lib/server/pointProjection.ts`), `haversineKm` (`lib/server/submissionFraud.ts`, takes two `{latitude, longitude}`, returns km).
- Produces:
  - `findActivePoint(pointId: string): Promise<ProjectedPoint | null>`
  - `listNearbyPoints(input: { latitude: number; longitude: number; radiusMeters: number; limit: number }): Promise<PlatformNearbyPoint[]>`
  - New deps on `PlatformApiDeps`: `findActivePointFn?`, `listNearbyPointsFn?`, `hasRecentRecordForPointFn?`
  - New view `platform_point_nearby` (GET, collector role, project-scoped) → `{ points: PlatformNearbyPoint[] }`

- [ ] **Step 1: Write `lib/server/platform/pointLookup.ts`** (pure composition; unit-test the exported filter/sort via an injectable events loader):

```ts
// Read-side lookup of public projected points for the tenant platform.
// Points are projected from events on demand — no projection table exists.
import type { ProjectedPoint } from "../../../shared/types.js";
import type { PlatformNearbyPoint } from "../../../shared/platformTypes.js";
import { projectPointById, projectPointsFromEvents } from "../pointProjection.js";
import { buildReadableEvents } from "../submissionEvents.js";
import { haversineKm } from "../submissionFraud.js";

export interface PointLookupDeps {
  loadEventsFn?: typeof buildReadableEvents;
}

export async function findActivePoint(
  pointId: string,
  deps: PointLookupDeps = {},
): Promise<ProjectedPoint | null> {
  const loadEvents = deps.loadEventsFn ?? buildReadableEvents;
  return projectPointById(await loadEvents(), pointId);
}

export async function listNearbyPoints(
  input: { latitude: number; longitude: number; radiusMeters: number; limit: number },
  deps: PointLookupDeps = {},
): Promise<PlatformNearbyPoint[]> {
  const loadEvents = deps.loadEventsFn ?? buildReadableEvents;
  const origin = { latitude: input.latitude, longitude: input.longitude };
  return projectPointsFromEvents(await loadEvents())
    .map((point) => ({
      pointId: point.pointId,
      category: point.category,
      name: point.details?.name ?? null,
      location: point.location,
      updatedAt: point.updatedAt,
      distanceMeters: Math.round(haversineKm(origin, point.location) * 1000),
    }))
    .filter((point) => point.distanceMeters <= input.radiusMeters)
    .sort((a, b) => a.distanceMeters - b.distanceMeters)
    .slice(0, input.limit);
}
```

- [ ] **Step 2: Write `tests/platformPointLookup.test.ts`** using a fake `loadEventsFn` that returns two CREATE events (build minimal `PointEvent` objects matching `shared/types.ts` — copy the shape used by tests in `tests/pointProjection.test.ts`), one ~100 m away and one ~10 km away. Assert: far point filtered out, near point first, `distanceMeters` roughly 100 (±30), `name` surfaced from details. Also test `findActivePoint` returns null for unknown id.

- [ ] **Step 3: Run to verify pointLookup tests pass**

Run: `npx tsx --test tests/platformPointLookup.test.ts`
Expected: PASS

- [ ] **Step 4: Write failing API tests** — append to `tests/platformApi.test.ts` (reuse its `baseDeps`, `jsonPost`, `ORG`, `PROJECT_ID`, `SCHEMA_ID` helpers). The record body helper for these tests:

```ts
const enrichBody = {
  projectId: PROJECT_ID,
  schemaVersionId: SCHEMA_ID,
  recordTypeKey: "retail_outlet",
  data: { name: "Central kiosk" },
  evidence: { gps: { latitude: 4.05, longitude: 9.7, accuracyMeters: 8 }, photos: [] },
  pointId: "pt_test_1",
};
```

Shared deps for the enrich tests: the same `getProjectFn`/`getPublishedSchemaFn` as the existing `record_create` happy-path test, plus:

```ts
findActivePointFn: async () => ({
  id: "pt_test_1", pointId: "pt_test_1", category: "pharmacy",
  location: { latitude: 4.0503, longitude: 9.7001 },  // ~35 m from evidence GPS
  details: { name: "Pharmacie Centrale" }, createdAt: "", updatedAt: "2026-07-01T00:00:00.000Z",
  gaps: [], eventsCount: 1, eventIds: ["e1"],
}),
hasRecentRecordForPointFn: async () => false,
```

Test cases (each sets an `Idempotency-Key` header like the existing tests):

1. **happy path**: 201; `createRecordFn` received `pointId: "pt_test_1"`, `captureLat: 4.05`, `captureLng: 9.7`.
2. **unknown point**: `findActivePointFn: async () => null` → 409, body `code === "platform_point_not_found"`.
3. **too far**: `findActivePointFn` returns a point at `{ latitude: 4.2, longitude: 9.7 }` (~16 km) → 422, `code === "platform_enrich_too_far"`.
4. **cooldown**: `hasRecentRecordForPointFn: async () => true` → 429, `code === "platform_enrich_cooldown"`.
5. **regression**: body without `pointId` → 201 and `createRecordFn` received `pointId: null` (or undefined), no point lookup called.
6. **nearby endpoint**: `GET` request to `.../api/user?view=platform_point_nearby&projectId=<PROJECT_ID>&latitude=4.05&longitude=9.7` with `listNearbyPointsFn: async () => [ /* one PlatformNearbyPoint */ ]` → 200, `points` array; invalid (missing latitude) → 400; membership `viewer` → 403 (collector required — reuse the viewer-membership override pattern from the existing viewer test).

- [ ] **Step 5: Run to verify API tests fail**

Run: `npx tsx --test tests/platformApi.test.ts`
Expected: new tests FAIL (unknown deps ignored, no gate logic, unknown view 404/400)

- [ ] **Step 6: Implement in `lib/server/platform/api.ts`**

1. Header comment: add the two behaviors to the views list (`record_create` note + `point_nearby  GET — nearby public points for the picker (collector+)`).
2. Imports: `import { findActivePoint, listNearbyPoints } from "./pointLookup.js";` and `import { haversineKm } from "../submissionFraud.js";` and add `hasRecentRecordForPoint` to the `recordStore` usage (it's already `* as recordStore`).
3. `PlatformApiDeps`: add

```ts
  findActivePointFn?: typeof findActivePoint;
  listNearbyPointsFn?: typeof listNearbyPoints;
  hasRecentRecordForPointFn?: typeof recordStore.hasRecentRecordForPoint;
```

4. Factory resolution (with the others):

```ts
  const findActivePointFn = deps.findActivePointFn ?? findActivePoint;
  const listNearbyPointsFn = deps.listNearbyPointsFn ?? listNearbyPoints;
  const hasRecentRecordForPointFn = deps.hasRecentRecordForPointFn ?? recordStore.hasRecentRecordForPoint;
```

5. Module-level constant near the top:

```ts
const ENRICH_MAX_DISTANCE_METERS = Number(process.env.PLATFORM_ENRICH_MAX_DISTANCE_M ?? 250);
const ENRICH_COOLDOWN_HOURS = 24;
const NEARBY_DEFAULT_RADIUS_METERS = 2000;
const NEARBY_MAX_RADIUS_METERS = 5000;
const NEARBY_LIMIT = 25;
```

6. In `handleRecordCreate`, after the record-type/field validation (`issues.length` check) and before `createRecordFn`:

```ts
    let captureLat: number | null = null;
    let captureLng: number | null = null;
    if (body.pointId) {
      const gps = body.evidence.gps;
      if (!gps) return errorResponse("GPS evidence is required when attaching to an existing point", 422, { code: "platform_enrich_gps_required" });
      const point = await findActivePointFn(body.pointId);
      if (!point) return errorResponse("Point not found", 409, { code: "platform_point_not_found" });
      const distanceMeters = haversineKm(
        { latitude: gps.latitude, longitude: gps.longitude },
        point.location,
      ) * 1000;
      if (distanceMeters > ENRICH_MAX_DISTANCE_METERS) {
        return errorResponse("You are too far from this point to enrich it", 422, { code: "platform_enrich_too_far" });
      }
      const onCooldown = await hasRecentRecordForPointFn({
        organizationId: context.organizationId,
        pointId: body.pointId,
        capturedBy: context.userId,
        recordTypeKey: body.recordTypeKey,
        withinHours: ENRICH_COOLDOWN_HOURS,
      });
      if (onCooldown) {
        return errorResponse("You already submitted a record for this point today", 429, { code: "platform_enrich_cooldown" });
      }
      captureLat = gps.latitude;
      captureLng = gps.longitude;
    }
```

then pass to `createRecordFn`: `pointId: body.pointId ?? null, captureLat, captureLng,` and include `pointId: body.pointId ?? null` in the audit payload.

7. New handler (place near `handleRecordList`):

```ts
  async function handlePointNearby(request: Request, url: URL): Promise<Response> {
    const projectId = url.searchParams.get("projectId") ?? "";
    const latitude = Number(url.searchParams.get("latitude"));
    const longitude = Number(url.searchParams.get("longitude"));
    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 ||
        !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
      return errorResponse("Valid latitude and longitude are required", 400);
    }
    const rawRadius = Number(url.searchParams.get("radiusMeters"));
    const radiusMeters = Number.isFinite(rawRadius) && rawRadius > 0
      ? Math.min(rawRadius, NEARBY_MAX_RADIUS_METERS)
      : NEARBY_DEFAULT_RADIUS_METERS;
    const context = await requireProjectOrgRole(request, projectId, "collector", tenancyDeps);
    if (isTenancyFailure(context)) return context;
    const points = await listNearbyPointsFn({ latitude, longitude, radiusMeters, limit: NEARBY_LIMIT });
    return jsonResponse({ points }, { status: 200 });
  }
```

8. Route map: `platform_point_nearby: { method: "GET", handler: (request) => handlePointNearby(request, new URL(request.url)) },`

9. Browse filter (spec: "`record_browse` accepts an optional `pointId` filter"): in `handleRecordBrowse`, read `const pointId = url.searchParams.get("pointId") ?? undefined;` and pass it through: `listRecordsFn({ organizationId, status: "approved", pointId })`. Add an API test: browse request with `&pointId=pt_1` → assert the fake `listRecordsFn` received `pointId: "pt_1"`.

- [ ] **Step 7: Run to verify pass**

Run: `npx tsx --test tests/platformApi.test.ts && npx tsx --test tests/platformPointLookup.test.ts`
Expected: PASS (all)

- [ ] **Step 8: Add env var to `.env.example`**

```
# Max distance (meters) between a company collector and a point when enriching it
PLATFORM_ENRICH_MAX_DISTANCE_M=250
```

- [ ] **Step 9: Commit**

```bash
git add lib/server/platform/pointLookup.ts lib/server/platform/api.ts .env.example tests/platformPointLookup.test.ts tests/platformApi.test.ts
git commit -m "feat: gate platform record enrichment and add nearby point view"
```

---

### Task 5: Client API

**Files:**
- Modify: `lib/client/platformApi.ts`
- Modify: `tests/platformClientApi.test.ts` (add cases)

**Interfaces:**
- Consumes: `PlatformNearbyPoint` (Task 2); server views from Task 4. `callPlatform(view, options, deps)` in this file already prefixes `platform_` and handles `idempotencyKey`/`params`.
- Produces:
  - `createPlatformRecordRequest` input gains `pointId?: string`; when set, request body includes `pointId`.
  - `nearbyPlatformPointsRequest(input: { projectId: string; latitude: number; longitude: number; radiusMeters?: number }, deps?): Promise<PlatformNearbyPoint[]>`

- [ ] **Step 1: Write failing client tests** — append to `tests/platformClientApi.test.ts`, following its existing fake-fetch pattern (it stubs the fetch dep and asserts URL/body):

The file has helpers `jsonResponse(body, status)` and `stubFetch(handler)` (returns `{ fetchFn, calls }`), and imports client functions from `../lib/client/platformApi.ts`. Add `nearbyPlatformPointsRequest` to that import and append:

```ts
const RECORD_INPUT = {
  projectId: "p1",
  schemaVersionId: "s1",
  recordTypeKey: "retail_outlet",
  data: { name: "Kiosk" },
  evidence: { gps: { latitude: 4.05, longitude: 9.7 }, photos: [] as string[] },
  idempotencyKey: "record-key-000001",
};

test("createPlatformRecordRequest forwards pointId when attaching to a point", async () => {
  const { fetchFn, calls } = stubFetch(() => jsonResponse({ record: { id: "r1" } }, 201));
  await createPlatformRecordRequest({ ...RECORD_INPUT, pointId: "pt_1" }, { fetchFn });
  const body = JSON.parse(String(calls[0].init?.body));
  assert.equal(body.pointId, "pt_1");
});

test("createPlatformRecordRequest omits pointId for standalone records", async () => {
  const { fetchFn, calls } = stubFetch(() => jsonResponse({ record: { id: "r1" } }, 201));
  await createPlatformRecordRequest(RECORD_INPUT, { fetchFn });
  const body = JSON.parse(String(calls[0].init?.body));
  assert.equal("pointId" in body, false);
});

test("nearbyPlatformPointsRequest hits platform_point_nearby with coordinates", async () => {
  const points = [{
    pointId: "pt_1", category: "pharmacy", name: "Pharmacie Centrale",
    location: { latitude: 4.0503, longitude: 9.7001 },
    updatedAt: "2026-07-01T00:00:00.000Z", distanceMeters: 35,
  }];
  const { fetchFn, calls } = stubFetch(() => jsonResponse({ points }));
  const result = await nearbyPlatformPointsRequest(
    { projectId: "p1", latitude: 4.05, longitude: 9.7 },
    { fetchFn },
  );
  assert.match(calls[0].url, /view=platform_point_nearby/);
  assert.match(calls[0].url, /projectId=p1/);
  assert.match(calls[0].url, /latitude=4\.05/);
  assert.match(calls[0].url, /longitude=9\.7/);
  assert.deepEqual(result, points);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx tsx --test tests/platformClientApi.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement in `lib/client/platformApi.ts`**

`createPlatformRecordRequest`: add `pointId?: string` to the input type; in the body object add `...(input.pointId ? { pointId: input.pointId } : {})`.

New function after `listApprovedPlatformRecordsRequest`:

```ts
export async function nearbyPlatformPointsRequest(
  input: { projectId: string; latitude: number; longitude: number; radiusMeters?: number },
  deps?: PlatformApiDeps,
): Promise<PlatformNearbyPoint[]> {
  const payload = await callPlatform<{ points: PlatformNearbyPoint[] }>(
    "point_nearby",
    {
      method: "GET",
      params: {
        projectId: input.projectId,
        latitude: String(input.latitude),
        longitude: String(input.longitude),
        ...(input.radiusMeters ? { radiusMeters: String(input.radiusMeters) } : {}),
      },
    },
    deps,
  );
  return payload.points;
}
```

Add `PlatformNearbyPoint` to the type imports from `shared/platformTypes`.

- [ ] **Step 4: Run to verify pass**

Run: `npx tsx --test tests/platformClientApi.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/client/platformApi.ts tests/platformClientApi.test.ts
git commit -m "feat: client support for point-linked platform records"
```

---

### Task 6: UI — point picker in PlatformCollectionFlow + console point badge

**Files:**
- Create: `lib/client/platformPointUi.ts` (pure helpers)
- Create: `tests/platformPointUi.test.ts`
- Modify: `components/Screens/PlatformCollectionFlow.tsx`
- Modify: `components/Console/ReviewQueueScreen.tsx`

**Interfaces:**
- Consumes: `nearbyPlatformPointsRequest`, `createPlatformRecordRequest` `pointId` (Task 5), `PlatformNearbyPoint` (Task 2), `record.pointId` (Task 3).
- Produces (in `platformPointUi.ts`):
  - `formatDistanceMeters(meters: number, language: "en" | "fr"): string` — `< 1000` → `"120 m"`, else 1-decimal km (`"1.4 km"`)
  - `pointStaleness(updatedAt: string, now: Date): { days: number; stale: boolean }` — `stale` when `days > 30`
  - `stalenessLabel(updatedAt: string, now: Date, language: "en" | "fr"): string` — e.g. `"updated 45 days ago"` / `"mis à jour il y a 45 jours"`, `"updated today"` / `"mis à jour aujourd'hui"` for day 0

- [ ] **Step 1: Write failing helper tests** — `tests/platformPointUi.test.ts`:

```ts
import assert from "node:assert/strict";
import test from "node:test";
import { formatDistanceMeters, pointStaleness, stalenessLabel } from "../lib/client/platformPointUi.js";

const NOW = new Date("2026-07-18T12:00:00.000Z");

test("formatDistanceMeters renders meters below 1km and km above", () => {
  assert.equal(formatDistanceMeters(120, "en"), "120 m");
  assert.equal(formatDistanceMeters(1400, "en"), "1.4 km");
});

test("pointStaleness flags points older than 30 days", () => {
  assert.deepEqual(pointStaleness("2026-07-17T12:00:00.000Z", NOW), { days: 1, stale: false });
  assert.equal(pointStaleness("2026-06-01T12:00:00.000Z", NOW).stale, true);
});

test("stalenessLabel is bilingual and handles today", () => {
  assert.equal(stalenessLabel("2026-07-18T09:00:00.000Z", NOW, "en"), "updated today");
  assert.equal(stalenessLabel("2026-06-03T12:00:00.000Z", NOW, "fr"), "mis à jour il y a 45 jours");
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx tsx --test tests/platformPointUi.test.ts`
Expected: FAIL (module missing)

- [ ] **Step 3: Implement `lib/client/platformPointUi.ts`**

```ts
export const POINT_STALE_AFTER_DAYS = 30;

export function formatDistanceMeters(meters: number, language: "en" | "fr"): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  const km = (meters / 1000).toFixed(1);
  return `${km} km`;
}

export function pointStaleness(updatedAt: string, now: Date): { days: number; stale: boolean } {
  const updated = new Date(updatedAt).getTime();
  const days = Math.max(0, Math.floor((now.getTime() - updated) / 86_400_000));
  return { days, stale: days > POINT_STALE_AFTER_DAYS };
}

export function stalenessLabel(updatedAt: string, now: Date, language: "en" | "fr"): string {
  const { days } = pointStaleness(updatedAt, now);
  if (days === 0) return language === "fr" ? "mis à jour aujourd'hui" : "updated today";
  return language === "fr" ? `mis à jour il y a ${days} jours` : `updated ${days} days ago`;
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx tsx --test tests/platformPointUi.test.ts`
Expected: PASS

- [ ] **Step 5: Add the picker to `PlatformCollectionFlow.tsx`**

Read the component first; it is a single-screen form (record-type select → fields → GPS → photos → submit) with a file-local `t(en, fr)` helper, `gpsEvidence` state, and an existing GPS-capture helper using Capacitor/`navigator.geolocation`. Integrate:

1. New state:

```ts
const [attachedPoint, setAttachedPoint] = useState<PlatformNearbyPoint | null>(null);
const [nearbyPoints, setNearbyPoints] = useState<PlatformNearbyPoint[] | null>(null);
const [isLoadingNearby, setIsLoadingNearby] = useState(false);
const [nearbyError, setNearbyError] = useState('');
```

2. Handler `loadNearbyPoints()`: ensure GPS via the component's existing capture helper (reuse it — do not duplicate geolocation code); then `nearbyPlatformPointsRequest({ projectId, latitude, longitude })`; set `nearbyPoints`; errors → `nearbyError` with bilingual copy (`t('Could not load nearby points', 'Impossible de charger les points à proximité')`).

3. UI section rendered after the record-type selector and before the field inputs, only when a record type is selected:
   - Collapsed state: `btn-ghost`-style button — `t('Attach to existing point', 'Associer à un point existant')` → calls `loadNearbyPoints()`.
   - Loading / error states with the file's existing patterns.
   - List: each row a 44px+ tap target showing `point.name ?? point.category`, category `micro-label`, `formatDistanceMeters(point.distanceMeters, language)`, and a staleness badge with `stalenessLabel(...)` — badge uses `amber` tint when `pointStaleness(...).stale`, muted otherwise. Tap → `setAttachedPoint(point)`, collapse list.
   - Attached state: a chip/card showing the selected point name + staleness + an X button to clear (`setAttachedPoint(null)`).
   - Empty list: `t('No points nearby', 'Aucun point à proximité')`.

4. Submit: pass `pointId: attachedPoint?.pointId` into the existing `createPlatformRecordRequest` call. On success, also reset `attachedPoint`/`nearbyPoints` alongside the existing reset logic. Map the new API error codes in the existing `PlatformApiError` handling to bilingual messages:
   - `platform_enrich_too_far` → `t('You are too far from this point. Move closer and retry.', 'Vous êtes trop loin de ce point. Rapprochez-vous et réessayez.')`
   - `platform_enrich_cooldown` → `t('You already submitted for this point today.', 'Vous avez déjà soumis pour ce point aujourd’hui.')`
   - `platform_point_not_found` → `t('This point no longer exists. Detach and submit as a new record.', 'Ce point n’existe plus. Détachez-le et soumettez un nouveau relevé.')`

5. When `attachedPoint` set and GPS evidence missing, disable submit with hint `t('Capture GPS to attach a point', 'Capturez le GPS pour associer un point')` (server rejects otherwise).

Follow existing styles in the file (`card-soft`, `micro-label`, `rounded-2xl`, `active:scale-95`). No new dependencies.

- [ ] **Step 6: Console badge in `ReviewQueueScreen.tsx`**

In the record card render, when `record.pointId` is set, show a small pill: `MapPin` icon (lucide-react, already used across the app) + `t('Linked point', 'Point associé')` + truncated `record.pointId` (`max-w` + `truncate`). Place it beside the existing record-type/status metadata.

Additionally, in the read-only (browse/approved) mode of the same screen, group records client-side by `pointId` before rendering: records sharing a `pointId` render under one header row (pill + count, e.g. "Linked point pt_… · 3 records"); records with `pointId == null` stay in the existing flat list below, unchanged. Pure presentation — same data, one `Map<string | null, PlatformRecord[]>` grouping pass, no new fetches.

- [ ] **Step 7: Verify**

Run: `npx tsx --test tests/platformPointUi.test.ts && npx run type-check 2>/dev/null || npm run typecheck 2>/dev/null || npx tsc --noEmit`
Expected: helper tests PASS; typecheck clean. (Use the repo's actual typecheck script from `package.json` — check `npm run` list.)

- [ ] **Step 8: Commit**

```bash
git add lib/client/platformPointUi.ts tests/platformPointUi.test.ts components/Screens/PlatformCollectionFlow.tsx components/Console/ReviewQueueScreen.tsx
git commit -m "feat: point picker with staleness in platform collection flow"
```

---

### Task 7: Full-suite gate

**Files:** none new.

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: all pass (matches pre-change baseline; the suite has pre-existing state — compare against a baseline run if anything unrelated fails).

- [ ] **Step 2: Run lint + typecheck + build**

Run: `npm run test:ci` (or the individual `lint`/`typecheck`/`build` scripts if `test:ci` is too slow)
Expected: clean.

- [ ] **Step 3: Commit any stragglers**

```bash
git status  # should be clean except intentional changes
```
