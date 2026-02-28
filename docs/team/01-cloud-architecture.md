# ADL Cloud Architecture Document

**Author:** Teammate 1 -- Cloud Architect
**Date:** 2026-02-27
**Status:** Living document -- updates with each scaling phase
**Scope:** Full cloud architecture for African Data Layer (ADL), from current MVP through 100K+ contributors

---

## Table of Contents

1. [Architecture Vision & Principles](#1-architecture-vision--principles)
2. [Target Cloud Architecture](#2-target-cloud-architecture)
3. [Environments](#3-environments)
4. [Networking & Edge Strategy](#4-networking--edge-strategy)
5. [Data Architecture](#5-data-architecture)
6. [Governance & Compliance](#6-governance--compliance)
7. [Cost & Reliability Tradeoffs](#7-cost--reliability-tradeoffs)
8. [Recommendations & Migration Path](#8-recommendations--migration-path)

---

## 1. Architecture Vision & Principles

### 1.1 Vision Statement

ADL's architecture must serve contributors on low-end Android devices over 2G/3G networks in Douala, Lagos, Nairobi, and eventually every major African city. Every architectural decision is filtered through three lenses: **does it work offline?**, **does it work on a $50 phone with 1 GB RAM?**, and **does it survive 300 ms+ round-trip latency to the nearest PoP?**

### 1.2 Core Principles

| # | Principle | Rationale |
|---|-----------|-----------|
| P1 | **Serverless-first** | Zero idle cost, automatic scaling, no ops team required at MVP stage. Current stack (Vercel Functions + Supabase) already follows this. |
| P2 | **Offline-first is non-negotiable** | Contributors in Bonamoussadi and beyond face intermittent connectivity. The existing `lib/client/offlineQueue.ts` IndexedDB queue with exponential backoff already implements this; architecture must never regress it. |
| P3 | **Africa-optimized edge delivery** | Vercel's edge network has PoPs in Johannesburg, Nairobi, and Cairo. Static assets and public API reads (`s-maxage=30, stale-while-revalidate=300` as in `api/submissions/index.ts`) must always be served from edge. |
| P4 | **Append-only event sourcing** | `point_events` table is the source of truth, projected into `ProjectedPoint` views via `lib/server/pointProjection.ts`. Never mutate raw events; always project. This enables audit trails and replay. |
| P5 | **Minimal egress, maximal caching** | African mobile data is expensive. Compress aggressively, cache at edge, serve delta updates where possible. |
| P6 | **Cost proportional to usage** | Startup economics: $0/mo at zero traffic, linear scaling. No fixed-cost infrastructure until 10K+ users force it. |
| P7 | **Data sovereignty by default** | User data stays in the continent. Supabase project in EU (closest available) now; migrate to Africa-region when available. |
| P8 | **Progressive complexity** | Start with Vercel + Supabase. Add components only when bottlenecks are measured, never speculated. |

### 1.3 Non-Functional Requirements

| Metric | MVP (now) | Phase 2 (10K) | Phase 3 (100K) |
|--------|-----------|---------------|----------------|
| API p95 latency (Africa) | < 2s | < 800ms | < 400ms |
| Offline submission queue max | 50 items | 200 items | 500 items |
| Photo upload size cap | 8 MB (`MAX_SUBMISSION_IMAGE_BYTES`) | 8 MB | 5 MB (auto-compress) |
| Uptime SLA | 99% | 99.5% | 99.9% |
| RTO / RPO | 4h / 24h | 1h / 1h | 15min / 5min |

---

## 2. Target Cloud Architecture

### 2.1 Current Architecture (As-Built)

```
                          CONTRIBUTORS (Mobile/PWA)
                                    |
                        [Offline Queue - IndexedDB]
                        lib/client/offlineQueue.ts
                                    |
                          [Online? Flush queue]
                        lib/client/submissionSync.ts
                                    |
                    +---------- HTTPS ----------+
                    |                           |
          +--------v---------+      +-----------v-----------+
          |  Vercel CDN/Edge |      |  Vercel CDN/Edge      |
          |  Static Assets   |      |  API Routing           |
          |  (dist/)         |      |  (vercel.json)         |
          +------------------+      +-----------+-----------+
                                                |
                              +-----------------+-----------------+
                              |                 |                 |
                    +---------v---+   +---------v---+   +---------v---+
                    | /api/auth   |   | /api/sub    |   | /api/leader |
                    | [...auth]   |   | missions    |   | board       |
                    | register    |   | index.ts    |   | index.ts    |
                    | signin      |   | [id].ts     |   |             |
                    +------+------+   +------+------+   +------+------+
                           |                |                  |
                    +------v------+  +------v------+   +------v------+
                    | Auth.js     |  | Vercel Blob |   |             |
                    | JWT/Cookie  |  | (Photos)    |   |             |
                    +-------------+  +-------------+   |             |
                           |                |          |             |
                    +------v-----------v-----------v---+             |
                    |        Supabase PostgreSQL                     |
                    |        - user_profiles                         |
                    |        - point_events (append-only)            |
                    +-----------------------------------------------+
                                        |
                              [Edge Config - Legacy Fallback]
                              lib/server/storage/edgeFallbackStore.ts
```

### 2.2 Key Current Components Mapped to Files

| Component | File(s) | Role |
|-----------|---------|------|
| **Offline queue** | `lib/client/offlineQueue.ts` | IndexedDB-backed queue with idempotency keys, exponential backoff, permanent failure tracking |
| **Submission sync** | `lib/client/submissionSync.ts` | HTTP POST to `/api/submissions` with `X-Idempotency-Key` header, retryable error classification |
| **API client** | `lib/client/api.ts` | `apiFetch` wrapper with `credentials: "include"`, configurable `VITE_API_BASE` |
| **Device profiling** | `lib/client/deviceProfile.ts` | Collects `deviceMemoryGb`, `hardwareConcurrency`, `isLowEnd` for fraud signals |
| **Auth** | `lib/auth.ts`, `api/auth/` | Auth.js with JWT decode, cookie-based sessions, Google OAuth + credentials |
| **Storage abstraction** | `lib/server/storage/index.ts` | Driver pattern: `postgres` (primary) with `edge` fallback when `DATA_READ_FALLBACK_EDGE=true` |
| **Postgres store** | `lib/server/storage/postgresStore.ts` | Direct `pg.Pool` queries, `max=5` connections, 10s query timeout |
| **DB connection** | `lib/server/db.ts` | Pool management with `StorageUnavailableError` classification, SSL handling |
| **Fraud detection** | `lib/server/submissionFraud.ts` | EXIF GPS extraction, haversine distance checks (1 km submission, 50 km IP), device fingerprinting |
| **Geofencing** | `shared/geofence.ts` | Bounding boxes for Bonamoussadi and Cameroon; `isWithinBonamoussadi()`, `isWithinCameroon()` |
| **Point projection** | `lib/server/pointProjection.ts` | Event sourcing projector: `point_events` -> `ProjectedPoint` with gap analysis |
| **Photo upload** | `api/submissions/index.ts` | Base64 decode -> `@vercel/blob` PUT, public access, max 8 MB |
| **AI integration** | `lib/gemini.ts` | Gemini 2.5 Flash for location search with Google Maps grounding, TTS, audio transcription |

### 2.3 Target Architecture (Phase 2-3)

```
                    CONTRIBUTORS              API CONSUMERS
                   (Mobile PWA)               (REST/GraphQL)
                        |                          |
              [IndexedDB Queue]                    |
              [Service Worker]                     |
                        |                          |
           +------------v--------------------------v-----------+
           |              Vercel Edge Network                   |
           |  +------------+  +-------------+  +------------+  |
           |  | Edge Cache  |  | Edge MW     |  | WAF/Rate   |  |
           |  | Static+API  |  | Auth check  |  | Limiter    |  |
           |  | s-maxage=30 |  | Geo-routing |  | Bot detect |  |
           |  +------+-----+  +------+------+  +------+-----+  |
           +---------|--------------|-----------------|---------+
                     |              |                 |
           +---------v--------------v-----------------v---------+
           |            Vercel Serverless Functions              |
           |  +----------+ +----------+ +----------+ +-------+  |
           |  | /api/auth | | /api/sub | | /api/ldr | | /api/ |  |
           |  |           | | missions | | board    | | user  |  |
           |  +-----+-----+ +----+----+ +----+----+ +---+---+  |
           +--------|------------|------------|----------|-------+
                    |            |            |          |
        +-----------v-+  +------v------+     |          |
        | Auth.js     |  | Vercel Blob |     |          |
        | Google OAuth|  | (Photos)    |     |          |
        +-------------+  +------+------+     |          |
                                |            |          |
           +--------------------v------------v----------v------+
           |              Supabase PostgreSQL                   |
           |   +------------------+  +----------------------+  |
           |   | user_profiles    |  | point_events         |  |
           |   | (phone column)   |  | (append-only log)    |  |
           |   +------------------+  | (partitioned by mo.) |  |
           |                         +----------------------+  |
           |   +------------------+  +----------------------+  |
           |   | point_projections|  | fraud_signals        |  |
           |   | (materialized)   |  | (async computed)     |  |
           |   +------------------+  +----------------------+  |
           |                                                    |
           |   Supabase Realtime (WebSocket)                   |
           |   - New submission notifications                   |
           |   - Leaderboard live updates                       |
           +----------------------------------------------------+
                                |
                    +-----------v-----------+
                    |   Supabase Edge Funcs  |
                    |   (Async processing)   |
                    |   - Photo resize       |
                    |   - Fraud scoring       |
                    |   - XP recalculation    |
                    +------------------------+
```

### 2.4 Component Decisions

| Component | Current | Phase 2 | Phase 3+ | Rationale |
|-----------|---------|---------|----------|-----------|
| CDN | Vercel Edge | Vercel Edge | Vercel Edge + Cloudflare R2 | Vercel edge PoPs in JNB/NBO/CAI cover primary African markets |
| Compute | Vercel Functions (Node.js) | Same + Edge Middleware | Same + dedicated workers | Fluid compute keeps cold starts low |
| Database | Supabase PostgreSQL (single) | + Connection pooling (pgBouncer) + read replica | + Partitioning + Citus/Neon branching | Current `max=5` pool is fine for MVP |
| Blob Storage | Vercel Blob | Same + CDN caching headers | + Image optimization pipeline | Photos already served with public URLs |
| Auth | Auth.js (JWT cookies) | Same | Same + phone OTP via Africa's Talking | Google OAuth works; phone auth needed for feature phone users |
| Queue | Client-side IndexedDB only | + Supabase Database Webhooks | + Upstash Redis Queue / QStash | No server-side queue exists today -- needed for async fraud scoring |
| Cache | HTTP `s-maxage=30` | + Vercel Edge Config for hot data | + Redis (Upstash) for session cache | Current 30s cache is appropriate for MVP data freshness |
| Real-time | None | Supabase Realtime | Same | Leaderboard and admin review need push updates |
| AI | Gemini API (client-side key!) | Move to server-side proxy | Same + batch geocoding pipeline | `lib/gemini.ts` exposes API key via `process.env.API_KEY` in Vite define -- security risk |
| Monitoring | Vercel Analytics + Speed Insights | + Sentry for error tracking | + Custom observability dashboard | `@vercel/analytics` and `@vercel/speed-insights` already in `package.json` |

---

## 3. Environments

### 3.1 Environment Strategy

| Environment | Branch | URL Pattern | Database | Purpose |
|-------------|--------|-------------|----------|---------|
| **Production** | `main` | `africandatalayer.vercel.app` | Supabase `prod` project | Live users, real data |
| **Staging** | `staging` | `staging-africandatalayer.vercel.app` | Supabase `staging` project (separate) | Pre-release validation, seed data |
| **Development** | `dev` | `dev-africandatalayer.vercel.app` | Supabase `dev` project (separate) | Daily development, synthetic data |
| **Preview** | PR branches | `<branch>-africandatalayer.vercel.app` | Shared `staging` database (read-only mode) | PR review, visual diffing |

### 3.2 Environment Parity

**Current gap:** There is only one Supabase project. All environments hit the same database.

**Recommended changes:**

1. **Create three Supabase projects:** `adl-prod`, `adl-staging`, `adl-dev`
2. **Environment variables per Vercel environment:**
   - `POSTGRES_URL` -> different for each environment
   - `BLOB_READ_WRITE_TOKEN` -> separate blob stores
   - `AUTH_SECRET` -> unique per environment
   - `EDGE_CONFIG` -> separate Edge Config stores
3. **Migration parity:** Use `supabase/migrations/` directory (already has `20260219_init_adl.sql` and `20260224_phone_identifier.sql`) with Supabase CLI `db push` in CI:
   ```bash
   # CI pipeline per environment
   supabase db push --db-url $POSTGRES_URL
   ```

### 3.3 Data Isolation

| Rule | Implementation |
|------|---------------|
| Production data never in staging | Separate Supabase projects with separate connection strings |
| Staging uses realistic synthetic data | Seed script `scripts/seed-edge-submissions.mjs` extended with Faker.js |
| Preview deployments are read-only | `DATA_STORE_DRIVER=postgres` with a read-only Postgres role |
| Secrets never shared across envs | Vercel Environment Variables scoped to Production/Preview/Development |

### 3.4 Feature Flags

**Current state:** Map scope is gated by `user_profiles.map_scope` column (`bonamoussadi`, `cameroon`, `global`). Admin-only features gated by `is_admin` boolean.

**Recommended approach:**

Use Vercel Edge Config for feature flags (already a dependency: `@vercel/edge-config`):

```json
{
  "feature_flags": {
    "phone_auth_enabled": false,
    "cameroon_expansion": true,
    "realtime_leaderboard": false,
    "gemini_search_enabled": true,
    "max_submission_image_bytes": 8388608
  }
}
```

This avoids adding another service and leverages what is already installed. Edge Config reads are sub-millisecond at the edge.

---

## 4. Networking & Edge Strategy

### 4.1 CDN Configuration for Africa

**Vercel Edge Network coverage relevant to ADL:**

| PoP Location | Target Market | Latency to Douala |
|--------------|---------------|-------------------|
| Johannesburg (JNB) | Southern Africa | ~120ms |
| Nairobi (NBO) | East Africa | ~100ms |
| Cairo (CAI) | North Africa | ~150ms |
| Paris (CDG) | Francophone fallback | ~180ms |
| London (LHR) | Anglophone fallback | ~170ms |

**Caching strategy for African users:**

```
Static assets (JS/CSS/images):
  Cache-Control: public, max-age=31536000, immutable
  (Vite content-hashed filenames: index-QrY-Hdyj.js)

Public API reads (/api/submissions GET, unauthenticated):
  Cache-Control: public, s-maxage=30, stale-while-revalidate=300
  (Already implemented in api/submissions/index.ts)

Authenticated API reads:
  Cache-Control: private, no-cache
  (Must revalidate per user)

Photo blobs (Vercel Blob):
  Cache-Control: public, max-age=86400
  (Photos are immutable once uploaded)
```

### 4.2 API Routing and Edge Middleware

**Current:** All API routes go through Vercel Functions (Node.js runtime). No edge middleware.

**Recommended additions:**

1. **Rate limiting middleware** (Edge Middleware at `middleware.ts`):
   ```
   /api/submissions POST -> 10 requests/minute per IP
   /api/auth/register POST -> 5 requests/minute per IP
   /api/auth/signin POST -> 10 requests/minute per IP
   ```

2. **Geo-routing middleware:**
   - Read `request.geo.country` from Vercel Edge
   - Set `X-ADL-Country` header for downstream functions
   - Block requests from sanctioned countries
   - Route to nearest data source when multi-region is implemented

3. **Auth pre-check at edge:**
   - Validate JWT signature at edge (fast rejection of expired/malformed tokens)
   - Current `lib/auth.ts` does full JWT decode in the function; move signature check to edge

### 4.3 Real-Time Strategy

**Current:** No real-time. All reads are polling-based.

**Recommended: Supabase Realtime (WebSocket)**

Supabase Realtime uses PostgreSQL's logical replication to push changes over WebSocket:

```
Use cases:
1. Admin review queue: New submissions appear instantly
2. Leaderboard: XP changes propagate in real-time
3. Contributor notifications: "Your submission was approved"

Channel structure:
- adl:submissions:{scope} -> New point_events for a map scope
- adl:leaderboard -> XP changes on user_profiles
- adl:admin -> Admin-targeted events

Fallback: If WebSocket unavailable (aggressive firewalls in some
African networks), fall back to 30-second polling (current behavior).
```

### 4.4 Offline-First Sync Protocol

**Current implementation is solid.** Key components:

```
1. ENQUEUE: User submits -> lib/client/offlineQueue.ts enqueueSubmission()
   - Generates idempotency key (crypto.randomUUID)
   - Stores in IndexedDB 'adl_offline_queue' store
   - Status: 'pending'

2. FLUSH: Online detected -> App.tsx useEffect triggers flushOfflineQueue()
   - Uses requestIdleCallback (graceful on low-end devices)
   - Iterates pending items, respects nextRetryAt (backoff)
   - Sends via lib/client/submissionSync.ts sendSubmissionPayload()
   - X-Idempotency-Key header prevents duplicates

3. BACKOFF: Failed sync -> exponential backoff
   - baseDelay = min(30000, 1000 * 2^retryCount)
   - jitter = random * 1000
   - Max 30s between retries

4. PERMANENT FAILURE: Non-retryable errors -> SyncErrorRecord
   - Stored in 'submission_sync_errors' IndexedDB store
   - Surfaced to user via getQueueStats()
```

**Infrastructure-level enhancements needed:**

| Enhancement | Description | Priority |
|-------------|-------------|----------|
| **Server-side idempotency** | Check `X-Idempotency-Key` against a Redis/Postgres dedup table before inserting `point_events`. Currently the header is sent but not checked server-side. | HIGH |
| **Conflict resolution** | When two contributors submit CREATE_EVENT for the same physical location, merge into one `point_id`. Currently creates duplicates. | MEDIUM |
| **Delta sync** | Return only events since `?since=<timestamp>` instead of full event list. `getPointEvents()` in `postgresStore.ts` fetches ALL events with `order by created_at asc` -- unsustainable at scale. | HIGH |
| **Background sync service worker** | Register a SW that flushes the queue even when the app tab is closed. Current sync only happens when App component mounts. | MEDIUM |

---

## 5. Data Architecture

### 5.1 PostgreSQL Scaling Path

**Current schema** (from `supabase/migrations/20260219_init_adl.sql`):

```sql
-- Two tables, both in public schema
user_profiles (
  id text PK,
  email text UNIQUE NOT NULL,
  phone text,              -- Added in 20260224 migration
  name text NOT NULL,
  image text DEFAULT '',
  occupation text DEFAULT '',
  xp integer DEFAULT 0 CHECK (xp >= 0),
  password_hash text,
  is_admin boolean DEFAULT false,
  map_scope text DEFAULT 'bonamoussadi',
  created_at timestamptz,
  updated_at timestamptz
)

point_events (
  id uuid PK,
  point_id text NOT NULL,
  event_type text CHECK ('CREATE_EVENT', 'ENRICH_EVENT'),
  user_id text NOT NULL,
  category text CHECK ('pharmacy', 'fuel_station', 'mobile_money'),
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  details jsonb DEFAULT '{}',
  photo_url text,
  created_at timestamptz NOT NULL,
  source text,
  external_id text
)

Indexes:
  idx_point_events_created_at_desc
  idx_point_events_point_id_created_at_desc
  idx_point_events_user_id_created_at_desc
  idx_point_events_external_id
```

**Scaling path:**

| Scale | Action | Rationale |
|-------|--------|-----------|
| **Now (< 1K events)** | No changes needed | Current `pg.Pool({ max: 5 })` handles MVP load fine |
| **1K-10K events** | Add `point_projections` materialized view | Stop projecting in application code (`projectPointsFromEvents()` scans ALL events per request) |
| **10K-50K events** | Partition `point_events` by month (`created_at`) | Queries with time range filters become partition-pruned |
| **50K+ events** | Supabase read replica for GET requests | Separate read/write pools. `lib/server/db.ts` gets `getReadPool()` |
| **100K+ events** | PostGIS extension for spatial queries | Replace application-level `isWithinBonamoussadi()` bounding-box checks with `ST_Within()` |
| **500K+ events** | Connection pooling via Supabase PgBouncer (Transaction mode) | Current `POSTGRES_PRISMA_URL` in `.env.example` suggests this is already anticipated |

**Critical optimization -- materialized projection:**

```sql
-- Replace in-app projectPointsFromEvents() with a materialized view
CREATE MATERIALIZED VIEW point_projections AS
SELECT DISTINCT ON (point_id)
  point_id,
  category,
  latitude,
  longitude,
  details,
  photo_url,
  created_at,
  source,
  external_id
FROM point_events
ORDER BY point_id, created_at DESC;

-- Refresh on write (via trigger or Supabase Edge Function)
CREATE UNIQUE INDEX ON point_projections (point_id);
```

This eliminates the O(N) full-table scan that `getPointEvents()` + `projectPointsFromEvents()` currently performs on every GET request.

### 5.2 Blob Storage Lifecycle

**Current:** Photos uploaded to Vercel Blob via `@vercel/blob` `put()` in `api/submissions/index.ts`:
```
Path pattern: submissions/{eventId}-{timestamp}.{ext}
Access: public
Max size: 8 MB (MAX_SUBMISSION_IMAGE_BYTES)
Formats: JPEG, PNG, WebP, HEIC, HEIF
```

**Lifecycle policy needed:**

| Age | Action | Storage |
|-----|--------|---------|
| 0-30 days | Original quality | Vercel Blob (hot) |
| 30-180 days | Compressed to WebP 80% quality | Vercel Blob |
| 180+ days | Thumbnail only (200px), original archived | Vercel Blob (thumbnail) + Cloudflare R2 (archive) |
| Deleted submissions | Hard delete after 30-day grace | N/A |

**Photo optimization pipeline (Phase 2):**

```
Upload -> Vercel Blob (original)
       -> Supabase Edge Function (async trigger)
          -> Generate 200px thumbnail
          -> Generate 800px preview
          -> Extract EXIF (already done in submissionFraud.ts)
          -> Store variants in Blob
          -> Update point_events.details with variant URLs
```

### 5.3 Event Streaming / Message Queue

**Current gap:** No server-side async processing. Everything is synchronous in the request path:
- Photo upload (Vercel Blob PUT)
- EXIF extraction (`extractPhotoMetadata()`)
- IP geolocation (`fetchIpLocation()` calls ipapi.co)
- Fraud check computation (`buildSubmissionFraudCheck()`)
- XP update (`upsertUserProfile()`)

This makes POST `/api/submissions` slow and fragile.

**Phase 2 architecture -- async processing via QStash:**

```
POST /api/submissions (synchronous path):
  1. Validate input
  2. Upload photo to Blob
  3. Insert point_event with status='pending_review'
  4. Return 201 immediately

QStash message -> /api/internal/process-submission:
  1. Extract EXIF metadata
  2. Fetch IP geolocation
  3. Compute fraud check
  4. Update point_event.details with fraud data
  5. Update XP
  6. Notify admin if fraud score > threshold
```

**Why QStash over alternatives:**
- Native Vercel integration (no infrastructure to manage)
- Built-in retry with exponential backoff
- HTTP-based (works with existing serverless functions)
- Free tier covers MVP needs (500 messages/day)

### 5.4 Data Residency and Sovereignty

**African data protection landscape:**

| Country | Law | Key Requirement |
|---------|-----|-----------------|
| **Cameroon** | Law No. 2010/012 on Cybersecurity and Cybercrime | Personal data must be processed lawfully; DPA notification required |
| **Nigeria** | NDPA 2023 | Data controller must register; cross-border transfer requires adequacy |
| **Kenya** | Data Protection Act 2019 | Consent-based; data transfers need adequate safeguards |
| **South Africa** | POPIA | Most mature; requires data processing agreements, information officer |
| **AU-wide** | Malabo Convention (2014, entered into force 2023) | Framework for harmonized data protection across AU member states |

**ADL's data residency strategy:**

1. **Current:** Supabase project in EU region (closest available with full feature set)
2. **Phase 2:** When Supabase launches Africa regions (anticipated), migrate to Johannesburg or Nairobi
3. **Phase 3:** If Supabase Africa region unavailable, self-managed PostgreSQL on AWS Africa (Cape Town `af-south-1`) or GCP Johannesburg
4. **Always:** Store GPS coordinates and photos (which contain location data) under the same residency rules as PII. The `point_events.details` JSONB contains `fraudCheck.ipLocation` which is indirectly PII.

**Cross-border data flow:** ADL collects data in Cameroon but serves it to API consumers potentially worldwide. Solution:
- Raw PII (email, phone, GPS) stays in primary database region
- Anonymized/aggregated data (point projections without `user_id`) can be replicated globally
- `redactEventUserIds()` in `lib/server/submissionAccess.ts` already handles this for unauthenticated reads

---

## 6. Governance & Compliance

### 6.1 IAM and Access Control

**Current model:**

```
Roles:
  - Anonymous: Read projected points (cached, user_id redacted)
  - Authenticated (Reader): Read events with own user_id visible
  - Authenticated (Contributor): Read + Submit (CREATE/ENRICH)
  - Admin: Full read + admin_events view + delete events

Implementation:
  - lib/auth.ts: requireUser() returns { id, token } or null
  - lib/server/submissionAccess.ts: toSubmissionAuthContext() checks is_admin
  - api/submissions/index.ts: Checks authContext for admin_events access
```

**Recommended enhancements:**

| Control | Implementation | Priority |
|---------|---------------|----------|
| **API key auth for consumers** | Issue API keys stored in Edge Config, validate in edge middleware | Phase 2 |
| **Role-based permissions table** | `user_roles` table with `role` enum: reader, contributor, senior_contributor, admin, api_consumer | Phase 2 |
| **Service accounts** | Dedicated identities for batch import scripts (`scripts/import-bonamoussadi-csv.mjs`) | Phase 1 |
| **Admin audit log** | Log all admin actions (delete event, approve, change user role) to `admin_audit_log` table | Phase 1 |
| **MFA for admins** | Require TOTP for `is_admin=true` users | Phase 2 |

### 6.2 Secrets Management

**Current state (.env.example):**

```
AUTH_SECRET=                    # Session encryption
GOOGLE_CLIENT_ID=               # OAuth
GOOGLE_CLIENT_SECRET=           # OAuth
ADL_POSTGRES_URL=               # Database (contains password)
BLOB_READ_WRITE_TOKEN=          # Vercel Blob access
EDGE_CONFIG=                    # Edge Config connection
VERCEL_API_TOKEN=               # Vercel API (dangerous!)
ADMIN_EMAIL=                    # Hardcoded admin
ADMIN_PASSWORD=                 # Hardcoded admin password!
```

**Security concerns:**

1. **CRITICAL: `ADMIN_PASSWORD` in environment variables.** This is a plaintext admin password. Must be replaced with hashed credentials in the database (already partially done: `user_profiles.password_hash` column exists, `bcryptjs` is a dependency).

2. **HIGH: Gemini API key exposed client-side.** `vite.config.ts` defines `process.env.API_KEY` which is bundled into the client JavaScript. Must be proxied through a server-side API route.

3. **MEDIUM: `VERCEL_API_TOKEN` in env.** This grants full Vercel account access. Should only be in CI/CD, never in runtime functions.

**Recommended secrets architecture:**

| Secret | Storage | Access Pattern |
|--------|---------|----------------|
| `AUTH_SECRET` | Vercel Environment Variables (encrypted) | Runtime, per-environment |
| `POSTGRES_URL` | Vercel Environment Variables (encrypted) | Runtime, per-environment |
| `BLOB_READ_WRITE_TOKEN` | Vercel Environment Variables (encrypted) | Runtime, per-environment |
| `GOOGLE_CLIENT_*` | Vercel Environment Variables (encrypted) | Runtime, shared staging+prod |
| `GEMINI_API_KEY` | Vercel Environment Variables (server only) | Server-side functions only, never in `VITE_` prefix |
| `VERCEL_API_TOKEN` | GitHub Actions Secrets only | CI/CD only, never runtime |
| Admin credentials | `user_profiles.password_hash` (bcrypt) | Database only, no env vars |

### 6.3 Audit Logging

**Current:** `console.info("[SUBMISSION_DEVICE]", ...)` in non-production (line 673 of `api/submissions/index.ts`). No structured audit log.

**Recommended audit events:**

```sql
CREATE TABLE audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id text NOT NULL,
  action text NOT NULL,         -- 'submission.create', 'submission.delete', 'user.login', etc.
  resource_type text NOT NULL,  -- 'point_event', 'user_profile'
  resource_id text,
  details jsonb DEFAULT '{}',
  ip_address inet,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_log_actor ON audit_log (actor_id, created_at DESC);
CREATE INDEX idx_audit_log_action ON audit_log (action, created_at DESC);
```

Events to log:
- `submission.create` / `submission.enrich` / `submission.delete`
- `user.register` / `user.login` / `user.login_failed`
- `admin.view_queue` / `admin.delete_event` / `admin.change_role`
- `api.key_issued` / `api.key_revoked`

### 6.4 Data Retention Policies

| Data Type | Retention | Deletion Method |
|-----------|-----------|-----------------|
| `point_events` (non-PII fields) | Indefinite | Never -- this is the core dataset |
| `point_events.user_id` | 2 years after last activity | Pseudonymize: replace with hash |
| `user_profiles` (active) | While account active | N/A |
| `user_profiles` (inactive > 18 months) | Delete after notification | Soft delete, 30-day grace, hard delete |
| Photos (Vercel Blob) | Follow `point_events` lifecycle | Delete when event is purged |
| Audit logs | 3 years | Archive to cold storage, then delete |
| Offline queue (client IndexedDB) | Until synced or 30 days | Auto-purge stale items in `flushOfflineQueue()` |
| EXIF metadata in `details.fraudCheck` | Same as parent event | Deleted with event |

---

## 7. Cost & Reliability Tradeoffs

### 7.1 Current Cost Profile (Vercel Pro + Supabase Free)

| Service | Tier | Monthly Cost | Usage |
|---------|------|-------------|-------|
| Vercel | Pro | $20/mo | Hosting, CDN, serverless functions |
| Supabase | Free | $0/mo | PostgreSQL (500 MB), Auth (50K MAU) |
| Vercel Blob | Included in Pro | $0 (up to 1 GB) | Photo storage |
| Vercel Edge Config | Included in Pro | $0 (limited reads) | Feature flags, legacy fallback |
| Vercel Analytics | Included in Pro | $0 | Web vitals |
| ipapi.co | Free tier | $0 | 1K lookups/day for fraud IP checks |
| Gemini API | Free tier | $0 | Location search, TTS |
| **Total** | | **~$20/mo** | |

### 7.2 Scaling Cost Projections

| Users | Events/mo | Photos/mo | DB Size | Blob Size | Vercel | Supabase | Other | Total |
|-------|-----------|-----------|---------|-----------|--------|----------|-------|-------|
| **100** (now) | 500 | 500 | 50 MB | 2 GB | $20 | $0 | $0 | **$20** |
| **1K** | 5K | 5K | 500 MB | 20 GB | $20 | $25 (Pro) | $10 | **$55** |
| **10K** | 50K | 50K | 5 GB | 200 GB | $40 | $25 | $50 | **$115** |
| **100K** | 500K | 500K | 50 GB | 2 TB | $150+ | $75+ | $200+ | **$425+** |

Key cost drivers at scale:
- **Vercel Function invocations:** $0.60/million after included quota
- **Vercel Blob storage:** $0.23/GB/month after 1 GB
- **Supabase database:** Pro tier at $25/mo includes 8 GB, then $0.125/GB
- **Bandwidth:** Vercel charges $0.15/GB after 1 TB; African users consume more bandwidth due to retries

### 7.3 When to Consider Moving Off Vercel

| Signal | Threshold | Action |
|--------|-----------|--------|
| Function invocations > 3M/month | ~$1,800 Vercel bill | Evaluate AWS Lambda + CloudFront |
| Blob storage > 500 GB | ~$115/mo just for blob | Move to Cloudflare R2 ($0.015/GB, no egress) |
| Need for long-running jobs > 60s | Vercel function timeout limit | Add dedicated worker (Railway, Fly.io, or AWS ECS) |
| Need WebSocket persistent connections | Vercel does not support long-lived WS | Use Supabase Realtime or dedicated WS server on Fly.io |
| African user latency consistently > 1s | CDN PoP limitations | Add Cloudflare as CDN layer in front of Vercel |
| Monthly bill > $500 | Startup economics ceiling | Full cost analysis: Vercel vs. self-managed |

**Recommendation:** Vercel remains optimal until ~$300/mo. Below that, the operational simplicity (zero DevOps, automatic deployments, preview URLs) outweighs the cost premium over raw AWS/GCP.

### 7.4 Reliability Targets

| Tier | Uptime | RTO | RPO | Monitoring | Incident Response |
|------|--------|-----|-----|------------|-------------------|
| **MVP (now)** | 99% (7.3h downtime/mo) | 4 hours | 24 hours | Vercel dashboard + manual checks | Founder gets paged |
| **Phase 2 (1K-10K)** | 99.5% (3.6h/mo) | 1 hour | 1 hour | Vercel + Sentry + Supabase alerts | On-call rotation (2 people) |
| **Phase 3 (10K-100K)** | 99.9% (43min/mo) | 15 min | 5 min | Full observability stack | PagerDuty + runbooks |

**Disaster recovery strategy:**

```
Current (MVP):
  - Database: Supabase daily automatic backups (7-day retention on free tier)
  - Blob: Vercel Blob has built-in redundancy
  - Code: Git (GitHub) is the recovery source
  - Recovery: Re-deploy from main branch + restore DB backup

Phase 2:
  - Database: Supabase Pro PITR (Point-in-Time Recovery)
  - Cross-region: Manual failover to second Supabase project
  - Blob: Replicate to Cloudflare R2 daily

Phase 3:
  - Database: Read replica in second region for automatic failover
  - Blob: Multi-region replication
  - DNS: Automated failover via Cloudflare DNS
```

### 7.5 Multi-Cloud Considerations

**Not recommended until Phase 3.** Reasons:
- Operational complexity multiplies with each provider
- Team is too small for multi-cloud ops
- Vercel + Supabase gives sufficient reliability for current scale

**When multi-cloud becomes necessary:**
- If Vercel has repeated outages affecting Africa specifically
- If data sovereignty requires compute in a country without Vercel PoPs
- If cost exceeds $500/mo and self-managed becomes cheaper

**Likely multi-cloud shape (Phase 3+):**
```
Vercel: CDN + Static hosting + Edge Middleware
Supabase: Database + Auth + Realtime
Cloudflare: R2 (blob), Workers (edge compute in Africa), DNS
AWS af-south-1: Long-running workers, batch processing
```

---

## 8. Recommendations & Migration Path

### Phase 1: Optimize Current Stack (Now -- Month 1-2)

**Goal:** Fix critical issues, establish environment separation, no architecture changes.

| # | Action | Effort | Impact | Files Affected |
|---|--------|--------|--------|----------------|
| 1.1 | **Move Gemini API key server-side** | 2h | Security fix | `vite.config.ts` (remove `define`), new `api/ai/search.ts` |
| 1.2 | **Remove `ADMIN_PASSWORD` from env** | 1h | Security fix | Seed admin via `user_profiles.password_hash` only |
| 1.3 | **Add server-side idempotency check** | 4h | Data integrity | `api/submissions/index.ts` (check `X-Idempotency-Key` vs recent events) |
| 1.4 | **Create staging Supabase project** | 2h | Env separation | New project + Vercel env vars for Preview/Staging |
| 1.5 | **Add `?since=` filter to GET /api/submissions** | 3h | Performance | `postgresStore.ts` (add WHERE clause), `api/submissions/index.ts` |
| 1.6 | **Add rate limiting edge middleware** | 3h | Security | New `middleware.ts` at project root |
| 1.7 | **Remove `VERCEL_API_TOKEN` from runtime env** | 30min | Security | `.env.example`, Vercel dashboard |
| 1.8 | **Add `audit_log` table** | 3h | Compliance | New migration in `supabase/migrations/` |
| 1.9 | **Enable Supabase PITR** (upgrade to Pro) | 30min | Reliability | Supabase dashboard |
| 1.10 | **Add Sentry error tracking** | 2h | Observability | `App.tsx`, `api/` error handlers |

### Phase 2: Scale Within Vercel + Supabase (Month 3-9, 0-10K Users)

**Goal:** Handle 10x growth without architecture overhaul.

| # | Action | Effort | Impact |
|---|--------|--------|--------|
| 2.1 | **Materialized projection view** | 1 week | Eliminates O(N) full scan on every GET; projected points served from pre-computed view |
| 2.2 | **Async submission processing via QStash** | 1 week | POST latency drops from ~3s to ~500ms; fraud check + EXIF happen async |
| 2.3 | **Supabase Realtime for admin queue** | 3 days | Admin sees new submissions instantly without polling |
| 2.4 | **Photo optimization pipeline** | 1 week | Thumbnails served from edge, original archived; reduces bandwidth 60%+ |
| 2.5 | **Phone auth (Africa's Talking SMS OTP)** | 1 week | Unlocks feature phone users who have no Google account |
| 2.6 | **Service Worker for background sync** | 3 days | Offline queue flushes even when app is backgrounded |
| 2.7 | **PostGIS spatial indexing** | 3 days | `ST_DWithin()` queries replace application-level haversine filtering |
| 2.8 | **API key auth for data consumers** | 3 days | Monetization-ready: issue API keys, track usage per key |
| 2.9 | **Partition `point_events` by month** | 2 days | Query performance for time-range scans |
| 2.10 | **Feature flag system via Edge Config** | 2 days | Gradual rollout of features per country/user segment |

### Phase 3: Hybrid Architecture (Month 10-18, 10K-100K Users)

**Goal:** Add dedicated infrastructure for workloads that outgrow serverless.

```
New components:
  - Cloudflare R2: Replace Vercel Blob for cost (zero egress fees)
  - Upstash Redis: Session cache, rate limiting state, leaderboard cache
  - Dedicated worker (Fly.io or Railway): Photo processing, batch imports,
    fraud model scoring (> 60s execution)
  - Supabase read replica: Separate read/write traffic
  - Cloudflare DNS: Latency-based routing for Africa
```

| # | Action | Effort | Impact |
|---|--------|--------|--------|
| 3.1 | **Migrate blob storage to Cloudflare R2** | 1 week | Save ~$100/mo on egress at 200 GB+ |
| 3.2 | **Add Redis caching layer (Upstash)** | 3 days | Cache projected points, leaderboard; p95 latency < 200ms |
| 3.3 | **Supabase read replica** | 2 days | Read traffic offloaded; write path unaffected |
| 3.4 | **Dedicated async worker** | 1 week | Fraud ML model, batch geocoding, data quality scoring |
| 3.5 | **Multi-country geofencing** | 3 days | Extend `shared/geofence.ts` with country-level bounding boxes from config |
| 3.6 | **Data anonymization pipeline** | 1 week | GDPR/NDPA compliance: pseudonymize inactive user data |
| 3.7 | **GraphQL API layer** | 2 weeks | API consumers get flexible queries instead of fixed REST endpoints |
| 3.8 | **Cloudflare CDN in front of Vercel** | 2 days | Additional African PoPs (Lagos, Accra, Dar es Salaam) |

### Phase 4: Full Cloud-Native (Month 18+, 100K+ Users)

**Goal:** Own the infrastructure for cost control and data sovereignty.

**This phase is triggered when:**
- Monthly Vercel bill exceeds $500
- Data sovereignty laws require in-country hosting
- Need for persistent WebSocket connections > Supabase Realtime limits
- ML/AI workloads need GPU access

**Target architecture:**

```
AWS af-south-1 (Cape Town) or GCP Johannesburg:
  - EKS/GKE cluster for API services
  - RDS PostgreSQL (multi-AZ) or Cloud SQL
  - S3/GCS for blob storage
  - SQS/Cloud Tasks for message queue
  - ElastiCache/Memorystore for Redis
  - CloudFront/Cloud CDN

Retain from current stack:
  - Vercel for frontend static hosting (or migrate to S3+CloudFront)
  - Supabase Auth (or migrate to Auth0/Clerk)
  - Cloudflare for DNS and DDoS protection

Migration approach:
  1. Backend API moves first (Vercel Functions -> EKS/GKE)
  2. Database moves second (Supabase -> managed PostgreSQL)
  3. Frontend moves last (Vercel -> S3+CloudFront)
  4. Blue-green deployment with gradual traffic shift
```

**Cost comparison at 100K users:**

| Component | Vercel+Supabase | AWS Self-Managed | Savings |
|-----------|----------------|-----------------|---------|
| Compute | $150/mo | $80/mo (2x t3.medium) | 47% |
| Database | $75/mo | $50/mo (db.t3.medium) | 33% |
| Blob storage | $460/mo (2TB) | $46/mo (S3) | 90% |
| CDN/Bandwidth | $150/mo | $85/mo (CloudFront) | 43% |
| **Total** | **$835/mo** | **$261/mo** | **69%** |

The tradeoff: self-managed requires 0.5-1 FTE DevOps engineer. At $261/mo savings, this only makes sense if the team has grown to include dedicated infrastructure talent.

---

## Appendix A: Decision Log

| Date | Decision | Rationale | Alternatives Considered |
|------|----------|-----------|------------------------|
| 2026-02 | Stay on Vercel + Supabase for Phase 1-2 | Zero ops overhead, fast iteration, adequate for 10K users | AWS Amplify (worse DX), Railway (no edge network), Fly.io (no CDN) |
| 2026-02 | PostgreSQL as primary store (not Edge Config) | Already migrated (`DATA_STORE_DRIVER=postgres`); Edge Config is read-only and limited | Keep Edge Config primary (hit 1MB limit) |
| 2026-02 | Offline-first via IndexedDB (not Service Worker Cache API) | Already implemented and battle-tested; Cache API doesn't handle form submissions | Service Worker Background Sync API (limited browser support) |
| 2026-02 | Append-only event log (not CRUD) | Audit trail, fraud forensics, event replay; `point_events` is immutable | Mutable `points` table with update-in-place |
| 2026-02 | QStash for async processing (not SQS/Redis Queue) | Native Vercel integration, no infrastructure, HTTP-based | Upstash Redis Queue (more complex), Supabase Edge Functions (limited) |

## Appendix B: Risk Register (Architecture)

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Supabase free tier DB hits 500 MB limit | High (6 months) | Service degradation | Monitor usage; upgrade to Pro ($25/mo) proactively |
| Vercel function cold starts > 5s in Africa | Medium | Poor UX for first request | Use Fluid Compute, keep functions small, edge caching |
| Gemini API rate limits hit during peak | Medium | Location search fails | Cache search results, implement client-side fallback |
| ipapi.co free tier (1K/day) exhausted | High (at 1K users) | Fraud checks skip IP location | Switch to MaxMind GeoLite2 database (local, free) |
| Single Supabase project = single point of failure | High | Total data loss risk | Phase 1.9: Enable PITR; Phase 2: read replica |
| African connectivity outage | High | Users cannot sync | Offline queue handles this; extend to 500-item capacity |
| Data sovereignty enforcement in Cameroon | Low (near-term) | Legal risk | Monitor regulatory landscape; plan for in-country hosting |

## Appendix C: Glossary

| Term | Definition |
|------|-----------|
| **PoP** | Point of Presence -- CDN edge server location |
| **PITR** | Point-in-Time Recovery -- database backup with second-level granularity |
| **RTO** | Recovery Time Objective -- max acceptable downtime after an incident |
| **RPO** | Recovery Point Objective -- max acceptable data loss window |
| **QStash** | Vercel's HTTP-based message queue service |
| **Edge Config** | Vercel's ultra-low-latency key-value store at the edge |
| **PgBouncer** | PostgreSQL connection pooler used by Supabase |
| **Materialized View** | Pre-computed query result stored as a table, refreshed periodically |
| **Event Sourcing** | Pattern where state is derived from an append-only log of events |
| **PostGIS** | PostgreSQL extension for geographic/spatial queries |
