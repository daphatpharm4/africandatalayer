# Company Collector Point Enrichment — Private Tenant Overlay

**Date:** 2026-07-18
**Status:** Approved design

## Problem

Company (tenant) collectors cannot update already-existing points — a core selling point of the platform. The tenant vertical (`lib/server/platform/`) was built as a standalone create-only pipeline: `platform_records` are schema-versioned blobs with no link to the core `ProjectedPoint` dataset. The core agent app has full CREATE/ENRICH event support (`PointEventType` in `shared/types.ts`), but tenant records never connect to it.

## Decisions (from brainstorming)

1. **Visibility: private tenant overlay.** A tenant's enrichments are visible only inside their org. The public projected point is untouched; other tenants never see the records.
2. **Field model: tenant-defined schema.** Collectors fill fields from their org's published record schema. No mapping to the core `ENRICH_FIELD_CATALOG`; no writes into the core projection engine.
3. **Point scope: any active point, with anti-abuse constraints** (proximity gate, cooldown) and staleness (`updatedAt`) surfaced in the picker.

Consequence of 1 + 2: the original "emit ENRICH_EVENT into the core pipeline" idea does not fit — that pipeline projects into shared global points. Chosen approach instead: link tenant records to points via `point_id` and join at read time.

## Approach

Add a nullable `point_id` to `platform_records`. A record with `point_id` is an enrichment attached to a public point; without it, a standalone record (today's behavior, unchanged). Read-time join surfaces an org's approved records on the point.

### 1. Data model

New migration `supabase/migrations/20260721_platform_record_point_link.sql`:

- `point_id text NULL` on `platform_records` — no FK (projection tables churn on rebuild); existence validated at the API via a projection-store lookup
- `capture_lat double precision NULL`, `capture_lng double precision NULL` — collector's GPS at capture, kept for forensics
- Index `platform_records_point_overlay` on `(organization_id, point_id, status)`

### 2. API (`lib/server/platform/api.ts`)

**`record_create`** body gains optional `pointId: string` and `captureLocation: { lat, lng }`. When `pointId` is present the server enforces, in order:

1. Point exists and is active in the projection store → else `409` (`platform_point_not_found`)
2. **Proximity:** capture GPS within `PLATFORM_ENRICH_MAX_DISTANCE_M` (env var, default `250`) meters of the point location → else `422` (`platform_enrich_too_far`). Reuse haversine/GPS helpers (`lib/server/gpsValidation.ts`).
3. **Cooldown:** max 1 record per (collector, point, recordType) per 24h → else `429` (`platform_enrich_cooldown`)
4. Existing rate limiting and idempotency unchanged

`captureLocation` is required when `pointId` is present; ignored otherwise. Audit payload for `record_created` includes `pointId`.

**New GET `platform_point_nearby`** (collector role, project-scoped): returns active projected points near a `lat`/`lng`, each with `id`, `category`, `name`, `location`, `updatedAt`. Powers the picker and exposes staleness. Bounded result count (e.g. 25) and radius.

**`record_list` / `record_browse`** include `pointId` in returned records; `record_browse` accepts an optional `pointId` filter.

### 3. UI

**`components/Screens/PlatformCollectionFlow.tsx`:** new optional step before the form — "Attach to existing point". Nearby list sorted by distance; each row shows name, category, distance, and an "updated X days ago" staleness badge (stale points highlighted to steer collectors toward old data). Skippable → standalone record.

**Console (`components/Console/`):** browse shows the linked point on each record; point-grouped view of the org's approved records.

### 4. Review & visibility

Unchanged review queue: `pending_review → approved/rejected` by tenant reviewer. Only approved records appear in browse. Overlay is strictly org-private.

### 5. Testing

- Migration contract test (new columns, index, nullability)
- API tests: happy path with pointId, missing captureLocation, inactive/unknown point, proximity failure, cooldown failure, standalone-record regression (no pointId still works)
- UI state test for the picker step (attach vs. skip)

## Out of scope

- Writing tenant data into the core projection engine
- Cross-tenant or public sharing of tenant records
- Category binding of record types to point categories (revisit if abuse appears)
- Manager-assigned point lists
