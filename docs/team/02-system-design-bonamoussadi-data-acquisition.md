# ADL System Design: Bonamoussadi Data Acquisition System

**Author:** Teammate 2 -- System Design Expert
**Date:** 2026-03-03
**Status:** Technical design -- ready for engineering review
**Scope:** End-to-end data collection and management system for 7 verticals in Bonamoussadi, Douala, Cameroon
**Verticals:** Billboards, Alcohol Outlets, Census/Ground Truth, Fuel Stations, Mobile Money Kiosks, Pharmacies, Transport/Blocked Roads
**Predecessor:** [02-system-design.md](./02-system-design.md) (general system design)

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

The data model extends ADL's existing event-sourced architecture (`point_events` -> projected state -> snapshots -> deltas) with formalized entity layers.

```
                         +------------------+
                         |      Zone        |
                         | (Bonamoussadi)   |
                         +--------+---------+
                                  |
                          1       |      *
                         +--------v---------+
                         |    Location      |
                         | (physical place) |
                         +--------+---------+
                                  |
                          1       |      *
                         +--------v---------+
                         |     Entity       |
                         | (business/asset) |
                         +--------+---------+
                                  |
                          1       |      *
                         +--------v---------+         +----------+
                         |   Observation    |-------->|  Media   |
                         | (field visit)    |  1   *  | (photos) |
                         +--------+---------+         +----------+
                                  |
                          2       |      *    (requires pair)
                         +--------v---------+
                         |     Delta        |
                         | (computed diff)  |
                         +---------+--------+
                                   |
                          *        |      1
                         +---------v--------+
                         |     Agent        |
                         | (field worker)   |
                         +------------------+
```

**Key relationships:**
- A Zone contains many Locations (a geofenced area like Bonamoussadi)
- A Location hosts one or more Entities (a GPS coordinate can have a pharmacy AND a mobile money kiosk)
- An Entity has many Observations over time (each field visit produces one Observation)
- An Observation captures one or more Media items (photos, videos)
- A Delta is computed from exactly two Observations of the same Entity (before/after)
- An Agent (field worker) produces many Observations

**Alignment with existing code:**
- `point_events` table = Observation events (CREATE_EVENT, ENRICH_EVENT)
- `ProjectedPoint` = the current materialized state of an Entity
- `snapshots` table = frozen Entity state at a point in time
- `snapshot_deltas` table = computed Deltas
- `user_profiles` table = Agent profiles

### 1.2 Core Entity Schemas

#### 1.2.1 Zone

Zones are geofenced operational areas. Bonamoussadi is the pilot zone.

```sql
CREATE TABLE IF NOT EXISTS zones (
  id text PRIMARY KEY,                         -- e.g., 'bonamoussadi'
  name_en text NOT NULL,                       -- 'Bonamoussadi'
  name_fr text NOT NULL,                       -- 'Bonamoussadi'
  country text NOT NULL DEFAULT 'CM',          -- ISO 3166-1 alpha-2
  city text NOT NULL,                          -- 'Douala'
  arrondissement text,                         -- 'Douala V'
  bounds_south double precision NOT NULL,      -- 4.0755
  bounds_west double precision NOT NULL,       -- 9.7185
  bounds_north double precision NOT NULL,      -- 4.0999
  bounds_east double precision NOT NULL,       -- 9.7602
  center_latitude double precision NOT NULL,   -- 4.0877
  center_longitude double precision NOT NULL,  -- 9.7394
  timezone text NOT NULL DEFAULT 'Africa/Douala', -- IANA timezone
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'planned', 'archived')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
```

**Note:** This formalizes what already exists in `shared/geofence.ts` as `BONAMOUSSADI_BOUNDS` and `BONAMOUSSADI_CENTER`. The existing constants remain as code-level shortcuts for the pilot zone.

#### 1.2.2 Location

A Location is a physical place on the ground, identified by GPS coordinates. Multiple entities can share one location (e.g., a pharmacy next door to a mobile money kiosk in the same building).

```sql
CREATE TABLE IF NOT EXISTS locations (
  id text PRIMARY KEY,                          -- 'loc_0192a3b4c5d6' (see ID system below)
  zone_id text NOT NULL REFERENCES zones(id),
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  geohash text NOT NULL,                        -- geohash-6 for proximity queries (~1.2km precision)
  geohash_precise text NOT NULL,                -- geohash-9 for dedup (~4.8m precision)
  altitude_m double precision,                  -- meters above sea level (if available)
  gps_accuracy_m double precision,              -- horizontal accuracy in meters from device
  landmark_description text,                    -- 'Behind Total station, facing the pharmacy'
  landmark_description_fr text,                 -- French equivalent
  road_name text,                               -- informal or formal road name
  quarter text,                                 -- sub-neighborhood: 'Denver', 'Tradex side'
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by_agent text                         -- agent who first created this location
);

CREATE INDEX idx_locations_zone ON locations (zone_id);
CREATE INDEX idx_locations_geohash ON locations (geohash);
CREATE INDEX idx_locations_geohash_precise ON locations (geohash_precise);
CREATE INDEX idx_locations_coords ON locations
  USING gist (point(longitude, latitude));
```

**Example row:**
```json
{
  "id": "loc_0192a3b4c5d6",
  "zone_id": "bonamoussadi",
  "latitude": 4.0891,
  "longitude": 9.7412,
  "geohash": "s10tqk",
  "geohash_precise": "s10tqk4w7",
  "gps_accuracy_m": 8.5,
  "landmark_description": "Next to Tradex fuel station, opposite the pharmacy de garde",
  "landmark_description_fr": "A cote de la station Tradex, en face de la pharmacie de garde",
  "road_name": "Rue de Denver",
  "quarter": "Denver"
}
```

#### 1.2.3 Entity

An Entity is a business, asset, or infrastructure point at a Location. This maps directly to the existing `ProjectedPoint` concept and the `point_events.point_id` grouping.

```sql
CREATE TABLE IF NOT EXISTS entities (
  id text PRIMARY KEY,                          -- 'ent_pharmacy_0192a3b4c5d6'
  location_id text NOT NULL REFERENCES locations(id),
  zone_id text NOT NULL REFERENCES zones(id),
  vertical text NOT NULL,                       -- 'pharmacy', 'fuel_station', etc.
  name text,                                    -- 'Pharmacie du Bonheur'
  formal_status text DEFAULT 'unknown'
    CHECK (formal_status IN ('formal', 'informal', 'unknown')),
  operational_status text DEFAULT 'active'
    CHECK (operational_status IN ('active', 'closed_temporary', 'closed_permanent', 'unknown')),
  first_observed_at timestamptz NOT NULL,
  last_observed_at timestamptz NOT NULL,
  observation_count integer NOT NULL DEFAULT 1,
  details jsonb NOT NULL DEFAULT '{}',          -- vertical-specific fields (see extensions)
  gaps text[] DEFAULT '{}',                     -- missing enrichable fields
  confidence_score numeric(3,2) DEFAULT 0.50,   -- 0.00 to 1.00
  photo_url text,
  source text,                                  -- 'field_agent', 'osm_import', 'seed_data'
  external_id text,                             -- ID in external system
  canonical_entity_id text,                     -- points to merged entity if deduplicated
  is_canonical boolean NOT NULL DEFAULT true,   -- false if merged into another entity
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT valid_vertical CHECK (vertical IN (
    'pharmacy', 'fuel_station', 'mobile_money',
    'alcohol_outlet', 'billboard', 'transport_road',
    'census_ground_truth'
  ))
);

CREATE INDEX idx_entities_zone_vertical ON entities (zone_id, vertical);
CREATE INDEX idx_entities_location ON entities (location_id);
CREATE INDEX idx_entities_vertical_status ON entities (vertical, operational_status);
CREATE INDEX idx_entities_canonical ON entities (canonical_entity_id) WHERE canonical_entity_id IS NOT NULL;
CREATE INDEX idx_entities_external ON entities (external_id) WHERE external_id IS NOT NULL;
```

**Alignment with existing code:** This formalizes what `projectPointsFromEvents()` in `/lib/server/pointProjection.ts` computes at runtime. The existing `point_events` table remains the source-of-truth event log; `entities` is the materialized projection (currently computed on-the-fly as `ProjectedPoint`).

#### 1.2.4 Observation

An Observation is a single field visit or data capture event. This maps directly to the existing `point_events` table with additional quality metadata.

