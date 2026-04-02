# System Design: End-to-End Data Collection & Management for Bonamoussadi

**Teammate 2 -- System Design Expert**
**Target Area:** Bonamoussadi, Douala V, Cameroon
**Date:** 2026-03-03
**Verticals:** Billboards, Alcohol Outlets, Census, Fuel Stations, Mobile Money, Pharmacy, Transport/Roads

---

## April 2026 Operational Note

This system-design document remains the structural baseline for the Bonamoussadi data model. Execution and modernization are now governed in parallel by:

- `docs/APP-MODERNIZATION-AND-GAMIFICATION-PROGRAM.md`
- `docs/MULTI-AGENT-MODERNIZATION-MASTER-PROMPT.md`

Use this document for architecture and data-shape decisions, and the newer docs for rollout sequencing, gamification integration, and cross-agent delivery.

---

## Table of Contents

1. [Universal Data Model](#1-universal-data-model)
2. [Entity ID System](#2-entity-id-system)
3. [Baseline vs. Snapshot Logic](#3-baseline-vs-snapshot-logic)
4. [Delta Computation Rules](#4-delta-computation-rules)
5. [Data Quality Scoring](#5-data-quality-scoring)
6. [Temporal Model](#6-temporal-model)

---

## 1. Universal Data Model

### 1.1 Entity Hierarchy

The existing ADL codebase uses an event-sourced architecture built around `PointEvent` objects that are projected into `ProjectedPoint` entities. The design below extends this architecture to accommodate all 7 verticals, including the 2 new ones (census and transport/roads) that do not yet exist in the codebase.

```
                              +-------------------+
                              |      Zone         |
                              | (survey boundary) |
                              +--------+----------+
                                       |
                                       | contains 1..*
                                       v
                              +-------------------+
                              |    Location       |
                              | (physical place)  |
                              +--------+----------+
                                       |
                                       | hosts 1..*
                                       v
                              +-------------------+
                              |     Entity        |
                              | (business/asset)  |
                              +--------+----------+
                                       |
                          +------------+------------+
                          |                         |
                          | observed by 0..*        | has 0..*
                          v                         v
                  +---------------+         +---------------+
                  | Observation   |         |    Media      |
                  | (field visit) |         | (photo/video) |
                  +-------+-------+         +---------------+
                          |
                          | produces 0..*
                          v
                  +---------------+
                  |    Delta      |
                  | (computed     |
                  |  change)      |
                  +---------------+

                  +---------------+
                  |    Agent      |
                  | (field worker)|
                  +---------------+
```

**Relationship to existing code:**
- `Location` is implicit today (stored as lat/lng on `PointEvent`)
- `Entity` maps to `ProjectedPoint` (the materialized view of all events for a `point_id`)
- `Observation` maps to `PointEvent` (CREATE_EVENT or ENRICH_EVENT)
- `Delta` maps to rows in `snapshot_deltas`
- `Agent` maps to `UserProfile`
- `Media` is currently a single `photo_url` on `PointEvent`; this design promotes it to a first-class entity

### 1.2 Core Entity Schemas

#### 1.2.1 Zone

A bounded geographic area that defines the scope of a survey campaign. For the initial deployment, there is one zone: Bonamoussadi.

```sql
CREATE TABLE IF NOT EXISTS zones (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,                      -- 'Bonamoussadi'
  slug          text NOT NULL UNIQUE,               -- 'bonamoussadi'
  city          text NOT NULL,                      -- 'Douala'
  country_code  text NOT NULL DEFAULT 'CM',         -- ISO 3166-1 alpha-2
  bounds_south  double precision NOT NULL,          -- 4.0755
  bounds_west   double precision NOT NULL,          -- 9.7185
  bounds_north  double precision NOT NULL,          -- 4.0999
  bounds_east   double precision NOT NULL,          -- 9.7602
  center_lat    double precision NOT NULL,          -- 4.0877
  center_lng    double precision NOT NULL,          -- 9.7394
  timezone      text NOT NULL DEFAULT 'Africa/Douala',
  status        text NOT NULL DEFAULT 'active'
                CHECK (status IN ('active', 'archived', 'planned')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
```

**Example row:**
```json
{
  "id": "a1b2c3d4-...",
  "name": "Bonamoussadi",
  "slug": "bonamoussadi",
  "city": "Douala",
  "country_code": "CM",
  "bounds_south": 4.0755,
  "bounds_west": 9.7185,
  "bounds_north": 4.0999,
  "bounds_east": 9.7602,
  "center_lat": 4.0877,
  "center_lng": 9.7394,
  "timezone": "Africa/Douala"
}
```

This replaces the hardcoded `BONAMOUSSADI_BOUNDS` and `BONAMOUSSADI_CENTER` constants in `shared/geofence.ts` with a database-driven approach, enabling multi-zone expansion without code changes.

#### 1.2.2 Location

A physical place identified by GPS coordinates and contextual landmarks. This is a NEW entity -- the current codebase embeds coordinates directly on events.

```sql
CREATE TABLE IF NOT EXISTS locations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  zone_id         uuid NOT NULL REFERENCES zones(id),
  latitude        double precision NOT NULL,
  longitude       double precision NOT NULL,
  accuracy_m      real,                             -- GPS accuracy in meters
  altitude_m      real,                             -- altitude if available
  geohash_6       text NOT NULL,                    -- 6-char geohash for proximity queries
  landmark_desc   text,                             -- 'En face du marche de Bonamoussadi'
  street_name     text,                             -- informal name if known
  quartier        text,                             -- sub-neighborhood
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_locations_geohash ON locations (geohash_6);
CREATE INDEX idx_locations_zone ON locations (zone_id);
CREATE INDEX idx_locations_coords ON locations USING gist (
  point(longitude, latitude)
);
```

**Why geohash_6?** A 6-character geohash covers approximately 1.2 km x 0.6 km. This is the right granularity for proximity queries in a dense neighborhood like Bonamoussadi without requiring PostGIS. Two entities at the same geohash_6 + same business name are candidate duplicates.

**Example row:**
```json
{
  "id": "loc_7f3a2b...",
  "zone_id": "a1b2c3d4-...",
  "latitude": 4.0842,
  "longitude": 9.7351,
  "accuracy_m": 8.5,
  "geohash_6": "s10tg6",
  "landmark_desc": "A cote de Total Bonamoussadi",
  "quartier": "Bonamoussadi Centre"
}
```

#### 1.2.3 Entity

The business or asset at a location. This corresponds to the current `ProjectedPoint` concept. Entities are the materialized state of all observations.

```sql
CREATE TABLE IF NOT EXISTS entities (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Composite natural key for deduplication
  point_id        text NOT NULL UNIQUE,             -- maps to existing point_id
  location_id     uuid REFERENCES locations(id),
  zone_id         uuid NOT NULL REFERENCES zones(id),
  vertical_id     text NOT NULL,                    -- 'pharmacy', 'fuel_station', etc.
  -- Core identity fields
  name            text,                             -- 'Pharmacie du Rond-Point'
  brand           text,                             -- 'Total', 'Orange', etc.
  operator        text,                             -- who runs it
  -- Spatial
  latitude        double precision NOT NULL,
  longitude       double precision NOT NULL,
  geohash_6       text NOT NULL,
  -- State
  status          text NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active', 'closed', 'demolished',
                                     'under_construction', 'seasonal', 'unknown')),
  -- Vertical-specific data stored as JSONB
  details         jsonb NOT NULL DEFAULT '{}',
  -- Provenance
  source          text,                             -- 'field_agent', 'csv_import', 'seed'
  external_id     text,                             -- external reference
  -- Quality
  confidence      real NOT NULL DEFAULT 0.0
                  CHECK (confidence >= 0 AND confidence <= 1),
  gaps            text[] DEFAULT '{}',              -- missing enrichable fields
  events_count    integer NOT NULL DEFAULT 0,
  -- Media
  photo_url       text,
  -- Timestamps
  first_seen_at   timestamptz NOT NULL,
  last_seen_at    timestamptz NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_entities_vertical ON entities (vertical_id);
CREATE INDEX idx_entities_zone ON entities (zone_id);
CREATE INDEX idx_entities_geohash ON entities (geohash_6);
CREATE INDEX idx_entities_status ON entities (status) WHERE status != 'active';
CREATE INDEX idx_entities_confidence ON entities (confidence);
```

**Relationship to existing code:** This is the persisted equivalent of `ProjectedPoint` from `lib/server/pointProjection.ts`. Today, projected points are computed on every read by replaying all events. This table caches the materialized state.

#### 1.2.4 Observation (extends existing `point_events`)

An observation is a single field visit or data capture event. This maps directly to the existing `point_events` table with extensions.

```sql
-- The existing point_events table remains the source of truth.
-- New columns extend it for the 7-vertical strategy:

ALTER TABLE point_events ADD COLUMN IF NOT EXISTS
  zone_id uuid REFERENCES zones(id);

ALTER TABLE point_events ADD COLUMN IF NOT EXISTS
  observation_type text NOT NULL DEFAULT 'field_visit'
  CHECK (observation_type IN (
    'field_visit',       -- agent physically present
    'remote_update',     -- satellite/API data
    'csv_import',        -- bulk import
    'community_report',  -- citizen tip
    'automated_sensor'   -- IoT/traffic sensor
  ));

ALTER TABLE point_events ADD COLUMN IF NOT EXISTS
  gps_accuracy_m real;

ALTER TABLE point_events ADD COLUMN IF NOT EXISTS
  confidence real DEFAULT 0.5
  CHECK (confidence >= 0 AND confidence <= 1);

ALTER TABLE point_events ADD COLUMN IF NOT EXISTS
  device_clock_at timestamptz;  -- raw device time, for clock drift detection

ALTER TABLE point_events ADD COLUMN IF NOT EXISTS
  server_received_at timestamptz DEFAULT now(); -- when server first saw it
```

**TypeScript interface (extending existing `PointEvent`):**

```typescript
interface ObservationEvent extends PointEvent {
  zoneId: string;
  observationType:
    | 'field_visit'
    | 'remote_update'
    | 'csv_import'
    | 'community_report'
    | 'automated_sensor';
  gpsAccuracyM: number | null;
  confidence: number;            // 0.0 to 1.0
  deviceClockAt: string | null;  // ISO 8601
  serverReceivedAt: string;      // ISO 8601
}
```

#### 1.2.5 Delta (extends existing `snapshot_deltas`)

The existing `snapshot_deltas` table is well-designed. Extensions for the 7-vertical strategy:

```sql
ALTER TABLE snapshot_deltas ADD COLUMN IF NOT EXISTS
  severity text DEFAULT 'low'
  CHECK (severity IN ('critical', 'high', 'medium', 'low', 'info'));

ALTER TABLE snapshot_deltas ADD COLUMN IF NOT EXISTS
  confidence real DEFAULT 0.5
  CHECK (confidence >= 0 AND confidence <= 1);

ALTER TABLE snapshot_deltas ADD COLUMN IF NOT EXISTS
  zone_id uuid REFERENCES zones(id);

ALTER TABLE snapshot_deltas ADD COLUMN IF NOT EXISTS
  requires_verification boolean DEFAULT false;
```

**TypeScript interface (extending existing `SnapshotDelta`):**

```typescript
interface ExtendedSnapshotDelta extends SnapshotDelta {
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  confidence: number;
  zoneId: string;
  requiresVerification: boolean;
}
```

#### 1.2.6 Agent (extends existing `user_profiles`)

```sql
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS
  agent_type text DEFAULT 'contributor'
  CHECK (agent_type IN ('contributor', 'field_agent', 'team_lead', 'validator'));

ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS
  trust_score real DEFAULT 0.5
  CHECK (trust_score >= 0 AND trust_score <= 1);

ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS
  assigned_zone_id uuid REFERENCES zones(id);

ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS
  total_observations integer DEFAULT 0;

ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS
  validation_accuracy real;  -- % of their observations confirmed by validators

ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS
  preferred_verticals text[];  -- ['pharmacy', 'fuel_station']

ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS
  device_fingerprints jsonb DEFAULT '[]';  -- known devices

ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS
  last_active_at timestamptz;
```

#### 1.2.7 Media

Currently a single `photo_url` on the event. Promoted to a first-class entity to support multi-photo observations, video for road conditions, and billboard photo evidence.

```sql
CREATE TABLE IF NOT EXISTS media (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id        uuid NOT NULL REFERENCES point_events(id),
  entity_id       text,                             -- point_id reference
  zone_id         uuid REFERENCES zones(id),
  -- File info
  url             text NOT NULL,                    -- Vercel Blob URL
  media_type      text NOT NULL DEFAULT 'photo'
                  CHECK (media_type IN ('photo', 'video', 'audio', 'document')),
  mime_type       text,                             -- 'image/jpeg'
  file_size_bytes integer,
  width_px        integer,
  height_px       integer,
  -- EXIF / metadata
  exif_gps_lat    double precision,
  exif_gps_lng    double precision,
  exif_captured_at timestamptz,
  exif_device     text,                             -- 'Samsung Galaxy A14'
  exif_status     text DEFAULT 'missing'
                  CHECK (exif_status IN ('ok', 'missing', 'parse_error',
                                          'unsupported_format', 'fallback_recovered')),
  -- Role
  role            text DEFAULT 'primary'
                  CHECK (role IN ('primary', 'secondary', 'evidence',
                                   'panoramic', 'closeup', 'context')),
  -- Fraud signals
  gps_match       boolean,
  gps_distance_km real,
  -- Timestamps
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_media_event ON media (event_id);
CREATE INDEX idx_media_entity ON media (entity_id);
```

### 1.3 Vertical-Specific Extensions

Each vertical stores its specific data in the `details` JSONB column on both `entities` and `point_events`. The existing `shared/verticals.ts` already defines per-vertical `enrichableFields` and `createRequiredFields`. Below are the schemas for ALL 7 verticals, including the two new ones.

#### Billboard
```typescript
interface BillboardDetails {
  name: string;                    // description of the billboard
  brand: string | null;            // advertiser brand
  size: 'small' | 'medium' | 'large' | 'mega' | null;
  format: 'static' | 'digital' | 'painted' | 'banner' | null;
  condition: 'good' | 'faded' | 'damaged' | 'blank' | null;
  illuminated: boolean | null;
  contentCategory: string | null;  // 'telecom', 'beverage', 'political', etc.
  ownerCompany: string | null;     // billboard owner/operator
  facingDirection: string | null;  // 'N', 'SE', etc.
  heightAboveGround: number | null; // meters
  visibilityScore: number | null;  // 1-5
}
```

**Vertical config addition for `shared/verticals.ts`:**
```typescript
billboard: {
  enrichableFields: ["brand", "size", "format", "condition",
                     "illuminated", "contentCategory", "ownerCompany"],
  createRequiredFields: ["name"],
}
```

#### Alcohol Outlet
```typescript
interface AlcoholOutletDetails {
  name: string;
  brand: string | null;           // primary brand sold
  outletType: 'bar' | 'off_licence' | 'restaurant' | 'nightclub'
            | 'informal_stand' | 'wholesale' | null;
  openingHours: string | null;
  paymentMethods: string[] | null;
  servesFood: boolean | null;
  hasSeating: boolean | null;
  estimatedCapacity: number | null;
  primaryBrands: string[] | null; // ['33 Export', 'Castel', 'Guinness']
  licenseVisible: boolean | null;
}
```

#### Census (NEW vertical)
```typescript
interface CensusDetails {
  structureType: 'residential' | 'commercial' | 'mixed' | 'institutional'
               | 'religious' | 'industrial' | 'vacant_lot' | 'under_construction';
  storeyCount: number | null;
  estimatedUnits: number | null;     // dwelling units or business units
  estimatedOccupants: number | null;
  roofMaterial: 'concrete' | 'zinc' | 'tile' | 'thatch' | 'other' | null;
  wallMaterial: 'concrete_block' | 'brick' | 'wood' | 'metal' | 'other' | null;
  hasElectricity: boolean | null;
  hasRunningWater: boolean | null;
  accessRoad: 'paved' | 'unpaved' | 'footpath' | null;
  condition: 'good' | 'fair' | 'poor' | 'derelict' | null;
  landUse: string | null;           // 'residential', 'commercial', etc.
  occupancyStatus: 'occupied' | 'vacant' | 'partial' | 'unknown' | null;
}
```

**New vertical config entry:**
```typescript
census: {
  id: "census",
  labelEn: "Census Structure",
  labelFr: "Structure recensement",
  pluralEn: "Census Structures",
  pluralFr: "Structures de recensement",
  icon: "building-2",
  color: "#718096",
  bgColor: "#edf2f7",
  enrichableFields: ["storeyCount", "estimatedUnits", "roofMaterial",
                     "wallMaterial", "hasElectricity", "hasRunningWater",
                     "condition", "occupancyStatus"],
  createRequiredFields: ["structureType"],
  normalizeDetails: identityNormalize,
}
```

#### Fuel Station
*(Already exists -- extending the current `normalizeFuelStation` in `shared/verticals.ts`)*
```typescript
interface FuelStationDetails {
  name: string;
  brand: string | null;            // 'Total', 'Tradex', 'MRS'
  hasFuelAvailable: boolean;
  fuelTypes: string[];             // ['Super', 'Diesel', 'Gas']
  pricesByFuel: Record<string, number>; // { "Super": 720, "Diesel": 650 }
  fuelPrice: number | null;        // legacy single price
  quality: string | null;
  paymentMethods: string[];
  openingHours: string | null;
  hasCarWash: boolean | null;
  hasConvenienceStore: boolean | null;
  queueLength: string | null;      // 'none', 'short', 'long'
  lastDeliveryDate: string | null;
}
```

#### Mobile Money
*(Already exists -- as defined in `normalizeMobileMoney`)*
```typescript
interface MobileMoneyDetails {
  name: string | null;
  providers: string[];             // ['MTN', 'Orange']
  hasMin50000XafAvailable: boolean | null;
  merchantIdByProvider: Record<string, string>;
  paymentMethods: string[];
  openingHours: string | null;
  reliability: string | null;
  phone: string | null;
}
```

#### Pharmacy
*(Already exists -- as defined in `normalizePharmacy`)*
```typescript
interface PharmacyDetails {
  name: string;
  isOpenNow: boolean;
  isOnDuty: boolean | null;        // pharmacie de garde
  openingHours: string | null;
  phone: string | null;
  hasDriveThrough: boolean | null;
}
```

#### Transport / Roads (NEW vertical)
```typescript
interface TransportRoadDetails {
  name: string;                     // road name or intersection description
  roadType: 'primary' | 'secondary' | 'tertiary' | 'residential'
           | 'footpath' | 'intersection' | null;
  surfaceType: 'paved' | 'unpaved' | 'gravel' | 'earth' | null;
  condition: 'good' | 'fair' | 'poor' | 'impassable' | null;
  isBlocked: boolean | null;
  blockageType: 'flood' | 'construction' | 'accident' | 'market_encroachment'
              | 'permanent_obstacle' | 'temporary' | null;
  blockageSince: string | null;     // ISO date
  estimatedClearDate: string | null;
  alternateRoute: string | null;    // description
  trafficLevel: 'free_flow' | 'moderate' | 'congested' | 'gridlock' | null;
  hasStreetLights: boolean | null;
  hasDrainage: boolean | null;
  laneCount: number | null;
  // For intersections
  hasTrafficLight: boolean | null;
  hasSpeedBump: boolean | null;
}
```

**New vertical config entry:**
```typescript
transport_road: {
  id: "transport_road",
  labelEn: "Road / Transport",
  labelFr: "Route / Transport",
  pluralEn: "Roads & Transport Points",
  pluralFr: "Routes & Points de transport",
  icon: "route",
  color: "#4a5568",
  bgColor: "#e2e8f0",
  enrichableFields: ["condition", "isBlocked", "blockageType",
                     "surfaceType", "trafficLevel", "hasStreetLights"],
  createRequiredFields: ["name", "roadType"],
  normalizeDetails: identityNormalize,
}
```

---

## 2. Entity ID System

### 2.1 ID Generation Strategy

The existing codebase uses `crypto.randomUUID()` (UUID v4) for event IDs and point IDs. This is adequate but has two problems: (1) UUIDs are not sortable by time, (2) there is no human-readable prefix to identify entity type at a glance.

**Proposed: Prefixed UUID v7**

UUID v7 encodes a Unix timestamp in the first 48 bits, making IDs naturally sortable by creation time. A human-readable prefix identifies the entity type.

```
Format: {prefix}_{uuid_v7}

Examples:
  evt_019502a8-3c4e-7b2d-9f3a-1c2b3d4e5f6a   (observation/event)
  ent_019502a8-4d5f-7c3e-a04b-2d3c4e5f6a7b   (entity)
  loc_019502a8-5e60-7d4f-b15c-3e4d5f6a7b8c   (location)
  med_019502a8-6f71-7e50-c26d-4f5e6a7b8c9d   (media)
  agt_019502a8-7082-7f61-d37e-5060718293a4   (agent)
  dlt_019502a8-8193-7072-e48f-61728394a5b6   (delta)
  zon_019502a8-92a4-7183-f590-7283a4b5c6d7   (zone)
  snp_019502a8-a3b5-7294-06a1-8394b5c6d7e8   (snapshot)
```

**Offline generation:** UUID v7 uses the device clock + random bits. Two devices generating IDs at the same millisecond will still produce unique IDs because of the random component (74 bits of randomness). Collision probability is negligible even at scale.

**Implementation:**

```typescript
// lib/shared/id.ts
const PREFIXES = {
  event: 'evt',
  entity: 'ent',
  location: 'loc',
  media: 'med',
  agent: 'agt',
  delta: 'dlt',
  zone: 'zon',
  snapshot: 'snp',
} as const;

type EntityType = keyof typeof PREFIXES;

export function generateId(type: EntityType): string {
  // UUID v7: timestamp (48 bits) + version (4 bits) + random (12 bits)
  //          + variant (2 bits) + random (62 bits)
  const now = Date.now();
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);

  // Encode timestamp in first 6 bytes (48 bits)
  bytes[0] = (now / 2**40) & 0xff;
  bytes[1] = (now / 2**32) & 0xff;
  bytes[2] = (now / 2**24) & 0xff;
  bytes[3] = (now / 2**16) & 0xff;
  bytes[4] = (now / 2**8) & 0xff;
  bytes[5] = now & 0xff;

  // Set version 7
  bytes[6] = (bytes[6] & 0x0f) | 0x70;
  // Set variant 10
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
  const uuid = [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join('-');

  return `${PREFIXES[type]}_${uuid}`;
}
```

**Backward compatibility:** The existing `point_id` (UUID v4 strings) remain valid. The `normalizeEventId` function in `postgresStore.ts` already handles non-UUID inputs via deterministic SHA-1 hashing. New IDs coexist with old ones.

### 2.2 Deduplication: "Same Entity Seen by Two Different Agents"

This is the central challenge in Bonamoussadi where no formal address system exists.

**Three-layer deduplication strategy:**

```
Layer 1: GPS Proximity
  |  Within 25 meters?
  |  No  -> Definitely different entities
  |  Yes -> Proceed to Layer 2
  v
Layer 2: Name Fuzzy Match
  |  Normalized name similarity > 0.7?
  |  No  -> Probably different entities (flag for review)
  |  Yes -> Proceed to Layer 3
  v
Layer 3: Vertical + Contextual Match
  |  Same vertical?
  |  Same brand / provider / distinguishing attribute?
  |  Yes -> Merge candidate (auto-merge if confidence > 0.85)
  |  No  -> Flag for manual review
  v
Output: MERGE | DISTINCT | REVIEW_NEEDED
```

**Implementation:**

```typescript
// lib/server/deduplication.ts

interface DeduplicationCandidate {
  entityA: string;     // point_id
  entityB: string;     // point_id
  gpsDistanceM: number;
  nameSimilarity: number;
  verticalMatch: boolean;
  brandMatch: boolean | null;
  mergeConfidence: number;
  decision: 'auto_merge' | 'distinct' | 'review_needed';
}

const GPS_PROXIMITY_THRESHOLD_M = 25;
const NAME_SIMILARITY_THRESHOLD = 0.7;
const AUTO_MERGE_CONFIDENCE = 0.85;

function haversineMeters(a: SubmissionLocation, b: SubmissionLocation): number {
  return haversineKm(a, b) * 1000;
}

function normalizeEntityName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s]/g, '')
    .replace(
      /\b(pharmacie|pharmacy|station|service|kiosque|kiosk|mobile money|boutique)\b/g,
      ''
    )
    .trim();
}

// Jaro-Winkler similarity (0 to 1)
function nameSimilarity(a: string, b: string): number {
  const na = normalizeEntityName(a);
  const nb = normalizeEntityName(b);
  if (na === nb) return 1.0;
  if (!na || !nb) return 0.0;
  return jaroWinkler(na, nb); // standard string similarity algorithm
}

function computeMergeConfidence(
  distanceM: number,
  nameSim: number,
  verticalMatch: boolean,
  brandMatch: boolean | null,
): number {
  let score = 0;

  // GPS proximity (0 to 0.4)
  if (distanceM < 5) score += 0.4;
  else if (distanceM < 10) score += 0.35;
  else if (distanceM < 15) score += 0.25;
  else if (distanceM < 25) score += 0.15;

  // Name similarity (0 to 0.3)
  score += nameSim * 0.3;

  // Vertical match (0 or 0.2)
  if (verticalMatch) score += 0.2;

  // Brand/provider match (0 or 0.1)
  if (brandMatch === true) score += 0.1;

  return Math.min(1.0, score);
}
```

**Merge queue table:**

```sql
CREATE TABLE IF NOT EXISTS merge_candidates (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_a_id     text NOT NULL,
  entity_b_id     text NOT NULL,
  gps_distance_m  real NOT NULL,
  name_similarity real NOT NULL,
  vertical_match  boolean NOT NULL,
  brand_match     boolean,
  merge_confidence real NOT NULL,
  decision        text NOT NULL DEFAULT 'review_needed'
                  CHECK (decision IN ('auto_merge', 'distinct', 'review_needed',
                                       'merged', 'rejected')),
  resolved_by     text,           -- agent who resolved
  resolved_at     timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);
```

**When deduplication runs:**
1. On every CREATE_EVENT: check new entity against existing entities in the same geohash_6
2. During weekly snapshot: batch scan for unresolved candidates
3. Admin queue: human review of `review_needed` candidates

### 2.3 Entity Identity Without Formal Addresses

Since Bonamoussadi has no formal address system, entity identity is established through a composite fingerprint:

```
Entity Fingerprint = {
  geohash_6,          -- approximate location bucket
  vertical_id,        -- what type of entity
  normalized_name,    -- fuzzy-matched name
  brand,              -- if applicable
  floor_level,        -- for multi-story buildings (census)
  distinguishing_attr -- provider for mobile money, fuel brand for stations
}
```

The fingerprint is NOT the primary key -- the UUID is. The fingerprint is used only for deduplication scoring.

---

## 3. Baseline vs. Snapshot Logic

### 3.1 Definitions

The existing codebase already implements a snapshot system via `runWeeklySnapshot()` in `lib/server/snapshotEngine.ts`. The design below formalizes and extends it.

```
BASELINE: The first complete survey of a zone+vertical combination.
           It establishes the "ground truth" entity set at time T0.

SNAPSHOT: Any subsequent observation cycle that captures the state
          of all known entities in a zone+vertical at time Tn.

PARTIAL BASELINE: A baseline where the zone was surveyed but the
                  agent did not cover all areas or all verticals.
```

**Formal state machine:**

```
                  +----------------+
                  |   PLANNED      |  Zone exists but no data collected
                  +-------+--------+
                          |
                          | First observation received
                          v
                  +----------------+
                  | PARTIAL_BASE   |  Baseline in progress; < threshold coverage
                  +-------+--------+
                          |
                          | Coverage >= threshold (e.g., 70% of zone area walked)
                          v
                  +----------------+
                  |   BASELINE     |  First complete survey
                  +-------+--------+
                          |
                          | Weekly snapshot cycle
                          v
                  +----------------+
                  |   SNAPSHOT_N   |  Subsequent observations
                  +-------+--------+
                          |
                          | Repeat weekly
                          v
                        (...)
```

### 3.2 Baseline Tracking Table

```sql
CREATE TABLE IF NOT EXISTS survey_campaigns (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  zone_id         uuid NOT NULL REFERENCES zones(id),
  vertical_id     text NOT NULL,
  campaign_type   text NOT NULL DEFAULT 'baseline'
                  CHECK (campaign_type IN ('baseline', 'snapshot', 'targeted')),
  status          text NOT NULL DEFAULT 'planned'
                  CHECK (status IN ('planned', 'in_progress', 'partial',
                                     'complete', 'archived')),
  -- Coverage tracking
  target_area_km2   real,
  covered_area_km2  real DEFAULT 0,
  coverage_pct      real DEFAULT 0
                    CHECK (coverage_pct >= 0 AND coverage_pct <= 100),
  target_entities   integer,          -- expected entity count (estimate)
  observed_entities integer DEFAULT 0,
  -- Temporal
  started_at      timestamptz,
  completed_at    timestamptz,
  snapshot_date   date,               -- the date this becomes a snapshot row
  -- Agents
  assigned_agents text[],
  -- Quality
  avg_confidence  real DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE(zone_id, vertical_id, snapshot_date)
);
```

### 3.3 Handling Partial Baselines

A partial baseline occurs when:
- An agent surveys only some streets in the zone
- A vertical is partially covered (e.g., pharmacies found but not all mobile money kiosks)
- Bad weather or time constraints end a survey early

**Rules:**
1. A baseline is "complete" when `coverage_pct >= 70` AND `observed_entities >= target_entities * 0.6`
2. Below that threshold, it remains "partial" and deltas are computed with a `partial_baseline` flag
3. Partial baselines are valid for presence checks ("this entity exists") but NOT for absence checks ("this entity was removed") -- because absence may mean "agent didn't walk that street"

**In the existing `computeDeltas()` function**, this means:

```typescript
// In snapshotEngine.ts, before computing deltas:
if (campaign.status === 'partial') {
  // Do NOT generate 'removed' deltas for partial baselines.
  // An entity missing from a partial survey may simply not have been visited.
  deltas = deltas.filter(d => d.deltaType !== 'removed');
  // Flag all deltas from partial baselines
  deltas.forEach(d => {
    d.confidence *= 0.6; // reduce confidence
    d.deltaSummary = `[PARTIAL] ${d.deltaSummary}`;
  });
}
```

### 3.4 Versioning Strategy

Entity state over time is already captured by the snapshot system. Each `snapshots` row is a point-in-time record of an entity's state. To query historical state:

```sql
-- What was entity X on date Y?
SELECT * FROM snapshots
WHERE point_id = $1
  AND snapshot_date <= $2
ORDER BY snapshot_date DESC
LIMIT 1;

-- Full history of entity X
SELECT * FROM snapshots
WHERE point_id = $1
ORDER BY snapshot_date ASC;
```

**Version numbering convention:**

```
Entity Version = snapshot_date ordinal for that entity

Example:
  ent_abc... was first seen on 2026-03-03 -> v1 (baseline)
  Observed again on 2026-03-10            -> v2
  Changed on 2026-03-17                   -> v3
  Not seen on 2026-03-24                  -> v3 (unchanged; no new version)
  Marked removed on 2026-03-31            -> v4 (terminal)
```

No explicit version column is needed because the `(point_id, snapshot_date)` composite key already provides versioning. The `snapshots` table is an append-only time-series.

---

## 4. Delta Computation Rules

### 4.1 Per-Vertical Delta Definitions

The existing `computeDeltas()` function in `snapshotEngine.ts` already handles the 4 delta types (new, removed, changed, unchanged) with field-level diffing. Below are the vertical-specific rules for what constitutes a meaningful delta and its severity.

#### Billboard

| Change | Delta Type | Severity | Min Interval |
|--------|-----------|----------|--------------|
| New billboard installed | new | medium | -- |
| Billboard removed/demolished | removed | high | -- |
| Advertiser/content changed | changed | high | 7 days |
| Condition degraded (good->faded) | changed | low | 7 days |
| Blank/unused billboard | changed | medium | 7 days |
| Illumination status changed | changed | low | 7 days |

```typescript
const BILLBOARD_DELTA_RULES: DeltaRules = {
  significantFields: ['brand', 'contentCategory', 'condition'],
  criticalFields: [],
  highFields: ['brand', 'contentCategory'],
  mediumFields: ['format', 'size'],
  lowFields: ['condition', 'illuminated', 'facingDirection'],
  minObservationIntervalDays: 7,
};
```

#### Alcohol Outlet

| Change | Delta Type | Severity | Min Interval |
|--------|-----------|----------|--------------|
| New outlet opened | new | medium | -- |
| Outlet closed permanently | removed | high | -- |
| Type changed (bar->nightclub) | changed | medium | 14 days |
| Hours changed | changed | low | 7 days |
| New brand offered | changed | low | 7 days |

#### Census

| Change | Delta Type | Severity | Min Interval |
|--------|-----------|----------|--------------|
| New structure detected | new | high | -- |
| Structure demolished | removed | critical | -- |
| Occupancy changed (occupied->vacant) | changed | high | 30 days |
| Infrastructure change (electricity added) | changed | medium | 30 days |
| Condition change (good->poor) | changed | medium | 30 days |
| Storey count changed (expansion) | changed | high | 30 days |

```typescript
const CENSUS_DELTA_RULES: DeltaRules = {
  significantFields: ['structureType', 'occupancyStatus', 'storeyCount'],
  criticalFields: [],  // removal is always critical
  highFields: ['structureType', 'occupancyStatus', 'storeyCount', 'estimatedUnits'],
  mediumFields: ['condition', 'hasElectricity', 'hasRunningWater'],
  lowFields: ['roofMaterial', 'wallMaterial', 'accessRoad'],
  minObservationIntervalDays: 30,
};
```

#### Fuel Station

| Change | Delta Type | Severity | Min Interval |
|--------|-----------|----------|--------------|
| New station opened | new | high | -- |
| Station closed | removed | critical | -- |
| Price changed (> 5 XAF) | changed | critical | 1 day |
| Fuel availability changed | changed | high | 1 day |
| Fuel type added/removed | changed | medium | 7 days |
| Queue length changed | changed | low | 1 day |

```typescript
const FUEL_DELTA_RULES: DeltaRules = {
  significantFields: ['pricesByFuel', 'hasFuelAvailable', 'fuelTypes'],
  criticalFields: ['pricesByFuel'],
  highFields: ['hasFuelAvailable'],
  mediumFields: ['fuelTypes', 'paymentMethods'],
  lowFields: ['queueLength', 'openingHours', 'quality'],
  minObservationIntervalDays: 1,
  // Fuel prices: only flag if change > 5 XAF
  numericThresholds: {
    'pricesByFuel.*': 5,
  },
};
```

#### Mobile Money

| Change | Delta Type | Severity | Min Interval |
|--------|-----------|----------|--------------|
| New kiosk opened | new | medium | -- |
| Kiosk closed | removed | medium | -- |
| Cash availability changed | changed | high | 1 day |
| Provider added/removed | changed | medium | 7 days |
| Merchant ID changed | changed | low | 7 days |

#### Pharmacy

| Change | Delta Type | Severity | Min Interval |
|--------|-----------|----------|--------------|
| New pharmacy opened | new | high | -- |
| Pharmacy closed | removed | critical | -- |
| On-duty status changed | changed | critical | 1 day |
| Opening hours changed | changed | medium | 7 days |

#### Transport / Roads

| Change | Delta Type | Severity | Min Interval |
|--------|-----------|----------|--------------|
| New road observed | new | medium | -- |
| Road permanently closed | removed | critical | -- |
| Road blocked | changed | critical | 0 days (immediate) |
| Road unblocked | changed | critical | 0 days (immediate) |
| Condition changed | changed | medium | 7 days |
| Traffic level changed | changed | low | 1 day |

```typescript
const TRANSPORT_DELTA_RULES: DeltaRules = {
  significantFields: ['isBlocked', 'condition', 'blockageType'],
  criticalFields: ['isBlocked', 'blockageType'],
  highFields: ['condition'],
  mediumFields: ['surfaceType', 'laneCount'],
  lowFields: ['trafficLevel', 'hasStreetLights', 'hasDrainage'],
  minObservationIntervalDays: 0, // real-time for blockages
};
```

### 4.2 Severity Scoring

```typescript
type DeltaSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

function computeDeltaSeverity(
  verticalId: string,
  deltaType: DeltaType,
  deltaField: string | null,
  deltaMagnitude: number | null,
): DeltaSeverity {
  const rules = DELTA_RULES_BY_VERTICAL[verticalId];

  // Removals are always at least 'high'
  if (deltaType === 'removed') {
    return rules.criticalFields.length > 0 ? 'critical' : 'high';
  }

  // New entities
  if (deltaType === 'new') return 'medium';

  // Unchanged
  if (deltaType === 'unchanged') return 'info';

  // Changed: check field-level severity
  if (!deltaField) return 'low';

  if (rules.criticalFields.includes(deltaField)) return 'critical';
  if (rules.highFields.includes(deltaField)) return 'high';
  if (rules.mediumFields.includes(deltaField)) return 'medium';
  return 'low';
}
```

### 4.3 Minimum Observation Interval

To prevent noisy deltas from rapid re-observations, each vertical defines a minimum interval. The existing `computeDeltas()` compares snapshots which are weekly, so the minimum interval is already 7 days. For verticals with real-time needs (fuel prices, road blockages), the system supports intra-week "micro-snapshots":

```typescript
function isValidDelta(
  observation: ObservationEvent,
  previousObservation: ObservationEvent | null,
  rules: DeltaRules,
): boolean {
  if (!previousObservation) return true; // first observation

  const elapsed = Date.now() - new Date(previousObservation.createdAt).getTime();
  const minIntervalMs = rules.minObservationIntervalDays * 24 * 60 * 60 * 1000;

  return elapsed >= minIntervalMs;
}
```

### 4.4 Distinguishing Real Change from Observation Error

```
Decision tree:
  1. Same agent, same entity, < 1 hour apart?
     -> Likely a CORRECTION, not a delta.
        Keep the later observation. Mark earlier as superseded.

  2. Different agents, same entity, same day, conflicting values?
     -> Likely an OBSERVATION ERROR.
        Use the higher-confidence observation.
        Flag for validator review.

  3. Same entity, > minInterval apart, values differ?
     -> REAL DELTA. Compute and store.

  4. Values differ by < numericThreshold?
     -> Insignificant change. Store as 'unchanged'.
        (e.g., fuel price changes by 1 XAF are noise)
```

**Implementation as an extension to the existing `detectChangedFields()` in `snapshotEngine.ts`:**

```typescript
function isSignificantChange(
  field: string,
  prevValue: unknown,
  currValue: unknown,
  verticalId: string,
): boolean {
  const rules = DELTA_RULES_BY_VERTICAL[verticalId];
  if (!rules) return true; // unknown vertical -> always significant

  // Check numeric thresholds
  if (typeof prevValue === 'number' && typeof currValue === 'number') {
    const thresholdKey = Object.keys(rules.numericThresholds ?? {})
      .find(k => field === k || field.startsWith(k.replace('.*', '')));
    if (thresholdKey) {
      const threshold = rules.numericThresholds![thresholdKey];
      if (Math.abs(currValue - prevValue) < threshold) return false;
    }
  }

  return true;
}
```

### 4.5 Delta Aggregation

Individual deltas roll up to area-level change reports. The existing `snapshot_stats` table already aggregates by vertical per snapshot date. The extension adds zone-level aggregation:

```sql
-- Zone-level aggregate view
CREATE OR REPLACE VIEW zone_delta_summary AS
SELECT
  s.snapshot_date,
  z.slug AS zone_slug,
  s.vertical_id,
  SUM(s.total_points) AS total_points,
  SUM(s.new_count) AS new_count,
  SUM(s.removed_count) AS removed_count,
  SUM(s.changed_count) AS changed_count,
  SUM(s.unchanged_count) AS unchanged_count,
  ROUND(AVG(s.completion_rate), 2) AS avg_completion_rate,
  -- Churn rate: (new + removed) / total
  CASE WHEN SUM(s.total_points) > 0
    THEN ROUND(
      (SUM(s.new_count) + SUM(s.removed_count))::numeric
      / SUM(s.total_points) * 100, 2
    )
    ELSE 0
  END AS churn_rate_pct
FROM snapshot_stats s
JOIN zones z ON z.id = s.zone_id
GROUP BY s.snapshot_date, z.slug, s.vertical_id
ORDER BY s.snapshot_date DESC, z.slug, s.vertical_id;
```

---

## 5. Data Quality Scoring

### 5.1 Per-Observation Confidence Score

Each observation receives a confidence score between 0.0 and 1.0, computed from multiple signals. The existing `submissionFraud.ts` already computes GPS match scores; this extends the approach.

```typescript
interface ObservationConfidenceFactors {
  gpsAccuracy: number;      // 0 to 0.25
  photoQuality: number;     // 0 to 0.20
  agentReliability: number; // 0 to 0.25
  dataCompleteness: number; // 0 to 0.15
  temporalFreshness: number;// 0 to 0.10
  fraudSignal: number;      // -0.30 to 0.05
}

function computeObservationConfidence(
  event: ObservationEvent,
  agent: UserProfile,
  fraudCheck: SubmissionFraudCheck | null,
): number {
  let score = 0;

  // 1. GPS Accuracy (0 to 0.25)
  const accuracyM = event.gpsAccuracyM ?? 50;
  if (accuracyM <= 5) score += 0.25;
  else if (accuracyM <= 10) score += 0.22;
  else if (accuracyM <= 20) score += 0.18;
  else if (accuracyM <= 50) score += 0.12;
  else score += 0.05;

  // 2. Photo Quality (0 to 0.20)
  if (event.photoUrl) {
    score += 0.10; // photo exists
    if (fraudCheck?.primaryPhoto?.exifStatus === 'ok') score += 0.05;
    if (fraudCheck?.primaryPhoto?.gps) score += 0.05;
  }

  // 3. Agent Reliability (0 to 0.25)
  const agentTrust = agent.trust_score ?? 0.5;
  score += agentTrust * 0.25;

  // 4. Data Completeness (0 to 0.15)
  // What fraction of enrichable fields were filled?
  const vertical = getVertical(event.category);
  const totalFields = vertical.enrichableFields.length + vertical.createRequiredFields.length;
  const filledFields = totalFields - (event.gaps?.length ?? totalFields);
  const completeness = totalFields > 0 ? filledFields / totalFields : 0;
  score += completeness * 0.15;

  // 5. Temporal Freshness (0 to 0.10)
  // How recently was the EXIF timestamp relative to submission?
  if (fraudCheck?.primaryPhoto?.capturedAt) {
    const capturedAt = new Date(fraudCheck.primaryPhoto.capturedAt).getTime();
    const submittedAt = new Date(event.createdAt).getTime();
    const ageMinutes = (submittedAt - capturedAt) / (1000 * 60);
    if (ageMinutes < 5) score += 0.10;
    else if (ageMinutes < 30) score += 0.08;
    else if (ageMinutes < 60) score += 0.05;
    else score += 0.02;
  }

  // 6. Fraud Signal (-0.30 to 0.05)
  if (fraudCheck?.primaryPhoto?.submissionGpsMatch === false) {
    score -= 0.30; // photo GPS doesn't match submission location
  } else if (fraudCheck?.primaryPhoto?.submissionGpsMatch === true) {
    score += 0.05;
  }

  return Math.max(0, Math.min(1, score));
}
```

### 5.2 Per-Entity Confidence Score

Entity confidence is an aggregate of all observations for that entity.

```typescript
function computeEntityConfidence(
  entity: ProjectedPoint,
  observations: ObservationEvent[],
): number {
  if (observations.length === 0) return 0;

  // Weighted average of observation confidences, with recency bias
  const now = Date.now();
  let weightedSum = 0;
  let totalWeight = 0;

  for (const obs of observations) {
    const ageMs = now - new Date(obs.createdAt).getTime();
    const ageDays = ageMs / (1000 * 60 * 60 * 24);

    // Exponential decay: half-life of 30 days
    const recencyWeight = Math.pow(0.5, ageDays / 30);
    const weight = recencyWeight;

    weightedSum += obs.confidence * weight;
    totalWeight += weight;
  }

  let baseConfidence = totalWeight > 0 ? weightedSum / totalWeight : 0;

  // Bonus for multiple observers (corroboration)
  const uniqueAgents = new Set(observations.map(o => o.userId)).size;
  if (uniqueAgents >= 3) baseConfidence += 0.10;
  else if (uniqueAgents >= 2) baseConfidence += 0.05;

  // Bonus for observation count
  if (observations.length >= 5) baseConfidence += 0.05;
  else if (observations.length >= 3) baseConfidence += 0.03;

  // Penalty for gaps
  const gapPenalty = (entity.gaps?.length ?? 0) * 0.02;
  baseConfidence -= gapPenalty;

  return Math.max(0, Math.min(1, baseConfidence));
}
```

### 5.3 Per-Delta Confidence Score

Delta confidence depends on the quality of both the "before" and "after" observations.

```typescript
function computeDeltaConfidence(
  beforeObservation: { confidence: number } | null,
  afterObservation: { confidence: number },
  deltaType: DeltaType,
): number {
  if (deltaType === 'new') {
    // New entity: confidence is just the observation confidence
    return afterObservation.confidence;
  }

  if (deltaType === 'removed') {
    // Removed: we need to be confident it was there before AND
    // confident we surveyed the area (it's not just a partial baseline miss)
    return (beforeObservation?.confidence ?? 0) * 0.8;
  }

  if (deltaType === 'unchanged') {
    return Math.min(
      beforeObservation?.confidence ?? 0,
      afterObservation.confidence,
    );
  }

  // Changed: minimum of before and after
  const before = beforeObservation?.confidence ?? 0;
  const after = afterObservation.confidence;
  return Math.min(before, after);
}
```

### 5.4 Agent Trust Score

Agent trust evolves over time based on their track record.

```typescript
function updateAgentTrustScore(
  agent: UserProfile,
  validationResult: 'confirmed' | 'corrected' | 'rejected',
): number {
  const current = agent.trust_score ?? 0.5;
  const total = agent.total_observations ?? 0;

  // Bayesian update with prior of 0.5
  const priorWeight = 10; // pseudo-count (how many observations before prior fades)
  const priorSum = 0.5 * priorWeight;

  let confirmed = (current * (total + priorWeight)) - priorSum + priorWeight * 0.5;
  // This is approximate; the real approach:

  switch (validationResult) {
    case 'confirmed':
      return Math.min(1.0, current + (1 - current) * 0.02);
    case 'corrected':
      return Math.max(0.1, current - 0.03);
    case 'rejected':
      return Math.max(0.05, current - 0.10);
  }
}
```

---

## 6. Temporal Model

### 6.1 Time Representation

**Rule: All timestamps stored as `timestamptz` (UTC internally). All API responses include ISO 8601 with timezone offset.**

The existing codebase already uses ISO 8601 strings (e.g., `new Date().toISOString()` produces `2026-03-03T12:00:00.000Z`). This is correct.

For display purposes, the Cameroon timezone offset is `UTC+01:00` (WAT, West Africa Time). Cameroon does not observe daylight saving time, so the offset is constant.

```typescript
// lib/shared/time.ts

const CAMEROON_TZ = 'Africa/Douala'; // UTC+01:00, no DST

export function toLocalDisplay(isoString: string, language: 'en' | 'fr'): string {
  const date = new Date(isoString);
  return date.toLocaleString(language === 'fr' ? 'fr-CM' : 'en-CM', {
    timeZone: CAMEROON_TZ,
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export function toSnapshotDate(date: Date = new Date()): string {
  // Snapshot dates are always in local Cameroon time
  // to avoid confusion (a Monday 03:00 UTC snapshot is
  // still Monday 04:00 WAT)
  return date.toLocaleDateString('en-CA', { timeZone: CAMEROON_TZ });
  // Returns YYYY-MM-DD
}
```

### 6.2 "As-Of" Queries

"What was the state of Bonamoussadi billboards on 2026-02-15?"

The snapshot system already supports this. The `snapshots` table stores point-in-time state per entity per week.

```sql
-- All billboard entities as of a specific date
SELECT
  s.point_id,
  s.site_name,
  s.latitude,
  s.longitude,
  s.details,
  s.gaps,
  s.events_count,
  s.snapshot_date AS state_as_of
FROM snapshots s
WHERE s.vertical_id = 'billboard'
  AND s.snapshot_date = (
    SELECT MAX(snapshot_date)
    FROM snapshots
    WHERE vertical_id = 'billboard'
      AND snapshot_date <= '2026-02-15'
  );
```

For entity-level history:

```sql
-- Full history of a specific entity
SELECT
  s.snapshot_date,
  s.details,
  d.delta_type,
  d.delta_field,
  d.previous_value,
  d.current_value,
  d.delta_summary
FROM snapshots s
LEFT JOIN snapshot_deltas d
  ON d.point_id = s.point_id
  AND d.snapshot_date = s.snapshot_date
WHERE s.point_id = $1
ORDER BY s.snapshot_date ASC;
```

### 6.3 Clock Drift on Offline Mobile Devices

Mobile devices in Bonamoussadi may have incorrect system clocks (wrong timezone, NTP not synced, manual time set). The design handles this through three mechanisms:

**Mechanism 1: Dual timestamps**

Every observation stores both:
- `device_clock_at`: The raw time from the device when the observation was recorded
- `server_received_at`: The time the server first received the data (set server-side, always accurate)
- `created_at`: The canonical timestamp, which uses server time when available

```typescript
// In offlineQueue.ts, when enqueueing:
const item: QueueItem = {
  // ...existing fields...
  payload: {
    ...payload,
    details: {
      ...(payload.details ?? {}),
      _deviceClockAt: new Date().toISOString(),
    },
  },
};
```

**Mechanism 2: Clock drift detection**

```typescript
function detectClockDrift(
  deviceClockAt: string | null,
  serverReceivedAt: string,
): { driftMs: number; driftSeverity: 'none' | 'minor' | 'major' } {
  if (!deviceClockAt) return { driftMs: 0, driftSeverity: 'none' };

  const deviceTime = new Date(deviceClockAt).getTime();
  const serverTime = new Date(serverReceivedAt).getTime();
  const driftMs = deviceTime - serverTime;
  const absDriftMs = Math.abs(driftMs);

  let driftSeverity: 'none' | 'minor' | 'major';
  if (absDriftMs < 5 * 60 * 1000) driftSeverity = 'none';       // < 5 min
  else if (absDriftMs < 60 * 60 * 1000) driftSeverity = 'minor'; // < 1 hour
  else driftSeverity = 'major';                                    // > 1 hour

  return { driftMs, driftSeverity };
}
```

**Mechanism 3: EXIF cross-reference**

The existing `submissionFraud.ts` already extracts EXIF `DateTimeOriginal` from photos. Compare the photo capture time with both device clock and server time to triangulate the true observation time.

```
If EXIF time is close to server time but far from device clock:
  -> Device clock is wrong. Use server time.

If EXIF time is close to device clock but far from server time:
  -> Data was collected offline and synced later. Use EXIF time.

If all three times are close:
  -> No drift. Use server time.

If all three times differ:
  -> Use server_received_at minus estimated transit delay.
```

### 6.4 Retention and Archival Policies

| Data Type | Hot Storage | Warm Storage | Cold/Archive |
|-----------|-------------|--------------|--------------|
| `point_events` (observations) | Last 12 months | 12-36 months | 36+ months |
| `snapshots` (weekly state) | Last 52 weeks | 2-5 years | 5+ years |
| `snapshot_deltas` (changes) | Last 52 weeks | 2-5 years | 5+ years |
| `snapshot_stats` (aggregates) | All time | -- | -- |
| `media` (photos/videos) | Last 6 months full-res | 6-24 months (thumbnails) | Deleted after 24 months |
| `merge_candidates` (resolved) | Last 3 months | 3-12 months | Deleted |

**Implementation via database partitioning:**

```sql
-- Example: partition snapshots by quarter
-- (not needed at current scale, but ready for growth)

-- For now, a simple archival policy:
-- Run monthly via Vercel Cron

-- Archive observations older than 12 months to cold storage
-- (In practice, move to a separate Postgres schema or S3 export)

-- Delete resolved merge candidates older than 3 months
DELETE FROM merge_candidates
WHERE decision IN ('merged', 'rejected', 'distinct')
  AND resolved_at < now() - interval '3 months';
```

**Compliance note (Law No. 2024/017):** Personal data (agent profiles, phone numbers, photos with faces) must be deletable upon request. The design supports this because:
1. Agent identity is stored separately in `user_profiles`
2. Observations reference agents by `user_id`, which can be anonymized
3. Photos are stored in Vercel Blob with deterministic URLs, enabling bulk deletion
4. A `data_deletion_requests` table tracks GDPR/local-law deletion requests

```sql
CREATE TABLE IF NOT EXISTS data_deletion_requests (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         text NOT NULL,
  request_type    text NOT NULL CHECK (request_type IN ('anonymize', 'delete_all')),
  status          text NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'in_progress', 'completed', 'failed')),
  requested_at    timestamptz NOT NULL DEFAULT now(),
  completed_at    timestamptz,
  details         jsonb DEFAULT '{}'
);
```

---

## Summary: What Changes in the Existing Codebase

The design above is intentionally additive. It builds on the existing architecture rather than replacing it.

**New files to create:**
- `lib/shared/id.ts` -- UUID v7 generation with prefixes
- `lib/shared/time.ts` -- timezone utilities
- `lib/server/deduplication.ts` -- entity deduplication engine
- `lib/server/confidenceScoring.ts` -- quality scoring functions

**Existing files to extend:**
- `shared/verticals.ts` -- add `census` and `transport_road` vertical configs
- `shared/types.ts` -- add new TypeScript interfaces (CensusDetails, TransportRoadDetails, etc.)
- `shared/geofence.ts` -- migrate hardcoded bounds to database-driven zone lookup
- `lib/server/snapshotEngine.ts` -- add severity scoring, confidence scoring, partial baseline handling
- `lib/server/pointProjection.ts` -- add entity confidence computation
- `lib/client/offlineQueue.ts` -- add device clock timestamp to queued items

**New database migrations:**
- `20260304_zones_table.sql` -- zones table
- `20260304_locations_table.sql` -- locations table
- `20260304_entities_table.sql` -- materialized entities table
- `20260304_media_table.sql` -- media table
- `20260304_extend_point_events.sql` -- new columns on point_events
- `20260304_extend_user_profiles.sql` -- agent trust scoring columns
- `20260304_extend_snapshot_deltas.sql` -- severity and confidence columns
- `20260304_merge_candidates.sql` -- deduplication queue
- `20260304_survey_campaigns.sql` -- baseline tracking
- `20260304_data_deletion_requests.sql` -- compliance
- `20260304_add_new_verticals.sql` -- add census and transport_road to category CHECK constraint
