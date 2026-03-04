# ADL Technical Architecture: Target State for Bonamoussadi Pilot
## Cloud Architect Deliverable

**Teammate 3 -- Cloud Architect**
**Date:** March 2026

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Offline-First Mobile Capture](#2-offline-first-mobile-capture)
3. [Storage Architecture](#3-storage-architecture)
4. [Sync Protocol](#4-sync-protocol)
5. [API Design](#5-api-design)
6. [Cost and Reliability Tradeoffs](#6-cost-and-reliability-tradeoffs)
7. [Technology Choices](#7-technology-choices)

---

## Existing System Inventory

Before proposing the target architecture, here is what is already deployed and operational:

| Layer | Current Technology | Status |
|---|---|---|
| **Frontend** | React 19 + Vite 6 SPA | Deployed on Vercel |
| **Backend API** | Vercel Serverless Functions (Node.js) | `/api/*` routes |
| **Primary Database** | PostgreSQL (Neon/Supabase-hosted) | `point_events`, `snapshots`, `snapshot_deltas`, `snapshot_stats`, `user_profiles` |
| **Legacy Fallback** | Vercel Edge Config | Read-only fallback when Postgres unavailable |
| **File Storage** | Vercel Blob (`@vercel/blob`) | Photo evidence uploads |
| **Offline Queue** | IndexedDB (`adl_offline_queue`) | Client-side queuing with exponential backoff |
| **Sync** | Custom `submissionSync.ts` + `offlineQueue.ts` | Sequential flush with idempotency keys |
| **Auth** | `@auth/core` + Google OAuth + email/password | Session-based |
| **AI** | Google Gemini (`@google/genai`) | Server-side search |
| **Analytics** | `@vercel/analytics` + `@vercel/speed-insights` | Page-level |
| **Maps** | Leaflet + React-Leaflet | POI visualization |
| **Charts** | Recharts | Dashboard analytics |
| **Cron** | Vercel Cron (`vercel.json`) | Weekly snapshot engine, Mondays 03:00 UTC |
| **Fraud Detection** | EXIF GPS extraction + haversine + IP geolocation | Server-side on submission |

**Key architectural decision already made:** The system is event-sourced. All data enters as immutable `point_events` (CREATE_EVENT / ENRICH_EVENT), projected into `ProjectedPoint` objects, frozen into weekly `snapshots`, with `snapshot_deltas` computed between consecutive snapshots. This is the correct foundation. The architecture below extends it without replacing it.

---

## 1. Architecture Overview

### 1.1 High-Level System Diagram

```
                                    FIELD OPERATIONS
                                    (Bonamoussadi, Douala)

    ┌─────────────────────────────────────────────────────────────┐
    │                                                             │
    │  ┌─────────────────────┐     ┌─────────────────────┐       │
    │  │  Field Agent App    │     │  Field Agent App    │       │
    │  │  (PWA on Android)   │     │  (PWA on Android)   │       │
    │  │                     │     │                     │       │
    │  │  ┌───────────────┐  │     │  ┌───────────────┐  │       │
    │  │  │ IndexedDB     │  │     │  │ IndexedDB     │  │       │
    │  │  │ Queue + Cache │  │     │  │ Queue + Cache │  │       │
    │  │  └───────┬───────┘  │     │  └───────┬───────┘  │       │
    │  │          │          │     │          │          │       │
    │  │  ┌───────┴───────┐  │     │  ┌───────┴───────┐  │       │
    │  │  │ Sync Engine   │  │     │  │ Sync Engine   │  │       │
    │  │  │ (adaptive)    │  │     │  │ (adaptive)    │  │       │
    │  │  └───────┬───────┘  │     │  └───────┴───────┘  │       │
    │  └──────────│──────────┘     └─────────────────────┘       │
    │             │                                               │
    │             │  MTN / Orange 3G/4G                           │
    │             │  (intermittent connectivity)                  │
    └─────────────┼───────────────────────────────────────────────┘
                  │
                  │ HTTPS
                  │
    ══════════════╪═══════════════════════════════════════════════
                  │           VERCEL EDGE NETWORK
    ══════════════╪═══════════════════════════════════════════════
                  │
                  ▼
    ┌─────────────────────────────────────────────────────────────┐
    │                     VERCEL PLATFORM                         │
    │                                                             │
    │  ┌──────────────────────────┐  ┌─────────────────────────┐ │
    │  │   API Layer              │  │   Static Assets         │ │
    │  │   (Serverless Functions) │  │   (Vite SPA bundle)     │ │
    │  │                          │  │                         │ │
    │  │  /api/submissions  POST  │  │   index.html            │ │
    │  │  /api/submissions  GET   │  │   assets/*.js           │ │
    │  │  /api/auth/*             │  │   assets/*.css          │ │
    │  │  /api/analytics    GET   │  │                         │ │
    │  │  /api/leaderboard  GET   │  │                         │ │
    │  │  /api/user         CRUD  │  │                         │ │
    │  │  /api/ai/search    POST  │  │                         │ │
    │  │  /api/health       GET   │  │                         │ │
    │  │                          │  │                         │ │
    │  │  ┌────────────────────┐  │  │                         │ │
    │  │  │ Fraud Engine       │  │  │                         │ │
    │  │  │ (EXIF + haversine  │  │  │                         │ │
    │  │  │  + IP geolocation) │  │  │                         │ │
    │  │  └────────────────────┘  │  │                         │ │
    │  └──────────┬───────────────┘  └─────────────────────────┘ │
    │             │                                               │
    │  ┌──────────┴───────────────────────────────────────────┐  │
    │  │              CRON JOBS (Vercel Cron)                  │  │
    │  │                                                       │  │
    │  │  Weekly:  /api/analytics?view=cron  (Mon 03:00 UTC)  │  │
    │  │           -> runWeeklySnapshot()                      │  │
    │  │           -> computeDeltas()                          │  │
    │  │           -> upsertStats()                            │  │
    │  │                                                       │  │
    │  │  Daily:   /api/road-snapshot (rainy season only)     │  │
    │  │           -> transport_road deltas                    │  │
    │  │                                                       │  │
    │  │  Monthly: /api/monthly-rollup                        │  │
    │  │           -> monthly_stats aggregation                │  │
    │  └──────────────────────────────────────────────────────┘  │
    │                                                             │
    └──────────────┬──────────────────────┬───────────────────────┘
                   │                      │
                   ▼                      ▼
    ┌──────────────────────────┐  ┌──────────────────────────────┐
    │   POSTGRESQL (Neon)      │  │   VERCEL BLOB STORAGE        │
    │   (Primary Database)     │  │   (File Storage)             │
    │                          │  │                              │
    │   ┌────────────────────┐ │  │   /photos/{eventId}.jpg     │
    │   │ point_events       │ │  │   /photos/{eventId}_2.jpg   │
    │   │ (immutable log)    │ │  │                              │
    │   ├────────────────────┤ │  │   Max: 4.5MB per upload     │
    │   │ snapshots          │ │  │   Compressed client-side    │
    │   │ (weekly frozen)    │ │  │                              │
    │   ├────────────────────┤ │  └──────────────────────────────┘
    │   │ snapshot_deltas    │ │
    │   │ (change records)   │ │  ┌──────────────────────────────┐
    │   ├────────────────────┤ │  │   VERCEL EDGE CONFIG         │
    │   │ snapshot_stats     │ │  │   (Read Fallback Cache)      │
    │   │ (aggregates)       │ │  │                              │
    │   ├────────────────────┤ │  │   Seed events (read-only)    │
    │   │ monthly_stats      │ │  │   Activated when Postgres    │
    │   │ (monthly rollup)   │ │  │   is temporarily unavailable │
    │   ├────────────────────┤ │  └──────────────────────────────┘
    │   │ user_profiles      │ │
    │   │ (auth + accounts)  │ │
    │   ├────────────────────┤ │
    │   │ collection_        │ │
    │   │ assignments        │ │
    │   │ (zone assignments) │ │
    │   └────────────────────┘ │
    │                          │
    │   Region: AWS us-east-1  │
    │   (Neon default)         │
    │                          │
    └──────────────────────────┘
```

### 1.2 Data Flow Diagram

```
FIELD AGENT SUBMISSION FLOW
═══════════════════════════

  Agent captures POI
       │
       ▼
  ┌─────────────────────┐
  │ 1. Compress photo    │  Client-side: resize to 1280px max,
  │    (client-side)     │  JPEG quality 0.7, target < 500KB
  └──────────┬──────────┘
             │
             ▼
  ┌─────────────────────┐
  │ 2. Enqueue to       │  IndexedDB: adl_offline_queue
  │    IndexedDB         │  Status: 'pending'
  │                      │  Includes: idempotencyKey, payload,
  │                      │  compressed photo as Blob
  └──────────┬──────────┘
             │
             ▼
  ┌─────────────────────┐
  │ 3. Attempt sync     │  If online:
  │    immediately       │    -> POST /api/submissions
  │                      │    -> Upload photo to Vercel Blob
  │                      │  If offline:
  │                      │    -> Stay in queue, retry later
  └──────────┬──────────┘
             │ (when online)
             ▼
  ┌─────────────────────┐
  │ 4. Server receives   │  Validates payload:
  │    submission         │  - Geofence check (Bonamoussadi bbox)
  │                      │  - EXIF GPS extraction + haversine
  │                      │  - IP geolocation cross-reference
  │                      │  - Idempotency key dedup
  │                      │  - Category validation
  └──────────┬──────────┘
             │
             ├──────────────────────────┐
             │                          │
             ▼                          ▼
  ┌─────────────────────┐  ┌─────────────────────┐
  │ 5a. Insert into      │  │ 5b. Upload photo    │
  │     point_events     │  │     to Vercel Blob  │
  │     (Postgres)       │  │                     │
  └──────────┬──────────┘  └─────────────────────┘
             │
             │ (weekly cron)
             ▼
  ┌─────────────────────┐
  │ 6. Snapshot engine   │  projectPointsFromEvents()
  │    runs              │  -> buildSnapshotRows()
  │                      │  -> computeDeltas()
  │                      │  -> upsertStats()
  │                      │  -> detectAnomalies()
  └──────────┬──────────┘
             │
             ▼
  ┌─────────────────────┐
  │ 7. Dashboard +       │  Admin reviews queue
  │    API consumers     │  Clients query delta feeds
  │    see fresh data    │  Exportable datasets
  └─────────────────────┘
```

### 1.3 Network Topology for Cameroon Context

```
NETWORK PATH: BONAMOUSSADI -> VERCEL
═════════════════════════════════════

  Agent phone (Bonamoussadi, Douala)
       │
       │  MTN / Orange cellular
       │  Typical: 3G (1-5 Mbps down, 0.3-1 Mbps up)
       │  Occasional 4G: (10-30 Mbps down, 3-10 Mbps up)
       │  Latency: 80-200ms to Lagos IX, 150-400ms to Europe
       │
       ▼
  ┌─────────────────────┐
  │ Local cell tower     │
  │ (Bonamoussadi area)  │
  └──────────┬──────────┘
             │
             ▼
  ┌─────────────────────┐
  │ MTN/Orange backbone  │
  │ Douala PoP           │
  └──────────┬──────────┘
             │
             │  Submarine cable (SAT-3/WASC or WACS)
             │  Douala -> Europe / US
             │
             ▼
  ┌─────────────────────┐
  │ Vercel Edge          │
  │ (nearest PoP)        │  Static assets served from edge
  │                      │  API requests routed to origin
  └──────────┬──────────┘
             │
             ▼
  ┌─────────────────────┐
  │ Vercel Serverless    │
  │ (us-east-1)          │  API function execution
  └──────────┬──────────┘
             │
             ▼
  ┌─────────────────────┐
  │ Neon Postgres        │
  │ (us-east-1)          │  Database queries
  └─────────────────────┘

  Total round-trip (Douala -> Vercel API -> Postgres -> response):
    Best case:   300-500ms  (4G, good conditions)
    Typical:     800-2000ms (3G, normal load)
    Degraded:    3-10s      (congested network, 2G fallback)
    Offline:     ∞          (queue locally, sync later)
```

---

## 2. Offline-First Mobile Capture

### 2.1 Current State Assessment

The existing offline implementation is functional but minimal:

**What works:**
- IndexedDB-based queue (`adl_offline_queue` store) with `pending`/`syncing`/`failed`/`synced` states
- Idempotency keys for deduplication on retry
- Exponential backoff with jitter (base 1s, max 30s)
- Error classification (retryable vs permanent)
- Sync error recording for diagnostics
- Client device profiling (`deviceProfile.ts`)

**What is missing for pilot readiness:**
- No local data cache (agents cannot view existing POIs offline)
- No photo staging (photos are not stored locally if upload fails)
- No bandwidth-aware sync (same behavior on 2G vs 4G)
- No upload prioritization (text and photos treated equally)
- No sync progress visibility beyond queue count
- No assignment data cached locally
- No battery/data usage optimization

### 2.2 Target Offline Architecture

```
ENHANCED OFFLINE ARCHITECTURE
═══════════════════════════════

  IndexedDB Database: adl_offline_queue (v3)
  ┌──────────────────────────────────────────────────────────┐
  │                                                          │
  │  Store: submission_queue        (existing, enhanced)     │
  │  ├── QueueItem                                          │
  │  │   ├── id: string                                     │
  │  │   ├── idempotencyKey: string                         │
  │  │   ├── payload: SubmissionInput                       │
  │  │   ├── status: 'pending'|'syncing'|'failed'|'synced'  │
  │  │   ├── priority: 1-5          (NEW)                   │
  │  │   ├── payloadSizeBytes: number (NEW)                 │
  │  │   ├── hasPhoto: boolean       (NEW)                  │
  │  │   ├── photoBlob: Blob | null  (NEW - staged photo)  │
  │  │   ├── photoSynced: boolean    (NEW)                  │
  │  │   ├── attempts: number                               │
  │  │   ├── retryCount: number                             │
  │  │   ├── nextRetryAt: string                            │
  │  │   ├── lastError: string                              │
  │  │   ├── createdAt: string                              │
  │  │   └── updatedAt: string                              │
  │  │                                                      │
  │  Store: submission_sync_errors   (existing)             │
  │  │                                                      │
  │  Store: local_poi_cache          (NEW)                  │
  │  ├── CachedPOI                                          │
  │  │   ├── pointId: string                                │
  │  │   ├── category: string                               │
  │  │   ├── latitude: number                               │
  │  │   ├── longitude: number                              │
  │  │   ├── details: object                                │
  │  │   ├── photoUrl: string | null                        │
  │  │   ├── lastSyncedAt: string                           │
  │  │   └── source: string                                 │
  │  │                                                      │
  │  Store: local_assignments        (NEW)                  │
  │  ├── CachedAssignment                                   │
  │  │   ├── id: string                                     │
  │  │   ├── zoneId: string                                 │
  │  │   ├── zoneBounds: object                             │
  │  │   ├── assignedVerticals: string[]                    │
  │  │   ├── dueDate: string                                │
  │  │   ├── pointsExpected: number                         │
  │  │   ├── status: string                                 │
  │  │   └── syncedAt: string                               │
  │  │                                                      │
  │  Store: network_metrics          (NEW)                  │
  │  ├── NetworkSample                                      │
  │  │   ├── timestamp: string                              │
  │  │   ├── rttMs: number                                  │
  │  │   ├── effectiveType: string   ('2g'|'3g'|'4g')     │
  │  │   ├── downlinkMbps: number                           │
  │  │   └── syncSuccess: boolean                           │
  │  │                                                      │
  │  Store: photo_staging            (NEW)                  │
  │  ├── StagedPhoto                                        │
  │  │   ├── id: string                                     │
  │  │   ├── queueItemId: string                            │
  │  │   ├── blob: Blob                                     │
  │  │   ├── originalSizeBytes: number                      │
  │  │   ├── compressedSizeBytes: number                    │
  │  │   ├── mimeType: string                               │
  │  │   ├── status: 'staged'|'uploading'|'uploaded'        │
  │  │   └── createdAt: string                              │
  │  │                                                      │
  └──────────────────────────────────────────────────────────┘

  Estimated local storage per agent:
    Queue items (50 pending):     ~50 KB
    POI cache (500 entities):     ~500 KB
    Assignments (5 active):       ~10 KB
    Network metrics (100 samples): ~20 KB
    Photo staging (20 photos):    ~10 MB
    ────────────────────────────────────
    Total:                        ~11 MB  (well within IndexedDB limits)
```

### 2.3 Photo Compression and Staging

```typescript
// Target: compress photos to < 500KB while maintaining evidence quality

interface PhotoCompressionConfig {
  maxWidth: 1280;           // px - sufficient for signage readability
  maxHeight: 1280;          // px
  quality: 0.7;             // JPEG quality (0-1)
  targetSizeBytes: 500_000; // 500KB target
  maxSizeBytes: 2_000_000;  // 2MB hard limit (reject if can't compress below)
  format: 'image/jpeg';     // Always JPEG for size efficiency
}

// Compression pipeline:
// 1. Read photo from camera/file input
// 2. Draw to canvas at maxWidth/maxHeight (maintain aspect ratio)
// 3. Export as JPEG at quality 0.7
// 4. If > targetSize, reduce quality in steps (0.6, 0.5, 0.4)
// 5. If > maxSize after quality 0.4, reduce dimensions by 50%
// 6. Store compressed Blob in photo_staging IndexedDB store
// 7. Original is discarded after staging

// EXIF preservation:
// Extract GPS coordinates BEFORE compression (canvas strips EXIF)
// Store extracted GPS in the QueueItem payload alongside the photo
// This is critical for fraud detection on the server
```

**Photo staging flow:**

```
  Camera capture
       │
       ▼
  ┌─────────────────────┐
  │ Extract EXIF GPS     │  Using exifr (already in dependencies)
  │ from original        │  before any processing
  └──────────┬──────────┘
             │
             ▼
  ┌─────────────────────┐
  │ Compress to canvas   │  1280px max, JPEG 0.7
  │ → JPEG blob          │  Target: < 500KB
  └──────────┬──────────┘
             │
             ▼
  ┌─────────────────────┐
  │ Store in IndexedDB   │  photo_staging store
  │ photo_staging        │  Status: 'staged'
  └──────────┬──────────┘
             │
             ▼
  ┌─────────────────────┐
  │ Create QueueItem     │  Links to staged photo
  │ in submission_queue  │  hasPhoto: true
  └─────────────────────┘
```

### 2.4 Queue Management and Prioritization

```
SYNC PRIORITY LEVELS
═════════════════════

Priority 1 (CRITICAL):  Road blockage events (isBlocked = true)
                         These have real-time commercial value.
                         Sync immediately if any connectivity exists.

Priority 2 (HIGH):      Text-only submissions (CREATE_EVENT / ENRICH_EVENT
                         without photo). Small payload (~1-3 KB).
                         Sync over any connection including 2G.

Priority 3 (NORMAL):    Submissions with photos, events older than 1 hour.
                         Sync when 3G+ detected.

Priority 4 (LOW):       POI cache refresh (download updated POI list).
                         Sync when on 4G or WiFi.

Priority 5 (DEFERRED):  Assignment downloads, map tile caching.
                         Sync on WiFi or when charging.
```

### 2.5 Conflict Resolution Strategy

```
CONFLICT RESOLUTION RULES
══════════════════════════

The event-sourced model largely eliminates conflicts because events are
immutable and append-only. Two agents can submit events for the same
point_id without conflict -- both are stored and merged during projection.

However, two conflict scenarios exist:

SCENARIO 1: Duplicate entity creation
  Agent A creates "Pharmacy near Carrefour" at point X
  Agent B creates "Pharmacie du Carrefour" at point X + 15m
  Both are offline, both sync later.

  Resolution: Server-side dedup (Teammate 2, Section 2.3)
  - Spatial proximity check (25m radius, same category)
  - Name similarity scoring
  - If score > 0.7: flag for admin merge review
  - If score < 0.7: accept as separate entities
  - Admin merge creates MERGE_EVENT

SCENARIO 2: Contradictory enrichments
  Agent A submits: pharmacy isOpenNow = true (at 09:00)
  Agent B submits: pharmacy isOpenNow = false (at 14:00)
  Both for the same point_id.

  Resolution: Last-write-wins (already implemented)
  - projectPointsFromEvents() orders events by created_at
  - Latest event's value takes precedence for scalar fields
  - Both events are preserved in the log
  - Delta engine captures the change

SCENARIO 3: Offline edits to stale data
  Agent views cached POI data from 3 days ago (last sync).
  Agent submits ENRICH_EVENT based on outdated state.

  Resolution: Accept unconditionally
  - The event records what the agent observed in the field
  - The timestamp records when the observation was made
  - If the data is older than 72 hours, flag for admin review
    (Teammate 2, Section 3.5, Rule 3)
  - The admin can accept or discard the late event
```

### 2.6 Battery and Data Usage Optimization

```
BATTERY OPTIMIZATION
═════════════════════

1. GPS USAGE
   - Request high-accuracy GPS only when agent taps "Capture"
   - Use coarse location (network-based) for map display
   - Stop GPS polling after coordinates are captured
   - Target: GPS active < 30 seconds per capture

2. NETWORK USAGE
   - Compress photos client-side (original 3-5MB → compressed 300-500KB)
   - Batch sync: wait for 3+ pending items before syncing (unless Priority 1)
   - Adaptive polling interval:
     Foreground + queue items: check every 30 seconds
     Foreground + empty queue: check every 5 minutes
     Background: check every 15 minutes (using Service Worker)
     No connectivity: pause polling entirely

3. SCREEN
   - Dark mode option for AMOLED screens (common on mid-range Android)
   - Minimize animations during capture workflow
   - Keep camera viewfinder active only during photo capture

4. DATA BUDGET
   Per submission (text only):     ~1-3 KB
   Per submission (with photo):    ~300-500 KB
   POI cache refresh (500 POIs):   ~250 KB (gzipped JSON)
   Assignment download:            ~5 KB

   Daily budget per agent (typical):
     20 captures with photos:  20 * 400KB = ~8 MB
     5 enrichments text-only:  5 * 2KB = ~10 KB
     1 POI cache refresh:      ~250 KB
     Overhead (TLS, headers):  ~500 KB
     ─────────────────────────────────
     Total: ~9 MB / day

   Monthly budget per agent: ~200 MB

   Cameroon mobile data cost:
     MTN: 1GB = ~2,500 XAF (~$4 USD)
     Orange: 1GB = ~2,000 XAF (~$3.30 USD)
     ADL cost per agent: ~500 XAF/month ($0.80) for data
```

---

## 3. Storage Architecture

### 3.1 Primary Database: PostgreSQL on Neon

The existing PostgreSQL deployment on Neon is the correct choice and should remain as the primary database. Here is the complete storage topology:

```
STORAGE TOPOLOGY
═════════════════

┌──────────────────────────────────────────────────────────────────┐
│                   NEON POSTGRESQL                                 │
│                   (Primary Database)                              │
│                                                                   │
│   ┌─────────────────────────────────────────────────┐            │
│   │  EVENT STORE (append-only)                       │            │
│   │                                                  │            │
│   │  point_events            ~2,000 rows pilot       │            │
│   │  ├── id (uuid PK)       ~6,000 rows 6 weeks     │            │
│   │  ├── point_id                                    │            │
│   │  ├── event_type          Indexes:                │            │
│   │  ├── user_id             - created_at DESC       │            │
│   │  ├── category            - (point_id, created_at)│            │
│   │  ├── latitude            - (user_id, created_at) │            │
│   │  ├── longitude           - external_id           │            │
│   │  ├── details (JSONB)     - (category, created_at)│            │
│   │  ├── photo_url                                   │            │
│   │  ├── created_at                                  │            │
│   │  ├── source                                      │            │
│   │  └── external_id                                 │            │
│   └─────────────────────────────────────────────────┘            │
│                                                                   │
│   ┌─────────────────────────────────────────────────┐            │
│   │  TIME-SERIES STORE (frozen weekly)               │            │
│   │                                                  │            │
│   │  snapshots               ~500 rows/week          │            │
│   │  ├── snapshot_date       ~3,000 rows 6 weeks     │            │
│   │  ├── point_id                                    │            │
│   │  ├── vertical_id         UNIQUE(snapshot_date,   │            │
│   │  ├── details (JSONB)            point_id)        │            │
│   │  └── ...                                         │            │
│   │                                                  │            │
│   │  snapshot_deltas         ~2,000 rows/week        │            │
│   │  ├── snapshot_date       ~12,000 rows 6 weeks    │            │
│   │  ├── baseline_date                               │            │
│   │  ├── delta_type                                  │            │
│   │  └── ...                                         │            │
│   │                                                  │            │
│   │  snapshot_stats          ~7 rows/week            │            │
│   │  ├── snapshot_date       ~42 rows 6 weeks        │            │
│   │  ├── vertical_id                                 │            │
│   │  ├── z-scores                                    │            │
│   │  └── anomaly_flags                               │            │
│   │                                                  │            │
│   │  monthly_stats           ~7 rows/month           │            │
│   │  ├── month                                       │            │
│   │  ├── vertical_id                                 │            │
│   │  └── aggregates                                  │            │
│   └─────────────────────────────────────────────────┘            │
│                                                                   │
│   ┌─────────────────────────────────────────────────┐            │
│   │  OPERATIONAL STORE                               │            │
│   │                                                  │            │
│   │  user_profiles           ~30 rows                │            │
│   │  collection_assignments  ~50 rows 6 weeks        │            │
│   └─────────────────────────────────────────────────┘            │
│                                                                   │
│   Estimated total rows after 6-week pilot: ~21,100               │
│   Estimated database size: ~50-100 MB (including indexes)        │
│                                                                   │
│   Neon Plan: Free tier (0.5 GB storage, 190 compute hours)      │
│   Sufficient for pilot. Upgrade to Launch ($19/mo) at scale.    │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│                   VERCEL BLOB STORAGE                             │
│                   (Photo Evidence)                                │
│                                                                   │
│   Bucket structure:                                               │
│     /photos/{eventId}.jpg         Primary evidence photo          │
│     /photos/{eventId}_2.jpg       Secondary evidence photo        │
│                                                                   │
│   Estimated volume (6-week pilot):                               │
│     ~500 POIs * 1.5 photos avg * 400KB avg = ~300 MB            │
│     Enrichment photos: ~1,000 * 400KB = ~400 MB                 │
│     ─────────────────────────────────────────────────            │
│     Total: ~700 MB                                                │
│                                                                   │
│   Vercel Blob: Free tier includes 1 GB.                          │
│   Pro plan ($20/mo) includes 5 GB. Sufficient for pilot.        │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│                   VERCEL EDGE CONFIG                              │
│                   (Read-Only Fallback)                            │
│                                                                   │
│   Purpose: When Postgres is temporarily unavailable, the         │
│   system falls back to Edge Config for read operations.          │
│   This is already implemented in lib/server/storage/index.ts.   │
│                                                                   │
│   Contains: Seed events (OSM imports, baseline data)             │
│   Size limit: 512 KB (Edge Config free tier)                     │
│                                                                   │
│   NOT used for writes. Writes always go to Postgres.             │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
```

### 3.2 Cache Layer Strategy

```
CACHE ARCHITECTURE (3 TIERS)
══════════════════════════════

TIER 1: CLIENT-SIDE CACHE (IndexedDB)
───────────────────────────────────────
  What:     POI data for the agent's assigned zone
  Freshness: Refreshed on each successful sync, max age 24 hours
  Size:     ~500 KB per agent (500 POIs compressed)
  Eviction: LRU by zone; only active assignment zones cached
  Purpose:  Enable offline map display and dedup checks

TIER 2: EDGE CACHE (Vercel Edge Network)
─────────────────────────────────────────
  What:     Static assets (JS, CSS, images), GET API responses
  Freshness: Static assets: immutable (hashed filenames)
             API responses: stale-while-revalidate, 60s
  Purpose:  Reduce latency for agents in Douala
  Config:
    headers: [
      {
        source: "/api/submissions",
        headers: [{ key: "Cache-Control", value: "no-store" }]
      },
      {
        source: "/api/analytics",
        headers: [{ key: "Cache-Control", value: "public, s-maxage=300, stale-while-revalidate=600" }]
      }
    ]

TIER 3: READ FALLBACK (Vercel Edge Config)
──────────────────────────────────────────
  What:     Seed data and last-known-good state
  Freshness: Updated manually or by migration scripts
  Purpose:  Ensure reads succeed even during Postgres outages
  Already implemented: edgeFallbackStore.ts
```

### 3.3 Data Retention and Archival Policy

```
RETENTION POLICY
═════════════════

DATA TYPE              RETENTION        ARCHIVAL STRATEGY
─────────────────────────────────────────────────────────────────
point_events           Indefinite       Never delete (immutable log).
                                        At 100K+ rows: partition by
                                        year using Postgres partitioning.

snapshots              6 months         After 6 months: export to
                       (hot storage)    Parquet files on Vercel Blob,
                                        delete from Postgres.

snapshot_deltas        3 months         After 3 months: aggregate
                       (hot storage)    into monthly_stats, export
                                        raw deltas to Parquet, delete.

snapshot_stats         Indefinite       Small table (~7 rows/week).
                                        Never delete.

monthly_stats          Indefinite       Small table (~7 rows/month).
                                        Never delete.

user_profiles          Indefinite       Small table. Never delete.
                                        Comply with erasure requests
                                        per Cameroon Law 2024/017.

collection_assignments 6 months         After 6 months: export to
                                        CSV on Vercel Blob, delete.

Photo blobs            12 months        After 12 months: compress
                       (hot storage)    to thumbnail (100px), delete
                                        original. Retain thumbnail
                                        indefinitely as evidence.

IndexedDB (client)     Auto-managed     Clear synced items after 24h.
                                        Clear POI cache after 7 days.
                                        Photos deleted after upload.
```

### 3.4 Estimated Storage Costs for 6-Week Pilot

| Resource | Provider | Estimated Usage | Cost |
|---|---|---|---|
| **PostgreSQL** | Neon Free Tier | ~100 MB, 190 compute-hours | **$0** |
| **Blob Storage** | Vercel Pro | ~700 MB photos | Included in Pro ($20/mo) |
| **Edge Config** | Vercel Pro | ~200 KB seed data | Included in Pro |
| **Bandwidth** (Vercel) | Vercel Pro | ~5 GB/month (20 agents) | Included in Pro (100 GB) |
| | | | |
| **Total infrastructure** | | | **$20/month** |

At this scale, Neon Free Tier (0.5 GB storage, 190 compute-hours/month) is sufficient. The Vercel Pro plan at $20/month covers blob storage, bandwidth, edge config, and serverless function execution.

---

## 4. Sync Protocol

### 4.1 Enhanced Sync Engine Design

The existing `flushOfflineQueue()` in `offlineQueue.ts` is a good foundation. The enhanced sync engine adds bandwidth awareness, upload prioritization, and resumable photo uploads.

```
SYNC ENGINE STATE MACHINE
═══════════════════════════

  ┌──────────┐   connectivity    ┌──────────────┐
  │          │   detected        │              │
  │  IDLE    ├──────────────────►│  PROBING     │
  │          │                   │  (measure    │
  │          │◄──────────────────┤   bandwidth) │
  │          │   no connectivity │              │
  └────┬─────┘                   └──────┬───────┘
       │                                │
       │  timer tick                    │  probe complete
       │  (check queue)                 │  (RTT + speed measured)
       │                                │
       ▼                                ▼
  ┌──────────┐                   ┌──────────────┐
  │ CHECK    │                   │  CLASSIFY    │
  │ QUEUE    │                   │  CONNECTION  │
  │          │                   │              │
  │ pending  │                   │  2G: text    │
  │ items?   │                   │  3G: text +  │
  │          │                   │      photos  │
  └────┬─────┘                   │  4G: all     │
       │                         │  WiFi: all   │
       │ yes, items pending      │  + cache     │
       │                         └──────┬───────┘
       ▼                                │
  ┌──────────────────────────────────────┴──────────┐
  │                                                  │
  │              SYNC LOOP                           │
  │                                                  │
  │  1. Sort queue by priority (1=highest, 5=lowest) │
  │  2. Filter by connection class:                  │
  │     2G: only priority 1-2 (text, critical)       │
  │     3G: priority 1-4 (text + photos)             │
  │     4G/WiFi: all priorities                      │
  │  3. For each item:                               │
  │     a. If text-only: POST /api/submissions       │
  │     b. If has photo:                             │
  │        i.  POST /api/submissions (text first)    │
  │        ii. Upload photo to Vercel Blob           │
  │     c. On success: remove from queue             │
  │     d. On failure: exponential backoff           │
  │  4. Update sync status UI                        │
  │                                                  │
  └──────────────────────────────────────────────────┘
```

### 4.2 Upload Priority Rules

```
UPLOAD PRIORITY MATRIX
═══════════════════════

PRIORITY   CONTENT            SIZE     MIN CONNECTION   MAX RETRY
────────────────────────────────────────────────────────────────────
1          Road blockage      ~2 KB    2G (any)         Unlimited
           (isBlocked=true)

2          Text submissions    ~2 KB    2G (any)         10 retries
           (no photo)

3          Photo uploads       ~400KB   3G (>0.5 Mbps)   5 retries
           (normal priority)

4          POI cache download  ~250KB   3G (>1 Mbps)     3 retries
           (GET, background)

5          Assignments +       ~50KB    4G/WiFi          2 retries
           map tiles
           (background)

BANDWIDTH MEASUREMENT:
  The sync engine measures bandwidth by timing a small probe request:

  async function measureBandwidth(): Promise<ConnectionClass> {
    // Use Navigator.connection API if available (Chrome Android)
    const conn = (navigator as any).connection;
    if (conn?.effectiveType) {
      return conn.effectiveType; // '2g', '3g', '4g'
    }

    // Fallback: time a HEAD request to /api/health
    const start = performance.now();
    try {
      await fetch('/api/health', { method: 'HEAD' });
      const rttMs = performance.now() - start;
      if (rttMs > 2000) return '2g';
      if (rttMs > 500) return '3g';
      return '4g';
    } catch {
      return 'offline';
    }
  }
```

### 4.3 Resumable Photo Uploads

```
RESUMABLE UPLOAD PROTOCOL
══════════════════════════

For photos > 200KB, use chunked upload to handle dropped connections:

1. Client splits photo Blob into 100KB chunks
2. Each chunk uploaded with:
   POST /api/submissions/upload-chunk
   Headers:
     X-Upload-Id: {queueItemId}
     X-Chunk-Index: {0, 1, 2, ...}
     X-Total-Chunks: {N}
     Content-Type: application/octet-stream
   Body: raw chunk bytes

3. Server stores chunks in temporary storage (Vercel /tmp)
4. When all chunks received:
   - Reassemble into complete file
   - Upload to Vercel Blob
   - Return blob URL
   - Update point_event.photo_url

5. If upload interrupted:
   - Client queries: GET /api/submissions/upload-status?id={queueItemId}
   - Server returns: { receivedChunks: [0, 1], totalExpected: 4 }
   - Client resumes from chunk 2

6. Timeout: Incomplete uploads cleaned up after 1 hour

SIMPLIFIED ALTERNATIVE (recommended for pilot):
  For the 6-week pilot with photos < 500KB after compression,
  standard single-request upload is sufficient. The retry mechanism
  in flushOfflineQueue already handles failures. Implement chunked
  uploads only if field testing reveals persistent upload failures.
```

### 4.4 Server-Side Deduplication on Receive

```
SERVER DEDUP FLOW
══════════════════

Already partially implemented via idempotency keys. Enhancement:

1. IDEMPOTENCY KEY CHECK (existing)
   - Client sends X-Idempotency-Key header
   - Server checks: does this key already exist?
   - If yes: return 200 with existing event (not 409 Conflict)
   - If no: proceed with insert

2. CONTENT HASH CHECK (new)
   - Compute SHA-256 of (category + point_id + event_type +
     latitude.toFixed(5) + longitude.toFixed(5) +
     JSON.stringify(sortedDetails))
   - Store hash in point_events.content_hash column
   - Check for duplicate hash within last 24 hours
   - If found: return 200 (treat as successful, skip insert)

3. SPATIAL TEMPORAL CHECK (new, for CREATE events)
   - Check: does a CREATE_EVENT exist for same category
     within 25m and within last 4 hours by the same user?
   - If yes: flag as potential duplicate, store but mark
     for admin review

SQL for content hash:
  ALTER TABLE point_events
    ADD COLUMN IF NOT EXISTS content_hash text;
  CREATE INDEX IF NOT EXISTS idx_point_events_content_hash
    ON point_events (content_hash)
    WHERE content_hash IS NOT NULL;
```

### 4.5 Sync Status Visibility for Field Agents

```
SYNC STATUS UI COMPONENT
═══════════════════════════

The agent sees a persistent sync indicator in the app header:

  ┌──────────────────────────────────────────────┐
  │  ADL Capture                    ⬤ 3 pending  │
  │                                  ↑ syncing   │
  └──────────────────────────────────────────────┘

States:
  ⬤ (green)  "All synced"          - Queue empty, online
  ⬤ (yellow) "3 pending"           - Items in queue, syncing
  ⬤ (orange) "Offline (5 queued)"  - No connectivity, items waiting
  ⬤ (red)    "2 failed"            - Permanent failures need attention

Tapping the indicator opens a sync detail panel:

  ┌──────────────────────────────────────────────┐
  │  Sync Status                                  │
  │                                               │
  │  Connection: 3G (Orange)  ↑ 0.8 Mbps         │
  │  Last sync: 2 minutes ago                     │
  │                                               │
  │  Pending:  3 submissions                      │
  │  ├── Pharmacy (text)       ● syncing...       │
  │  ├── Billboard (+ photo)   ○ waiting          │
  │  └── Road blockage         ● syncing...       │
  │                                               │
  │  Failed:   1 submission                       │
  │  └── Mobile Money agent    ✗ invalid GPS      │
  │      [View Details] [Retry] [Discard]         │
  │                                               │
  │  Today's stats:                               │
  │  ├── Uploaded: 12 submissions, 8 photos       │
  │  ├── Data used: ~4.2 MB                       │
  │  └── Battery impact: minimal                  │
  │                                               │
  │  [Force Sync Now]                             │
  └──────────────────────────────────────────────┘
```

---

## 5. API Design

### 5.1 API Surface Overview

The existing API routes handle the core operations. Below is the complete target API surface, noting what exists and what is new.

```
API ROUTE MAP
══════════════

METHOD  PATH                              STATUS    PURPOSE
────────────────────────────────────────────────────────────────────

FIELD AGENT APIs
────────────────────────────────────────────────────────────────────
POST    /api/submissions                  EXISTS    Submit event
GET     /api/submissions                  EXISTS    List events (filtered)
GET     /api/submissions?offline=true     NEW       Download POI cache
                                                    for offline use
POST    /api/submissions/upload-chunk     NEW       Resumable photo chunk
GET     /api/submissions/upload-status    NEW       Check chunk progress
GET     /api/assignments                  NEW       Get agent's assignments
PUT     /api/assignments/:id/status       NEW       Update assignment status

AUTHENTICATION
────────────────────────────────────────────────────────────────────
GET     /api/auth/signin/:provider        EXISTS    OAuth redirect
GET     /api/auth/callback/:provider      EXISTS    OAuth callback
POST    /api/auth/signin                  EXISTS    Email/password login
GET     /api/auth/session                 EXISTS    Current session
POST    /api/auth/signout                 EXISTS    Logout

ADMIN APIs
────────────────────────────────────────────────────────────────────
GET     /api/analytics                    EXISTS    Dashboard data
GET     /api/analytics?view=cron          EXISTS    Trigger snapshot (cron)
GET     /api/analytics?view=deltas        NEW       Delta feed
GET     /api/analytics?view=stats         NEW       Vertical-level stats
POST    /api/admin/assignments            NEW       Create assignment
GET     /api/admin/review-queue           NEW       Flagged submissions
PUT     /api/admin/review-queue/:id       NEW       Approve/reject
POST    /api/admin/merge-points           NEW       Merge duplicate entities
GET     /api/admin/agents                 NEW       Agent performance

CLIENT-FACING APIs (data consumers)
────────────────────────────────────────────────────────────────────
GET     /api/data/snapshots               NEW       Latest snapshot data
GET     /api/data/deltas                  NEW       Delta feed (date range)
GET     /api/data/export                  NEW       CSV/JSON export
GET     /api/data/verticals/:id           NEW       Vertical-specific data
GET     /api/data/poi/:pointId            NEW       Single POI history

UTILITY
────────────────────────────────────────────────────────────────────
GET     /api/health                       EXISTS    Health check
GET     /api/leaderboard                  EXISTS    Agent XP rankings
GET     /api/user                         EXISTS    User profile
PUT     /api/user                         EXISTS    Update profile
POST    /api/ai/search                    EXISTS    Gemini AI search
```

### 5.2 Field Agent API Details

```
POST /api/submissions
═════════════════════

Request:
  Headers:
    Content-Type: application/json
    Authorization: Bearer {sessionToken}
    X-Idempotency-Key: {uuid}         (for dedup on retry)

  Body:
  {
    "eventType": "CREATE_EVENT",       // or "ENRICH_EVENT"
    "category": "mobile_money",
    "pointId": "mobile_money-s16gdq-a1b2c3d4",  // auto-generated for CREATE
    "location": {
      "latitude": 4.0823,
      "longitude": 9.7356
    },
    "details": {
      "name": "MoMo Kiosk Carrefour",
      "providers": ["MTN", "Orange"],
      "isActive": true,
      "hasFloat": true,
      "clientDevice": { ... }          // auto-injected by client
    },
    "photoBase64": "data:image/jpeg;base64,...",  // or separate upload
    "source": "field_agent"
  }

Response (201 Created):
  {
    "id": "event-uuid",
    "pointId": "mobile_money-s16gdq-a1b2c3d4",
    "photoUrl": "https://blob.vercel-storage.com/photos/event-uuid.jpg",
    "fraudCheck": {
      "gpsMatch": true,
      "ipMatch": true,
      "withinGeofence": true,
      "distance_m": 12.5
    }
  }

Response (409 Conflict -- idempotent):
  Returns existing event data (treat as success on client)

Response (422 Unprocessable):
  {
    "error": "Outside Bonamoussadi geofence",
    "retryable": false
  }


GET /api/submissions?offline=true
══════════════════════════════════

Purpose: Download a compressed snapshot of all POIs for offline cache.

Request:
  Headers:
    Authorization: Bearer {sessionToken}
    Accept-Encoding: gzip

  Query params:
    offline=true             Required flag
    zone=bona-zone-B         Optional zone filter
    since=2026-03-01         Optional incremental (only changed since)

Response (200 OK):
  Content-Type: application/json
  Content-Encoding: gzip

  {
    "syncedAt": "2026-03-03T10:00:00Z",
    "totalPoints": 487,
    "points": [
      {
        "pointId": "mobile_money-s16gdq-a1b2c3d4",
        "category": "mobile_money",
        "latitude": 4.0823,
        "longitude": 9.7356,
        "details": { "name": "MoMo Kiosk", "providers": ["MTN"] },
        "photoUrl": "https://...",
        "updatedAt": "2026-03-02T15:30:00Z"
      },
      ...
    ]
  }

  Size estimate: ~250 KB gzipped for 500 POIs
```

### 5.3 Admin API Details

```
GET /api/admin/review-queue
════════════════════════════

Purpose: List submissions flagged for admin review.

Flags that trigger review:
  - Fraud check failed (GPS mismatch, IP mismatch, outside geofence)
  - Potential duplicate (spatial proximity match)
  - Late submission (> 72 hours old when synced)
  - Low confidence score (< 40)
  - Anomaly detected by snapshot engine (z-score > 2)

Response:
  {
    "queue": [
      {
        "eventId": "uuid",
        "pointId": "pharmacy-s16gdp-x1y2z3",
        "category": "pharmacy",
        "agentId": "user-123",
        "agentName": "Kouam J.",
        "flags": ["gps_mismatch", "potential_duplicate"],
        "details": { ... },
        "photoUrl": "https://...",
        "createdAt": "2026-03-03T09:15:00Z",
        "duplicateCandidates": [
          {
            "pointId": "pharmacy-s16gdp-a4b5c6",
            "name": "Pharmacie du Carrefour",
            "distance_m": 18.3,
            "similarity": 0.82
          }
        ]
      }
    ],
    "totalPending": 12,
    "totalReviewed": 847
  }


POST /api/admin/merge-points
═════════════════════════════

Purpose: Merge two duplicate entities into one.

Request:
  {
    "keepPointId": "pharmacy-s16gdp-a1b2c3",    // Entity to keep
    "mergePointId": "pharmacy-s16gdp-x4y5z6",   // Entity to merge into keep
    "reason": "Same pharmacy, different entrance photos"
  }

Effect:
  1. Creates MERGE_EVENT on the kept entity
  2. Creates CLOSE_EVENT on the merged entity with reference to kept entity
  3. All future queries return only the kept entity
  4. Historical events from merged entity are preserved
```

### 5.4 Client-Facing (Data Consumer) APIs

```
GET /api/data/deltas
═════════════════════

Purpose: Feed of changes for data consumers (the commercial product).

Query params:
  vertical=mobile_money      Filter by vertical
  since=2026-02-24           Start date (ISO)
  until=2026-03-03           End date (ISO)
  significance=high,medium   Filter by significance
  format=json                json or csv

Response:
  {
    "period": { "from": "2026-02-24", "to": "2026-03-03" },
    "vertical": "mobile_money",
    "summary": {
      "totalPoints": 142,
      "newPoints": 8,
      "removedPoints": 3,
      "changedPoints": 22,
      "unchangedPoints": 109,
      "netGrowth": 5,
      "weekOverWeekGrowth": 3.65
    },
    "deltas": [
      {
        "pointId": "mobile_money-s16gdq-a1b2c3",
        "deltaType": "new",
        "significance": "high",
        "location": { "latitude": 4.0823, "longitude": 9.7356 },
        "details": { "name": "New MoMo Agent", "providers": ["MTN"] },
        "photoUrl": "https://..."
      },
      {
        "pointId": "mobile_money-s16gdp-x4y5z6",
        "deltaType": "changed",
        "field": "isActive",
        "previousValue": true,
        "currentValue": false,
        "significance": "high",
        "summary": "Agent went inactive"
      }
    ],
    "anomalies": [
      {
        "metric": "removed_count",
        "zScore": 2.3,
        "direction": "increase",
        "description": "Unusual number of agent closures this week"
      }
    ]
  }


GET /api/data/export
═════════════════════

Purpose: Bulk data export for enterprise clients.

Query params:
  vertical=pharmacy          Required
  snapshot_date=2026-03-03   Optional (defaults to latest)
  format=csv                 csv, json, or geojson

Response (CSV):
  Content-Type: text/csv
  Content-Disposition: attachment; filename="adl-pharmacy-2026-03-03.csv"

  point_id,category,name,latitude,longitude,is_formal,is_open,is_on_duty,...
  pharmacy-s16gdp-a1b2c3,pharmacy,Pharmacie Bonamoussadi,4.0835,9.7412,true,true,false,...

Response (GeoJSON):
  Content-Type: application/geo+json

  {
    "type": "FeatureCollection",
    "features": [
      {
        "type": "Feature",
        "geometry": { "type": "Point", "coordinates": [9.7412, 4.0835] },
        "properties": {
          "pointId": "pharmacy-s16gdp-a1b2c3",
          "category": "pharmacy",
          "name": "Pharmacie Bonamoussadi",
          ...
        }
      }
    ]
  }
```

### 5.5 Authentication and Authorization Model

```
AUTH MODEL
═══════════

CURRENT (keep):
  - Google OAuth via @auth/core (for admin/team)
  - Email/password via bcrypt (for field agents)
  - Session-based auth with httpOnly cookies

ENHANCEMENT FOR PILOT:

ROLES:
  ┌────────────┬──────────────────────────────────────────────────────┐
  │ Role       │ Permissions                                         │
  ├────────────┼──────────────────────────────────────────────────────┤
  │ agent      │ POST /api/submissions                               │
  │            │ GET  /api/submissions (own data only)                │
  │            │ GET  /api/submissions?offline=true                   │
  │            │ GET  /api/assignments (own assignments)              │
  │            │ PUT  /api/assignments/:id/status                     │
  │            │ GET  /api/leaderboard                                │
  │            │ GET  /api/user (own profile)                         │
  │            │ PUT  /api/user (own profile)                         │
  ├────────────┼──────────────────────────────────────────────────────┤
  │ admin      │ All agent permissions +                              │
  │            │ GET  /api/analytics (all views)                      │
  │            │ GET  /api/submissions (all data)                     │
  │            │ POST /api/admin/assignments                          │
  │            │ GET  /api/admin/review-queue                         │
  │            │ PUT  /api/admin/review-queue/:id                     │
  │            │ POST /api/admin/merge-points                         │
  │            │ GET  /api/admin/agents                               │
  │            │ DELETE /api/submissions/:id                          │
  ├────────────┼──────────────────────────────────────────────────────┤
  │ client     │ GET  /api/data/* (read-only, API key auth)           │
  │            │ Rate limited: 100 requests/minute                   │
  └────────────┴──────────────────────────────────────────────────────┘

CLIENT API KEY AUTH (new):
  For data consumers, implement simple API key authentication:

  Header: X-API-Key: adl_live_xxxxxxxxxxxxxxxxxxxx

  Keys stored in a new table:
  CREATE TABLE api_keys (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    key_hash text NOT NULL UNIQUE,    -- SHA-256 of the key
    client_name text NOT NULL,
    permissions text[] NOT NULL,       -- ['data:read', 'data:export']
    rate_limit_per_minute integer DEFAULT 100,
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now(),
    last_used_at timestamptz
  );
```

---

## 6. Cost and Reliability Tradeoffs

### 6.1 Monthly Infrastructure Costs for Pilot

```
PILOT COST MODEL (10-20 field agents, ~500 POIs, 6 weeks)
═══════════════════════════════════════════════════════════

INFRASTRUCTURE
───────────────────────────────────────────────────────────

Service              Plan          Monthly Cost    Notes
─────────────────────────────────────────────────────────
Vercel               Pro           $20/month       100GB bandwidth,
                                                   serverless functions,
                                                   blob storage (5GB),
                                                   edge config,
                                                   cron jobs,
                                                   analytics

Neon PostgreSQL      Free Tier     $0/month        0.5 GB storage,
                                                   190 compute-hours,
                                                   1 project

Domain (optional)    Vercel        ~$12/year       africandatalayer.com
                                   ($1/month)      or similar

─────────────────────────────────────────────────────────
Infrastructure subtotal:           $20-21/month
─────────────────────────────────────────────────────────

OPERATIONAL
───────────────────────────────────────────────────────────

Service              Plan          Monthly Cost    Notes
─────────────────────────────────────────────────────────
Google Gemini API    Free Tier     $0/month        15 RPM, 1M tokens/day
                     (pay-as-you-go                sufficient for pilot
                      if exceeded)                 search usage

Field agent data     MTN/Orange    ~10,000 XAF     ~200MB/agent/month
                     mobile data   (~$16 USD)      for 20 agents total
                     per agent     total for 20    (ADL should provide
                                                   data bundles)

SMS notifications    (optional)    ~5,000 XAF      For assignment alerts
                                   (~$8 USD)       50 SMS/month

─────────────────────────────────────────────────────────
Operational subtotal:              ~$24-44/month
─────────────────────────────────────────────────────────

TOTAL MONTHLY COST (PILOT):       ~$44-65/month
TOTAL 6-WEEK PILOT COST:          ~$66-98
```

### 6.2 Scaling Cost Curve

```
SCALING MODEL
══════════════

                    PILOT        10x              100x
                    (now)        (6 months)       (2 years)
──────────────────────────────────────────────────────────────
Field agents        10-20        100-200          1,000-2,000
POIs                500          5,000            50,000
Events/month        2,000        20,000           200,000
Photos/month        1,500        15,000           150,000
Photo storage       700 MB       7 GB             70 GB
DB size             100 MB       1 GB             10 GB
API calls/month     50K          500K             5M
Bandwidth/month     5 GB         50 GB            500 GB
──────────────────────────────────────────────────────────────

COST AT EACH SCALE
──────────────────────────────────────────────────────────────

                    PILOT        10x              100x
──────────────────────────────────────────────────────────────
Vercel              $20          $20              $150-300
                    (Pro)        (Pro, still      (Enterprise, or
                                 within limits)   migrate to
                                                  self-hosted)

Neon Postgres       $0           $19              $69-199
                    (Free)       (Launch)         (Scale/Business)

Photo storage       $0           $20-50           $100-300
                    (included    (Vercel Blob     (migrate to
                     in Vercel)  overages or      Cloudflare R2
                                 Cloudflare R2)   or S3)

Agent data          $16          $160             $1,600
                    (20 agents)  (200 agents)     (2,000 agents)

Total infra         $20          $60-90           $320-800
Total w/ ops        $44-65       $250-400         $2,000-4,000
──────────────────────────────────────────────────────────────

KEY INFLECTION POINTS:
  - At ~5,000 POIs: Neon Free Tier runs out of storage -> $19/mo
  - At ~5 GB photos: Vercel Blob limits hit -> add Cloudflare R2
  - At ~100 GB bandwidth: Vercel Pro bandwidth limit -> Enterprise
  - At ~200 agents: consider moving API to self-hosted (Hetzner/Fly.io)
    to control costs and add African-region server

MIGRATION TRIGGERS (from current Vercel-only stack):
  1. If API latency from Cameroon consistently > 2s:
     Add a compute node in EU-West or Africa (Fly.io has JNB region)
  2. If photo storage > 10 GB:
     Migrate to Cloudflare R2 (free egress, $0.015/GB storage)
  3. If monthly Vercel bill > $300:
     Move API to Fly.io or Railway, keep Vercel for frontend CDN
```

### 6.3 Single Points of Failure and Mitigation

```
FAILURE MODE ANALYSIS
══════════════════════

COMPONENT              SPOF?   IMPACT           MITIGATION
──────────────────────────────────────────────────────────────────

Vercel Platform        YES     Total API         - Client-side offline queue
                               outage            absorbs submissions
                                                 - Edge Config fallback for
                                                 reads (already implemented)
                                                 - Vercel has 99.99% SLA
                                                 on Pro plan
                                                 - Status: status.vercel.com

Neon PostgreSQL        YES     No writes,        - Edge Config read fallback
                               degraded reads    (already implemented)
                                                 - StorageUnavailableError
                                                 handling (already in db.ts)
                                                 - Client queue absorbs
                                                 write failures
                                                 - Neon: 99.95% SLA

Vercel Blob Storage    YES     No photo          - Photos staged locally in
                               uploads           IndexedDB until upload
                                                 succeeds
                                                 - Text submissions still
                                                 work without photos
                                                 - Blob has Vercel's SLA

MTN/Orange Network     YES     No sync from      - THIS IS THE #1 RISK
(Cameroon cellular)            field              - Offline-first design
                                                 makes this a delay,
                                                 not a failure
                                                 - Agent can capture all
                                                 day and sync at end of
                                                 day from better location
                                                 - WiFi at team office as
                                                 backup sync point

Power Grid (ENEO)      NO      Phone batteries   - Mid-range Android phones
                               die                have 4000-5000 mAh
                                                 - 8-10 hours active use
                                                 - Portable power banks
                                                 ($5-10) as field kit
                                                 - Data in IndexedDB
                                                 survives restart

Field Agent Phone      NO      Agent loses       - IndexedDB persists across
                               work              app restarts
                                                 - Synced data is on server
                                                 - Unsynced data is at risk
                                                 only if phone is destroyed
                                                 before ever syncing

Admin Single Person    YES     Review queue       - Multiple admins (2-3)
                               blocked           - Auto-approve rules for
                                                 low-risk submissions
                                                 - Confidence score auto-
                                                 publishing (Section 4.4
                                                 of Teammate 2's doc)
```

### 6.4 Disaster Recovery Plan

```
DISASTER RECOVERY
══════════════════

SCENARIO 1: Neon PostgreSQL data loss
  Prevention:
    - Neon provides point-in-time recovery (PITR) on paid plans
    - On Free Tier: no automatic PITR

  Recovery plan (pilot):
    1. Events are the source of truth. All other tables are derived.
    2. Weekly: run pg_dump via Neon console, store in Vercel Blob
    3. If data loss: restore from latest dump
    4. Replay any events from agent offline queues that haven't
       been acknowledged
    5. Re-run snapshot engine to rebuild snapshots/deltas/stats

  Recovery time: 1-4 hours
  Data loss window: up to 7 days (weekly backup) minus any
    events still in agent offline queues

SCENARIO 2: Vercel Blob storage loss (photos)
  Prevention: Vercel Blob is backed by Cloudflare R2 with
    11 nines durability.

  Recovery plan:
    - Photos are evidence, not source data. Loss is painful
      but not catastrophic -- the event data survives.
    - Re-collection of photos can be done on next field visit.
    - For pilot: accept the risk. At scale: replicate to a
      second blob store.

SCENARIO 3: Complete Vercel account compromise
  Prevention:
    - 2FA on Vercel account
    - Separate admin accounts (no shared credentials)
    - Environment variables for all secrets

  Recovery plan:
    1. Restore from git repository (all code is in GitHub)
    2. Re-deploy to new Vercel project
    3. Restore database from Neon backup
    4. Update DNS
    5. Recovery time: 2-4 hours

BACKUP SCHEDULE (PILOT):
  - Database (pg_dump):  Weekly, stored in Vercel Blob
  - Code:                Continuous (GitHub, already in place)
  - Config (.env):       Documented in .env.example (already exists)
  - Photos:              No backup (accept risk for pilot)
```

### 6.5 SLA Targets

```
SLA TARGETS BY COMPONENT
══════════════════════════

Component               Target      Measurement
──────────────────────────────────────────────────────────────
API availability        99.5%       Uptime of /api/health endpoint
                                    (Vercel provides 99.99%, but
                                    Neon free tier may have more
                                    downtime, so target 99.5%)

Submission acceptance   99.9%       % of submissions accepted within
                                    24 hours of creation (including
                                    offline queue retry). NOT
                                    real-time -- offline-first means
                                    eventual consistency.

Photo upload success    95%         % of photos successfully uploaded
                                    within 48 hours of capture.
                                    5% tolerance for persistent
                                    network issues.

Snapshot freshness      < 7 days    Time between snapshot runs.
                                    Weekly cron on Monday 03:00 UTC.
                                    Transport road: < 24 hours
                                    during rainy season.

Admin review response   < 48 hours  Time from flagged submission to
                                    admin decision (approve/reject).

Delta publication       < 24 hours  Time from snapshot run to delta
                                    availability in /api/data/deltas.

Data export             < 5 minutes Time to generate and serve a
                                    full CSV/GeoJSON export.

Client API response     < 3 seconds p95 response time for GET
                                    /api/data/* endpoints.
                                    (Limited by Cameroon network
                                    latency, not server processing.)
```

---

## 7. Technology Choices

### 7.1 Decision Matrix

| Decision | Choice | Alternatives Considered | Why This Fits Cameroon Context |
|---|---|---|---|
| **Hosting** | Vercel (keep) | Fly.io, Railway, Hetzner, AWS | Already deployed; free SSL; global CDN reduces latency from Douala; serverless = no server to manage; generous free/Pro tier for pilot budget |
| **Database** | Neon PostgreSQL (keep) | Supabase, PlanetScale, CockroachDB, Turso | Already in use; free tier covers pilot; serverless scaling; JSONB support critical for flexible event details; familiar SQL |
| **File Storage** | Vercel Blob (keep) | Cloudflare R2, AWS S3, Supabase Storage | Already integrated; CDN-backed; simple API; 5 GB on Pro plan; migrate to R2 at scale for cost savings |
| **Offline Storage** | IndexedDB (keep, enhance) | SQLite (via sql.js), localStorage | Already implemented; 50MB+ capacity on Android Chrome; no native dependency needed; good enough for queue + cache |
| **Frontend Framework** | React 19 + Vite (keep) | Next.js, SvelteKit, Remix | Already built; SPA model works well for PWA; no SSR needed for field app; fast builds with Vite |
| **Maps** | Leaflet (keep) | Mapbox GL JS, Google Maps | Already integrated; free; OpenStreetMap tiles work offline with caching; no API key required |
| **Auth** | @auth/core (keep) | Clerk, Auth0, Supabase Auth | Already implemented; supports Google + email/password; no extra cost; add phone auth later |
| **AI Search** | Google Gemini (keep) | OpenAI, Anthropic, local model | Already integrated; free tier sufficient; server-side only (no client cost) |
| **Monitoring** | Vercel Analytics (keep) + add Sentry (free tier) | Datadog, New Relic | Analytics already integrated; add Sentry for error tracking at $0/month (free 5K events) |
| **Cron** | Vercel Cron (keep) | GitHub Actions, external cron | Already configured; no extra service to manage |

### 7.2 Build vs Buy Decisions

```
BUILD vs BUY ANALYSIS
══════════════════════

FEATURE                  DECISION    RATIONALE
──────────────────────────────────────────────────────────────

Offline queue            BUILD       Already built. Custom queue
                         (keep)      fits event-sourced model perfectly.
                                     No off-the-shelf solution handles
                                     the ADL-specific priority +
                                     bandwidth-aware sync.

Photo compression        BUILD       ~50 lines of canvas API code.
                                     No library needed. Ship faster.

Sync engine              BUILD       Already built. The adaptive
                         (enhance)   bandwidth layer is ~200 lines.
                                     Libraries like Workbox don't
                                     fit the custom sync priority model.

Snapshot engine          BUILD       Already built. Core business logic.
                         (keep)      No off-the-shelf delta computation
                                     exists for this data model.

Fraud detection          BUILD       Already built. Domain-specific
                         (keep)      (EXIF + haversine + IP).

Auth                     BUY         @auth/core is already integrated.
                         (keep)      Building auth from scratch is a
                                     security risk for no benefit.

Maps + tiles             BUY         Leaflet + OSM tiles. Free, proven,
                         (keep)      offline-cacheable.

Database                 BUY         Neon PostgreSQL. No reason to
                         (keep)      self-host for pilot.

Hosting                  BUY         Vercel. No reason to manage
                         (keep)      infrastructure for pilot.

Error monitoring         BUY         Add Sentry free tier. 5 minutes
                         (add)       to integrate, massive debugging
                                     value for field issues.

Push notifications       DEFER       Not needed for pilot. Agents
                                     check app manually. Add Firebase
                                     Cloud Messaging later if needed.

Real-time updates        DEFER       Not needed for pilot. Weekly
(WebSocket/SSE)                      snapshots are sufficient. Add
                                     Supabase Realtime or Pusher
                                     if daily road updates require
                                     push to admin dashboard.
```

### 7.3 Migration Path from Current Stack

```
MIGRATION ROADMAP
══════════════════

The current stack requires NO migration for the pilot. All recommendations
extend the existing system. Here is the change inventory:

PHASE 1: PILOT PREP (Week -2 to Week 0)
─────────────────────────────────────────
Changes to existing code:

1. lib/client/offlineQueue.ts
   - Add priority field to QueueItem
   - Add photo staging store (new IndexedDB object store)
   - Add local_poi_cache store
   - Upgrade DB_VERSION from 2 to 3

2. lib/client/submissionSync.ts
   - Add bandwidth measurement (Navigator.connection + HEAD probe)
   - Add priority-based sync filtering
   - Add separate text/photo upload paths

3. New file: lib/client/poiCache.ts
   - Download and cache POIs from GET /api/submissions?offline=true
   - LRU eviction
   - Max-age 24 hours

4. New file: lib/client/syncStatus.ts
   - Observable sync state for UI
   - Connection quality indicator
   - Data usage tracking

5. api/submissions/index.ts
   - Add offline=true query param handler
   - Add content_hash dedup
   - Add admin review flag logic

6. New files: api/admin/*.ts
   - Assignment management endpoints
   - Review queue endpoints
   - Agent performance endpoints

7. New files: api/data/*.ts
   - Delta feed endpoint
   - Export endpoint (CSV, GeoJSON)
   - Client API key auth middleware

8. supabase/migrations/
   - Add collection_assignments table
   - Add api_keys table
   - Add content_hash column to point_events
   - Add is_baseline column to snapshot_stats
   - Add monthly_stats table

9. vercel.json
   - Add daily cron for transport_road (rainy season)
   - Add monthly cron for monthly_stats
   - Add cache headers for API routes

10. package.json
    - Add @sentry/browser (error tracking)
    - No other new dependencies needed


PHASE 2: PILOT (Weeks 1-6)
───────────────────────────
No infrastructure changes during pilot. Focus on:
  - Monitoring sync success rates
  - Adjusting compression quality if photos too large
  - Adjusting backoff timers based on Cameroon network reality
  - Manual weekly database backups (pg_dump)

PHASE 3: POST-PILOT SCALING (if pilot succeeds)
─────────────────────────────────────────────────
Conditional on pilot results:

  IF photo storage > 5 GB:
    Migrate to Cloudflare R2 ($0.015/GB/month, free egress)

  IF API latency from Cameroon consistently > 2s:
    Deploy API to Fly.io EU-West or JNB region
    Keep Vercel for frontend CDN

  IF database > 0.5 GB:
    Upgrade Neon to Launch plan ($19/month)
    Enable PITR for disaster recovery

  IF > 50 field agents:
    Consider native Android app (React Native or Capacitor)
    for better camera/GPS/battery control

  IF real-time road updates needed:
    Add WebSocket layer (Supabase Realtime or Pusher)
    for push notifications to admin dashboard
```

### 7.4 Why Not a Native Mobile App?

```
PWA vs NATIVE APP DECISION
════════════════════════════

Decision: Stay with PWA (Progressive Web App) for pilot.

FACTOR              PWA (current)                  NATIVE (future)
──────────────────────────────────────────────────────────────────
Development cost    $0 (already built)             $10,000-30,000
Time to market      0 weeks (done)                 8-12 weeks
Update deployment   Instant (Vercel deploy)        Play Store review (days)
Offline support     IndexedDB (sufficient)         SQLite (more powerful)
Camera access       Good (MediaDevices API)        Excellent (full control)
GPS accuracy        Good (Geolocation API)         Excellent (raw GNSS)
Battery control     Limited                        Full (JobScheduler)
Background sync     Service Worker (limited)       WorkManager (robust)
File size limit     ~50 MB (IndexedDB)             Unlimited (filesystem)
Install friction    "Add to Home Screen" prompt    Play Store install
Agent familiarity   Opens in Chrome (familiar)     New app (training)
──────────────────────────────────────────────────────────────────

Verdict: PWA is sufficient for 500 POIs and 20 agents. The main
limitations (background sync, battery control) are manageable
with the adaptive sync engine described in Section 4. Switch to
native (React Native + Expo) only if pilot reveals:
  - Background sync failures > 10% of submissions
  - Battery drain complaints from agents
  - Photo quality issues requiring raw camera control
  - Need for > 50 MB local storage per agent
```

---

## Summary: Architecture Decision Records

| ADR | Decision | Status |
|---|---|---|
| ADR-001 | Keep Vercel as hosting platform | Confirmed |
| ADR-002 | Keep Neon PostgreSQL as primary database | Confirmed |
| ADR-003 | Keep Vercel Blob for photo storage | Confirmed |
| ADR-004 | Enhance IndexedDB offline queue (not replace) | New |
| ADR-005 | Add client-side photo compression pipeline | New |
| ADR-006 | Add bandwidth-aware sync with priority levels | New |
| ADR-007 | Add local POI cache for offline map display | New |
| ADR-008 | Add content-hash deduplication on server | New |
| ADR-009 | Add API key auth for data consumer endpoints | New |
| ADR-010 | Add Sentry for error monitoring | New |
| ADR-011 | Stay with PWA (defer native app) | Confirmed |
| ADR-012 | Add daily cron for transport_road during rainy season | New |
| ADR-013 | Weekly pg_dump backup to Vercel Blob | New |
| ADR-014 | Migrate to Cloudflare R2 at > 5 GB photos | Deferred |
| ADR-015 | Migrate API to Fly.io at > $300/month Vercel bill | Deferred |

**Total new dependencies:** 1 (@sentry/browser)
**Total new API routes:** 11
**Total new database tables:** 2 (api_keys, monthly_stats) + 2 columns
**Total new IndexedDB stores:** 4
**Estimated implementation effort:** 3-4 developer-weeks
**Monthly infrastructure cost (pilot):** $20-65

---

## Sources and References

- Vercel Pro pricing: https://vercel.com/pricing
- Neon PostgreSQL pricing: https://neon.tech/pricing
- Cloudflare R2 pricing: https://developers.cloudflare.com/r2/pricing/
- Cameroon mobile data pricing: MTN Cameroon and Orange Cameroon rate cards
- Navigator.connection API: https://developer.mozilla.org/en-US/docs/Web/API/NetworkInformation
- IndexedDB storage limits: https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria
- Vercel Blob documentation: https://vercel.com/docs/storage/vercel-blob
- Neon PITR documentation: https://neon.tech/docs/introduction/point-in-time-restore
- Sentry JavaScript SDK: https://docs.sentry.io/platforms/javascript/
- Fly.io regions (including JNB): https://fly.io/docs/reference/regions/