```sql
-- The existing point_events table IS the observation store.
-- Below documents the extended schema for the data acquisition system.

CREATE TABLE IF NOT EXISTS observations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id text NOT NULL REFERENCES entities(id),
  agent_id text NOT NULL REFERENCES agents(id),
  zone_id text NOT NULL REFERENCES zones(id),
  vertical text NOT NULL,

  -- Event classification
  event_type text NOT NULL
    CHECK (event_type IN ('CREATE_EVENT', 'ENRICH_EVENT', 'VERIFY_EVENT', 'CLOSE_EVENT')),
  observation_type text NOT NULL DEFAULT 'field_visit'
    CHECK (observation_type IN ('field_visit', 'remote_survey', 'import', 'automated')),

  -- Location at time of observation (agent's GPS, may differ from entity location)
  agent_latitude double precision NOT NULL,
  agent_longitude double precision NOT NULL,
  agent_gps_accuracy_m double precision,
  agent_altitude_m double precision,

  -- Captured data
  details jsonb NOT NULL DEFAULT '{}',
  photo_urls text[] DEFAULT '{}',
  photo_count integer NOT NULL DEFAULT 0,

  -- Temporal
  observed_at timestamptz NOT NULL,             -- when the agent actually observed (from device clock)
  device_clock_offset_ms integer,               -- estimated offset from server time
  received_at timestamptz NOT NULL DEFAULT now(), -- when server received this observation
  synced_at timestamptz,                        -- when offline observation was synced

  -- Quality signals
  gps_accuracy_m double precision,
  observation_duration_s integer,               -- how long the agent spent at the location
  is_offline_submission boolean NOT NULL DEFAULT false,

  -- Fraud / validation
  fraud_check jsonb,                            -- SubmissionFraudCheck object
  client_device jsonb,                          -- ClientDeviceInfo object
  validation_status text NOT NULL DEFAULT 'pending'
    CHECK (validation_status IN ('pending', 'validated', 'rejected', 'needs_review')),
  validated_by text,
  validated_at timestamptz,

  -- Lineage
  source text DEFAULT 'field_agent',
  external_id text,
  idempotency_key text UNIQUE,
  baseline_snapshot_id uuid,                    -- if this observation is part of a baseline survey

  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_obs_entity_date ON observations (entity_id, observed_at DESC);
CREATE INDEX idx_obs_agent_date ON observations (agent_id, observed_at DESC);
CREATE INDEX idx_obs_zone_vertical_date ON observations (zone_id, vertical, observed_at DESC);
CREATE INDEX idx_obs_validation ON observations (validation_status, created_at DESC);
CREATE INDEX idx_obs_idempotency ON observations (idempotency_key) WHERE idempotency_key IS NOT NULL;
```

**Migration path:** The existing `point_events` table remains operational. The `observations` table extends it for the structured data acquisition system. A view or migration can bridge the two:

```sql
-- Bridge view: existing point_events exposed as observations
CREATE OR REPLACE VIEW observations_compat AS
SELECT
  id,
  point_id AS entity_id,
  user_id AS agent_id,
  'bonamoussadi' AS zone_id,
  category AS vertical,
  event_type,
  'field_visit' AS observation_type,
  latitude AS agent_latitude,
  longitude AS agent_longitude,
  NULL::double precision AS agent_gps_accuracy_m,
  NULL::double precision AS agent_altitude_m,
  details,
  CASE WHEN photo_url IS NOT NULL THEN ARRAY[photo_url] ELSE '{}' END AS photo_urls,
  CASE WHEN photo_url IS NOT NULL THEN 1 ELSE 0 END AS photo_count,
  created_at AS observed_at,
  NULL::integer AS device_clock_offset_ms,
  created_at AS received_at,
  NULL::timestamptz AS synced_at,
  (details->>'confidenceScore')::numeric AS gps_accuracy_m,
  NULL::integer AS observation_duration_s,
  false AS is_offline_submission,
  details->'fraudCheck' AS fraud_check,
  details->'clientDevice' AS client_device,
  'pending' AS validation_status,
  NULL AS validated_by,
  NULL::timestamptz AS validated_at,
  source,
  external_id,
  NULL AS idempotency_key,
  NULL::uuid AS baseline_snapshot_id,
  created_at
FROM point_events;
```

#### 1.2.5 Delta

Deltas are computed differences between two observations of the same entity. This extends the existing `snapshot_deltas` table.

```sql
-- The existing snapshot_deltas table handles weekly aggregate deltas.
-- This table adds observation-pair-level deltas for finer granularity.

CREATE TABLE IF NOT EXISTS entity_deltas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id text NOT NULL REFERENCES entities(id),
  zone_id text NOT NULL REFERENCES zones(id),
  vertical text NOT NULL,

  -- The two observations being compared
  before_observation_id uuid NOT NULL REFERENCES observations(id),
  after_observation_id uuid NOT NULL REFERENCES observations(id),
  before_observed_at timestamptz NOT NULL,
  after_observed_at timestamptz NOT NULL,
  time_gap_hours numeric NOT NULL,              -- hours between observations

  -- Delta classification
  delta_type text NOT NULL
    CHECK (delta_type IN ('new', 'removed', 'changed', 'unchanged', 'reopened')),
  delta_field text,                             -- which field changed (null for new/removed)
  previous_value text,
  current_value text,
  delta_magnitude numeric,                      -- numeric difference if applicable
  delta_direction text
    CHECK (delta_direction IN ('increase', 'decrease', 'stable', 'not_applicable')),
  delta_summary text,                           -- human-readable summary

  -- Significance scoring
  severity text NOT NULL DEFAULT 'low'
    CHECK (severity IN ('critical', 'high', 'medium', 'low', 'info')),
  significance_score numeric(3,2) NOT NULL DEFAULT 0.50,  -- 0.00 to 1.00
  confidence_score numeric(3,2) NOT NULL DEFAULT 0.50,    -- based on observation quality

  -- Aggregation support
  is_meaningful boolean NOT NULL DEFAULT true,  -- false for noise/trivial changes
  snapshot_date date,                           -- links to weekly snapshot if applicable

  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_deltas_entity_date ON entity_deltas (entity_id, after_observed_at DESC);
CREATE INDEX idx_deltas_zone_vertical ON entity_deltas (zone_id, vertical, after_observed_at DESC);
CREATE INDEX idx_deltas_type_severity ON entity_deltas (delta_type, severity, after_observed_at DESC);
CREATE INDEX idx_deltas_snapshot ON entity_deltas (snapshot_date DESC, vertical) WHERE snapshot_date IS NOT NULL;
```

#### 1.2.6 Agent

Agents are field workers who collect data. This extends the existing `user_profiles` table.

```sql
CREATE TABLE IF NOT EXISTS agents (
  id text PRIMARY KEY,                          -- same as user_profiles.id
  user_profile_id text NOT NULL REFERENCES user_profiles(id),
  zone_id text NOT NULL REFERENCES zones(id),
  agent_code text UNIQUE NOT NULL,              -- 'AGT-014' (human-readable)

  -- Capabilities
  assigned_verticals text[] NOT NULL DEFAULT '{}',  -- which verticals this agent covers
  assigned_sectors text[] DEFAULT '{}',             -- sub-zones within Bonamoussadi
  max_daily_observations integer DEFAULT 50,

  -- Performance tracking
  total_observations integer NOT NULL DEFAULT 0,
  validated_observations integer NOT NULL DEFAULT 0,
  rejected_observations integer NOT NULL DEFAULT 0,
  reliability_score numeric(3,2) NOT NULL DEFAULT 0.50,  -- 0.00 to 1.00
  avg_gps_accuracy_m numeric,
  avg_observation_duration_s numeric,
  last_active_at timestamptz,

  -- Device info
  primary_device_id text,                       -- from ClientDeviceInfo.deviceId
  device_platform text,
  is_low_end_device boolean DEFAULT false,

  -- Status
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'suspended', 'inactive', 'training')),

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_agents_zone ON agents (zone_id, status);
CREATE INDEX idx_agents_reliability ON agents (reliability_score DESC);
```

**Example row:**
```json
{
  "id": "usr_abc123",
  "user_profile_id": "usr_abc123",
  "zone_id": "bonamoussadi",
  "agent_code": "AGT-014",
  "assigned_verticals": ["pharmacy", "mobile_money"],
  "assigned_sectors": ["Denver", "Tradex"],
  "reliability_score": 0.87,
  "total_observations": 234,
  "validated_observations": 219,
  "rejected_observations": 8,
  "status": "active"
}
```

#### 1.2.7 Media

Media captures evidence for observations.

