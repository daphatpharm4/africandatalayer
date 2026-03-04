# ADL System Design: End-to-End Data Collection Workflow
## Bonamoussadi, Douala, Cameroon

**Teammate 2 -- System Design Expert Deliverable**
**Date:** March 2026

---

## Table of Contents

1. [Unified Data Model](#1-unified-data-model)
2. [Entity ID Strategy](#2-entity-id-strategy)
3. [Baseline vs Snapshot Logic](#3-baseline-vs-snapshot-logic)
4. [Delta Computation Rules](#4-delta-computation-rules)
5. [Collection Workflow](#5-collection-workflow)
6. [Data Quality Scoring](#6-data-quality-scoring)

---

## Existing System Context

Before proposing new designs, this document acknowledges what is already built and working. The current MVP includes:

- **Event-sourced data model:** `point_events` table with `CREATE_EVENT` / `ENRICH_EVENT` types
- **Point projection engine:** Events are folded into `ProjectedPoint` objects via `projectPointsFromEvents()`
- **Snapshot/delta system:** Weekly snapshots frozen to `snapshots` table, deltas computed between consecutive snapshots, stats with z-score anomaly detection
- **Fraud detection:** EXIF GPS extraction, haversine distance checks, IP geolocation cross-referencing
- **Six active verticals:** `pharmacy`, `fuel_station`, `mobile_money`, `alcohol_outlet`, `retail_kiosk`, `billboard`
- **Geofencing:** Bonamoussadi bounding box (4.0755-4.0999 N, 9.7185-9.7602 E)
- **Offline queue:** Client-side submission queuing with sync
- **Seed data:** OSM Overpass imports with external ID tracking

The designs below extend this foundation to cover the full seven verticals (adding `transport_road` and `census_proxy`, replacing `retail_kiosk` as a standalone vertical), define precise schemas, and formalize the collection workflows needed for the Bonamoussadi pilot.

---

## 1. Unified Data Model

### 1.1 Design Philosophy

The existing `point_events` table uses a `details JSONB` column for vertical-specific fields. This is the correct pattern for ADL's stage -- it allows rapid vertical addition without schema migrations. The design below formalizes the structure inside that JSONB while keeping the flexible storage layer.

The model follows three principles:
1. **Core fields live in typed columns** (enforced at the database level)
2. **Vertical-specific fields live in JSONB** (enforced at the application level via `normalizeDetails`)
3. **Relationships are expressed through point IDs and spatial proximity** (not foreign keys between entities)

### 1.2 Core Entity Schema (All Verticals)

This extends the existing `point_events` and `snapshots` tables. No migration needed for the event table itself -- the category CHECK constraint is the only change.

```sql
-- Migration: extend category constraint to include all 7 target verticals
ALTER TABLE point_events DROP CONSTRAINT IF EXISTS point_events_category_check;
ALTER TABLE point_events ADD CONSTRAINT point_events_category_check
  CHECK (category IN (
    'pharmacy',
    'fuel_station',
    'mobile_money',
    'alcohol_outlet',
    'billboard',
    'transport_road',
    'census_proxy'
  ));
```

The universal entity fields (stored as typed columns in `point_events`):

```
point_events
├── id              uuid        PRIMARY KEY     -- event UUID
├── point_id        text        NOT NULL        -- entity identifier (see Section 2)
├── event_type      text        NOT NULL        -- 'CREATE_EVENT' | 'ENRICH_EVENT'
├── user_id         text        NOT NULL        -- contributor ID
├── category        text        NOT NULL        -- vertical ID
├── latitude        float8      NOT NULL        -- WGS84
├── longitude       float8      NOT NULL        -- WGS84
├── details         jsonb       NOT NULL        -- vertical-specific payload
├── photo_url       text                        -- primary evidence photo
├── created_at      timestamptz NOT NULL        -- event timestamp
├── source          text                        -- 'field_agent' | 'osm_overpass' | 'seed_import' | 'csv_import'
└── external_id     text                        -- dedup key for imports (e.g., 'osm_overpass:4382447689')
```

The projected entity (computed from events, stored in `snapshots` during weekly runs):

```
ProjectedPoint (TypeScript interface -- already exists)
├── id              string          -- same as pointId
├── pointId         string          -- stable entity ID
├── category        SubmissionCategory
├── location        { latitude, longitude }
├── details         SubmissionDetails   -- merged from all events
├── photoUrl        string | undefined
├── createdAt       string          -- first event timestamp
├── updatedAt       string          -- most recent event timestamp
├── source          string | undefined
├── externalId      string | undefined
├── gaps            string[]        -- missing enrichable fields
├── eventsCount     number          -- total events contributing
└── eventIds        string[]        -- all event UUIDs
```

### 1.3 Universal Details Fields (Inside JSONB)

These fields are valid for every vertical and are extracted/normalized by the base `identityNormalize` function:

```typescript
// Universal fields within details JSONB
interface UniversalDetails {
  name?: string;                    // Entity display name
  siteName?: string;                // Alias for name (legacy compat)
  openingHours?: string;            // Human-readable hours, e.g. "08:00-20:00"
  phone?: string;                   // Contact phone (E.164 format)
  brand?: string;                   // Brand affiliation
  operator?: string;                // Operating company
  website?: string;                 // URL

  // Metadata (set by system, not by field agent)
  confidenceScore?: number;         // 0-100, computed (see Section 6)
  lastSeenAt?: string;              // ISO date of last field verification
  source?: string;                  // Data provenance
  externalId?: string;              // External system reference
  isImported?: boolean;             // True if from bulk import

  // Evidence tracking
  hasPhoto?: boolean;
  hasSecondaryPhoto?: boolean;
  secondPhotoUrl?: string;

  // Fraud metadata (set by system)
  fraudCheck?: SubmissionFraudCheck;
  clientDevice?: ClientDeviceInfo;
}
```

### 1.4 Vertical-Specific Extension Fields

Each vertical defines its own extension of the details JSONB. Below are the exact field definitions per vertical.

#### Pharmacy

```typescript
interface PharmacyDetails extends UniversalDetails {
  isOpenNow?: boolean;              // Currently open for business
  isOnDuty?: boolean;               // Is "pharmacie de garde" (on-duty rotation)
  availability?: string;            // Free text: "in-stock", "out of stock", etc.
  isLicensed?: boolean;             // Has visible pharmacy license
  licenseNumber?: string;           // If visible on signage
  hasPrescriptionService?: boolean; // Accepts prescriptions
  isFormal?: boolean;               // true = licensed pharmacy, false = informal vendor
  medicineCategories?: string[];    // ['antibiotics', 'antimalarials', 'painkillers']
}
```

Vertical config update:
```typescript
{
  enrichableFields: ["openingHours", "isOpenNow", "isOnDuty", "isLicensed",
                     "hasPrescriptionService", "medicineCategories"],
  createRequiredFields: ["name", "isOpenNow"],
}
```

#### Fuel Station

```typescript
interface FuelStationDetails extends UniversalDetails {
  hasFuelAvailable?: boolean;       // Currently has fuel in stock
  fuelTypes?: string[];             // ['super', 'diesel', 'gas']
  pricesByFuel?: Record<string, number>;  // { "super": 840, "diesel": 780 }
  fuelPrice?: number;               // Legacy single-price field
  quality?: string;                 // 'good' | 'mixed' | 'poor'
  queueLength?: string;             // 'none' | 'short' | 'long'
  paymentMethods?: string[];        // ['cash', 'mobile_money']
  hasConvenienceStore?: boolean;
  hasCarWash?: boolean;
  hasATM?: boolean;
  hasMobileMoney?: boolean;         // Co-located mobile money agent
  isFormal?: boolean;               // true = branded station, false = jerry can vendor
}
```

Vertical config update:
```typescript
{
  enrichableFields: ["fuelTypes", "pricesByFuel", "quality", "paymentMethods",
                     "openingHours", "hasFuelAvailable", "queueLength",
                     "hasConvenienceStore", "hasCarWash", "hasATM"],
  createRequiredFields: ["name", "hasFuelAvailable"],
}
```

#### Mobile Money

```typescript
interface MobileMoneyDetails extends UniversalDetails {
  providers?: string[];             // ['MTN', 'Orange']
  hasMin50000XafAvailable?: boolean; // Can service 50,000 XAF transactions
  merchantId?: string;              // Legacy single-merchant field
  merchantIdByProvider?: Record<string, string>; // { "MTN": "123456", "Orange": "789012" }
  paymentMethods?: string[];        // ['cash']
  paymentModes?: string[];          // ['cash_in', 'cash_out', 'transfer']
  isActive?: boolean;               // Actively transacting (vs branded but dormant)
  isFormal?: boolean;               // Has operator-issued signage/branding
  hasFloat?: boolean;               // Has sufficient float for transactions
  agentType?: string;               // 'exclusive' | 'multi_operator' | 'merchant_point'
}
```

Vertical config (existing, extended):
```typescript
{
  enrichableFields: ["merchantIdByProvider", "paymentMethods", "openingHours",
                     "providers", "isActive", "hasFloat", "agentType"],
  createRequiredFields: ["providers"],
}
```

#### Alcohol Outlet

```typescript
interface AlcoholOutletDetails extends UniversalDetails {
  outletType?: string;              // 'bar' | 'restaurant' | 'off_licence' | 'street_vendor' | 'nightclub'
  isFormal?: boolean;               // Has visible business license
  servesFood?: boolean;
  hasSeating?: boolean;             // Indoor/outdoor seating available
  brandsAvailable?: string[];       // ['33 Export', 'Castel', 'Beaufort']
  priceRange?: string;              // 'low' | 'medium' | 'high'
  operatingPeriod?: string;         // 'day_only' | 'evening_only' | 'day_and_evening' | 'night_only'
  paymentMethods?: string[];
}
```

Vertical config update:
```typescript
{
  enrichableFields: ["brand", "openingHours", "paymentMethods", "outletType",
                     "isFormal", "servesFood", "brandsAvailable", "priceRange"],
  createRequiredFields: ["name"],
}
```

#### Billboard

```typescript
interface BillboardDetails extends UniversalDetails {
  billboardType?: string;           // 'standard' | 'digital' | 'street_furniture' | 'wall_paint' | 'poster' | 'informal'
  size?: string;                    // 'small' | 'medium' | 'large' | 'mega'
  isOccupied?: boolean;             // Has active advertising content
  advertiserBrand?: string;         // Brand currently displayed
  advertiserCategory?: string;      // 'telecom' | 'beer' | 'banking' | 'fmcg' | 'political' | 'other'
  condition?: string;               // 'good' | 'damaged' | 'destroyed'
  isLit?: boolean;                  // Has lighting (illuminated at night)
  isFormal?: boolean;               // Licensed billboard vs informal signage
  facing?: string;                  // Compass direction: 'N' | 'NE' | 'E' | etc.
}
```

Vertical config:
```typescript
{
  enrichableFields: ["brand", "billboardType", "isOccupied", "advertiserBrand",
                     "advertiserCategory", "condition", "size", "isLit"],
  createRequiredFields: ["name"],
}
```

#### Transport Road (New Vertical)

```typescript
interface TransportRoadDetails extends UniversalDetails {
  roadName?: string;                // Local name of road/segment
  segmentType?: string;             // 'primary' | 'secondary' | 'tertiary' | 'alley' | 'footpath'
  surfaceType?: string;             // 'asphalt' | 'laterite' | 'gravel' | 'earth' | 'concrete'
  condition?: string;               // 'good' | 'fair' | 'poor' | 'impassable'
  isBlocked?: boolean;              // Currently blocked/impassable
  blockageType?: string;            // 'flooding' | 'construction' | 'accident' | 'debris' | 'market_encroachment'
  blockageSeverity?: string;        // 'partial' | 'full'
  passableBy?: string[];            // ['pedestrian', 'moto', 'car', 'truck']
  hasStreetLight?: boolean;
  hasSidewalk?: boolean;
  trafficLevel?: string;            // 'low' | 'medium' | 'high' | 'gridlock'
  estimatedWidth?: string;          // 'single_lane' | 'two_lane' | 'multi_lane'
  floodRisk?: string;               // 'none' | 'low' | 'moderate' | 'high' (based on observation + season)
}
```

Vertical config:
```typescript
{
  id: "transport_road",
  labelEn: "Road Segment",
  labelFr: "Segment routier",
  pluralEn: "Road Segments",
  pluralFr: "Segments routiers",
  icon: "route",
  color: "#718096",
  bgColor: "#edf2f7",
  enrichableFields: ["condition", "isBlocked", "blockageType", "surfaceType",
                     "passableBy", "trafficLevel", "hasStreetLight"],
  createRequiredFields: ["roadName", "condition"],
  normalizeDetails: normalizeTransportRoad,
}
```

#### Census Proxy (New Vertical)

```typescript
interface CensusProxyDetails extends UniversalDetails {
  buildingType?: string;            // 'residential' | 'commercial' | 'mixed' | 'industrial' | 'institutional' | 'religious'
  storeyCount?: number;             // Number of floors
  occupancyStatus?: string;         // 'occupied' | 'partially_occupied' | 'vacant' | 'under_construction'
  estimatedUnits?: number;          // Estimated residential units or commercial spaces
  hasElectricity?: boolean;         // Visible power connection
  hasWater?: boolean;               // Visible water tank or piped water
  constructionMaterial?: string;    // 'concrete' | 'brick' | 'wood' | 'metal_sheet' | 'mixed'
  roofMaterial?: string;            // 'metal_sheet' | 'concrete' | 'tile' | 'thatch'
  hasCommercialGround?: boolean;    // Ground floor is commercial
  commercialTypes?: string[];       // Types of businesses on ground floor
  nearbyInfrastructure?: string[];  // ['school', 'clinic', 'market', 'church', 'mosque']
}
```

Vertical config:
```typescript
{
  id: "census_proxy",
  labelEn: "Building / Census Point",
  labelFr: "Batiment / Point de recensement",
  pluralEn: "Buildings",
  pluralFr: "Batiments",
  icon: "building-2",
  color: "#4a5568",
  bgColor: "#e2e8f0",
  enrichableFields: ["occupancyStatus", "storeyCount", "estimatedUnits",
                     "hasElectricity", "constructionMaterial", "hasCommercialGround"],
  createRequiredFields: ["buildingType", "occupancyStatus"],
  normalizeDetails: normalizeCensusProxy,
}
```

### 1.5 Relationship Model Between Entities

Entities are not linked by foreign keys. Instead, relationships are expressed through:

```
RELATIONSHIP MODEL
==================

1. SPATIAL PROXIMITY (implicit)
   - Entities within 25m of each other are "co-located"
   - Used for: fuel station + mobile money agent, building + ground-floor businesses
   - Computed at query time via haversine distance

2. SAME-POINT ENRICHMENT (explicit, already implemented)
   - Multiple events with the same point_id form one projected entity
   - ENRICH_EVENT adds data to a CREATE_EVENT

3. CROSS-VERTICAL REFERENCE (new, via details JSONB)
   - A census_proxy building can reference its ground-floor businesses:
     details.relatedPointIds = ["point-id-of-pharmacy", "point-id-of-bar"]
   - A fuel_station can reference a co-located mobile_money agent:
     details.coLocatedPointIds = ["point-id-of-momo-kiosk"]
   - These are advisory references, not enforced foreign keys

4. ROAD SEGMENT ADJACENCY (new, for transport_road)
   - Road segments reference connected segments:
     details.connectedSegmentIds = ["point-id-segment-north", "point-id-segment-south"]
   - Enables basic graph traversal for route analysis
```

```
                    ┌─────────────────────┐
                    │   census_proxy      │
                    │   (building)        │
                    │                     │
                    │ relatedPointIds: [  │
                    │   "pharmacy-123",   │
                    │   "momo-456"        │
                    │ ]                   │
                    └──────┬──────────────┘
                           │ spatial proximity
                    ┌──────┴──────────────┐
              ┌─────┤  Ground Floor       ├─────┐
              │     └─────────────────────┘     │
     ┌────────▼──────┐              ┌───────────▼────┐
     │  pharmacy      │              │  mobile_money   │
     │  "pharmacy-123"│              │  "momo-456"     │
     └────────────────┘              └─────────────────┘

     ┌────────────────┐    connectedSegmentIds    ┌────────────────┐
     │ transport_road  │◄────────────────────────►│ transport_road  │
     │ segment-A       │                          │ segment-B       │
     └────────────────┘                          └────────────────┘
```

### 1.6 Complete Schema Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         point_events (immutable log)                    │
│                                                                         │
│  id (uuid PK) | point_id | event_type | user_id | category            │
│  latitude | longitude | details (jsonb) | photo_url | created_at       │
│  source | external_id                                                   │
│                                                                         │
│  Indexes: created_at DESC, (point_id, created_at DESC),                │
│           (user_id, created_at DESC), external_id                      │
└──────────────────────────────┬──────────────────────────────────────────┘
                               │
                               │ projectPointsFromEvents()
                               ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    ProjectedPoint (in-memory, computed)                  │
│                                                                         │
│  Merged view of all events for a given point_id.                       │
│  Latest event wins for scalar fields; arrays/objects deep-merge.       │
└──────────────────────────────┬──────────────────────────────────────────┘
                               │
                               │ runWeeklySnapshot()
                               ▼
┌──────────────────────────────────────────────────────────────┐
│                  snapshots (frozen weekly state)              │
│                                                              │
│  id | snapshot_date | vertical_id | point_id | category     │
│  site_name | latitude | longitude | details | gaps          │
│  events_count | photo_url | source | external_id            │
│                                                              │
│  UNIQUE(snapshot_date, point_id)                             │
└──────────────────────────────┬───────────────────────────────┘
                               │
                               │ computeDeltas()
                               ▼
┌──────────────────────────────────────────────────────────────┐
│              snapshot_deltas (change records)                 │
│                                                              │
│  id | snapshot_date | baseline_snapshot_date | vertical_id   │
│  point_id | delta_type | delta_field                         │
│  previous_value | current_value | delta_magnitude            │
│  delta_direction | delta_summary                             │
└──────────────────────────────┬───────────────────────────────┘
                               │
                               │ aggregate per vertical
                               ▼
┌──────────────────────────────────────────────────────────────┐
│           snapshot_stats (vertical-level aggregates)          │
│                                                              │
│  id | snapshot_date | vertical_id | total_points             │
│  completed_points | completion_rate | new_count              │
│  removed_count | changed_count | unchanged_count             │
│  avg_price | week_over_week_growth | moving_avg_4w           │
│  z_score_total_points | z_score_new_count                    │
│  z_score_removed_count | anomaly_flags                       │
│                                                              │
│  UNIQUE(snapshot_date, vertical_id)                          │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│                user_profiles (contributor accounts)           │
│                                                              │
│  id (text PK) | email | name | phone | image | occupation   │
│  xp | password_hash | is_admin | map_scope                  │
│  created_at | updated_at                                     │
└──────────────────────────────────────────────────────────────┘
```

### 1.7 New Table: Collection Assignments

To support the field workflow described in Section 5, add an assignments table:

```sql
CREATE TABLE IF NOT EXISTS collection_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_user_id text NOT NULL REFERENCES user_profiles(id),
  zone_id text NOT NULL,                    -- e.g., 'bona-zone-A', 'bona-zone-B'
  zone_label text NOT NULL,                 -- Human-readable zone name
  zone_bounds jsonb NOT NULL,               -- { south, west, north, east }
  assigned_verticals text[] NOT NULL,       -- ['pharmacy', 'mobile_money']
  assigned_date date NOT NULL DEFAULT CURRENT_DATE,
  due_date date NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'in_progress', 'completed', 'expired')),
  points_expected integer NOT NULL DEFAULT 0,
  points_submitted integer NOT NULL DEFAULT 0,
  completion_rate numeric GENERATED ALWAYS AS (
    CASE WHEN points_expected > 0
      THEN ROUND((points_submitted::numeric / points_expected) * 100, 1)
      ELSE 0
    END
  ) STORED,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_assignments_agent_status
  ON collection_assignments (agent_user_id, status);
CREATE INDEX IF NOT EXISTS idx_assignments_zone_date
  ON collection_assignments (zone_id, assigned_date DESC);
```

---

## 2. Entity ID Strategy

### 2.1 ID Generation Scheme

The current system uses two ID patterns:
- **Event IDs:** `crypto.randomUUID()` -- random UUIDs (correct for immutable event log)
- **Point IDs:** Either `crypto.randomUUID()` for field-created entities OR `seed-point-osm-overpass-{osmId}` for imported entities

The proposed strategy formalizes this into a **composite, deterministic-when-possible** approach:

```
POINT ID GENERATION RULES
==========================

1. IMPORTED ENTITIES (from external sources)
   Format: "ext-{source}-{externalId}"
   Examples:
     ext-osm-4382447689
     ext-google-ChIJ...
     ext-csv-row-042

   Rationale: Deterministic. Same external entity always produces
   same point_id, enabling dedup across import runs.

2. FIELD-CREATED ENTITIES (new entities discovered by agents)
   Format: "{category}-{geohash6}-{shortUuid}"
   Examples:
     pharmacy-s16gdp-a1b2c3d4
     mobile_money-s16gdq-e5f6g7h8

   Where:
     - category = vertical ID
     - geohash6 = 6-character geohash of GPS coordinates (~1.2km precision)
     - shortUuid = first 8 characters of a UUIDv4

   Rationale: Partially deterministic (category + location encoded),
   but with random suffix to avoid collision. The geohash enables
   spatial clustering of IDs for dedup candidates.

3. LEGACY COMPATIBILITY
   Existing point_ids (seed-point-*, random UUIDs) remain valid.
   The system must accept any non-empty string as a point_id.
```

Implementation (extending existing `identifier.ts`):

```typescript
import { encode as geohashEncode } from "ngeohash";

export function generatePointId(
  category: string,
  latitude: number,
  longitude: number,
): string {
  const geohash = geohashEncode(latitude, longitude, 6);
  const shortUuid = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  return `${category}-${geohash}-${shortUuid}`;
}

export function generateImportPointId(source: string, externalId: string): string {
  return `ext-${source}-${externalId}`;
}

// Extract geohash from a field-created point ID (for spatial dedup)
export function extractGeohash(pointId: string): string | null {
  const parts = pointId.split("-");
  if (parts.length < 3) return null;
  const geohash = parts[parts.length - 2];
  if (!geohash || geohash.length !== 6) return null;
  return geohash;
}
```

### 2.2 Handling Informal Businesses With No Official ID

Informal businesses (unlicensed bars, street vendors, mobile money kiosks without signage) are the hardest to identify. The strategy:

```
INFORMAL ENTITY IDENTIFICATION
================================

Problem: An informal alcohol vendor at a street corner has no name,
no license, no signage. How do we create a stable identity?

Solution: LOCATION + CATEGORY + DESCRIPTORS = identity

1. The point_id is generated from GPS + category + random suffix
   (as above). The GPS coordinates ARE the primary identifier.

2. The "name" field for informal entities uses a descriptive pattern:
   "[Category] near [landmark]"
   Examples:
     "Informal bar near Carrefour Bonamoussadi"
     "Mobile money agent opposite Pharmacie Makepe"
     "Fuel vendor (jerry cans) at Bonamoussadi junction"

3. The isFormal field (present on all business verticals) is set to false.

4. Photo evidence is the primary verification. The photo of the
   location serves as a fingerprint for the entity.

5. For subsequent visits, agents find existing entities via:
   a. Map-based proximity search (see entities within 25m)
   b. Visual matching against stored photos
   c. Descriptive name matching
```

### 2.3 Deduplication Strategy

Deduplication operates at three levels:

```
DEDUP LEVEL 1: IMPORT-TIME (before insertion)
=============================================
- Check external_id against existing events:
  SELECT 1 FROM point_events WHERE external_id = $1 LIMIT 1
- If match found, skip import (already implemented in buildCombinedEvents)
- This prevents OSM re-imports from creating duplicate entities

DEDUP LEVEL 2: SUBMISSION-TIME (before creating new point)
==========================================================
When a field agent submits a CREATE_EVENT:

1. Compute candidate radius: 25m for most verticals, 50m for transport_road
2. Find existing projected points within radius AND same category:

   SELECT point_id, site_name, latitude, longitude
   FROM snapshots
   WHERE snapshot_date = (SELECT MAX(snapshot_date) FROM snapshots)
     AND category = $1
     AND earth_distance(
       ll_to_earth(latitude, longitude),
       ll_to_earth($2, $3)
     ) < $4

3. If candidates found:
   a. Score each candidate using name similarity (Levenshtein) + distance
   b. If best score > 0.7 similarity AND < 25m distance:
      - Prompt agent: "This looks like [existing entity name]. Enrich it?"
      - If agent confirms: convert to ENRICH_EVENT for that point_id
      - If agent says "No, this is different": create new entity

DEDUP LEVEL 3: ADMIN REVIEW (post-submission)
==============================================
Admin queue includes a "potential duplicates" flag:
- System identifies pairs of points with same category, < 50m apart
- Admin can merge: all events from point B re-assigned to point A
- Merge is a new event_type: 'MERGE_EVENT' (point B -> point A)
```

```
DEDUP FLOW DIAGRAM

  Agent submits CREATE_EVENT
          │
          ▼
  ┌───────────────────┐
  │ Check external_id │──── match found ────► SKIP (already exists)
  └───────┬───────────┘
          │ no match
          ▼
  ┌───────────────────┐
  │ Spatial search     │
  │ same category      │
  │ within 25m radius  │
  └───────┬───────────┘
          │
    ┌─────┴─────┐
    │           │
  no match    candidates found
    │           │
    ▼           ▼
  CREATE    ┌─────────────────┐
  new       │ Show to agent:  │
  entity    │ "Is this the    │
            │  same as X?"    │
            └───┬─────────┬───┘
                │         │
              "Yes"     "No"
                │         │
                ▼         ▼
            ENRICH     CREATE
            existing   new entity
            entity
```

### 2.4 Entity Lifecycle

```
ENTITY STATE MACHINE
=====================

  ┌──────────┐   first CREATE_EVENT    ┌──────────┐
  │          │─────────────────────────►│          │
  │ (none)   │                          │  ACTIVE  │
  │          │                          │          │
  └──────────┘                          └────┬─────┘
                                             │
                              ┌──────────────┼──────────────┐
                              │              │              │
                        ENRICH_EVENT    no events for    CLOSE_EVENT
                        (updates data)  N weeks          (explicit)
                              │              │              │
                              ▼              ▼              ▼
                         ┌──────────┐  ┌──────────┐  ┌──────────┐
                         │  ACTIVE  │  │ DORMANT  │  │  CLOSED  │
                         │(enriched)│  │          │  │          │
                         └──────────┘  └────┬─────┘  └──────────┘
                                            │
                                    agent re-verifies
                                    (new ENRICH_EVENT)
                                            │
                                            ▼
                                       ┌──────────┐
                                       │  ACTIVE  │
                                       │(revived) │
                                       └──────────┘

State Determination Rules (computed, not stored):
- ACTIVE:  Has events within the last 8 weeks
- DORMANT: Last event is 8-16 weeks old, no CLOSE_EVENT
- CLOSED:  Has a CLOSE_EVENT, or last event > 16 weeks old
           and not re-verified

The system does NOT store lifecycle state as a column.
It is computed from the event timeline during projection.
```

Implementation logic for the projection engine:

```typescript
type EntityLifecycle = "active" | "dormant" | "closed";

const DORMANT_THRESHOLD_WEEKS = 8;
const CLOSED_THRESHOLD_WEEKS = 16;

function computeLifecycle(point: ProjectedPoint, referenceDate: Date): EntityLifecycle {
  const lastEvent = new Date(point.updatedAt);
  const weeksSinceLastEvent = (referenceDate.getTime() - lastEvent.getTime())
    / (7 * 24 * 60 * 60 * 1000);

  // Check for explicit close event (stored in details)
  if (point.details.isClosed === true) return "closed";

  if (weeksSinceLastEvent > CLOSED_THRESHOLD_WEEKS) return "closed";
  if (weeksSinceLastEvent > DORMANT_THRESHOLD_WEEKS) return "dormant";
  return "active";
}
```

---

## 3. Baseline vs Snapshot Logic

### 3.1 Terminology

```
DEFINITIONS
============

BASELINE:   The first complete survey of a zone for a given vertical.
            All known entities are captured. This establishes the
            "ground truth" against which future changes are measured.

SNAPSHOT:   A periodic capture of current state. May be full (all
            entities revisited) or partial (subset visited).

DELTA:      The computed difference between two snapshots. Already
            implemented in snapshotEngine.ts.

ZONE:       A geofenced area. Currently Bonamoussadi is one zone.
            Sub-zones (A, B, Makepe) will be defined for route planning.
```

### 3.2 Baseline Capture Process

The baseline is the first `runWeeklySnapshot()` that meets the completeness threshold:

```
BASELINE QUALIFICATION CRITERIA
================================

A snapshot qualifies as "baseline" for a vertical if:

1. Coverage: >= 80% of estimated entities have been captured
   (estimate comes from Teammate 1's field capture scope)

2. Completeness: >= 60% of captured entities have zero gaps
   (all enrichable fields filled)

3. Photo evidence: >= 90% of captured entities have a primary photo

4. Zone coverage: Every sub-zone has at least 1 captured entity
   (prevents clustering all captures in one corner)

Estimated entities per vertical (from Teammate 1 analysis):
  transport_road:   50-80  road segments
  mobile_money:    100-200 agent points
  pharmacy:         10-15  formal + 20-40 informal = 30-55
  fuel_station:      5-10  stations
  alcohol_outlet:   80-150 points of sale
  billboard:        30-60  billboard locations
  census_proxy:    560+    buildings/businesses
```

SQL to track baseline designation:

```sql
-- Add baseline tracking to snapshot_stats
ALTER TABLE snapshot_stats
  ADD COLUMN IF NOT EXISTS is_baseline boolean NOT NULL DEFAULT false;

-- A trigger or application logic sets is_baseline = true when
-- the criteria above are met for the first time per vertical.
```

### 3.3 Snapshot Schedule

```
SNAPSHOT CADENCE BY VERTICAL
==============================

Vertical          | Snapshot Frequency | Rationale
------------------+--------------------+----------------------------------
transport_road    | Daily (rainy season) | Road conditions change within hours during
                  | Weekly (dry season)  | June-Oct rainy season. High commercial value.
mobile_money      | Weekly              | High agent turnover, weekly churn visible
pharmacy          | Bi-weekly           | Formal pharmacies are stable; informal turnover
fuel_station      | Weekly              | Stock-out events are time-sensitive
alcohol_outlet    | Bi-weekly           | Moderate turnover, some night-only ops
billboard         | Monthly             | Slow-changing inventory
census_proxy      | Monthly             | Buildings change slowly

Implementation: The existing runWeeklySnapshot() runs on a single schedule.
Rather than changing this, the system will:
1. Run the snapshot engine weekly for ALL verticals
2. For daily transport_road snapshots, add a separate cron endpoint
3. Monthly verticals still get weekly snapshots (harmless -- deltas
   will be "unchanged" most weeks)
```

### 3.4 Handling Partial Snapshots

When not all entities are visited in a snapshot period, the system must avoid false "removed" deltas.

```
PARTIAL SNAPSHOT RULES
=======================

Problem: Agent visits 60 of 100 mobile money kiosks this week.
The other 40 are NOT removed -- they just weren't visited.

Solution: CARRY-FORWARD with decay

1. The snapshot engine already handles this correctly: it projects
   ALL events for all time, not just events from the current period.
   If a kiosk had a CREATE_EVENT 3 weeks ago and no new events,
   it still appears in the current projection.

2. A point is only marked "removed" in deltas if:
   a. An explicit CLOSE_EVENT is submitted, OR
   b. The entity has been in DORMANT state (> 8 weeks with no events)
      AND an agent physically visited the location and confirmed closure

3. The "completion_rate" in snapshot_stats tracks what percentage
   of known entities received at least one event this snapshot period:

   completion_rate = (points with events this period) / total_points * 100

4. A snapshot with < 50% completion_rate is flagged as "partial"
   and its deltas carry a lower confidence weight (see Section 6).

5. For partial snapshots, the delta computation adds a flag:

   delta.isFromPartialSnapshot = completion_rate < 50
```

### 3.5 Temporal Consistency Rules

```
TEMPORAL CONSISTENCY
=====================

Rule 1: EVENT ORDERING
  Events are always ordered by created_at timestamp.
  If two events have the same timestamp, the one with the later
  insertion (higher UUID in v7 format, or later DB insert order) wins.

Rule 2: NO FUTURE EVENTS
  The system rejects events with created_at > now() + 1 hour.
  (1-hour tolerance for timezone/clock drift on mobile devices.)

Rule 3: NO RETROACTIVE EVENTS
  Events older than 72 hours are flagged for admin review.
  This catches delayed offline-queue syncs.
  Events older than 7 days are rejected outright.

Rule 4: SNAPSHOT IMMUTABILITY
  Once a snapshot is written for a given (snapshot_date, point_id),
  it is never updated (ON CONFLICT DO NOTHING, already implemented).
  Corrections create new events that appear in the NEXT snapshot.

Rule 5: DELTA BASELINE CONSISTENCY
  Deltas always compare against the immediately previous snapshot.
  The system does not skip snapshots even if they were partial.
  This ensures a continuous chain:
    snapshot_1 -> delta_1_2 -> snapshot_2 -> delta_2_3 -> snapshot_3 -> ...

Rule 6: TIMEZONE HANDLING
  All timestamps are stored in UTC (timestamptz).
  Cameroon is UTC+1 (WAT). The snapshot_date uses the UTC date.
  A snapshot for "2026-03-03" covers events through 2026-03-03T23:59:59Z.
```

---

## 4. Delta Computation Rules

### 4.1 Current Implementation

The existing `computeDeltas()` in `snapshotEngine.ts` already handles:
- New points (in current but not previous snapshot)
- Removed points (in previous but not current)
- Changed points (field-by-field comparison of `details` JSONB)
- Unchanged points
- Numeric delta magnitude and direction for number fields

### 4.2 Meaningful Delta Definitions Per Vertical

Not all field changes are equally meaningful. The following defines **publishable deltas** -- changes worth reporting to data consumers.

```
DELTA SIGNIFICANCE RULES
==========================

For each vertical, fields are classified as:

  HIGH:   Change triggers immediate delta publication
  MEDIUM: Change included in weekly rollup
  LOW:    Change recorded but not surfaced in reports

───────────────────────────────────────────────────────
PHARMACY
───────────────────────────────────────────────────────
  HIGH:   isOpenNow (closed -> open, open -> closed)
          isOnDuty (pharmacie de garde status change)
          Entity lifecycle (new, closed)
  MEDIUM: openingHours, isLicensed, availability
  LOW:    phone, website, name spelling correction

───────────────────────────────────────────────────────
FUEL STATION
───────────────────────────────────────────────────────
  HIGH:   hasFuelAvailable (stock-out event)
          pricesByFuel (any price change >= 5 XAF)
          Entity lifecycle (new, closed)
  MEDIUM: fuelTypes (new fuel type added/removed)
          queueLength, quality
  LOW:    paymentMethods, openingHours, operator

───────────────────────────────────────────────────────
MOBILE MONEY
───────────────────────────────────────────────────────
  HIGH:   providers (provider added/removed)
          hasMin50000XafAvailable (liquidity change)
          isActive (agent went active/dormant)
          Entity lifecycle (new, closed)
  MEDIUM: agentType, merchantIdByProvider
  LOW:    openingHours, paymentMethods

───────────────────────────────────────────────────────
ALCOHOL OUTLET
───────────────────────────────────────────────────────
  HIGH:   Entity lifecycle (new, closed)
          isFormal (formalization/informalization)
  MEDIUM: outletType, brandsAvailable, priceRange
          operatingPeriod
  LOW:    servesFood, hasSeating, paymentMethods

───────────────────────────────────────────────────────
BILLBOARD
───────────────────────────────────────────────────────
  HIGH:   isOccupied (vacant -> occupied, occupied -> vacant)
          advertiserBrand (new advertiser)
          Entity lifecycle (new, removed)
          condition (good -> damaged/destroyed)
  MEDIUM: advertiserCategory, billboardType
  LOW:    isLit, facing, size

───────────────────────────────────────────────────────
TRANSPORT ROAD
───────────────────────────────────────────────────────
  HIGH:   isBlocked (blocked -> clear, clear -> blocked)
          condition (any change)
          blockageType, blockageSeverity
          Entity lifecycle (new road segment)
  MEDIUM: surfaceType, passableBy, trafficLevel
  LOW:    hasStreetLight, hasSidewalk, estimatedWidth

───────────────────────────────────────────────────────
CENSUS PROXY
───────────────────────────────────────────────────────
  HIGH:   occupancyStatus (occupied -> vacant, new construction)
          Entity lifecycle (new building, demolished)
  MEDIUM: storeyCount (building expanded/reduced)
          estimatedUnits, hasCommercialGround
  LOW:    constructionMaterial, roofMaterial, hasElectricity
```

### 4.3 Delta Categories

Extending the existing `DeltaType` with sub-categories:

```typescript
// Existing (keep)
type DeltaType = "new" | "removed" | "changed" | "unchanged";

// New: delta significance classification
type DeltaSignificance = "high" | "medium" | "low";

// New: enriched delta with significance
interface EnrichedDelta extends SnapshotDelta {
  significance: DeltaSignificance;
  isPublishable: boolean;       // significance === "high" || "medium"
  isFromPartialSnapshot: boolean;
}

// Configuration per vertical
const DELTA_SIGNIFICANCE: Record<string, Record<string, DeltaSignificance>> = {
  pharmacy: {
    isOpenNow: "high",
    isOnDuty: "high",
    openingHours: "medium",
    isLicensed: "medium",
    phone: "low",
    name: "low",
  },
  fuel_station: {
    hasFuelAvailable: "high",
    pricesByFuel: "high",
    fuelPrice: "high",
    fuelTypes: "medium",
    queueLength: "medium",
    paymentMethods: "low",
  },
  // ... (full map per vertical as defined above)
};

function classifyDelta(delta: SnapshotDelta): DeltaSignificance {
  // New/removed entities are always HIGH
  if (delta.deltaType === "new" || delta.deltaType === "removed") return "high";
  if (delta.deltaType === "unchanged") return "low";

  // For changed fields, look up the significance map
  const verticalMap = DELTA_SIGNIFICANCE[delta.verticalId];
  if (!verticalMap || !delta.deltaField) return "medium";
  return verticalMap[delta.deltaField] ?? "medium";
}
```

### 4.4 Confidence Thresholds for Publishing

```
DELTA PUBLICATION RULES
========================

A delta is published (sent to API consumers, shown in dashboard) if:

1. The entity's confidence score >= 40 (see Section 6)
   AND
2. The delta significance is HIGH or MEDIUM
   AND
3. At least ONE of:
   a. The entity has a photo from the current snapshot period
   b. The entity has been verified by 2+ independent agents
   c. The delta is from an entity with eventsCount >= 3

Exception: For transport_road blockage events (isBlocked = true),
publish immediately regardless of confidence score if the agent
has a photo. Road blockages are time-critical.

Unpublished deltas are still recorded in snapshot_deltas but flagged:
  delta.isPublished = false
```

### 4.5 Delta Aggregation for Reporting

```
AGGREGATION TIERS
==================

DAILY ROLLUP (transport_road only during rainy season):
  - Count of blocked/unblocked road segments
  - New blockage events
  - Blockages resolved

WEEKLY ROLLUP (all verticals):
  - This is the primary reporting cadence
  - Already implemented via snapshot_stats table
  - Metrics: total_points, new_count, removed_count, changed_count
  - Statistical: week_over_week_growth, moving_avg_4w, z-scores, anomalies

MONTHLY ROLLUP (for commercial reports):
  Computed by aggregating 4 weekly snapshot_stats:

  monthly_stats = {
    vertical_id,
    month,
    avg_total_points:     AVG(total_points) over 4 weeks,
    total_new:            SUM(new_count),
    total_removed:        SUM(removed_count),
    total_changed:        SUM(changed_count),
    net_growth:           SUM(new_count) - SUM(removed_count),
    churn_rate:           SUM(removed_count) / AVG(total_points) * 100,
    avg_completion_rate:  AVG(completion_rate),
    price_trend:          [weekly avg_price values for trend line],
  }
```

SQL for monthly rollup (to be run as a scheduled job):

```sql
CREATE TABLE IF NOT EXISTS monthly_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  month date NOT NULL,              -- First day of month
  vertical_id text NOT NULL,
  avg_total_points numeric,
  total_new integer DEFAULT 0,
  total_removed integer DEFAULT 0,
  total_changed integer DEFAULT 0,
  net_growth integer DEFAULT 0,
  churn_rate numeric,
  avg_completion_rate numeric,
  UNIQUE(month, vertical_id)
);

INSERT INTO monthly_stats (month, vertical_id, avg_total_points, total_new,
  total_removed, total_changed, net_growth, churn_rate, avg_completion_rate)
SELECT
  date_trunc('month', snapshot_date)::date AS month,
  vertical_id,
  ROUND(AVG(total_points), 1),
  SUM(new_count),
  SUM(removed_count),
  SUM(changed_count),
  SUM(new_count) - SUM(removed_count),
  CASE WHEN AVG(total_points) > 0
    THEN ROUND(SUM(removed_count)::numeric / AVG(total_points) * 100, 2)
    ELSE 0
  END,
  ROUND(AVG(completion_rate), 1)
FROM snapshot_stats
WHERE snapshot_date >= date_trunc('month', CURRENT_DATE - interval '1 month')
  AND snapshot_date < date_trunc('month', CURRENT_DATE)
GROUP BY date_trunc('month', snapshot_date), vertical_id
ON CONFLICT (month, vertical_id) DO UPDATE SET
  avg_total_points = EXCLUDED.avg_total_points,
  total_new = EXCLUDED.total_new,
  total_removed = EXCLUDED.total_removed,
  total_changed = EXCLUDED.total_changed,
  net_growth = EXCLUDED.net_growth,
  churn_rate = EXCLUDED.churn_rate,
  avg_completion_rate = EXCLUDED.avg_completion_rate;
```

---

## 5. Collection Workflow

### 5.1 Zone Decomposition

Bonamoussadi is divided into sub-zones for route planning:

```
BONAMOUSSADI SUB-ZONES
========================

Zone boundaries (approximate, within Bonamoussadi bounding box):
  Bonamoussadi bounds: S=4.0755, W=9.7185, N=4.0999, E=9.7602

  Zone A (West):     S=4.0755, W=9.7185, N=4.0999, E=9.7350
  Zone B (Central):  S=4.0755, W=9.7350, N=4.0999, E=9.7480
  Zone C (East):     S=4.0755, W=9.7480, N=4.0999, E=9.7602

  ┌────────────────────────────────────────────────────────┐
  │                    Bonamoussadi                         │
  │                                                        │
  │    ┌──────────────┬──────────────┬──────────────┐      │
  │    │              │              │              │      │
  │    │   Zone A     │   Zone B     │   Zone C     │      │
  │    │   (West)     │  (Central)   │   (East)     │      │
  │    │              │              │              │      │
  │    │ ~190 POIs    │ ~210 POIs    │ ~160 POIs    │      │
  │    │              │              │              │      │
  │    └──────────────┴──────────────┴──────────────┘      │
  │                                                        │
  └────────────────────────────────────────────────────────┘

  Estimated entities per zone (all verticals combined):
    Zone A: ~190 (includes Carrefour Bonamoussadi junction, TOTAL stations)
    Zone B: ~210 (densest commercial corridor, most mobile money kiosks)
    Zone C: ~160 (includes Makepe, Tradex station, university area)
```

### 5.2 Route Planning and Assignment

```
ASSIGNMENT WORKFLOW
====================

1. PLANNING (Admin, weekly on Monday)
   ┌─────────────────────────────────────────────┐
   │ Admin Dashboard: Assignment Planning View    │
   │                                              │
   │ This week's assignments:                     │
   │                                              │
   │ Agent: Kouam J.                              │
   │   Zone: B (Central)                          │
   │   Verticals: pharmacy, mobile_money          │
   │   Expected points: 45                        │
   │   Due: Friday March 6                        │
   │                                              │
   │ Agent: Ngassa M.                             │
   │   Zone: A (West)                             │
   │   Verticals: fuel_station, alcohol_outlet    │
   │   Expected points: 30                        │
   │   Due: Friday March 6                        │
   │                                              │
   │ Agent: Tabi P.                               │
   │   Zone: C (East)                             │
   │   Verticals: billboard, transport_road       │
   │   Expected points: 35                        │
   │   Due: Friday March 6                        │
   │                                              │
   │ [+ Add Assignment]                           │
   └─────────────────────────────────────────────┘

2. DISTRIBUTION
   - Assignments pushed to agent's mobile app
   - Agent sees their zone on the map with:
     a. Existing entities to VERIFY (blue markers)
     b. Approximate locations of expected new entities (grey markers, from OSM/satellite)
     c. Zone boundary highlighted
   - Agent can plan their walking route

3. ROTATION
   - Each agent covers a different zone each week
   - This provides cross-verification (Agent B verifies Agent A's data)
   - Rotation schedule:
     Week 1: Agent 1 -> Zone A,  Agent 2 -> Zone B,  Agent 3 -> Zone C
     Week 2: Agent 1 -> Zone B,  Agent 2 -> Zone C,  Agent 3 -> Zone A
     Week 3: Agent 1 -> Zone C,  Agent 2 -> Zone A,  Agent 3 -> Zone B
     Week 4: Repeat cycle
```

### 5.3 On-Site Capture Protocol Per Vertical

```
═══════════════════════════════════════════════════════
PROTOCOL: PHARMACY
═══════════════════════════════════════════════════════

Step 1: APPROACH
  - Walk to pharmacy location
  - If new entity: confirm it is a pharmacy (green cross, signage)
  - If existing entity: locate on map, tap to open

Step 2: PHOTO EVIDENCE
  - Primary photo: Storefront showing name/signage (REQUIRED)
  - Secondary photo: Interior or additional signage (OPTIONAL)
  - GPS must be enabled; photo EXIF captures location

Step 3: DATA CAPTURE
  ┌─────────────────────────────────────┐
  │ Create Pharmacy                     │
  │                                     │
  │ Name: [Pharmacie de Bonamoussadi ]  │
  │                                     │
  │ Is Open Now?  [Yes] / [No]         │
  │                                     │
  │ Is On-Duty (Pharmacie de Garde)?   │
  │   [Yes] / [No] / [Don't Know]     │
  │                                     │
  │ Is Licensed (visible signage)?     │
  │   [Yes] / [No]                     │
  │                                     │
  │ Opening Hours: [08:00 - 20:00   ]  │
  │                                     │
  │ Phone: [+237 6XX XXX XXX       ]   │
  │                                     │
  │ [Submit with Photo]                 │
  └─────────────────────────────────────┘

Step 4: INFORMAL VENDOR HANDLING
  - If informal drug vendor (no green cross, selling on table/street):
    Set isFormal = false
    Name = "Informal medicine vendor near [landmark]"
    Photo should show the merchandise layout

Time per entity: ~3 minutes (formal), ~2 minutes (informal)

═══════════════════════════════════════════════════════
PROTOCOL: FUEL STATION
═══════════════════════════════════════════════════════

Step 1: APPROACH
  - Walk/drive to station
  - Note brand (Total, Tradex, OLA Energy, MRS, etc.)

Step 2: PHOTO EVIDENCE
  - Primary photo: Station entrance with brand signage (REQUIRED)
  - Secondary photo: Price board or pump display (REQUIRED for fuel_station)

Step 3: DATA CAPTURE
  ┌─────────────────────────────────────┐
  │ Create Fuel Station                 │
  │                                     │
  │ Name: [TOTAL Bonamoussadi 1     ]  │
  │ Brand: [Total       ]              │
  │                                     │
  │ Fuel Available? [Yes] / [No]       │
  │                                     │
  │ Fuel Types:                         │
  │   [x] Super  Price: [840] XAF/L   │
  │   [x] Diesel Price: [780] XAF/L   │
  │   [ ] Gas    Price: [   ] XAF/L   │
  │                                     │
  │ Queue Length: (None) (Short) (Long) │
  │                                     │
  │ Services:                           │
  │   [ ] Convenience Store             │
  │   [ ] Car Wash                      │
  │   [ ] ATM                           │
  │   [ ] Mobile Money Agent            │
  │                                     │
  │ [Submit with Photo]                 │
  └─────────────────────────────────────┘

Step 4: INFORMAL FUEL VENDOR
  - Jerry can vendors near stations: isFormal = false
  - Name = "Informal fuel vendor near [station name]"
  - Photo of jerry cans/bottles

Time per entity: ~5 minutes (formal), ~2 minutes (informal)

═══════════════════════════════════════════════════════
PROTOCOL: MOBILE MONEY
═══════════════════════════════════════════════════════

Step 1: APPROACH
  - Identify kiosk/agent by MTN/Orange branding

Step 2: PHOTO EVIDENCE
  - Primary photo: Kiosk/booth with visible operator branding (REQUIRED)
  - Secondary photo: Agent fee schedule if visible (OPTIONAL)

Step 3: DATA CAPTURE
  ┌─────────────────────────────────────┐
  │ Create Mobile Money Point           │
  │                                     │
  │ Providers:                          │
  │   [x] MTN                           │
  │   [x] Orange                        │
  │   [ ] CAMTEL                        │
  │                                     │
  │ Cash Available (>= 50,000 XAF)?    │
  │   [Yes] / [No] / [Ask Agent]       │
  │                                     │
  │ Agent Name/Kiosk Name:             │
  │   [Kiosque MoMo Carrefour      ]   │
  │                                     │
  │ Merchant ID (if visible on sign):  │
  │   MTN: [            ]              │
  │   Orange: [         ]              │
  │                                     │
  │ [Submit with Photo]                 │
  └─────────────────────────────────────┘

Time per entity: ~2 minutes

═══════════════════════════════════════════════════════
PROTOCOL: ALCOHOL OUTLET
═══════════════════════════════════════════════════════

Step 1: APPROACH
  - Identify bar/outlet (signage, beer branding, seating area)
  - Note: many operate evenings only; daytime capture may find them closed

Step 2: PHOTO EVIDENCE
  - Primary photo: Exterior showing entrance and any signage (REQUIRED)
  - If closed at time of visit, photo of closed storefront is acceptable

Step 3: DATA CAPTURE
  ┌─────────────────────────────────────┐
  │ Create Alcohol Outlet               │
  │                                     │
  │ Name: [Bar Le Diplomate          ]  │
  │                                     │
  │ Type:                               │
  │   (Bar) (Restaurant) (Off-Licence)  │
  │   (Street Vendor) (Nightclub)       │
  │                                     │
  │ Is Licensed (visible)?              │
  │   [Yes] / [No]                      │
  │                                     │
  │ Operating Period:                   │
  │   (Day only) (Evening only)         │
  │   (Day + Evening) (Night only)      │
  │                                     │
  │ Brands Visible:                     │
  │   [x] 33 Export                     │
  │   [x] Castel                        │
  │   [ ] Beaufort                      │
  │   [ ] Other: [                ]     │
  │                                     │
  │ [Submit with Photo]                 │
  └─────────────────────────────────────┘

Time per entity: ~2 minutes (daytime), ~3 minutes (evening with verification)

═══════════════════════════════════════════════════════
PROTOCOL: BILLBOARD
═══════════════════════════════════════════════════════

Step 1: APPROACH
  - Walk along roads, scan for billboards and signage

Step 2: PHOTO EVIDENCE
  - Primary photo: Full billboard face showing content (REQUIRED)
  - Aim to capture the entire billboard in frame

Step 3: DATA CAPTURE
  ┌─────────────────────────────────────┐
  │ Create Billboard                    │
  │                                     │
  │ Description: [MTN billboard at   ]  │
  │              [Carrefour junction  ]  │
  │                                     │
  │ Type:                               │
  │   (Standard) (Digital) (Wall Paint) │
  │   (Street Furniture) (Poster)       │
  │   (Informal)                        │
  │                                     │
  │ Occupied? [Yes] / [No/Blank]       │
  │                                     │
  │ Advertiser Brand: [MTN           ]  │
  │ Category: (Telecom) (Beer)          │
  │           (Banking) (FMCG) (Other)  │
  │                                     │
  │ Condition: (Good) (Damaged)         │
  │            (Destroyed)              │
  │                                     │
  │ Size: (Small) (Medium) (Large)      │
  │                                     │
  │ [Submit with Photo]                 │
  └─────────────────────────────────────┘

Time per entity: ~2 minutes

═══════════════════════════════════════════════════════
PROTOCOL: TRANSPORT ROAD
═══════════════════════════════════════════════════════

Step 1: APPROACH
  - Walk along road segment (typically 100-300m per segment)
  - A segment is defined as the stretch between two intersections

Step 2: PHOTO EVIDENCE
  - Primary photo: Road surface and condition (REQUIRED)
  - Secondary photo: Blockage or damage if present (REQUIRED if blocked)
  - Photo should be taken facing along the road direction

Step 3: DATA CAPTURE
  ┌─────────────────────────────────────┐
  │ Create Road Segment                 │
  │                                     │
  │ Road Name: [Rue de l'Harmonie   ]  │
  │                                     │
  │ Segment Type:                       │
  │   (Primary) (Secondary) (Tertiary)  │
  │   (Alley) (Footpath)               │
  │                                     │
  │ Surface: (Asphalt) (Laterite)       │
  │          (Gravel) (Earth)           │
  │                                     │
  │ Condition: (Good) (Fair) (Poor)     │
  │            (Impassable)             │
  │                                     │
  │ Blocked? [Yes] / [No]              │
  │ If yes:                             │
  │   Blockage: (Flooding) (Construction)│
  │             (Accident) (Debris)      │
  │             (Market Encroachment)    │
  │   Severity: (Partial) (Full)        │
  │   Passable by:                      │
  │     [x] Pedestrian                  │
  │     [x] Moto                        │
  │     [ ] Car                         │
  │     [ ] Truck                       │
  │                                     │
  │ [Submit with Photo]                 │
  └─────────────────────────────────────┘

Time per segment: ~4 minutes

═══════════════════════════════════════════════════════
PROTOCOL: CENSUS PROXY
═══════════════════════════════════════════════════════

Step 1: APPROACH
  - Walk along street, capture buildings systematically
  - One building = one entity (even if multi-story)

Step 2: PHOTO EVIDENCE
  - Primary photo: Building front facade (REQUIRED)

Step 3: DATA CAPTURE
  ┌─────────────────────────────────────┐
  │ Create Building                     │
  │                                     │
  │ Building Type:                      │
  │   (Residential) (Commercial)        │
  │   (Mixed) (Industrial)              │
  │   (Institutional) (Religious)       │
  │                                     │
  │ Occupancy:                          │
  │   (Occupied) (Partially Occupied)   │
  │   (Vacant) (Under Construction)     │
  │                                     │
  │ Storeys: [  3  ]                    │
  │ Estimated Units: [ 6  ]            │
  │                                     │
  │ Has Commercial Ground Floor?        │
  │   [Yes] / [No]                      │
  │ If yes, types:                      │
  │   [x] Shop/Retail                   │
  │   [ ] Restaurant/Bar                │
  │   [ ] Office                        │
  │   [ ] Pharmacy/Clinic               │
  │                                     │
  │ Construction: (Concrete) (Brick)    │
  │               (Wood) (Metal Sheet)  │
  │                                     │
  │ [Submit with Photo]                 │
  └─────────────────────────────────────┘

Time per building: ~2 minutes
```

### 5.4 Required Evidence Per Data Point

```
EVIDENCE REQUIREMENTS
======================

              Primary   Secondary   GPS      Timestamp  Geofence
Vertical      Photo     Photo       Required Required   Check
─────────────────────────────────────────────────────────────────
pharmacy      YES       optional    YES      YES        YES
fuel_station  YES       YES*        YES      YES        YES
mobile_money  YES       optional    YES      YES        YES
alcohol       YES       optional    YES      YES        YES
billboard     YES       optional    YES      YES        YES
transport     YES       YES*        YES      YES        YES
census_proxy  YES       optional    YES      YES        YES

* = Required for fuel_station (price board) and transport_road (if blocked)

GPS ACCURACY REQUIREMENT:
  - Horizontal accuracy must be <= 50 meters
  - If GPS accuracy > 50m, submission is accepted but flagged for review
  - EXIF GPS from photo is cross-referenced with device GPS (already implemented)

TIMESTAMP REQUIREMENTS:
  - Photo EXIF timestamp must be within 24 hours of submission time
  - If no EXIF timestamp, device timestamp is used
  - Submissions older than 72 hours flagged for admin review

GEOFENCE:
  - Must be within Bonamoussadi bounds (already enforced)
  - Future: per-zone assignment geofence check
```

### 5.5 Review and Validation Pipeline

```
VALIDATION PIPELINE
====================

  Field Agent submits
         │
         ▼
  ┌──────────────────────┐
  │ AUTOMATED CHECKS     │
  │                      │
  │ 1. Photo present?    │──── no ────► REJECT (400)
  │ 2. GPS valid?        │──── no ────► REJECT (400)
  │ 3. In geofence?      │──── no ────► REJECT (400)
  │ 4. Required fields?  │──── no ────► REJECT (400)
  │ 5. Category valid?   │──── no ────► REJECT (400)
  │ 6. Photo GPS match?  │──── no ────► REJECT (400)
  │ 7. Duplicate check   │──── match ──► PROMPT (enrich?)
  └──────┬───────────────┘
         │ passes
         ▼
  ┌──────────────────────┐
  │ FRAUD CHECKS         │
  │ (already implemented)│
  │                      │
  │ 1. EXIF GPS vs       │
  │    submission GPS     │
  │ 2. IP location vs    │
  │    submission GPS     │
  │ 3. Device fingerprint│
  │                      │
  │ Result: fraud score  │
  └──────┬───────────────┘
         │
         ▼
  ┌──────────────────────┐
  │ CONFIDENCE SCORING   │
  │ (see Section 6)      │
  │                      │
  │ Compute initial      │
  │ confidence score     │
  └──────┬───────────────┘
         │
         ▼
  ┌──────────────────────┐
  │ TRIAGE               │
  │                      │
  │ Score >= 70?         │──── yes ──► AUTO-PUBLISH
  │ Score 40-69?         │──── yes ──► QUEUE FOR REVIEW
  │ Score < 40?          │──── yes ──► FLAG FOR INVESTIGATION
  └──────────────────────┘

ADMIN REVIEW QUEUE (already exists in AdminQueue.tsx)
  - Admin sees submissions ordered by confidence score (lowest first)
  - For each submission:
    a. View photo evidence
    b. View GPS location on map
    c. View fraud check details
    d. Actions: APPROVE / REJECT / REQUEST RE-VISIT
  - APPROVE: sets reviewerApproved = true (boosts confidence score)
  - REJECT: creates a REJECTION_EVENT that suppresses the data point
  - REQUEST RE-VISIT: notifies the agent to return and re-capture

REVIEW SLA:
  - HIGH significance deltas: reviewed within 24 hours
  - MEDIUM: reviewed within 72 hours
  - Unreviewed submissions auto-publish after 7 days if score >= 50
```

---

## 6. Data Quality Scoring

### 6.1 Confidence Score System

The confidence score is a 0-100 integer that expresses how reliable a data point is. It is computed from multiple factors and stored in `details.confidenceScore`.

### 6.2 Scoring Factors

```
CONFIDENCE SCORE FACTORS
=========================

Factor                    Weight    Range    Description
───────────────────────────────────────────────────────────────
recency                   25%       0-25     How recent is the last observation?
sourceCount               20%       0-20     How many independent events contribute?
photoEvidence             20%       0-20     Quality of photographic evidence
gpsAccuracy               15%       0-15     GPS precision and cross-validation
reviewerApproval          10%       0-10     Has an admin approved this data?
fieldCompleteness         10%       0-10     What % of enrichable fields are filled?
───────────────────────────────────────────────────────────────
TOTAL                    100%       0-100
```

### 6.3 Score Computation Formula

```typescript
interface ConfidenceFactors {
  recency: number;           // 0-25
  sourceCount: number;       // 0-20
  photoEvidence: number;     // 0-20
  gpsAccuracy: number;       // 0-15
  reviewerApproval: number;  // 0-10
  fieldCompleteness: number; // 0-10
}

function computeConfidenceScore(point: ProjectedPoint, referenceDate: Date): number {

  // ── RECENCY (0-25) ──────────────────────────────────
  const daysSinceUpdate = (referenceDate.getTime() - new Date(point.updatedAt).getTime())
    / (24 * 60 * 60 * 1000);

  let recency: number;
  if (daysSinceUpdate <= 7)       recency = 25;  // This week
  else if (daysSinceUpdate <= 14) recency = 22;  // Last week
  else if (daysSinceUpdate <= 30) recency = 18;  // This month
  else if (daysSinceUpdate <= 60) recency = 12;  // Last month
  else if (daysSinceUpdate <= 90) recency = 6;   // 2-3 months ago
  else                            recency = 0;   // Stale

  // ── SOURCE COUNT (0-20) ─────────────────────────────
  // Multiple independent observations increase confidence
  const events = point.eventsCount;
  let sourceCount: number;
  if (events >= 5)       sourceCount = 20;
  else if (events >= 3)  sourceCount = 15;
  else if (events >= 2)  sourceCount = 10;
  else                   sourceCount = 5;   // Single observation

  // Bonus: if events come from different users (multi-source)
  // This requires checking event user_ids -- simplified here
  // as a bonus applied during projection

  // ── PHOTO EVIDENCE (0-20) ──────────────────────────
  let photoEvidence = 0;
  if (point.photoUrl) photoEvidence += 10;           // Has primary photo
  if (point.details.hasSecondaryPhoto) photoEvidence += 5;  // Has secondary photo
  if (point.details.fraudCheck) {
    const fc = point.details.fraudCheck as SubmissionFraudCheck;
    if (fc.primaryPhoto?.exifStatus === "ok") photoEvidence += 5; // EXIF validated
  }

  // ── GPS ACCURACY (0-15) ────────────────────────────
  let gpsAccuracy = 5;  // Base: GPS present (required for submission)
  if (point.details.fraudCheck) {
    const fc = point.details.fraudCheck as SubmissionFraudCheck;
    // Photo GPS matches submission GPS
    if (fc.primaryPhoto?.submissionGpsMatch === true) gpsAccuracy += 5;
    // IP location matches submission GPS
    if (fc.primaryPhoto?.ipGpsMatch === true) gpsAccuracy += 5;
  }

  // ── REVIEWER APPROVAL (0-10) ───────────────────────
  let reviewerApproval = 0;
  if (point.details.reviewerApproved === true) reviewerApproval = 10;
  // Partial credit for not-yet-reviewed
  else if (point.eventsCount >= 2) reviewerApproval = 3;

  // ── FIELD COMPLETENESS (0-10) ──────────────────────
  const totalEnrichable = point.gaps.length +
    Object.keys(point.details).filter(k =>
      !["fraudCheck","clientDevice","source","externalId","isImported",
        "hasPhoto","hasSecondaryPhoto","secondPhotoUrl","confidenceScore",
        "lastSeenAt","name","siteName"].includes(k)
    ).length;
  const filledFields = totalEnrichable > 0
    ? (totalEnrichable - point.gaps.length) / totalEnrichable
    : 0;
  const fieldCompleteness = Math.round(filledFields * 10);

  // ── TOTAL ──────────────────────────────────────────
  const total = recency + sourceCount + photoEvidence + gpsAccuracy
    + reviewerApproval + fieldCompleteness;

  return Math.min(100, Math.max(0, total));
}
```

### 6.4 Score Thresholds

```
CONFIDENCE SCORE THRESHOLDS
=============================

Score Range    Label              Action
──────────────────────────────────────────────────────
80-100         HIGH CONFIDENCE    Auto-publish, no review needed
60-79          GOOD               Publish, review within 72h
40-59          MODERATE           Publish with caveat, review within 48h
20-39          LOW                Do not publish, queue for review
0-19           VERY LOW           Flag for investigation, may be fraudulent

EXAMPLES:

Score 85 -- "Pharmacie de Bonamoussadi"
  recency=25 (visited yesterday) + sourceCount=15 (3 events from 2 agents)
  + photoEvidence=15 (primary + EXIF ok) + gpsAccuracy=15 (all GPS match)
  + reviewerApproval=10 (admin approved) + fieldCompleteness=5
  = 85 HIGH CONFIDENCE

Score 55 -- "Informal bar near junction" (single import)
  recency=25 (this week) + sourceCount=5 (1 event)
  + photoEvidence=10 (primary photo only, no EXIF) + gpsAccuracy=5 (GPS only)
  + reviewerApproval=0 (not reviewed) + fieldCompleteness=10 (all fields filled)
  = 55 MODERATE

Score 25 -- "Pharmacy 300148855" (OSM import, no field verification)
  recency=0 (imported 3+ months ago, never re-verified)
  + sourceCount=5 (1 import event) + photoEvidence=0 (no photo)
  + gpsAccuracy=5 (GPS from OSM) + reviewerApproval=0
  + fieldCompleteness=3 (name only, many gaps)
  = 13 VERY LOW -> not published until field-verified
```

### 6.5 Score Lifecycle

```
SCORE EVOLUTION OVER TIME
==========================

Day 0:  Entity created by field agent with photo
        Score = ~55 (recency=25, source=5, photo=10, gps=10, review=0, fields=5)

Day 2:  Admin approves submission
        Score = ~65 (review bonus +10)

Day 7:  Second agent verifies entity with ENRICH_EVENT
        Score = ~80 (source +5, fields +5)

Day 30: No new events, recency decays
        Score = ~62 (recency drops from 25 to 18)

Day 60: Still no new events
        Score = ~50 (recency drops to 12)

Day 90: Entity enters DORMANT state
        Score = ~38 (recency = 0, entity deprioritized)

The score decays naturally with time, ensuring that only
recently-verified data maintains high confidence.
This drives the collection workflow: agents are directed
to re-verify entities whose scores are dropping.
```

### 6.6 Integration with Existing Codebase

The confidence score computation integrates at two points:

1. **At submission time** (in `POST /api/submissions`): Compute initial score and store in `details.confidenceScore`

2. **At snapshot time** (in `runWeeklySnapshot`): Recompute all scores with current reference date, update in snapshot rows

```typescript
// In snapshotEngine.ts, extend buildSnapshotRows:
function buildSnapshotRows(snapshotDate: string, points: ProjectedPoint[]): SnapshotRow[] {
  const referenceDate = new Date(snapshotDate);
  return points.map((p) => {
    // Recompute confidence score at snapshot time
    const freshScore = computeConfidenceScore(p, referenceDate);
    const details = { ...p.details, confidenceScore: freshScore };

    return {
      snapshotDate,
      verticalId: p.category,
      pointId: p.pointId,
      category: p.category,
      siteName: (details.siteName as string) ?? (details.name as string) ?? null,
      latitude: p.location.latitude,
      longitude: p.location.longitude,
      details: details as Record<string, unknown>,
      gaps: p.gaps,
      eventsCount: p.eventsCount,
      photoUrl: p.photoUrl ?? null,
      source: p.source ?? null,
      externalId: p.externalId ?? null,
    };
  });
}
```

---

## Summary: Implementation Priority

For the Bonamoussadi pilot, the implementation order should be:

```
PHASE 1 (Week 1-2): Foundation
  1. Add transport_road and census_proxy verticals to VERTICALS config
  2. Update category CHECK constraint migration
  3. Implement generatePointId() with geohash
  4. Implement confidence score computation
  5. Create collection_assignments table

PHASE 2 (Week 3-4): Collection Workflow
  6. Build assignment planning UI (admin)
  7. Build agent assignment view (mobile)
  8. Implement spatial dedup (25m proximity check)
  9. Add per-vertical capture forms in ContributionFlow

PHASE 3 (Week 5-6): Delta Enhancement
  10. Add delta significance classification
  11. Add monthly_stats rollup job
  12. Build publishable delta API endpoint
  13. Add partial snapshot handling

PHASE 4 (Ongoing): Quality Loop
  14. Score decay drives re-verification assignments
  15. Agent rotation ensures cross-verification
  16. Monthly quality reports to identify data gaps
```

---

## Appendix: Key Constants

```typescript
// Geofencing
const BONAMOUSSADI_BOUNDS = { south: 4.0755, west: 9.7185, north: 4.0999, east: 9.7602 };

// Deduplication
const DEDUP_RADIUS_METERS = 25;        // Default proximity for same-vertical dedup
const DEDUP_RADIUS_ROAD_METERS = 50;   // Wider for road segments

// Entity lifecycle
const DORMANT_THRESHOLD_WEEKS = 8;
const CLOSED_THRESHOLD_WEEKS = 16;

// Confidence scoring
const SCORE_THRESHOLD_AUTO_PUBLISH = 70;
const SCORE_THRESHOLD_PUBLISHABLE = 40;
const SCORE_THRESHOLD_FLAG = 20;

// Temporal rules
const MAX_EVENT_AGE_HOURS = 72;        // Flag for review
const MAX_EVENT_AGE_REJECT_DAYS = 7;   // Hard reject
const MAX_FUTURE_EVENT_HOURS = 1;      // Clock drift tolerance

// Snapshot cadence
const SNAPSHOT_WEEKLY_DAY = 0;         // Sunday
const TRANSPORT_DAILY_RAINY_START = "2026-06-01";
const TRANSPORT_DAILY_RAINY_END = "2026-10-31";

// Collection targets (Bonamoussadi pilot)
const ESTIMATED_ENTITIES = {
  transport_road: { min: 50, max: 80 },
  mobile_money: { min: 100, max: 200 },
  pharmacy: { min: 30, max: 55 },
  fuel_station: { min: 5, max: 10 },
  alcohol_outlet: { min: 80, max: 150 },
  billboard: { min: 30, max: 60 },
  census_proxy: { min: 560, max: 800 },
};
```
