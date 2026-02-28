# ADL System Design Document

**Author:** Teammate 2 -- System Design Expert
**Date:** 2026-02-27
**Status:** Living document -- updates with each scaling phase
**Predecessor:** [01-cloud-architecture.md](./01-cloud-architecture.md) (Cloud Architect)
**Scope:** Service boundaries, API design, data models, performance targets, failure handling, caching, and real-time sync for African Data Layer

---

## Table of Contents

1. [Service Boundaries](#1-service-boundaries)
2. [API Design](#2-api-design)
3. [Data Models](#3-data-models)
4. [Performance Targets](#4-performance-targets)
5. [Failure Handling Strategy](#5-failure-handling-strategy)
6. [Caching Strategy](#6-caching-strategy)
7. [Real-time & Sync Architecture](#7-real-time--sync-architecture)

---

## 1. Service Boundaries

### 1.1 Current Monolith Decomposition Analysis

ADL today runs as a single Vercel deployment -- every API route, the React SPA, auth logic, fraud checking, photo upload, event projection, and leaderboard calculation all deploy together in one `vercel.json` routing config. This is appropriate for the current stage.

**Current module map (logical boundaries that already exist in code):**

```
+-----------------------------------------------------------------+
|  Vercel Deployment (monolith)                                    |
|                                                                  |
|  [AUTH MODULE]          [SUBMISSION MODULE]     [USER MODULE]    |
|  api/auth/auth.ts       api/submissions/        api/user/        |
|  api/auth/register.ts     index.ts (GET/POST)     index.ts       |
|  api/auth/[...auth].ts    [id].ts (GET/PUT/DEL)                  |
|  api/auth/callback/                                              |
|  api/auth/signin/       [LEADERBOARD MODULE]    [HEALTH MODULE]  |
|  lib/auth.ts            api/leaderboard/        api/health/      |
|                           index.ts                index.ts       |
|                                                                  |
|  [STORAGE LAYER]        [PROJECTION ENGINE]     [FRAUD ENGINE]   |
|  lib/server/storage/    lib/server/             lib/server/      |
|    index.ts               pointProjection.ts      submissionFraud |
|    postgresStore.ts                               .ts            |
|    edgeConfigStore.ts   [ACCESS CONTROL]                         |
|    edgeFallbackStore.ts lib/server/                              |
|    types.ts               submissionAccess.ts                    |
|                                                                  |
|  [SHARED DOMAIN]        [CLIENT OFFLINE]                         |
|  shared/types.ts        lib/client/                              |
|  shared/geofence.ts       offlineQueue.ts                        |
|  types.ts (UI types)      submissionSync.ts                      |
+-----------------------------------------------------------------+
```

**Analysis of coupling and cohesion:**

| Boundary | Cohesion | Coupling to others | Verdict |
|----------|----------|-------------------|---------|
| Auth module | High -- isolated JWT/cookie/OAuth logic | Low -- only `lib/auth.ts` used by other modules via `requireUser()` | Clean boundary, could split easily |
| Submission module | Medium -- combines CRUD, photo upload, fraud, projection | High -- calls storage, fraud, projection, geofence, blob upload, IP geolocation, user profile XP update | Core domain, keep together for now |
| Leaderboard module | High -- single GET aggregation | Medium -- reads all events, user profiles | Could be async/cached worker |
| User module | High -- profile CRUD | Low -- only storage layer | Clean boundary |
| Storage layer | High -- abstract store interface | Low -- only `pg` driver | Good abstraction; already supports driver swap |
| Fraud engine | High -- EXIF parsing, haversine, photo fraud metadata | Medium -- called inline during POST submission | Candidate for async extraction |
| Projection engine | High -- event folding, gap analysis | Low -- pure functions, no I/O | Excellent isolation |

### 1.2 Proposed Service Boundaries

Given that ADL is an early-stage startup with a small team, over-decomposition into microservices would be premature. The recommendation is a **modular monolith** with clear internal boundaries, preparing for extraction only when measured bottlenecks demand it.

**Phase 1 (MVP, now -- 1K users): Keep as monolith**

No changes to deployment topology. Enforce boundaries through:
- TypeScript module interfaces (the `StorageStore` interface in `lib/server/storage/types.ts` is a good pattern)
- No cross-module direct database access; always go through the storage abstraction
- Fraud detection called inline during submission POST is acceptable at current scale

**Phase 2 (1K -- 10K users): Extract async processing**

```
+--------------------+     +---------------------+
|  ADL API Monolith  |     |  Async Workers      |
|  (Vercel Functions) |---->|  (Vercel Cron/      |
|                    |     |   QStash webhooks)   |
|  - Auth            |     |                     |
|  - Submissions     |     |  - Fraud scoring    |
|  - User profiles   |     |  - Photo processing |
|  - Health          |     |  - Leaderboard      |
|  - Point projection|     |    recalculation    |
|                    |     |  - XP recalculation  |
+--------+-----------+     +----------+----------+
         |                            |
         +--------+-------------------+
                  |
         +--------v----------+
         |  Supabase Postgres |
         |  + Vercel Blob     |
         +--------------------+
```

Extraction triggers:
- Fraud scoring (EXIF extraction + IP geolocation) adds > 200ms p95 to submission POST latency
- Leaderboard computation (`getPointEvents()` loads ALL events) exceeds 500ms
- Photo resize/optimize pipeline needed for bandwidth savings

**Phase 3 (10K -- 100K users): Bounded context extraction**

Only split if the monolith deployment exceeds Vercel function size limits or team grows to 3+ squads.

| Service | Owns | Extract when |
|---------|------|-------------|
| Submission Service | point_events, photo upload, geofencing | Team split or function cold start > 3s |
| Identity Service | user_profiles, auth, registration | Regulatory requirement (data residency per country) |
| Analytics Service | leaderboard, contribution stats, projections | Computation time exceeds 1s or data consumers need independent SLA |
| Fraud Service | fraud_signals, EXIF analysis, IP scoring | ML model integration or real-time scoring pipeline needed |

### 1.3 Service Ownership Matrix

| Module | Owner (Role) | On-call | Runbook location |
|--------|-------------|---------|-----------------|
| Auth (`api/auth/`, `lib/auth.ts`) | Full-stack lead | Primary | `/docs/runbooks/auth.md` |
| Submissions (`api/submissions/`) | Full-stack lead | Primary | `/docs/runbooks/submissions.md` |
| Storage (`lib/server/storage/`) | Full-stack lead | Primary | `/docs/runbooks/storage.md` |
| Fraud (`lib/server/submissionFraud.ts`) | Full-stack lead (later: Fraud specialist) | Secondary | `/docs/runbooks/fraud.md` |
| Offline queue (`lib/client/offlineQueue.ts`) | Frontend lead | Primary | `/docs/runbooks/offline.md` |
| Infrastructure (Vercel, Supabase) | Cloud engineer | Primary | `/docs/runbooks/infra.md` |

### 1.4 Decision Criteria: Split vs. Keep Together

| Signal | Action |
|--------|--------|
| Two modules need different scaling profiles (e.g., reads vs. writes) | Consider split |
| A module has a different deployment cadence | Consider split |
| A module needs a different runtime (e.g., Python ML) | Extract |
| Team size < 5 developers | Keep together |
| Shared database tables between modules | Keep together |
| Module adds > 200ms latency to critical path synchronously | Extract to async |
| Module failure should not take down the whole system | Extract with circuit breaker |

---

## 2. API Design

### 2.1 Complete API Specification

#### Base URL

```
Production:  https://africandatalayer.vercel.app/api
Staging:     https://staging-africandatalayer.vercel.app/api
```

#### Versioning Strategy

**Current state:** No API versioning exists. All endpoints are unversioned.

**Recommended approach:** URL-prefix versioning when breaking changes are needed:

```
/api/v1/submissions    (future, when breaking change is introduced)
/api/submissions       (current, treated as v0/unversioned)
```

**When to version:**
- Removing a field from a response body
- Changing the type of a response field
- Removing an endpoint
- Changing authentication scheme

**When NOT to version (additive changes are safe):**
- Adding a new field to a response body
- Adding a new endpoint
- Adding a new query parameter
- Adding a new optional field to a request body

#### 2.1.1 Health

```
GET /api/health
```

| Attribute | Value |
|-----------|-------|
| Auth | None |
| Rate limit | 60 req/min (any) |
| Cache | `no-store` |
| File | `api/health/index.ts` |

**Response 200:**
```json
{
  "status": "ok",
  "db": "ok",
  "ts": "2026-02-27T10:00:00.000Z"
}
```

**Response 503:**
```json
{
  "status": "error",
  "db": "error",
  "ts": "2026-02-27T10:00:00.000Z"
}
```

#### 2.1.2 Authentication

```
POST /api/auth/register
```

| Attribute | Value |
|-----------|-------|
| Auth | None |
| Rate limit | 5 req/min per IP |
| File | `api/auth/register.ts` |

**Request body:**
```json
{
  "identifier": "+237612345678",
  "password": "securepassword",
  "name": "Charles"
}
```

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `identifier` | string | Yes | Email or phone (E.164 format) |
| `password` | string | Yes | Min 8 characters |
| `name` | string | No | Display name; defaults to identifier prefix |

**Response 201:** `{ "ok": true }`
**Response 400:** `{ "error": "Phone/email and password are required" }`
**Response 409:** `{ "error": "User already exists" }`

---

```
POST /api/auth/callback/credentials
```

| Attribute | Value |
|-----------|-------|
| Auth | None |
| Rate limit | 10 req/min per IP |
| File | `api/auth/auth.ts` (Auth.js handler) |

Handled by Auth.js. Sets `authjs.session-token` (or `__Secure-authjs.session-token` on HTTPS) as an HTTP-only cookie with JWT.

```
GET /api/auth/callback/google
POST /api/auth/signin/google
```

Google OAuth flow, handled by Auth.js.

---

```
GET /api/auth/session
```

Returns current session. Handled by Auth.js.

---

#### 2.1.3 Submissions (Points of Interest)

```
GET /api/submissions
```

| Attribute | Value |
|-----------|-------|
| Auth | Optional for public reads; required for `scope != bonamoussadi` or `view=events` |
| Rate limit | 100 req/min (anonymous), 300 req/min (authenticated) |
| Cache | `public, s-maxage=30, stale-while-revalidate=300` for anonymous projected points |
| File | `api/submissions/index.ts` |

**Query parameters:**

| Param | Type | Default | Notes |
|-------|------|---------|-------|
| `view` | `"events"` \| `"admin_events"` | (none, returns projected points) | `events` = raw event list; `admin_events` = enriched with user info + fraud data (admin only) |
| `scope` | `"bonamoussadi"` \| `"cameroon"` \| `"global"` | `"bonamoussadi"` | `cameroon` and `global` require admin auth |
| `lat` | number | (none) | Center latitude for radius filter |
| `lng` | number | (none) | Center longitude for radius filter |
| `radius` | number | (none) | Radius in km for proximity filter |

**Response 200 (default -- projected points):**
```json
[
  {
    "id": "uuid",
    "pointId": "uuid",
    "category": "pharmacy",
    "location": { "latitude": 4.0877, "longitude": 9.7394 },
    "details": {
      "name": "Pharmacie du Centre",
      "isOpenNow": true,
      "isOnDuty": false,
      "openingHours": "08:00-20:00"
    },
    "photoUrl": "https://blob.vercel-storage.com/...",
    "createdAt": "2026-02-01T10:00:00.000Z",
    "updatedAt": "2026-02-27T10:00:00.000Z",
    "gaps": ["isOnDuty"],
    "eventsCount": 3,
    "eventIds": ["uuid1", "uuid2", "uuid3"]
  }
]
```

**Response 200 (view=events, unauthenticated -- userId redacted):**
Array of `PointEvent` objects with `userId` stripped.

**Response 200 (view=admin_events -- admin only):**
```json
[
  {
    "event": { /* PointEvent */ },
    "user": { "id": "user@example.com", "name": "Charles", "email": "user@example.com" },
    "fraudCheck": { /* SubmissionFraudCheck or null */ }
  }
]
```

**Current gap identified:** No pagination. `getPointEvents()` in `postgresStore.ts` (line 289-298) fetches ALL events with `order by created_at asc`. This will not scale.

**Recommended fix -- add cursor-based pagination:**
```
GET /api/submissions?cursor=<last_event_id>&limit=50
GET /api/submissions?view=events&cursor=<last_event_id>&limit=100
```

---

```
POST /api/submissions
```

| Attribute | Value |
|-----------|-------|
| Auth | Required (JWT cookie or Bearer token) |
| Rate limit | 30 req/min (contributor), 100 req/min (admin) |
| Max body size | ~16 MB (two base64 photos at 8 MB each + metadata) |
| File | `api/submissions/index.ts` |

**Request body:**
```json
{
  "eventType": "CREATE_EVENT",
  "category": "pharmacy",
  "location": { "latitude": 4.0877, "longitude": 9.7394 },
  "details": {
    "name": "Pharmacie du Centre",
    "isOpenNow": true,
    "clientDevice": {
      "deviceId": "abc123",
      "platform": "Android",
      "deviceMemoryGb": 2,
      "hardwareConcurrency": 4,
      "isLowEnd": true
    }
  },
  "imageBase64": "data:image/jpeg;base64,/9j/4AAQ..."
}
```

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `eventType` | `"CREATE_EVENT"` \| `"ENRICH_EVENT"` | No (defaults to `CREATE_EVENT`) | |
| `category` | `"pharmacy"` \| `"fuel_station"` \| `"mobile_money"` | Yes | Also accepts `PHARMACY`, `FUEL`, `MOBILE_MONEY` |
| `location` | `{ latitude, longitude }` | No (falls back to photo GPS or IP) | |
| `pointId` | string (UUID) | Required for `ENRICH_EVENT` | Target point to enrich |
| `details` | object | No | Category-specific fields |
| `imageBase64` | string | Yes | Data URI with base64-encoded image |
| `secondImageBase64` | string | No | Optional second photo |

**Category-specific required fields for CREATE_EVENT:**

| Category | Required fields (validated by `listCreateMissingFields`) |
|----------|--------------------------------------------------------|
| `pharmacy` | `name`, `isOpenNow` |
| `mobile_money` | `providers` |
| `fuel_station` | `name`, `hasFuelAvailable` |

**Category-specific enrichable fields (validated by `ENRICHABLE_FIELDS`):**

| Category | Enrichable fields |
|----------|-------------------|
| `pharmacy` | `openingHours`, `isOpenNow`, `isOnDuty` |
| `mobile_money` | `merchantIdByProvider`, `paymentMethods`, `openingHours`, `providers` |
| `fuel_station` | `fuelTypes`, `pricesByFuel`, `quality`, `paymentMethods`, `openingHours`, `hasFuelAvailable` |

**Geofencing rules:**
- Non-admin users: location must be within Bonamoussadi bounds (`shared/geofence.ts`)
- Admin users: global scope allowed

**Photo validation pipeline (synchronous in current POST handler):**
1. Parse base64 data URI, validate MIME type (jpeg/png/webp/heic/heif)
2. Validate size <= 8 MB (`MAX_SUBMISSION_IMAGE_BYTES`)
3. Extract EXIF metadata (GPS, timestamp, device make/model)
4. If photo has GPS: verify distance to submission location <= 1 km
5. If photo has GPS + IP available: verify distance to IP <= 50 km
6. Upload to Vercel Blob
7. Build fraud check metadata and store in `details.fraudCheck`

**Response 201:** Full `PointEvent` object
**Response 400:** Various validation errors
**Response 401:** `{ "error": "Unauthorized" }`
**Response 500:** Photo storage failures

**Current gap identified:** The `X-Idempotency-Key` header is sent by `lib/client/offlineQueue.ts` (line 233: `await sendFn(item.payload, { idempotencyKey: item.idempotencyKey })`) but **never checked server-side** in `api/submissions/index.ts`. This means replayed submissions after network failures create duplicate events.

---

```
GET /api/submissions/[id]
```

| Attribute | Value |
|-----------|-------|
| Auth | Required |
| Rate limit | 100 req/min |
| File | `api/submissions/[id].ts` |

**Query parameters:**

| Param | Type | Notes |
|-------|------|-------|
| `view` | `"event"` | Return raw event instead of projected point |

**Response 200:** `ProjectedPoint` or `PointEvent` (if `view=event`)
**Response 404:** `{ "error": "Submission not found" }`

---

```
PUT /api/submissions/[id]
```

| Attribute | Value |
|-----------|-------|
| Auth | Required |
| Rate limit | 30 req/min |
| File | `api/submissions/[id].ts` |

Creates an `ENRICH_EVENT` for the target point. Legacy compatibility endpoint.

**Request body:**
```json
{
  "details": { "openingHours": "08:00-20:00" },
  "photoUrl": "https://..."
}
```

**Response 200:** New `PointEvent`
**Response 404:** `{ "error": "Submission not found" }`

---

```
DELETE /api/submissions/[id]?view=event
```

| Attribute | Value |
|-----------|-------|
| Auth | Required (admin only) |
| Rate limit | 30 req/min |
| File | `api/submissions/[id].ts` |

**Response 200:** `{ "ok": true, "id": "uuid" }`
**Response 403:** `{ "error": "Forbidden" }`
**Response 409:** `{ "error": "Submission source is read-only and cannot be deleted" }`

---

#### 2.1.4 User Profile

```
GET /api/user
```

| Attribute | Value |
|-----------|-------|
| Auth | Required |
| Rate limit | 60 req/min |
| File | `api/user/index.ts` |

**Response 200:**
```json
{
  "id": "user@example.com",
  "name": "Charles",
  "email": "user@example.com",
  "phone": null,
  "image": "",
  "occupation": "Engineer",
  "XP": 25,
  "isAdmin": false,
  "mapScope": "bonamoussadi"
}
```

Note: `passwordHash` is included in the `UserProfile` type but the `rowToUserProfile` function in `postgresStore.ts` (line 82) does include it. **This is a security gap -- password hashes must never be sent to the client.**

**Recommended fix:** Strip `passwordHash` in the API response layer, not the storage layer.

---

```
PUT /api/user
```

| Attribute | Value |
|-----------|-------|
| Auth | Required |
| Rate limit | 30 req/min |
| File | `api/user/index.ts` |

**Request body:**
```json
{
  "occupation": "Software Engineer",
  "mapScope": "cameroon"
}
```

| Field | Type | Notes |
|-------|------|-------|
| `occupation` | string | Max 120 characters |
| `mapScope` | `"bonamoussadi"` \| `"cameroon"` \| `"global"` | Non-admin users restricted to `bonamoussadi` |

---

#### 2.1.5 Leaderboard

```
GET /api/leaderboard
```

| Attribute | Value |
|-----------|-------|
| Auth | None |
| Rate limit | 60 req/min |
| Cache | `public, s-maxage=30, stale-while-revalidate=300` |
| File | `api/leaderboard/index.ts` |

**Response 200:**
```json
[
  {
    "rank": 1,
    "userId": "user@example.com",
    "name": "Charles",
    "xp": 150,
    "contributions": 30,
    "lastContributionAt": "2026-02-27T10:00:00.000Z",
    "lastLocation": "Pharmacie du Centre"
  }
]
```

Returns top 100 users. No pagination.

**Current gap:** Loads ALL point events into memory to aggregate. At 100K events this is untenable.

---

#### 2.1.6 Future Endpoints (Proposed)

| Endpoint | Method | Purpose | Priority |
|----------|--------|---------|----------|
| `/api/v1/webhooks` | POST | Register webhook for data consumers | Phase 2 |
| `/api/v1/export` | GET | Bulk data export (GeoJSON, CSV) | Phase 2 |
| `/api/v1/submissions/nearby` | GET | Proximity search with PostGIS | Phase 2 |
| `/api/v1/notifications/subscribe` | POST | Push notification subscription | Phase 2 |
| `/api/v1/rewards` | GET | Rewards catalog | Phase 2 |
| `/api/v1/rewards/redeem` | POST | Redeem XP for rewards | Phase 2 |

### 2.2 Rate Limiting Tiers

| Role | Tier | Reads | Writes | Notes |
|------|------|-------|--------|-------|
| Anonymous | Free | 100 req/min | 0 | Only public cached reads |
| Contributor | Standard | 300 req/min | 30 req/min | Authenticated users |
| Admin | Elevated | 600 req/min | 100 req/min | Admin dashboard needs higher throughput |
| API Consumer | Keyed | 1000 req/min | 0 (read-only) | Future: data consumers with API keys |

**Implementation:** Vercel Edge Middleware with `@upstash/ratelimit` using sliding window algorithm. Store in Upstash Redis.

**Current state:** No rate limiting exists. This is a critical security gap.

### 2.3 Pagination Standards

All list endpoints must support cursor-based pagination:

```
GET /api/submissions?cursor=<opaque_cursor>&limit=50&sort=created_at&order=desc
```

| Param | Type | Default | Max |
|-------|------|---------|-----|
| `cursor` | string | (none -- first page) | Opaque base64-encoded `{id, createdAt}` |
| `limit` | number | 50 | 200 |
| `sort` | string | `created_at` | Allowed: `created_at`, `updated_at` |
| `order` | `asc` \| `desc` | `desc` | |

**Response envelope (future):**
```json
{
  "data": [ /* items */ ],
  "pagination": {
    "cursor": "eyJpZCI6...",
    "hasMore": true,
    "total": 1523
  }
}
```

### 2.4 Webhook Design for Data Consumers

**Phase 2 feature.** Enables NGOs, governments, and researchers to receive real-time data.

```
POST /api/v1/webhooks
Authorization: Bearer <api_key>

{
  "url": "https://consumer.example.com/hook",
  "events": ["point.created", "point.enriched", "point.updated"],
  "categories": ["pharmacy", "fuel_station"],
  "region": {
    "type": "bounds",
    "south": 4.0, "west": 9.5, "north": 4.2, "east": 9.9
  },
  "secret": "whsec_..."
}
```

**Webhook payload:**
```json
{
  "id": "evt_...",
  "type": "point.created",
  "timestamp": "2026-02-27T10:00:00.000Z",
  "data": {
    "point": { /* ProjectedPoint */ },
    "event": { /* PointEvent -- userId redacted */ }
  },
  "signature": "sha256=..."
}
```

Delivery: HMAC-SHA256 signed, 3 retries with exponential backoff (1s, 10s, 60s), dead letter after 3 failures.

### 2.5 API Authentication Flow

```
CREDENTIAL LOGIN FLOW
=====================
Client                        Server (Auth.js)              Database
  |                              |                            |
  |-- POST /api/auth/callback    |                            |
  |   /credentials               |                            |
  |   {identifier, password}  -->|                            |
  |                              |-- normalizeIdentifier()    |
  |                              |-- getUserProfile() ------->|
  |                              |<-- UserProfile (w/ hash) --|
  |                              |-- bcrypt.compare()         |
  |                              |-- JWT encode (isAdmin,uid) |
  |<-- Set-Cookie: authjs.      |                            |
  |    session-token=<jwt>       |                            |
  |                              |                            |
  |-- GET /api/submissions       |                            |
  |   Cookie: authjs.session-   |                            |
  |   token=<jwt>             -->|                            |
  |                              |-- getAuthToken(request)    |
  |                              |   decode JWT               |
  |                              |   extract id from          |
  |                              |   email || uid || sub      |
  |                              |-- requireUser() returns    |
  |                              |   { id, token }            |
  |<-- 200 JSON response        |                            |

GOOGLE OAUTH FLOW
=================
Client                        Server (Auth.js)      Google       Database
  |                              |                    |             |
  |-- GET /api/auth/signin/      |                    |             |
  |   google                  -->|                    |             |
  |                              |-- redirect ------->|             |
  |<-- 302 to Google consent     |                    |             |
  |-- User consents ------------>|                    |             |
  |                              |<-- callback -------|             |
  |                              |-- signIn callback: |             |
  |                              |   getUserProfile() |------------>|
  |                              |   upsertProfile()  |------------>|
  |                              |   check isAdmin    |             |
  |                              |-- JWT encode       |             |
  |<-- Set-Cookie + redirect     |                    |             |

OFFLINE SUBMISSION FLOW
=======================
Client (offlineQueue.ts)        Server                         Database
  |                              |                               |
  |-- [OFFLINE] enqueue          |                               |
  |   to IndexedDB               |                               |
  |   with idempotencyKey        |                               |
  |                              |                               |
  |-- [ONLINE] flushOfflineQueue |                               |
  |   for each pending item:     |                               |
  |   POST /api/submissions      |                               |
  |   X-Idempotency-Key: <key>  |                               |
  |                           -->|                               |
  |                              |-- (KEY NOT CHECKED!) ---------| <-- GAP
  |                              |-- validate, upload photo      |
  |                              |-- insertPointEvent() -------->|
  |<-- 201 Created               |                               |
  |   remove from IndexedDB      |                               |
  |                              |                               |
  |-- [NETWORK ERROR]            |                               |
  |   increment retryCount       |                               |
  |   calculate nextRetryAt      |                               |
  |   (exponential backoff       |                               |
  |    1s * 2^retry, max 30s,    |                               |
  |    + random jitter)          |                               |
```

---

## 3. Data Models

### 3.1 Entity-Relationship Model

```
+------------------+         +------------------+
| user_profiles    |         | point_events     |
|------------------|         |------------------|
| id (PK, text)    |<-----+  | id (PK, uuid)    |
| email (text)     |      |  | point_id (text)  |----+
| phone (text)     |      +--| user_id (text)   |    |
| name (text)      |         | event_type (text)|    |
| image (text)     |         | category (text)  |    |
| occupation (text)|         | latitude (float) |    |
| xp (int)         |         | longitude (float)|    |
| password_hash    |         | details (jsonb)  |    |
| is_admin (bool)  |         | photo_url (text) |    |
| map_scope (text) |         | created_at (tz)  |    |
| updated_at (tz)  |         | source (text)    |    |
+------------------+         | external_id (text)|    |
                              +------------------+    |
                                                      |
                              +------------------+    |
                              | [PROJECTED VIEW] |    |
                              | projected_points |    |
                              | (materialized)   |    |
                              |------------------|    |
                              | point_id (PK)    |<---+
                              | category (text)  |
                              | latitude (float) |
                              | longitude (float)|
                              | details (jsonb)  |
                              | photo_url (text) |
                              | created_at (tz)  |
                              | updated_at (tz)  |
                              | gaps (text[])    |
                              | events_count(int)|
                              | event_ids(uuid[])|
                              +------------------+

                              +------------------+
                              | [FUTURE]         |
                              | fraud_signals    |
                              |------------------|
                              | id (PK, uuid)    |
                              | event_id (FK)    |----> point_events.id
                              | signal_type (txt)|
                              | severity (text)  |
                              | metadata (jsonb) |
                              | created_at (tz)  |
                              +------------------+

                              +------------------+
                              | [FUTURE]         |
                              | webhook_subs     |
                              |------------------|
                              | id (PK, uuid)    |
                              | consumer_id (txt)|
                              | url (text)       |
                              | events (text[])  |
                              | categories(text[]|
                              | region (jsonb)   |
                              | secret (text)    |
                              | active (bool)    |
                              | created_at (tz)  |
                              +------------------+

                              +------------------+
                              | [FUTURE]         |
                              | idempotency_keys |
                              |------------------|
                              | key (PK, text)   |
                              | user_id (text)   |
                              | event_id (uuid)  |----> point_events.id
                              | created_at (tz)  |
                              | expires_at (tz)  |
                              +------------------+
```

### 3.2 Current Schema (Inferred from Code)

The actual SQL schema is inferred from `postgresStore.ts` queries:

```sql
-- user_profiles
CREATE TABLE user_profiles (
    id          TEXT PRIMARY KEY,
    email       TEXT,
    phone       TEXT,                     -- optional; fallback code handles missing column
    name        TEXT NOT NULL DEFAULT '',
    image       TEXT DEFAULT '',
    occupation  TEXT DEFAULT '',
    xp          INTEGER NOT NULL DEFAULT 0,
    password_hash TEXT,
    is_admin    BOOLEAN NOT NULL DEFAULT FALSE,
    map_scope   TEXT NOT NULL DEFAULT 'bonamoussadi',
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- point_events (append-only event log)
CREATE TABLE point_events (
    id          UUID PRIMARY KEY,
    point_id    TEXT NOT NULL,
    event_type  TEXT NOT NULL,             -- 'CREATE_EVENT' | 'ENRICH_EVENT'
    user_id     TEXT NOT NULL,
    category    TEXT NOT NULL,             -- 'pharmacy' | 'fuel_station' | 'mobile_money'
    latitude    DOUBLE PRECISION NOT NULL,
    longitude   DOUBLE PRECISION NOT NULL,
    details     JSONB NOT NULL DEFAULT '{}',
    photo_url   TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    source      TEXT,
    external_id TEXT
);
```

### 3.3 Event Sourcing Schema Evolution Strategy

The `details` JSONB column in `point_events` is the primary extension point. This is a good design for a schema-on-read system.

**Rules for evolving the event schema:**

1. **Never remove fields from `details`.** Old events retain their original shape.
2. **Add new fields with normalization in the projection layer.** See `normalizeDetailsForCategory()` in `pointProjection.ts` for the pattern: it handles aliases like `hasCashAvailable` -> `hasMin50000XafAvailable`, `hours` -> `openingHours`.
3. **Version the event structure implicitly.** The presence/absence of fields indicates the version. If explicit versioning is needed, add a `_schemaVersion` field to `details`.
4. **Handle missing columns gracefully.** The `phoneColumnState` pattern in `postgresStore.ts` (lines 8, 134-157) demonstrates runtime column detection. This is fragile but pragmatic for MVP. Replace with proper migrations in Phase 2.

**Migration strategy for schema changes:**

| Change type | Approach | Downtime |
|-------------|----------|----------|
| Add column to `user_profiles` | `ALTER TABLE ... ADD COLUMN` with `DEFAULT` | Zero |
| Add column to `point_events` | `ALTER TABLE ... ADD COLUMN` with `DEFAULT NULL` | Zero |
| Add new field to `details` JSONB | No schema change; update projection logic | Zero |
| Rename a `details` field | Add alias in `normalizeDetailsForCategory()`; both old and new names work | Zero |
| Add index | `CREATE INDEX CONCURRENTLY` | Zero |
| Partition `point_events` | Create partitioned table, migrate data, swap | Maintenance window |
| Change column type | Create new column, backfill, update code, drop old | Phased rollout |

### 3.4 Read Model / Projection Design

**Current projection architecture:**

```
point_events (source of truth)
    |
    v
projectPointsFromEvents()          -- lib/server/pointProjection.ts
    |
    |  1. Sort events by createdAt ASC
    |  2. Group by pointId
    |  3. For each group:
    |     - First event initializes the ProjectedPoint
    |     - Subsequent events merge details (last-write-wins per field)
    |     - Location updates to latest event's location
    |     - photoUrl updates to latest non-null
    |     - gaps recalculated after each merge
    |  4. Sort results by updatedAt DESC
    |
    v
ProjectedPoint[]                   -- returned to client
```

**Current problem:** Projection runs on every GET request by loading ALL events from the database. At current scale (< 1000 events) this works. At 10K+ events it will not.

**Phase 2 recommendation: Materialized projection table**

```sql
CREATE TABLE projected_points (
    point_id    TEXT PRIMARY KEY,
    category    TEXT NOT NULL,
    latitude    DOUBLE PRECISION NOT NULL,
    longitude   DOUBLE PRECISION NOT NULL,
    details     JSONB NOT NULL DEFAULT '{}',
    photo_url   TEXT,
    created_at  TIMESTAMPTZ NOT NULL,
    updated_at  TIMESTAMPTZ NOT NULL,
    gaps        TEXT[] NOT NULL DEFAULT '{}',
    events_count INTEGER NOT NULL DEFAULT 1,
    event_ids   UUID[] NOT NULL DEFAULT '{}'
);

CREATE INDEX idx_projected_points_category ON projected_points (category);
CREATE INDEX idx_projected_points_location ON projected_points USING gist (
    ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)
);
CREATE INDEX idx_projected_points_updated ON projected_points (updated_at DESC);
```

**Projection update strategy:**
- On each `insertPointEvent()`, also update the corresponding `projected_points` row
- Use the same `mergeDetails()` logic but apply incrementally
- Fallback: periodic full rebuild via Vercel Cron (`/api/cron/rebuild-projections`)

### 3.5 Indexing Strategy with Query Patterns

| Query pattern | Current index | Recommended index | Used by |
|---------------|--------------|-------------------|---------|
| Get user by ID | PK on `user_profiles.id` | Sufficient | `getUserProfile()` |
| Get users by batch of IDs | PK on `user_profiles.id` | Sufficient (uses `WHERE id = ANY($1)`) | `getUserProfilesBatch()` |
| Get all events ordered by time | None (full table scan) | `CREATE INDEX idx_pe_created ON point_events (created_at ASC)` | `getPointEvents()` |
| Get events by point_id | None | `CREATE INDEX idx_pe_point_id ON point_events (point_id)` | `projectPointById()` |
| Get events by user_id | None | `CREATE INDEX idx_pe_user_id ON point_events (user_id)` | `filterEventsForViewer()` |
| Get events by category | None | `CREATE INDEX idx_pe_category ON point_events (category)` | Scope filtering |
| Proximity search | None | PostGIS GiST index on `(longitude, latitude)` | Future `/nearby` endpoint |
| Deduplicate by external_id | None | `CREATE UNIQUE INDEX idx_pe_external_id ON point_events (external_id) WHERE external_id IS NOT NULL` | Seed event dedup |
| Leaderboard aggregation | None (full scan) | Materialized leaderboard table or `idx_pe_user_id` | `GET /api/leaderboard` |

**Immediate action items:**
1. Add `idx_pe_created` -- every GET request sorts by `created_at`
2. Add `idx_pe_point_id` -- critical for enrichment operations
3. Add `idx_pe_user_id` -- needed for per-user event filtering

### 3.6 Data Migration Strategy

**Approach: Forward-only migrations with versioned SQL files**

```
migrations/
  001_initial_schema.sql
  002_add_phone_column.sql
  003_add_point_events_indexes.sql
  004_create_projected_points.sql
  005_create_idempotency_keys.sql
  006_partition_point_events.sql
```

**Execution:** Run via Supabase CLI (`supabase db push`) or a lightweight migration runner in a Vercel Cron function. Never run destructive migrations (column drops, table drops) without a rollback plan.

**Zero-downtime migration pattern:**
1. Add new column/table (additive change)
2. Deploy code that writes to both old and new
3. Backfill existing data
4. Deploy code that reads from new
5. (Optional, much later) Drop old column/table

---

## 4. Performance Targets

### 4.1 API Latency Targets

Measured from Vercel edge PoP to function response. African users experience an additional 100-300ms network RTT depending on location.

| Endpoint | p50 | p95 | p99 | Notes |
|----------|-----|-----|-----|-------|
| `GET /api/health` | 20ms | 50ms | 100ms | DB ping only |
| `GET /api/submissions` (cached) | 5ms | 10ms | 20ms | Edge cache hit |
| `GET /api/submissions` (miss) | 200ms | 500ms | 1000ms | Full projection; must improve with materialization |
| `GET /api/submissions` (admin_events) | 500ms | 2000ms | 5000ms | Includes fraud fallback lookups (EXIF from URLs) |
| `POST /api/submissions` | 800ms | 2000ms | 4000ms | Photo upload + EXIF + IP lookup + DB write |
| `GET /api/submissions/[id]` | 150ms | 400ms | 800ms | Single point projection |
| `PUT /api/submissions/[id]` | 100ms | 300ms | 600ms | Simple event insert |
| `DELETE /api/submissions/[id]` | 50ms | 150ms | 300ms | Admin only, single DELETE |
| `GET /api/user` | 50ms | 150ms | 300ms | Single row lookup |
| `PUT /api/user` | 50ms | 200ms | 400ms | Single row upsert |
| `GET /api/leaderboard` (cached) | 5ms | 10ms | 20ms | Edge cache hit |
| `GET /api/leaderboard` (miss) | 300ms | 800ms | 2000ms | Full aggregation; must improve |
| `POST /api/auth/register` | 200ms | 500ms | 1000ms | bcrypt hash |
| Auth credential login | 200ms | 500ms | 1000ms | bcrypt compare |

### 4.2 Throughput Targets by Growth Phase

| Phase | Users | Events/day | Peak req/sec | DB connections | Blob uploads/day |
|-------|-------|------------|-------------|----------------|-------------------|
| MVP (now) | < 100 | < 200 | 2 | 5 (current pool max) | < 200 |
| Phase 1 | 1K | 2K | 10 | 5 | 2K |
| Phase 2 | 10K | 20K | 50 | 20 (pgBouncer) | 20K |
| Phase 3 | 100K | 200K | 200 | 50 (pgBouncer + read replicas) | 200K |

### 4.3 Database Query Performance Budgets

| Query category | Budget | Current estimate | Action if exceeded |
|----------------|--------|-----------------|-------------------|
| Single row lookup (user profile) | < 10ms | ~5ms | Add connection pooling |
| Batch user lookup (leaderboard) | < 50ms | ~20ms | Fine at current scale |
| All events scan | < 200ms | ~100ms (< 1K events) | Paginate + materialize projections |
| Single event insert | < 20ms | ~10ms | Fine |
| Bulk upsert (N events in transaction) | < N * 30ms | ~N * 15ms | Batch INSERT with VALUES list |

### 4.4 Frontend Performance Budgets

Measured on a low-end Android device (1 GB RAM, 3G connection):

| Metric | Target | Notes |
|--------|--------|-------|
| LCP (Largest Contentful Paint) | < 3.0s | Map tiles are LCP; preload critical tile layer |
| FID (First Input Delay) | < 200ms | React 19 concurrent rendering helps |
| CLS (Cumulative Layout Shift) | < 0.1 | Fixed-height map container, skeleton loaders |
| TTI (Time to Interactive) | < 5.0s | Service worker precaches shell |
| JS bundle (main) | < 200 KB (gzipped) | Current: `index-QrY-Hdyj.js` -- verify size |
| Offline-to-interactive | < 1.0s | IndexedDB read + cached shell |

### 4.5 Offline Sync Performance Targets

| Metric | Target | Notes |
|--------|--------|-------|
| Queue items before degradation | 200 | IndexedDB handles thousands but UI should warn at 200 |
| Single item sync time | < 5s | Photo upload dominates |
| Full queue flush (50 items) | < 120s | Sequential with backoff delays |
| Time to detect connectivity | < 2s | `navigator.onLine` + fetch heartbeat |
| Conflict resolution time | < 100ms | Client-side, merge by pointId |

---

## 5. Failure Handling Strategy

### 5.1 Circuit Breaker Patterns

**External services that can fail:**

| Service | Used by | Failure mode | Circuit breaker strategy |
|---------|---------|-------------|------------------------|
| Supabase PostgreSQL | All API endpoints | Connection timeout, pool exhaustion | `StorageUnavailableError` (exists in `lib/server/db.ts`). Returns 503 with `code: "storage_unavailable"`. **Enhancement:** add circuit breaker state (closed/open/half-open) with 5 failures in 60s to open, 30s cooldown. |
| Vercel Blob | `POST /api/submissions` | Upload failure | Currently returns 500. **Enhancement:** retry once, then return 503 with client-retryable flag. |
| ipapi.co (IP geolocation) | `POST /api/submissions` | Timeout (3s), rate limit | Currently fails silently (returns `null`). This is correct -- location falls back to photo GPS or explicit `location`. |
| EXIF parsing (exifr) | `POST /api/submissions` | Corrupt image data | Currently caught with try/catch (line 513 of `api/submissions/index.ts`). Falls back to explicit location. Correct behavior. |
| Google OAuth | Auth flow | Google down | Auth.js handles this. Users can still use credentials login. |

**Proposed circuit breaker implementation:**

```typescript
// lib/server/circuitBreaker.ts (proposed)
interface CircuitState {
  failures: number;
  lastFailure: number;
  state: 'closed' | 'open' | 'half-open';
}

const breakers = new Map<string, CircuitState>();
const FAILURE_THRESHOLD = 5;
const RESET_TIMEOUT_MS = 30_000;

function getBreaker(name: string): CircuitState {
  if (!breakers.has(name)) {
    breakers.set(name, { failures: 0, lastFailure: 0, state: 'closed' });
  }
  return breakers.get(name)!;
}

function shouldAllow(name: string): boolean {
  const breaker = getBreaker(name);
  if (breaker.state === 'closed') return true;
  if (breaker.state === 'open') {
    if (Date.now() - breaker.lastFailure > RESET_TIMEOUT_MS) {
      breaker.state = 'half-open';
      return true; // allow one probe
    }
    return false;
  }
  return true; // half-open: allow probe
}
```

**Note:** In a serverless environment, circuit breaker state is per-instance and ephemeral. For cross-instance state, use Upstash Redis (Phase 2).

### 5.2 Retry Policies

**Current offline queue retry (from `lib/client/offlineQueue.ts`):**

```
flushOfflineQueue() (lines 204-287):
  - For each pending item:
    1. Skip if nextRetryAt > now (backoff not elapsed)
    2. Mark as 'syncing', increment attempts
    3. Call sendFn(payload, { idempotencyKey })
    4. On success: remove from IndexedDB
    5. On retryable error:
       - retryCount += 1
       - baseDelay = min(30000, 1000 * 2^retryCount)
       - jitter = random(0, 1000)
       - nextRetryAt = now + baseDelay + jitter
       - Mark as 'failed'
    6. On permanent error (retryable=false):
       - Record in SYNC_ERROR_STORE
       - Remove from queue
```

**Analysis and improvements:**

| Aspect | Current | Recommendation |
|--------|---------|---------------|
| Max retry delay | 30s cap | Increase to 5 minutes for extended offline |
| Max retries | Unlimited | Add max of 20 retries before permanent failure |
| Jitter | Random 0-1000ms | Good. Keep. |
| Backoff base | 1000ms * 2^n | Good exponential curve. |
| Permanent failure classification | Only `retryable: false` errors | Add: 400-level responses (except 408, 429) should be permanent |
| Queue size limit | Unbounded | Warn at 200, reject at 500 with user notification |
| Stale item cleanup | None | Remove items older than 7 days |

**Server-side retry policy (for external service calls):**

| Service | Max retries | Backoff | Timeout |
|---------|-------------|---------|---------|
| PostgreSQL query | 0 (fail fast to client) | N/A | 10s (current `DEFAULT_QUERY_TIMEOUT_MS`) |
| Vercel Blob upload | 1 | 500ms fixed | 30s |
| IP geolocation (ipapi.co) | 0 | N/A | 3s (current) |
| EXIF extraction | 0 | N/A | N/A (CPU-bound) |
| Remote EXIF fetch (admin forensics) | 0 | N/A | 4s (current `REMOTE_FETCH_TIMEOUT_MS`) |

### 5.3 Graceful Degradation Strategy

```
WHAT WORKS WHEN WHAT FAILS
===========================

PostgreSQL down:
  [WORKS]  Client-side map (cached tiles, cached points in IndexedDB)
  [WORKS]  Offline submission queue (enqueues locally)
  [WORKS]  Service worker cached shell
  [FAILS]  All API reads (GET /api/submissions, /api/leaderboard)
           Returns 503 with { code: "storage_unavailable" }
  [FAILS]  New submissions (POST /api/submissions)
           Client catches 503, enqueues to offlineQueue
  [FAILS]  Login (auth needs DB for profile lookup)
           Cached JWT session continues to work until expiry

Vercel Blob down:
  [WORKS]  All reads (GET endpoints)
  [WORKS]  Leaderboard, user profile
  [FAILS]  Photo upload in POST /api/submissions
           Returns 500 "Unable to store photo"
  [DEGRADE] Client should still enqueue submission for retry

IP geolocation (ipapi.co) down:
  [WORKS]  Everything -- ipLocation returns null
  [DEGRADE] Fraud check has no IP data (less accurate)
  [DEGRADE] Location falls back to photo GPS or explicit location

Network down (contributor device):
  [WORKS]  Cached map view
  [WORKS]  Submission form (enqueues to IndexedDB)
  [WORKS]  Queue status display
  [FAILS]  Fresh data fetches
  [DEGRADE] Queue flushes when connectivity returns

Edge Config (fallback store) down:
  [WORKS]  Everything if postgres is primary
  [DEGRADE] Legacy submissions not merged (minor)
```

### 5.4 Data Consistency Guarantees

| Data type | Consistency model | Rationale |
|-----------|------------------|-----------|
| `point_events` (writes) | **Strong** -- single PostgreSQL writer with `ON CONFLICT` upsert | Append-only log must not lose events |
| `ProjectedPoint` (reads) | **Eventually consistent** -- up to 30s stale due to `s-maxage=30` cache | Acceptable for map display; contributors see their own submissions immediately (cache bypass on auth) |
| `user_profiles` (writes) | **Strong** -- single writer upsert | Profile updates are low-frequency |
| `user_profiles` (reads) | **Strong** -- no caching on authenticated reads | User sees own XP immediately |
| Leaderboard | **Eventually consistent** -- 30s cache + full recomputation | Leaderboard staleness is acceptable |
| Offline queue sync | **At-least-once delivery** (currently) | Idempotency gap means duplicates possible |

**Critical gap: At-least-once without idempotency = duplicates**

The offline queue generates an `idempotencyKey` per item (`lib/client/offlineQueue.ts` line 111) and sends it as a header, but the server never checks it. If a request succeeds but the client doesn't receive the response (network drop after server commit), the client retries and creates a duplicate event.

**Fix (implement in Phase 1):**

```sql
CREATE TABLE idempotency_keys (
    key         TEXT PRIMARY KEY,
    user_id     TEXT NOT NULL,
    event_id    UUID NOT NULL REFERENCES point_events(id),
    response    JSONB NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at  TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '24 hours'
);

CREATE INDEX idx_idem_expires ON idempotency_keys (expires_at);
```

Server-side check in `POST /api/submissions`:
1. Read `X-Idempotency-Key` header
2. Look up in `idempotency_keys` table
3. If found and not expired: return cached response (201 with original event)
4. If not found: proceed with normal flow, store response after commit
5. Cron job: `DELETE FROM idempotency_keys WHERE expires_at < NOW()` daily

### 5.5 Dead Letter Queue for Failed Async Operations

**Current state:** Permanent failures in the offline queue are recorded in `SYNC_ERROR_STORE_NAME` IndexedDB store (`lib/client/offlineQueue.ts` lines 169-184). This is client-side only -- if the user clears browser data, failures are lost.

**Phase 2: Server-side dead letter table**

```sql
CREATE TABLE dead_letter_queue (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source       TEXT NOT NULL,      -- 'webhook_delivery', 'fraud_scoring', 'photo_resize'
    payload      JSONB NOT NULL,
    error        TEXT NOT NULL,
    attempts     INTEGER NOT NULL DEFAULT 1,
    max_attempts INTEGER NOT NULL DEFAULT 3,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processed_at TIMESTAMPTZ
);
```

Items in the DLQ are reviewed manually via admin dashboard or retried via a Vercel Cron job.

---

## 6. Caching Strategy

### 6.1 Cache Layers

```
Layer 1: CDN Edge (Vercel Edge Network)
=========================================
  What:    GET /api/submissions (anonymous), GET /api/leaderboard
  Header:  Cache-Control: public, s-maxage=30, stale-while-revalidate=300
  TTL:     30s fresh, serve stale up to 300s while revalidating
  Purge:   Automatic on TTL expiry; manual via Vercel API
  Source:  api/submissions/index.ts line 61, api/leaderboard/index.ts line 15

Layer 2: Client-side (Browser/Service Worker)
==============================================
  What:    Static assets (JS, CSS, images), map tiles
  Header:  Varies (Vite hashed filenames enable immutable caching)
  TTL:     Long-lived for hashed assets, no-cache for HTML shell
  Storage: Service worker cache + HTTP cache

Layer 3: Client-side (IndexedDB)
=================================
  What:    Offline submission queue, last-known map data
  TTL:     Persistent until synced or manually cleared
  Source:  lib/client/offlineQueue.ts

Layer 4: Application (in-memory, per serverless invocation)
============================================================
  What:    phoneColumnState in postgresStore.ts (line 8)
  TTL:     Lifetime of serverless function instance
  Note:    Serverless functions are ephemeral; this is a warm-instance optimization only

Layer 5: Database (PostgreSQL query cache)
===========================================
  What:    Supabase's built-in shared_buffers
  TTL:     Managed by PostgreSQL
  Note:    No application-level DB cache exists today
```

### 6.2 Cache Invalidation for Event-Sourced Data

The event-sourced architecture makes cache invalidation straightforward because the source of truth (point_events) is append-only.

**Current approach (acceptable for MVP):**
- 30-second `s-maxage` means new submissions appear within 30s for anonymous users
- Authenticated users bypass cache (`cache-control: no-store` is the default in `lib/server/http.ts`)

**Phase 2 approach:**
1. **Write-through to projection table:** When `insertPointEvent()` succeeds, also upsert `projected_points`. API reads from `projected_points` directly instead of replaying all events.
2. **Revalidation on write:** After a successful POST to `/api/submissions`, the API could return a `X-Revalidate: /api/submissions` header that the edge layer uses to purge the cached response.
3. **Supabase Realtime for admin:** Subscribe to `point_events` INSERT via Supabase Realtime WebSocket. Admin dashboard updates in real-time without polling.

**Stale data tolerance by consumer:**

| Consumer | Staleness tolerance | Strategy |
|----------|-------------------|----------|
| Anonymous map viewer | 30s | Edge cache with `stale-while-revalidate` |
| Authenticated contributor (own data) | 0s | Cache bypass for authenticated requests |
| Admin dashboard | 5s | Supabase Realtime push (Phase 2) |
| Leaderboard | 60s | Increase `s-maxage` to 60 for leaderboard |
| Webhook consumers | < 10s | Event-driven push on write |
| Data export | Minutes | Batch job, not cached |

### 6.3 Cache Warming for Projected Points

**Problem:** First request after cache expiry (or cold start) must load all events and project them. This is the slowest path.

**Phase 2 solution: Materialized projection table with warm reads**

1. **On deploy:** Vercel build step or post-deploy hook triggers `/api/cron/rebuild-projections` to fully rebuild the `projected_points` table.
2. **On write:** Each `insertPointEvent()` incrementally updates the relevant `projected_points` row.
3. **GET /api/submissions:** Reads directly from `projected_points` table -- single indexed query, no full event replay.
4. **Fallback:** If `projected_points` is empty/missing, fall back to full event replay (current behavior).

**Estimated latency improvement:**
- Current (full replay of 1000 events): ~200ms
- With materialized table (indexed query): ~20ms
- At 100K events: current would be ~5s; materialized stays at ~20ms

---

## 7. Real-time & Sync Architecture

### 7.1 Offline Queue Sync Protocol

**Current design (from `lib/client/offlineQueue.ts`):**

```
STATE MACHINE PER QUEUE ITEM
==============================

  +----------+     enqueue()     +---------+
  |  (none)  | ----------------> | PENDING |
  +----------+                   +----+----+
                                      |
                            flushOfflineQueue()
                                      |
                                 +----v-----+
                                 | SYNCING  |
                                 +----+-----+
                                      |
                          +-----------+-----------+
                          |                       |
                     sendFn() OK            sendFn() ERROR
                          |                       |
                    +-----v-----+          +------v------+
                    |  (removed  |          | retryable?  |
                    |  from IDB) |          +------+------+
                    +-----------+                  |
                                           +------+------+
                                           |             |
                                         Yes            No
                                           |             |
                                    +------v---+   +----v--------+
                                    |  FAILED  |   | (permanent  |
                                    | (w/ next |   |  failure    |
                                    |  RetryAt)|   |  recorded,  |
                                    +----------+   |  removed)   |
                                                   +-------------+
```

**Improvements to current design:**

1. **Add explicit MAX_RETRIES (20)**
   After 20 retries, move to permanent failure even if error is "retryable". The current design retries forever.

2. **Add queue staleness detection**
   Items older than 7 days should be moved to permanent failure with reason "stale_queue_item".

3. **Add queue size limit**
   Max 500 items. Beyond that, show user a warning and reject new enqueues until items are synced.

4. **Add connectivity detection before flush**
   Before calling `flushOfflineQueue()`, check `navigator.onLine` AND attempt a lightweight fetch to `/api/health`. Only flush if both pass.

5. **Add progress callback**
   `flushOfflineQueue()` should accept an `onProgress(synced, failed, total)` callback for UI updates.

6. **Batch sync (Phase 2)**
   Instead of sending items one-by-one, batch up to 10 items in a single `POST /api/submissions/batch` request to reduce round trips on slow connections.

### 7.2 Conflict Resolution Strategy

**Conflict types in ADL:**

| Conflict | Likelihood | Resolution |
|----------|-----------|------------|
| Two users CREATE the same POI | Medium | **Accept both** as separate points. Admin merges via point_id reassignment. |
| Two users ENRICH the same field on the same point | Low | **Last-write-wins** at the field level. The `mergeDetails()` function in `pointProjection.ts` (line 136) already implements this. |
| Offline queue replays create duplicate events | High (current gap) | **Idempotency key** (Section 5.4). Server returns cached response for duplicate key. |
| User submits enrichment for a gap that was already filled by someone else | Medium | Current: returns 400 "ENRICH_EVENT must include at least one currently missing field". **Improvement:** Accept the enrichment but store as a competing value. Admin or confidence scoring resolves. |

**Conflict resolution for offline queue:**

```
OFFLINE CONFLICT SCENARIO
==========================

Time T0: User A offline, enqueues ENRICH for Point P (field: openingHours)
Time T1: User B online, successfully enriches Point P (field: openingHours)
Time T2: User A comes online, queue flushes

Current behavior: User A gets 400 error because openingHours is no longer a gap.
This goes to permanent failure in sync error store.

Proposed behavior:
1. Server detects the field was already filled
2. Instead of 400, store as a "competing enrichment" event
3. Return 201 with a flag: { "competingFields": ["openingHours"] }
4. Admin dashboard shows competing values for review
5. Client removes item from queue (success)
```

### 7.3 Real-time Updates for Admin Dashboard

**Current state:** No real-time updates. Admin refreshes the page to see new submissions.

**Phase 2 architecture using Supabase Realtime:**

```
Admin Browser                    Supabase Realtime         PostgreSQL
     |                                |                        |
     |-- Subscribe to channel ------->|                        |
     |   "point_events:INSERT"        |                        |
     |                                |                        |
     |                                |    [New event INSERT]  |
     |                                |<-----------------------|
     |<-- WebSocket push              |                        |
     |   { event: PointEvent,         |                        |
     |     user: { name, email } }    |                        |
     |                                |                        |
     |-- Update admin queue UI        |                        |
     |   (prepend to list)            |                        |
```

**Implementation steps:**
1. Enable Supabase Realtime on the `point_events` table (Supabase dashboard toggle)
2. Add client-side subscription in admin component:
   ```typescript
   supabase
     .channel('point_events')
     .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'point_events' }, payload => {
       // Add to admin queue
     })
     .subscribe()
   ```
3. Enrich the event with user info via a separate fetch (or denormalize user name into the event details)

**Channels:**
- `point_events:INSERT` -- New submissions (admin dashboard)
- `user_profiles:UPDATE` -- XP changes (leaderboard live update)
- `presence` -- Online contributor count for admin

### 7.4 Push Notification Architecture

**Phase 2 feature.** Uses Web Push API for PWA notifications.

```
PUSH NOTIFICATION FLOW
=======================

Contributor Device           ADL Server              Push Service
     |                          |                        |
     |-- requestPermission() -->|                        |
     |-- subscribe()            |                        |
     |   (VAPID public key)     |                        |
     |                          |                        |
     |-- POST /api/push/sub     |                        |
     |   { endpoint, keys }  -->|                        |
     |                          |-- store subscription   |
     |                          |   in push_subscriptions|
     |                          |   table                |
     |                          |                        |
     [Later: event triggers notification]                |
     |                          |                        |
     |                          |-- web-push library     |
     |                          |   POST to endpoint --->|
     |                          |                        |
     |<----- Push event --------|<-----------------------|
     |   (Service Worker)       |                        |
     |-- Show notification      |                        |
```

**Notification triggers:**

| Event | Recipient | Content |
|-------|-----------|---------|
| Point enriched by others | Original creator | "Your submission {name} was enriched with {field}" |
| Submission approved | Submitter | "Your contribution to {name} was approved. +{xp} XP!" |
| New gap near user | Contributors in area | "A nearby {category} needs {field} data" |
| Leaderboard rank change | Affected user | "You moved to rank #{rank} on the leaderboard!" |
| Fraud flag | Admin | "{user} submission flagged: {reason}" |

**Data table:**

```sql
CREATE TABLE push_subscriptions (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      TEXT NOT NULL REFERENCES user_profiles(id),
    endpoint     TEXT NOT NULL,
    p256dh_key   TEXT NOT NULL,
    auth_key     TEXT NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, endpoint)
);
```

---

## Appendix A: Current Gaps Summary

| # | Gap | Severity | File(s) | Recommended fix | Phase |
|---|-----|----------|---------|----------------|-------|
| G1 | **No idempotency check server-side** | Critical | `api/submissions/index.ts`, `lib/client/offlineQueue.ts` | Add `idempotency_keys` table and check `X-Idempotency-Key` header | Phase 1 |
| G2 | **No pagination on event queries** | High | `lib/server/storage/postgresStore.ts` line 289 | Add cursor-based pagination; materialize projections | Phase 1 |
| G3 | **No rate limiting** | High | All API routes | Add Upstash + Vercel Edge Middleware | Phase 1 |
| G4 | **Password hash in API response** | High | `api/user/index.ts`, `postgresStore.ts` | Strip `passwordHash` from API responses | Phase 1 |
| G5 | **No database indexes on point_events** | Medium | `postgresStore.ts` | Add indexes for `created_at`, `point_id`, `user_id` | Phase 1 |
| G6 | **Leaderboard loads all events** | Medium | `api/leaderboard/index.ts` | Materialized leaderboard table or DB-level aggregation | Phase 2 |
| G7 | **No offline queue size limit** | Medium | `lib/client/offlineQueue.ts` | Add max 500 items with user warning | Phase 1 |
| G8 | **No max retry count** | Medium | `lib/client/offlineQueue.ts` | Add max 20 retries | Phase 1 |
| G9 | **phoneColumnState runtime detection** | Low | `postgresStore.ts` line 8 | Replace with proper migration to add phone column | Phase 1 |
| G10 | **No real-time updates** | Low (MVP) | N/A | Add Supabase Realtime for admin dashboard | Phase 2 |
| G11 | **No API versioning** | Low (MVP) | All API routes | Add `/api/v1/` prefix when first breaking change needed | Phase 2 |
| G12 | **buildCombinedEvents() duplicated** | Low | `api/submissions/index.ts` line 361, `api/submissions/[id].ts` line 9 | Extract to shared utility | Phase 1 |

---

## Appendix B: Decision Log

| Date | Decision | Rationale | Alternatives considered |
|------|----------|-----------|------------------------|
| 2026-02-27 | Keep monolith through 10K users | Small team, shared database, no measured bottleneck | Microservices (rejected: overhead) |
| 2026-02-27 | Cursor-based pagination over offset | Better performance with large datasets, stable page results | Offset pagination (rejected: skip scan cost) |
| 2026-02-27 | Server-side idempotency table over Redis | Simpler, uses existing PostgreSQL, 24h TTL sufficient | Redis/Upstash (overkill for MVP) |
| 2026-02-27 | Materialized projection table over in-memory cache | Survives cold starts, shared across instances, indexable | Redis cache (rejected: adds infra), in-memory (rejected: ephemeral) |
| 2026-02-27 | Supabase Realtime over SSE/polling | Already in stack (Supabase), WebSocket support, built-in auth | SSE (rejected: no Supabase integration), polling (rejected: wasteful) |
| 2026-02-27 | Web Push over Firebase/OneSignal | No vendor lock-in, PWA-native, no additional SDK | FCM (rejected: Google dependency), OneSignal (rejected: cost) |