```sql
CREATE TABLE IF NOT EXISTS media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  observation_id uuid NOT NULL REFERENCES observations(id),
  entity_id text NOT NULL REFERENCES entities(id),
  agent_id text NOT NULL REFERENCES agents(id),

  -- File info
  media_type text NOT NULL CHECK (media_type IN ('photo', 'video', 'audio')),
  url text NOT NULL,                            -- Vercel Blob URL
  thumbnail_url text,
  file_size_bytes integer,
  mime_type text,                               -- 'image/jpeg', 'image/webp'
  width_px integer,
  height_px integer,

  -- EXIF / metadata
  exif_gps_latitude double precision,
  exif_gps_longitude double precision,
  exif_captured_at timestamptz,
  exif_device_make text,
  exif_device_model text,
  exif_status text CHECK (exif_status IN ('ok', 'missing', 'parse_error', 'unsupported_format', 'fallback_recovered')),

  -- Classification
  purpose text NOT NULL DEFAULT 'evidence'
    CHECK (purpose IN ('evidence', 'storefront', 'product', 'price_tag', 'signage', 'road_condition', 'billboard_creative')),
  is_primary boolean NOT NULL DEFAULT false,

  -- Quality
  blur_score numeric(3,2),                      -- 0.00 (sharp) to 1.00 (blurry)
  brightness_score numeric(3,2),                -- 0.00 (dark) to 1.00 (overexposed)

  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_media_observation ON media (observation_id);
CREATE INDEX idx_media_entity ON media (entity_id, created_at DESC);
```

### 1.3 Vertical-Specific Extensions

Each vertical stores its specific fields in the `details` JSONB column of the Entity and Observation tables. Below are the required and enrichable fields per vertical.

This directly extends the existing `VERTICALS` registry in `/shared/verticals.ts`.

#### 1.3.1 Pharmacy

```typescript
interface PharmacyDetails {
  // Required on create
  name: string;                    // 'Pharmacie du Bonheur'
  isOpenNow: boolean;              // true

  // Enrichable
  openingHours: string;            // '08:00-20:00'
  isOnDuty: boolean;               // true = pharmacie de garde
  phone: string;                   // '+237677123456'

  // Extended fields for data acquisition
  formalStatus: 'formal' | 'informal' | 'unknown';  // 'formal'
  licenseNumber: string;           // 'PH-DLA-2024-0142'
  ownerName: string;               // (optional, privacy-sensitive)
  drugCategories: string[];        // ['prescription', 'otc', 'vitamins']
  hasConsultationRoom: boolean;
  hasColdChain: boolean;           // cold storage for vaccines/insulin
  supplierSources: string[];       // ['CENAME', 'private_wholesaler']
  stockoutItems: string[];         // items currently out of stock
  nearestAlternativeId: string;    // entity_id of nearest open pharmacy
}
```

#### 1.3.2 Fuel Station

```typescript
interface FuelStationDetails {
  // Required on create
  name: string;                    // 'Total Bonamoussadi'
  hasFuelAvailable: boolean;

  // Enrichable
  fuelTypes: string[];             // ['super', 'diesel', 'kerosene']
  pricesByFuel: Record<string, number>;  // { 'super': 730, 'diesel': 690 }
  quality: string;                 // 'good', 'adulterated_suspected'
  paymentMethods: string[];        // ['cash', 'mobile_money']
  openingHours: string;

  // Extended
  operator: string;                // 'TotalEnergies'
  brand: string;                   // 'Total'
  pumpCount: number;               // 6
  hasLPG: boolean;
  hasLubricants: boolean;
  hasCarWash: boolean;
  hasConvenienceStore: boolean;
  queueLength: 'none' | 'short' | 'long' | 'extreme';
  estimatedWaitMinutes: number;
  lastDeliveryDate: string;        // ISO date
  stockLevel: 'full' | 'partial' | 'low' | 'empty';
}
```

#### 1.3.3 Mobile Money

```typescript
interface MobileMoneyDetails {
  // Required on create
  providers: string[];             // ['MTN MoMo', 'Orange Money']

  // Enrichable
  merchantIdByProvider: Record<string, string>;
  paymentMethods: string[];        // ['cash', 'transfer']
  openingHours: string;

  // Extended
  hasMin50000XafAvailable: boolean;
  floatLevel: 'high' | 'medium' | 'low' | 'empty';  // cash availability proxy
  maxTransactionXaf: number;       // maximum single transaction
  isAgent: boolean;                // true = official agent, false = informal reseller
  agentId: string;                 // official agent network ID
  feesPercentage: number;          // typical fee charged
  servicesOffered: string[];       // ['cash_in', 'cash_out', 'bill_pay', 'transfer']
  dailyTransactionEstimate: 'low' | 'medium' | 'high';
  hasSecurityCamera: boolean;
  operatingHoursActual: string;    // actual observed hours vs posted
}
```

#### 1.3.4 Alcohol Outlet

```typescript
interface AlcoholOutletDetails {
  // Required on create
  name: string;

  // Enrichable
  brand: string;                   // primary brand (e.g., 'Castel', '33 Export')
  openingHours: string;
  paymentMethods: string[];

  // Extended
  outletType: 'bar' | 'restaurant' | 'retail_shop' | 'informal_vendor' | 'off_license';
  licenseStatus: 'licensed' | 'unlicensed' | 'unknown';
  brandsSold: string[];            // ['33 Export', 'Castel', 'Guinness', 'Beaufort']
  hasRefrigeration: boolean;
  pricesByBrand: Record<string, number>;
  servesFood: boolean;
  hasSeating: boolean;
  estimatedDailyVolume: 'low' | 'medium' | 'high';
  supplierSource: string;          // 'Brasseries du Cameroun distributor'
}
```

#### 1.3.5 Billboard

```typescript
interface BillboardDetails {
  // Required on create
  name: string;                    // 'Billboard face Carrefour Denver'

  // Enrichable
  brand: string;                   // current advertiser brand

  // Extended
  format: 'standard' | 'large' | 'digital' | 'wall_paint' | 'banner' | 'poster';
  sizeMetersSq: number;            // estimated size in m^2
  orientation: 'north' | 'south' | 'east' | 'west' | 'unknown';
  height_m: number;                // height from ground
  illuminated: boolean;
  ownerCompany: string;            // billboard owner
  advertiserBrand: string;         // current campaign advertiser
  campaignName: string;            // campaign creative name
  campaignStartDate: string;       // ISO date
  campaignEndDate: string;         // ISO date
  isOccupied: boolean;             // false = blank/available
  conditionStatus: 'good' | 'damaged' | 'faded' | 'partially_obscured';
  trafficExposure: 'high' | 'medium' | 'low';
  permitNumber: string;
  facingRoadName: string;
}
```

#### 1.3.6 Transport / Blocked Roads

```typescript
interface TransportRoadDetails {
  // Required on create
  name: string;                    // 'Route Denver - Makepe' or 'Blocked road near pharmacy X'

  // Extended
  roadType: 'primary' | 'secondary' | 'tertiary' | 'alley' | 'unpaved';
  blockageType: 'construction' | 'flooding' | 'accident' | 'market_encroachment' | 'permanent_closure' | 'none';
  blockageSeverity: 'full' | 'partial' | 'passable_with_difficulty' | 'clear';
  blockageStartDate: string;       // ISO date (when blockage was first observed)
  blockageEstimatedEnd: string;    // ISO date (if known)
  alternateRoute: string;          // description of detour
  surfaceCondition: 'paved_good' | 'paved_damaged' | 'unpaved_passable' | 'unpaved_difficult' | 'flooded';
  trafficLevel: 'high' | 'medium' | 'low' | 'blocked';
  hasStreetLighting: boolean;
  hasdrainage: boolean;
  widthEstimate: 'one_lane' | 'two_lane' | 'multi_lane';
  motoTaxiAccessible: boolean;
  carAccessible: boolean;
  connectedLandmarks: string[];    // ['Total station', 'Marche Bonamoussadi']
}
```

#### 1.3.7 Census / Ground Truth

```typescript
interface CensusGroundTruthDetails {
  // Required on create
  name: string;                    // 'Block DEN-A14' or structure identifier

  // Extended
  structureType: 'residential' | 'commercial' | 'mixed' | 'industrial' | 'institutional' | 'vacant_land' | 'under_construction';
  structureUse: string[];          // ['housing', 'shop_ground_floor']
  storeyCount: number;
  estimatedHouseholds: number;
  estimatedPopulation: number;
  roofMaterial: 'concrete' | 'zinc' | 'tile' | 'thatch' | 'other';
  wallMaterial: 'concrete_block' | 'wood' | 'metal_sheet' | 'mud_brick' | 'other';
  hasElectricity: boolean;
  hasRunningWater: boolean;
  hasSatelliteDish: boolean;       // proxy for income level
  poiPresent: string[];            // ['pharmacy', 'mobile_money', 'school']
  buildingFootprintSqM: number;
  densityClassification: 'high' | 'medium' | 'low';
  lastCensusYear: number;          // 2005
  changeFromImagery: 'new_structure' | 'demolished' | 'modified' | 'unchanged' | 'not_in_imagery';
}
```

---

## 2. Entity ID System

### 2.1 ID Generation Strategy

ADL uses a **hybrid ID system** combining type-safety, temporal ordering, and offline generation.

#### Format: Prefixed UUID v7

```
{type_prefix}_{uuid_v7}
```

**Examples:**
```
loc_019516a0-7c3a-7def-8a0b-1c2d3e4f5a6b    -- Location
ent_019516a0-7c3a-7def-8a0b-1c2d3e4f5a6b    -- Entity
obs_019516a0-7c3a-7def-8a0b-1c2d3e4f5a6b    -- Observation
med_019516a0-7c3a-7def-8a0b-1c2d3e4f5a6b    -- Media
dlt_019516a0-7c3a-7def-8a0b-1c2d3e4f5a6b    -- Delta
```

**Why UUID v7:**
- **Time-ordered:** The first 48 bits encode a Unix timestamp in milliseconds. This means IDs sort chronologically in B-tree indexes without extra columns.
- **Offline-safe:** Any device can generate a UUID v7 without server coordination. No sequence server, no ID range pre-allocation.
- **Collision-resistant:** 74 bits of random data per millisecond. At 1,000 IDs/ms the collision probability is ~10^-23.
- **Existing alignment:** The codebase already uses `crypto.randomUUID()` (UUID v4) in `offlineQueue.ts` and `gen_random_uuid()` in Postgres. UUID v7 is a drop-in replacement.

**Implementation:**
```typescript
// lib/shared/ids.ts
const PREFIXES = {
  location: 'loc',
  entity: 'ent',
  observation: 'obs',
  media: 'med',
  delta: 'dlt',
  agent: 'agt',
} as const;

type EntityType = keyof typeof PREFIXES;

export function generateId(type: EntityType): string {
  // UUID v7: timestamp (48 bits) + version (4 bits) + random (12 bits) + variant (2 bits) + random (62 bits)
  const timestamp = Date.now();
  const timestampHex = timestamp.toString(16).padStart(12, '0');

  const randomBytes = new Uint8Array(10);
  crypto.getRandomValues(randomBytes);

  // Set version 7 (0111)
  randomBytes[0] = (randomBytes[0] & 0x0f) | 0x70;
  // Set variant 10xx
  randomBytes[2] = (randomBytes[2] & 0x3f) | 0x80;

  const hex = Array.from(randomBytes, b => b.toString(16).padStart(2, '0')).join('');

  const uuid = [
    timestampHex.slice(0, 8),
    timestampHex.slice(8, 12),
    hex.slice(0, 4),
    hex.slice(4, 8),
    hex.slice(8, 20),
  ].join('-');

  return `${PREFIXES[type]}_${uuid}`;
}
```

#### Human-Readable Agent Codes

Agents also get a sequential human-readable code for field operations:

```
AGT-{zone_abbrev}-{sequence}
AGT-BON-001    -- first agent in Bonamoussadi
AGT-BON-014    -- fourteenth agent
```

These are assigned server-side at registration and stored alongside the UUID-based `id`.

### 2.2 Entity Deduplication

The "same entity seen by two different agents" problem is critical in Bonamoussadi where no formal addresses exist. The system uses a **multi-signal deduplication pipeline**.

#### Deduplication Signals

```
+------------------------------------------------------------------+
|  Agent A submits new entity                                       |
|  name: "Pharmacie du Soleil"                                     |
|  location: 4.0892, 9.7413                                        |
|  vertical: pharmacy                                               |
+---------------------------+--------------------------------------+
                            |
                            v
+---------------------------+--------------------------------------+
|  STAGE 1: Geospatial proximity filter                            |
|  - Find all entities of same vertical within 50m radius          |
|  - Uses geohash_precise index (geohash-9 = ~4.8m cells)         |
|  - If no candidates within 50m, this is a NEW entity             |
+---------------------------+--------------------------------------+
                            |
              candidates found (e.g., 3 pharmacies within 50m)
                            |
                            v
+---------------------------+--------------------------------------+
|  STAGE 2: Name fuzzy matching                                    |
|  - Normalize: lowercase, remove accents, remove common           |
|    stopwords ('pharmacie', 'de', 'du', 'la', 'le', 'chez')      |
|  - Jaro-Winkler similarity threshold >= 0.80                     |
|  - Exact match on first meaningful word boosts score              |
|                                                                   |
|  "Pharmacie du Soleil" vs "Pharmacie Soleil" -> 0.95 (MATCH)    |
|  "Pharmacie du Soleil" vs "Pharmacie de la Paix" -> 0.42 (NO)   |
+---------------------------+--------------------------------------+
                            |
              1 candidate passes (Pharmacie Soleil at 12m away)
                            |
                            v
+---------------------------+--------------------------------------+
|  STAGE 3: Photo visual similarity (future enhancement)           |
|  - Compare storefront photos using perceptual hash               |
|  - Hamming distance < 10 = likely same entity                    |
|  - Skipped if no photos available                                |
+---------------------------+--------------------------------------+
                            |
                            v
+---------------------------+--------------------------------------+
|  STAGE 4: Merge decision                                         |
|  - Combined dedup score:                                         |
|    score = 0.50 * geo_proximity_score                            |
|          + 0.35 * name_similarity_score                          |
|          + 0.15 * photo_similarity_score                         |
|                                                                   |
|  - score >= 0.75: AUTO-MERGE (treat as ENRICH_EVENT)             |
|  - 0.50 <= score < 0.75: FLAG for admin review                  |
|  - score < 0.50: CREATE as new entity                            |
+---------------------------+--------------------------------------+
```

#### Proximity Score Calculation

```typescript
function geoProximityScore(distanceMeters: number): number {
  // 0m = 1.0, 10m = 0.9, 25m = 0.7, 50m = 0.3, >50m = 0
  if (distanceMeters > 50) return 0;
  return Math.max(0, 1 - (distanceMeters / 50) ** 0.7);
}
```

#### Merge Handling

When two entities are determined to be the same:

```sql
-- Mark the duplicate as non-canonical, pointing to the survivor
UPDATE entities
SET canonical_entity_id = 'ent_SURVIVOR_ID',
    is_canonical = false,
    updated_at = now()
WHERE id = 'ent_DUPLICATE_ID';

-- Re-point all observations from the duplicate to the survivor
UPDATE observations
SET entity_id = 'ent_SURVIVOR_ID'
WHERE entity_id = 'ent_DUPLICATE_ID';
```

The merged entity retains the observation history from both agents, increasing confidence.

### 2.3 Entity Identity Without Formal Addresses

Since Bonamoussadi has no formal address system, entity identity is established through a **composite identity fingerprint**:

```typescript
interface EntityFingerprint {
  vertical: string;            // 'pharmacy'
  geohash9: string;            // 's10tqk4w7' (~4.8m precision)
  normalizedName: string;      // 'soleil' (after stopword removal)
  landmarkContext: string;     // 'near_tradex_station' (optional)
}

// Two entities are considered the same if:
// 1. Same vertical
// 2. Same geohash-9 OR adjacent geohash-9 cells
// 3. Name similarity >= 0.80
```

---

## 3. Baseline vs. Snapshot Logic

### 3.1 Definitions

```
+---------------------------------------------------------------------------+
|  BASELINE                                                                  |
|  A complete first survey of a defined geographic area.                     |
|                                                                            |
|  - Covers an entire zone or sector (e.g., "Denver quarter of             |
|    Bonamoussadi")                                                          |
|  - Establishes the initial inventory: what entities exist, where,         |
|    and in what state                                                       |
|  - Requires walking every street/alley in the sector                      |
|  - Time-bounded: must be completed within a defined window                |
|    (e.g., 7 days for a sector)                                            |
|  - Produces: initial entity records + location records + first            |
|    observations for each entity found                                     |
+---------------------------------------------------------------------------+

+---------------------------------------------------------------------------+
|  SNAPSHOT                                                                  |
|  A subsequent observation of an entity or set of entities.                 |
|                                                                            |
|  - Revisits entities already in the baseline                              |
|  - Records current state (may have changed)                               |
|  - Can be full-zone (revisit everything) or targeted (revisit             |
|    specific entities or verticals)                                         |
|  - Weekly cadence for most verticals (daily for fuel/mobile_money)        |
|  - Produces: new observations + deltas computed against previous          |
|    state                                                                   |
+---------------------------------------------------------------------------+
```

### 3.2 Baseline Survey Structure

```sql
CREATE TABLE IF NOT EXISTS baseline_surveys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  zone_id text NOT NULL REFERENCES zones(id),
  sector text,                                  -- sub-zone: 'Denver', 'Tradex side'
  survey_name text NOT NULL,                    -- 'Bonamoussadi Phase 1 - Denver'

  -- Planning
  planned_start_date date NOT NULL,
  planned_end_date date NOT NULL,
  assigned_agent_ids text[] NOT NULL,
  target_verticals text[] NOT NULL,             -- which verticals to survey

  -- Execution tracking
  status text NOT NULL DEFAULT 'planned'
    CHECK (status IN ('planned', 'in_progress', 'completed', 'partial', 'cancelled')),
  actual_start_date date,
  actual_end_date date,

  -- Coverage metrics
  streets_planned integer,                      -- estimated streets to walk
  streets_completed integer DEFAULT 0,
  entities_found integer DEFAULT 0,
  observations_created integer DEFAULT 0,

  -- Completion criteria
  minimum_coverage_pct numeric(5,2) DEFAULT 90.00,  -- sector must be >= 90% covered
  is_baseline_complete boolean NOT NULL DEFAULT false,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
```

### 3.3 Partial Baseline Handling

A baseline may be incomplete for several reasons:
- Agent could not access certain streets (flooding, security)
- Agent ran out of time/battery
- Some entity types were missed (e.g., found pharmacies but missed informal alcohol vendors)

**Handling strategy:**

```
+------------------------------------------------------------------+
|  Baseline survey for Denver sector                                |
|  Target: all 7 verticals                                         |
|  Duration: 5 days (2026-03-10 to 2026-03-14)                     |
+------------------------------------------------------------------+
                       |
    +------------------+------------------+
    |                  |                  |
    v                  v                  v
  Day 1-3:          Day 4:             Day 5:
  Streets 1-15      Streets 16-20      Streets 21-22
  (all verticals)   (all verticals)    (pharmacy + fuel only,
                                        agent battery died)
    |                  |                  |
    v                  v                  v
  COVERED            COVERED           PARTIAL
                                       (mark streets 21-22 as
                                        partial_coverage for
                                        alcohol, billboard,
                                        mobile_money, transport,
                                        census verticals)
```

```sql
-- Track coverage at street/block level
CREATE TABLE IF NOT EXISTS baseline_coverage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  baseline_survey_id uuid NOT NULL REFERENCES baseline_surveys(id),
  sector text NOT NULL,
  block_or_street text NOT NULL,               -- 'Street 21' or 'Block DEN-A14'
  vertical text NOT NULL,
  coverage_status text NOT NULL
    CHECK (coverage_status IN ('complete', 'partial', 'not_visited')),
  agent_id text,
  visited_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
```

### 3.4 Versioning Strategy for Entity State

Entity state is versioned through the **event-sourced observation chain**, consistent with the existing `point_events` architecture.

```
Entity: ent_pharmacy_001 (Pharmacie du Soleil)

Time ──────────────────────────────────────────────>

  obs_001           obs_002           obs_003
  (CREATE)          (ENRICH)          (ENRICH)
  2026-03-10        2026-03-17        2026-03-24
  |                 |                 |
  v                 v                 v
  State v1          State v2          State v3
  isOpenNow: true   isOpenNow: true   isOpenNow: false
  isOnDuty: null    isOnDuty: true    isOnDuty: false
  phone: null       phone: +2376..    phone: +2376..
  |                 |                 |
  +----- delta -----+                 |
  |      d1: isOnDuty null->true      |
  |                 +----- delta -----+
  |                 |      d2: isOpenNow true->false
  |                 |      d3: isOnDuty true->false
  |                 |
  +-- snapshot S1 --+-- snapshot S2 --+-- snapshot S3 --
  |  (week of 3/10) | (week of 3/17) | (week of 3/24) |
```

**Querying historical state:**

The current `loadSnapshotAsMap()` function in `snapshotEngine.ts` already supports point-in-time queries by snapshot date. The entity state at any snapshot date is the frozen `details` JSONB from the `snapshots` table for that date.

```sql
-- What was the state of all pharmacies on 2026-03-17?
SELECT point_id, site_name, details, gaps
FROM snapshots
WHERE snapshot_date = '2026-03-17'
  AND vertical_id = 'pharmacy'
ORDER BY site_name;
```

**Immutability rule:** Observations are never modified after creation. If an agent made an error, a corrective ENRICH_EVENT is submitted rather than editing the original observation. This preserves the complete audit trail required by Law No. 2024/017.

---

## 4. Delta Computation Rules

### 4.1 Vertical-Specific Delta Definitions

The existing `detectChangedFields()` function in `/lib/server/snapshotEngine.ts` performs field-by-field JSON comparison with the `SKIP_FIELDS` set filtering out metadata. The rules below extend this with semantic meaning per vertical.

#### 4.1.1 Pharmacy Deltas

| Delta Event | Fields | Severity | Minimum Interval | Example |
|------------|--------|----------|-----------------|---------|
| Pharmacy opened/closed | `isOpenNow` | **critical** | 1 hour | Was open last week, now closed |
| On-duty status changed | `isOnDuty` | **high** | 4 hours | Became pharmacie de garde |
| New pharmacy appeared | (new entity) | **high** | N/A | New informal vendor detected |
| Pharmacy disappeared | (removed entity) | **critical** | 7 days | Not observed for 2+ weeks |
| Hours changed | `openingHours` | **medium** | 24 hours | Changed from 08-20 to 08-18 |
| Stockout reported | `stockoutItems` | **high** | 4 hours | Essential medicines unavailable |
| License status changed | `formalStatus` | **medium** | 7 days | Was formal, now informal |

#### 4.1.2 Fuel Station Deltas

| Delta Event | Fields | Severity | Minimum Interval | Example |
|------------|--------|----------|-----------------|---------|
| Price changed | `pricesByFuel.*` | **critical** | 1 hour | Super went from 730 to 750 XAF |
| Fuel availability changed | `hasFuelAvailable` | **critical** | 1 hour | Station ran out of diesel |
| Queue length changed | `queueLength` | **medium** | 30 minutes | Queue went from short to extreme |
| New fuel type added | `fuelTypes` | **low** | 7 days | Station now offers kerosene |
| Station closed | `operational_status` | **critical** | 4 hours | Temporary closure |
| Stock level changed | `stockLevel` | **high** | 4 hours | Full to low |

#### 4.1.3 Mobile Money Deltas

| Delta Event | Fields | Severity | Minimum Interval | Example |
|------------|--------|----------|-----------------|---------|
| Float level changed | `floatLevel`, `hasMin50000XafAvailable` | **high** | 30 minutes | Cash depleted |
| New provider added | `providers` | **medium** | 7 days | Now offers Orange Money too |
| Agent opened/closed | (new/removed) | **high** | 24 hours | New kiosk appeared |
| Fees changed | `feesPercentage` | **medium** | 24 hours | Fee increased from 1% to 2% |
| Services expanded | `servicesOffered` | **low** | 7 days | Now offers bill pay |

#### 4.1.4 Alcohol Outlet Deltas

| Delta Event | Fields | Severity | Minimum Interval | Example |
|------------|--------|----------|-----------------|---------|
| New outlet appeared | (new entity) | **medium** | 7 days | New bar opened |
| Outlet closed | (removed entity) | **medium** | 14 days | Bar permanently closed |
| Brand portfolio changed | `brandsSold` | **low** | 7 days | Dropped Beaufort, added new brand |
| Price changed | `pricesByBrand.*` | **medium** | 7 days | Beer price increased |
| License status changed | `licenseStatus` | **high** | 30 days | Was unlicensed, now licensed |

#### 4.1.5 Billboard Deltas

| Delta Event | Fields | Severity | Minimum Interval | Example |
|------------|--------|----------|-----------------|---------|
| Creative changed | `advertiserBrand`, `campaignName` | **high** | 24 hours | New campaign installed |
| Billboard vacated | `isOccupied` | **medium** | 7 days | Billboard now empty |
| Billboard occupied | `isOccupied` | **medium** | 7 days | Was empty, now has creative |
| Condition degraded | `conditionStatus` | **low** | 7 days | Good to damaged |
| New billboard installed | (new entity) | **medium** | N/A | New OOH panel appeared |
| Billboard removed | (removed entity) | **medium** | 14 days | Panel taken down |

#### 4.1.6 Transport / Blocked Roads Deltas

| Delta Event | Fields | Severity | Minimum Interval | Example |
|------------|--------|----------|-----------------|---------|
| Road blocked | `blockageSeverity` | **critical** | 30 minutes | New blockage due to flooding |
| Road cleared | `blockageSeverity` | **critical** | 30 minutes | Blockage removed |
| Surface condition changed | `surfaceCondition` | **medium** | 7 days | Paved to damaged |
| Traffic level changed | `trafficLevel` | **low** | 1 hour | Low to high |
| New construction started | `blockageType` = construction | **high** | 24 hours | New construction site |

#### 4.1.7 Census / Ground Truth Deltas

| Delta Event | Fields | Severity | Minimum Interval | Example |
|------------|--------|----------|-----------------|---------|
| New structure detected | (new entity) | **medium** | N/A | New building not in imagery |
| Structure demolished | (removed entity) | **medium** | 30 days | Building torn down |
| Use changed | `structureUse` | **medium** | 30 days | Residential to commercial |
| New POI in structure | `poiPresent` | **low** | 14 days | Pharmacy opened at ground floor |
| Density change | `estimatedHouseholds` | **low** | 90 days | More households in building |

### 4.2 Delta Severity Scoring

```typescript
type DeltaSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

interface DeltaSeverityRule {
  vertical: string;
  field: string | null;           // null = applies to entity-level changes
  deltaType: DeltaType;
  severity: DeltaSeverity;
  significanceScore: number;      // 0.0 to 1.0
}

const SEVERITY_RULES: DeltaSeverityRule[] = [
  // Pharmacy
  { vertical: 'pharmacy', field: 'isOpenNow', deltaType: 'changed', severity: 'critical', significanceScore: 0.95 },
  { vertical: 'pharmacy', field: 'isOnDuty', deltaType: 'changed', severity: 'high', significanceScore: 0.85 },
  { vertical: 'pharmacy', field: null, deltaType: 'new', severity: 'high', significanceScore: 0.80 },
  { vertical: 'pharmacy', field: null, deltaType: 'removed', severity: 'critical', significanceScore: 0.95 },

  // Fuel
  { vertical: 'fuel_station', field: 'pricesByFuel', deltaType: 'changed', severity: 'critical', significanceScore: 0.95 },
  { vertical: 'fuel_station', field: 'hasFuelAvailable', deltaType: 'changed', severity: 'critical', significanceScore: 0.98 },
  { vertical: 'fuel_station', field: 'stockLevel', deltaType: 'changed', severity: 'high', significanceScore: 0.85 },

  // Mobile Money
  { vertical: 'mobile_money', field: 'floatLevel', deltaType: 'changed', severity: 'high', significanceScore: 0.85 },
  { vertical: 'mobile_money', field: 'hasMin50000XafAvailable', deltaType: 'changed', severity: 'high', significanceScore: 0.85 },

  // Billboard
  { vertical: 'billboard', field: 'advertiserBrand', deltaType: 'changed', severity: 'high', significanceScore: 0.80 },
  { vertical: 'billboard', field: 'isOccupied', deltaType: 'changed', severity: 'medium', significanceScore: 0.65 },

  // Transport
  { vertical: 'transport_road', field: 'blockageSeverity', deltaType: 'changed', severity: 'critical', significanceScore: 0.95 },
  { vertical: 'transport_road', field: 'surfaceCondition', deltaType: 'changed', severity: 'medium', significanceScore: 0.60 },

  // Default fallback
  { vertical: '*', field: null, deltaType: 'unchanged', severity: 'info', significanceScore: 0.10 },
  { vertical: '*', field: null, deltaType: 'changed', severity: 'low', significanceScore: 0.40 },
  { vertical: '*', field: null, deltaType: 'new', severity: 'medium', significanceScore: 0.70 },
  { vertical: '*', field: null, deltaType: 'removed', severity: 'medium', significanceScore: 0.70 },
];
```

### 4.3 Temporal Rules

**Minimum observation intervals by vertical (to constitute a valid delta):**

| Vertical | Min Interval | Rationale |
|----------|-------------|-----------|
| fuel_station | 30 minutes | Prices and queues change intraday |
| mobile_money | 30 minutes | Float levels change rapidly |
| transport_road | 15 minutes | Blockages can appear/clear quickly |
| pharmacy | 4 hours | Status changes are less frequent |
| billboard | 24 hours | Creative changes are daily at most |
| alcohol_outlet | 24 hours | Outlet state changes slowly |
| census_ground_truth | 7 days | Physical structures change slowly |

```typescript
const MIN_DELTA_INTERVAL_HOURS: Record<string, number> = {
  fuel_station: 0.5,
  mobile_money: 0.5,
  transport_road: 0.25,
  pharmacy: 4,
  billboard: 24,
  alcohol_outlet: 24,
  census_ground_truth: 168, // 7 days
};

function isValidDeltaInterval(vertical: string, beforeAt: Date, afterAt: Date): boolean {
  const minHours = MIN_DELTA_INTERVAL_HOURS[vertical] ?? 4;
  const gapHours = (afterAt.getTime() - beforeAt.getTime()) / (1000 * 60 * 60);
  return gapHours >= minHours;
}
```

### 4.4 Distinguishing Real Change from Observation Error

This is critical: if Agent A records a pharmacy as "open" and Agent B records it as "closed" 30 minutes later, is the pharmacy actually closed, or did Agent B make an error?

**Decision framework:**

```
+------------------------------------------------------------------+
|  Delta observed: field X changed from value A to value B          |
+------+-----------------------------------------------------------+
       |
       v
  Is the before-observation confidence >= 0.70?
       |
   NO  |   YES
   |   |   |
   v   |   v
  Mark |  Is the after-observation confidence >= 0.70?
  as   |       |
  LOW  |   NO  |   YES
  CONF |   |   |   |
       |   v   |   v
       |  Mark |  Are both observations from the same agent?
       |  as   |       |
       |  LOW  |   YES |   NO
       |  CONF |   |   |   |
       |       |   v   |   v
       |       |  HIGH |  Was there a 3rd observation within
       |       |  CONF |  +/- 24 hours that confirms either A or B?
       |       |       |       |
       |       |       |   YES |   NO
       |       |       |   |   |   |
       |       |       |   v   |   v
       |       |       |  Use  |  Mark delta as
       |       |       |  the  |  'needs_verification'
       |       |       |  confirmed value
```

```typescript
function classifyDeltaConfidence(
  beforeObs: Observation,
  afterObs: Observation,
  corroboratingObs: Observation | null,
): 'confirmed' | 'likely' | 'needs_verification' | 'likely_error' {
  const beforeConf = beforeObs.confidence_score ?? 0.50;
  const afterConf = afterObs.confidence_score ?? 0.50;

  // Both low confidence = cannot trust the delta
  if (beforeConf < 0.50 && afterConf < 0.50) return 'likely_error';

  // Same agent, both high confidence = they corrected themselves
  if (beforeObs.agent_id === afterObs.agent_id && beforeConf >= 0.70 && afterConf >= 0.70) {
    return 'confirmed';
  }

  // Different agents, both high confidence
  if (beforeConf >= 0.70 && afterConf >= 0.70) {
    // Check for corroborating evidence
    if (corroboratingObs) return 'confirmed';
    return 'likely';
  }

  // One high, one low
  if (afterConf >= 0.70 && beforeConf < 0.50) return 'likely'; // trust newer observation
  if (beforeConf >= 0.70 && afterConf < 0.50) return 'needs_verification';

  return 'needs_verification';
}
```

### 4.5 Delta Aggregation Rules

Individual entity-level deltas roll up to zone-level change reports via the existing `snapshot_stats` table mechanism. The aggregation adds:

```typescript
interface ZoneDeltaReport {
  zoneId: string;
  snapshotDate: string;
  baselineDate: string;

  // Per vertical summary
  verticals: Array<{
    verticalId: string;
    totalEntities: number;
    newCount: number;
    removedCount: number;
    changedCount: number;
    unchangedCount: number;

    // Severity breakdown
    criticalDeltas: number;
    highDeltas: number;
    mediumDeltas: number;

    // Headline deltas (top 3 most significant changes)
    headlineDeltas: Array<{
      entityName: string;
      deltaSummary: string;
      severity: DeltaSeverity;
      significanceScore: number;
    }>;

    // Vertical-specific aggregates
    avgPrice?: number;               // fuel_station
    dutPharmacyCount?: number;       // pharmacy
    blockedRoadCount?: number;       // transport_road
    occupiedBillboardPct?: number;   // billboard
    avgFloatLevel?: string;          // mobile_money
  }>;

  // Zone-level metrics
  totalEntitiesAllVerticals: number;
  totalCriticalDeltas: number;
  overallChangeRate: number;         // % of entities that changed
  anomalyFlags: AnomalyFlag[];
}
```

**Aggregation is computed by the existing `runWeeklySnapshot()` function** in `snapshotEngine.ts`, extended with the severity breakdown.

---

## 5. Data Quality Scoring

### 5.1 Per-Observation Confidence Score

Each observation receives a confidence score from 0.00 to 1.00 based on measurable signals.

```typescript
interface ObservationQualitySignals {
  gpsAccuracyM: number | null;        // device-reported horizontal accuracy
  photoCount: number;                   // number of evidence photos
  photoHasExif: boolean;                // at least one photo has valid EXIF
  photoGpsMatchesSubmission: boolean;   // EXIF GPS within 1km of submission GPS
  agentReliabilityScore: number;        // agent's historical reliability (0-1)
  observationDurationS: number | null;  // time spent at location
  isOffline: boolean;                   // was this submitted offline?
  hasLandmarkDescription: boolean;      // agent provided landmark context
  deviceClockDriftMs: number | null;    // estimated clock offset from server
}

function computeObservationConfidence(signals: ObservationQualitySignals): number {
  let score = 0.50; // base score

  // GPS accuracy: +0.15 for <= 10m, +0.10 for <= 25m, -0.10 for > 50m, -0.20 for null
  if (signals.gpsAccuracyM !== null) {
    if (signals.gpsAccuracyM <= 10) score += 0.15;
    else if (signals.gpsAccuracyM <= 25) score += 0.10;
    else if (signals.gpsAccuracyM <= 50) score += 0.00;
    else score -= 0.10;
  } else {
    score -= 0.20;
  }

  // Photos: +0.10 per photo (max +0.20)
  score += Math.min(signals.photoCount * 0.10, 0.20);

  // EXIF quality: +0.05 for valid EXIF, +0.05 if GPS matches
  if (signals.photoHasExif) score += 0.05;
  if (signals.photoGpsMatchesSubmission) score += 0.05;

  // Agent reliability: -0.15 to +0.10 based on history
  score += (signals.agentReliabilityScore - 0.50) * 0.30;

  // Observation duration: +0.05 for >= 60s (not a drive-by)
  if (signals.observationDurationS !== null && signals.observationDurationS >= 60) {
    score += 0.05;
  }

  // Offline penalty: -0.05 (slightly less trustworthy, no real-time validation)
  if (signals.isOffline) score -= 0.05;

  // Landmark description bonus: +0.05
  if (signals.hasLandmarkDescription) score += 0.05;

  // Clock drift penalty: -0.05 if drift > 5 minutes
  if (signals.deviceClockDriftMs !== null && Math.abs(signals.deviceClockDriftMs) > 300000) {
    score -= 0.05;
  }

  // Clamp to [0.05, 1.00]
  return Math.max(0.05, Math.min(1.00, Math.round(score * 100) / 100));
}
```

**Example scores:**

| Scenario | GPS | Photos | EXIF Match | Agent Score | Duration | Result |
|----------|-----|--------|------------|-------------|----------|--------|
| Good field visit | 8m | 2 | Yes | 0.85 | 120s | **0.90** |
| Rushed drive-by | 45m | 0 | N/A | 0.60 | 5s | **0.43** |
| Offline submission | null | 1 | No | 0.70 | 90s | **0.46** |
| New untrusted agent | 12m | 1 | Yes | 0.30 | 60s | **0.59** |
| Verified import | N/A | 0 | N/A | 1.00 | N/A | **0.65** |

### 5.2 Per-Entity Confidence Score

Entity confidence aggregates across all observations of that entity.

```typescript
function computeEntityConfidence(
  observations: Array<{ confidence: number; observedAt: Date }>,
  lastObservedAt: Date,
): number {
  if (observations.length === 0) return 0.10;

  // Recency weight: more recent observations count more
  const now = Date.now();
  const weightedScores = observations.map(obs => {
    const ageHours = (now - obs.observedAt.getTime()) / (1000 * 60 * 60);
    const recencyWeight = Math.exp(-ageHours / (24 * 30)); // half-life of ~30 days
    return { score: obs.confidence, weight: recencyWeight };
  });

  const totalWeight = weightedScores.reduce((sum, ws) => sum + ws.weight, 0);
  const weightedAvg = weightedScores.reduce((sum, ws) => sum + ws.score * ws.weight, 0) / totalWeight;

  // Observation count bonus: more observations = higher confidence
  // Diminishing returns: 1 obs = +0, 2 obs = +0.05, 5 obs = +0.10, 10+ obs = +0.15
  const countBonus = Math.min(0.15, Math.log2(observations.length) * 0.05);

  // Staleness penalty: if last observation is > 30 days old, reduce confidence
  const daysSinceLastObs = (now - lastObservedAt.getTime()) / (1000 * 60 * 60 * 24);
  const stalenessPenalty = daysSinceLastObs > 30
    ? Math.min(0.30, (daysSinceLastObs - 30) / 180 * 0.30) // loses 0.30 over 6 months
    : 0;

  // Consistency bonus: if all observations agree on key fields, +0.05
  // (implementation checks if the latest 3 observations have same core values)

  return Math.max(0.05, Math.min(1.00,
    Math.round((weightedAvg + countBonus - stalenessPenalty) * 100) / 100
  ));
}
```

### 5.3 Per-Delta Confidence Score

A delta is only as trustworthy as the observations it is computed from.

```typescript
function computeDeltaConfidence(
  beforeObservation: { confidence: number },
  afterObservation: { confidence: number },
  classification: 'confirmed' | 'likely' | 'needs_verification' | 'likely_error',
): number {
  // Base: geometric mean of the two observation scores
  const base = Math.sqrt(beforeObservation.confidence * afterObservation.confidence);

  // Classification adjustment
  const classificationMultiplier: Record<string, number> = {
    'confirmed': 1.10,
    'likely': 1.00,
    'needs_verification': 0.75,
    'likely_error': 0.40,
  };

  const adjusted = base * (classificationMultiplier[classification] ?? 1.00);
  return Math.max(0.05, Math.min(1.00, Math.round(adjusted * 100) / 100));
}
```

### 5.4 Agent Reliability Score

Agent reliability is computed from their historical accuracy, updated after each admin validation.

```typescript
function updateAgentReliability(agent: Agent, validationResult: 'validated' | 'rejected'): number {
  const total = agent.validated_observations + agent.rejected_observations + 1;
  const validated = agent.validated_observations + (validationResult === 'validated' ? 1 : 0);
  const rejected = agent.rejected_observations + (validationResult === 'rejected' ? 1 : 0);

  // Base accuracy rate
  const accuracyRate = validated / total;

  // Apply Bayesian smoothing (prior: 50% accuracy, weight = 5 virtual observations)
  const priorWeight = 5;
  const smoothedRate = (validated + priorWeight * 0.50) / (total + priorWeight);

  // Bonus for consistency: if last 10 are all validated, +0.05
  // Penalty for recent rejections: if 2+ of last 5 rejected, -0.10

  return Math.max(0.10, Math.min(0.99, Math.round(smoothedRate * 100) / 100));
}
```

---

## 6. Temporal Model

### 6.1 Time Representation

**Standard: UTC storage with Africa/Douala (WAT, UTC+1) for display.**

```
+------------------------------------------------------------------+
|  All timestamps stored as:  timestamptz  (PostgreSQL)             |
|  All timestamps in API:     ISO 8601 with timezone offset         |
|                              2026-03-03T14:30:00+01:00            |
|  All timestamps in code:    Date objects (UTC internally)         |
|  Display timezone:          Africa/Douala (UTC+1, no DST)         |
+------------------------------------------------------------------+
```

**Rationale:**
- Cameroon observes West Africa Time (WAT) year-round. No daylight saving time changes.
- UTC+1 is fixed, making timezone handling simple.
- `timestamptz` in PostgreSQL stores the absolute moment; display conversion is a presentation concern.

**Every observation stores three timestamps:**

| Field | Purpose | Source |
|-------|---------|--------|
| `observed_at` | When the agent physically observed the entity | Device clock |
| `received_at` | When the server received the data | Server clock (`DEFAULT now()`) |
| `synced_at` | When an offline observation was synced | Server clock at sync time |

### 6.2 As-Of Queries

"What was the state of all Bonamoussadi billboards on 2026-03-17?"

This is already supported by the `snapshots` table. The query:

```sql
-- Point-in-time state reconstruction
SELECT
  s.point_id AS entity_id,
  s.site_name,
  s.latitude,
  s.longitude,
  s.details,
  s.gaps,
  s.events_count
FROM snapshots s
WHERE s.snapshot_date = (
  -- Find the most recent snapshot on or before the requested date
  SELECT MAX(snapshot_date)
  FROM snapshots
  WHERE snapshot_date <= '2026-03-17'
    AND vertical_id = 'billboard'
)
AND s.vertical_id = 'billboard'
ORDER BY s.site_name;
```

For intra-week queries (between snapshots), reconstruct from observations:

```sql
-- Reconstruct entity state as of a specific timestamp (between snapshots)
-- Uses the latest observation for each entity on or before the target time
SELECT DISTINCT ON (o.entity_id)
  o.entity_id,
  e.name,
  o.details,
  o.observed_at
FROM observations o
JOIN entities e ON e.id = o.entity_id
WHERE e.vertical = 'billboard'
  AND e.zone_id = 'bonamoussadi'
  AND o.observed_at <= '2026-03-17T15:00:00+01:00'
  AND o.validation_status != 'rejected'
ORDER BY o.entity_id, o.observed_at DESC;
```

### 6.3 Clock Drift on Offline Mobile Devices

Mobile devices in Bonamoussadi may have inaccurate clocks (wrong timezone, never synced with NTP, or manually set incorrectly). This is handled through **server-side drift estimation**.

```
+------------------------------------------------------------------+
|  CLOCK DRIFT DETECTION                                            |
|                                                                   |
|  1. On app launch (online): client sends { clientTime: Date.now() }
|     Server computes: drift = serverTime - clientTime              |
|     Stored in session as device_clock_offset_ms                   |
|                                                                   |
|  2. On each submission (online or offline):                       |
|     - Client records observed_at from device clock                |
|     - Server records received_at from server clock                |
|     - If online: drift = received_at - observed_at (minus         |
|       network latency estimate of ~500ms)                         |
|     - If offline: use last known drift from session               |
|                                                                   |
|  3. Correction policy:                                            |
|     - |drift| < 5 minutes: no correction, store as-is            |
|     - 5 min <= |drift| < 24 hours: store raw, add corrected_at   |
|       field: corrected_at = observed_at + drift                   |
|     - |drift| >= 24 hours: likely wrong date, flag for review,    |
|       use received_at as fallback                                 |
+------------------------------------------------------------------+
```

```typescript
interface ClockDriftResult {
  rawObservedAt: string;           // as reported by device
  correctedObservedAt: string;     // adjusted for drift
  driftMs: number;                 // estimated offset
  driftCategory: 'none' | 'minor' | 'major' | 'invalid';
  useFallback: boolean;            // true if drift is too large
}

function estimateClockDrift(
  deviceObservedAt: Date,
  serverReceivedAt: Date,
  lastKnownDriftMs: number | null,
  isOffline: boolean,
): ClockDriftResult {
  const NETWORK_LATENCY_MS = 500;
  const MINOR_THRESHOLD_MS = 5 * 60 * 1000;      // 5 minutes
  const MAJOR_THRESHOLD_MS = 24 * 60 * 60 * 1000; // 24 hours

  let driftMs: number;
  if (isOffline && lastKnownDriftMs !== null) {
    driftMs = lastKnownDriftMs;
  } else {
    driftMs = serverReceivedAt.getTime() - deviceObservedAt.getTime() - NETWORK_LATENCY_MS;
  }

  const absDrift = Math.abs(driftMs);
  let category: ClockDriftResult['driftCategory'];
  let useFallback = false;

  if (absDrift < MINOR_THRESHOLD_MS) {
    category = 'none';
  } else if (absDrift < MAJOR_THRESHOLD_MS) {
    category = 'minor';
  } else {
    category = 'invalid';
    useFallback = true;
  }

  const corrected = useFallback
    ? serverReceivedAt.toISOString()
    : new Date(deviceObservedAt.getTime() + (category === 'none' ? 0 : driftMs)).toISOString();

  return {
    rawObservedAt: deviceObservedAt.toISOString(),
    correctedObservedAt: corrected,
    driftMs,
    driftCategory: category,
    useFallback,
  };
}
```

### 6.4 Retention and Archival Policies

```
+------------------------------------------------------------------+
|  DATA RETENTION POLICY                                            |
|  (Aligned with Law No. 2024/017 compliance deadline June 2026)   |
+------------------------------------------------------------------+

  Tier 1: HOT DATA (PostgreSQL primary, Supabase)
  ------------------------------------------------
  - observations:        last 90 days
  - entities:            all (current state)
  - entity_deltas:       last 90 days
  - snapshots:           last 52 weeks (1 year)
  - snapshot_deltas:     last 52 weeks
  - snapshot_stats:      last 52 weeks
  - media URLs:          last 90 days (Vercel Blob)
  - agents:              all (active lifecycle)

  Tier 2: WARM DATA (PostgreSQL archive partition / separate schema)
  ------------------------------------------------
  - observations:        90 days to 2 years (compressed, queryable)
  - entity_deltas:       90 days to 2 years
  - snapshots:           1 to 3 years (monthly aggregation)
  - media metadata:      retained indefinitely (URLs may expire)
  - media files:         moved to cold storage after 90 days

  Tier 3: COLD DATA (object storage / export)
  ------------------------------------------------
  - observations:        > 2 years (exported to Parquet/CSV)
  - media files:         > 90 days (moved to cheaper storage)
  - full database dumps: monthly, encrypted, retained 5 years

  Data Deletion (Law No. 2024/017 compliance)
  ------------------------------------------------
  - Agent personal data: deletable upon request (right to erasure)
  - Observation data:    anonymized (agent_id replaced with hash)
                         after agent deletion request
  - Entity data:         not personal data, retained indefinitely
  - Media containing faces: auto-blurred after 90 days (future)
```

**Archival implementation:**

```sql
-- Partition observations by month for efficient archival
-- (to be implemented when volume justifies it)

-- Archive old observations (run monthly)
CREATE OR REPLACE FUNCTION archive_old_observations()
RETURNS void AS $$
BEGIN
  INSERT INTO observations_archive
  SELECT * FROM observations
  WHERE observed_at < now() - interval '90 days'
    AND id NOT IN (SELECT id FROM observations_archive);

  DELETE FROM observations
  WHERE observed_at < now() - interval '90 days';
END;
$$ LANGUAGE plpgsql;

-- Archive old snapshots (keep only weekly for > 1 year, monthly for > 3 years)
CREATE OR REPLACE FUNCTION compact_old_snapshots()
RETURNS void AS $$
BEGIN
  -- Keep one snapshot per month for data older than 1 year
  DELETE FROM snapshots
  WHERE snapshot_date < current_date - interval '1 year'
    AND snapshot_date NOT IN (
      SELECT DISTINCT ON (date_trunc('month', snapshot_date))
        snapshot_date
      FROM snapshots
      WHERE snapshot_date < current_date - interval '1 year'
      ORDER BY date_trunc('month', snapshot_date), snapshot_date DESC
    );
END;
$$ LANGUAGE plpgsql;
```

### 6.5 Temporal Query Patterns

| Query | Implementation | Performance |
|-------|---------------|-------------|
| Current state of all pharmacies | `SELECT * FROM entities WHERE vertical = 'pharmacy' AND zone_id = 'bonamoussadi' AND is_canonical = true` | Index scan, < 10ms |
| State at specific date | `SELECT * FROM snapshots WHERE snapshot_date = $1 AND vertical_id = $2` | Index scan, < 50ms |
| All changes in last 7 days | `SELECT * FROM entity_deltas WHERE after_observed_at > now() - interval '7 days' AND zone_id = $1` | Index scan, < 100ms |
| History of one entity | `SELECT * FROM observations WHERE entity_id = $1 ORDER BY observed_at DESC` | Index scan, < 20ms |
| Week-over-week comparison | Existing `snapshot_stats` table, pre-computed | Direct read, < 10ms |
| Trend over 12 weeks | Existing analytics API `view=trends` | Pre-computed, < 50ms |

---

## Summary of Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| ID system | Prefixed UUID v7 | Offline-safe, time-ordered, no coordination needed |
| Storage | PostgreSQL (Supabase) + JSONB for vertical details | Matches existing stack, flexible schema for 7 verticals |
| Event model | Event-sourced (observations are immutable) | Audit trail for Law No. 2024/017, no data loss |
| Deduplication | GPS proximity + name fuzzy matching + photo similarity | No formal addresses exist in Bonamoussadi |
| Delta computation | Field-level diff with severity scoring per vertical | Extends existing `snapshotEngine.ts` approach |
| Time handling | UTC storage, WAT display, server-side clock drift correction | Simple (no DST in Cameroon), handles offline devices |
| Confidence scoring | Multi-signal weighted score (GPS, photos, agent history, EXIF) | Transparent quality measurement |
| Snapshot cadence | Weekly (Mon 03:00 UTC) for aggregate, per-observation for granular | Matches existing cron; daily for fuel/mobile_money |
| Baseline surveys | Structured survey with coverage tracking per sector per vertical | Handles partial surveys explicitly |
| Retention | 90 days hot, 2 years warm, 5 years cold with anonymization | Law No. 2024/017 compliance |

---

## Migration Path from Current System

The design is **additive** -- it does not break any existing tables or APIs. Implementation can proceed in phases:

1. **Phase 1:** Add `zones` table, formalize Bonamoussadi as a zone. No code changes needed.
2. **Phase 2:** Add `agents` table, backfill from `user_profiles`. Add `baseline_surveys` table.
3. **Phase 3:** Add `locations` table with geohash indexes. Add deduplication pipeline.
4. **Phase 4:** Extend `point_events` -> `observations` (add columns via ALTER TABLE or create new table with bridge view).
5. **Phase 5:** Add `entity_deltas` table for observation-pair deltas. Extend `snapshotEngine.ts` with severity scoring.
6. **Phase 6:** Add `media` table. Migrate from single `photo_url` to multi-photo support.
7. **Phase 7:** Add confidence scoring to observation submission pipeline.

Each phase can be deployed independently. The existing app continues to function at every step.
