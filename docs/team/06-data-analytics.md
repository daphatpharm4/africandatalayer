# ADL Data Analytics & KPI Framework

**Author:** Teammate 6 -- Data Analyst
**Date:** 2026-02-28
**Status:** Living document -- updates with each analytics iteration
**Predecessors:**
- [01-cloud-architecture.md](./01-cloud-architecture.md) (Cloud Architect)
- [02-system-design.md](./02-system-design.md) (System Design Expert)
- [04-cybersecurity.md](./04-cybersecurity.md) (Cybersecurity Expert)
- [05-fraud-strategy.md](./05-fraud-strategy.md) (Fraud Specialist)
**Scope:** KPI definitions, data quality framework, dashboard designs, SQL query library, pipeline architecture, and decision support for African Data Layer

---

## Table of Contents

1. [KPI Framework](#1-kpi-framework)
2. [Data Quality Framework](#2-data-quality-framework)
3. [Dashboard Designs](#3-dashboard-designs)
4. [Analysis Queries Library](#4-analysis-queries-library)
5. [Data Pipeline Architecture](#5-data-pipeline-architecture)
6. [Decision Support Queries](#6-decision-support-queries)

---

## 1. KPI Framework

All KPIs are grounded in ADL's two core tables: `user_profiles` and `point_events`. The `point_events` table uses an event-sourcing model where each row is either a `CREATE_EVENT` (new POI) or `ENRICH_EVENT` (additional data for an existing POI). The `details` JSONB column stores category-specific fields, fraud metadata, and client device info. The `user_profiles` table tracks contributor identity, XP, admin status, and geographic scope.

### 1.1 Tier 1 -- North Star Metrics

These three metrics define whether ADL is succeeding at its core mission: building a trusted, fresh, comprehensive map of essential services across Africa.

---

#### KPI-T1-01: Active Verified Data Points per Region

| Field | Detail |
|---|---|
| **Definition** | Count of unique `point_id` values that have at least one `CREATE_EVENT` and at least one `ENRICH_EVENT` (cross-validated by a second contributor), grouped by geographic region. A point is "verified" when it has events from two or more distinct `user_id` values. |
| **Why it matters** | Raw point counts inflate easily with fabricated data. Requiring cross-contributor verification ensures the metric reflects real, trustworthy locations. |
| **SQL** | See below |
| **Phase 1 target (Bonamoussadi MVP)** | 200 verified points across 3 categories |
| **Phase 2 target (Cameroon expansion)** | 2,000 verified points |
| **Phase 3 target (Pan-African)** | 50,000 verified points |
| **Alert threshold** | Fewer than 5 new verified points per week in any active region |

```sql
-- KPI-T1-01: Active verified data points per region
-- A "verified" point has events from >= 2 distinct users
WITH point_contributors AS (
  SELECT
    point_id,
    category,
    COUNT(DISTINCT user_id) AS distinct_contributors,
    MIN(created_at) AS first_seen,
    MAX(created_at) AS last_updated,
    -- Approximate region via lat/lng bucketing (0.05 deg ~ 5km grid)
    ROUND(latitude::numeric, 2) AS lat_bucket,
    ROUND(longitude::numeric, 2) AS lng_bucket
  FROM point_events
  GROUP BY point_id, category,
    ROUND(latitude::numeric, 2),
    ROUND(longitude::numeric, 2)
),
verified_points AS (
  SELECT *
  FROM point_contributors
  WHERE distinct_contributors >= 2
)
SELECT
  lat_bucket,
  lng_bucket,
  category,
  COUNT(*) AS verified_point_count,
  AVG(distinct_contributors) AS avg_contributors_per_point
FROM verified_points
GROUP BY lat_bucket, lng_bucket, category
ORDER BY verified_point_count DESC;
```

---

#### KPI-T1-02: Weekly Active Contributors (WAC)

| Field | Detail |
|---|---|
| **Definition** | Count of distinct `user_id` values in `point_events` where `created_at` falls within the trailing 7-day window. |
| **Why it matters** | Contributor retention is the engine of the platform. WAC directly measures whether the gamification loop (5 XP per event via `BASE_EVENT_XP` in `api/submissions/index.ts:60`) is working. |
| **SQL** | See below |
| **Phase 1 target** | 20 WAC |
| **Phase 2 target** | 500 WAC |
| **Phase 3 target** | 10,000 WAC |
| **Alert threshold** | WAC drops more than 30% week-over-week |

```sql
-- KPI-T1-02: Weekly active contributors
SELECT
  DATE_TRUNC('week', created_at) AS week_start,
  COUNT(DISTINCT user_id) AS weekly_active_contributors
FROM point_events
WHERE created_at >= NOW() - INTERVAL '12 weeks'
GROUP BY DATE_TRUNC('week', created_at)
ORDER BY week_start DESC;

-- Current WAC (single number)
SELECT COUNT(DISTINCT user_id) AS wac
FROM point_events
WHERE created_at >= NOW() - INTERVAL '7 days';
```

---

#### KPI-T1-03: Data Freshness Score

| Field | Detail |
|---|---|
| **Definition** | For each unique `point_id`, the age (in days) of its most recent event. The freshness score is the median age across all active points. Lower is better. |
| **Why it matters** | A pharmacy that was open 6 months ago may be closed today. Freshness is what distinguishes ADL from static datasets like OpenStreetMap. |
| **SQL** | See below |
| **Phase 1 target** | Median freshness < 14 days |
| **Phase 2 target** | Median freshness < 7 days |
| **Phase 3 target** | Median freshness < 3 days |
| **Alert threshold** | Median freshness exceeds 21 days |

```sql
-- KPI-T1-03: Data freshness score
WITH latest_per_point AS (
  SELECT
    point_id,
    category,
    MAX(created_at) AS last_event_at,
    EXTRACT(EPOCH FROM (NOW() - MAX(created_at))) / 86400.0 AS age_days
  FROM point_events
  GROUP BY point_id, category
)
SELECT
  category,
  COUNT(*) AS total_points,
  ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY age_days)::numeric, 1) AS median_age_days,
  ROUND(AVG(age_days)::numeric, 1) AS avg_age_days,
  ROUND(MAX(age_days)::numeric, 1) AS max_age_days,
  COUNT(*) FILTER (WHERE age_days <= 7) AS fresh_within_7d,
  COUNT(*) FILTER (WHERE age_days > 30) AS stale_over_30d
FROM latest_per_point
GROUP BY category

UNION ALL

SELECT
  'ALL' AS category,
  COUNT(*),
  ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY age_days)::numeric, 1),
  ROUND(AVG(age_days)::numeric, 1),
  ROUND(MAX(age_days)::numeric, 1),
  COUNT(*) FILTER (WHERE age_days <= 7),
  COUNT(*) FILTER (WHERE age_days > 30)
FROM latest_per_point
ORDER BY category;
```

---

### 1.2 Tier 2 -- Growth & Engagement

---

#### KPI-T2-01: New Contributors per Week

| Field | Detail |
|---|---|
| **Definition** | Count of distinct `user_id` values whose first-ever `point_events` row falls within the given week. |
| **SQL** | See below |
| **Phase 1 target** | 10 new/week |
| **Phase 2 target** | 100 new/week |
| **Alert threshold** | Fewer than 3 new contributors in any given week |

```sql
-- KPI-T2-01: New contributors per week
WITH first_contribution AS (
  SELECT
    user_id,
    MIN(created_at) AS first_at
  FROM point_events
  GROUP BY user_id
)
SELECT
  DATE_TRUNC('week', first_at) AS cohort_week,
  COUNT(*) AS new_contributors
FROM first_contribution
GROUP BY DATE_TRUNC('week', first_at)
ORDER BY cohort_week DESC;
```

---

#### KPI-T2-02: Retention (D1 / D7 / D30)

| Field | Detail |
|---|---|
| **Definition** | Of contributors who made their first submission in a given cohort week, what percentage submitted again within 1 day (D1), 7 days (D7), and 30 days (D30)? |
| **SQL** | See below |
| **Phase 1 target** | D1 >= 30%, D7 >= 20%, D30 >= 10% |
| **Phase 2 target** | D1 >= 40%, D7 >= 30%, D30 >= 20% |
| **Alert threshold** | D7 drops below 10% |

```sql
-- KPI-T2-02: Retention cohorts (D1, D7, D30)
WITH first_contribution AS (
  SELECT
    user_id,
    MIN(created_at) AS first_at
  FROM point_events
  GROUP BY user_id
),
subsequent AS (
  SELECT
    fc.user_id,
    fc.first_at,
    DATE_TRUNC('week', fc.first_at) AS cohort_week,
    MIN(pe.created_at) FILTER (
      WHERE pe.created_at > fc.first_at + INTERVAL '1 day'
    ) AS returned_after_d1,
    MIN(pe.created_at) FILTER (
      WHERE pe.created_at > fc.first_at + INTERVAL '7 days'
    ) AS returned_after_d7,
    MIN(pe.created_at) FILTER (
      WHERE pe.created_at > fc.first_at + INTERVAL '30 days'
    ) AS returned_after_d30
  FROM first_contribution fc
  LEFT JOIN point_events pe
    ON pe.user_id = fc.user_id
    AND pe.created_at > fc.first_at
  GROUP BY fc.user_id, fc.first_at, DATE_TRUNC('week', fc.first_at)
)
SELECT
  cohort_week,
  COUNT(*) AS cohort_size,
  ROUND(100.0 * COUNT(*) FILTER (WHERE returned_after_d1 IS NOT NULL) / COUNT(*), 1) AS d1_pct,
  ROUND(100.0 * COUNT(*) FILTER (WHERE returned_after_d7 IS NOT NULL) / COUNT(*), 1) AS d7_pct,
  ROUND(100.0 * COUNT(*) FILTER (WHERE returned_after_d30 IS NOT NULL) / COUNT(*), 1) AS d30_pct
FROM subsequent
WHERE cohort_week <= NOW() - INTERVAL '30 days'  -- only show mature cohorts
GROUP BY cohort_week
ORDER BY cohort_week DESC;
```

---

#### KPI-T2-03: Contributions per User

| Field | Detail |
|---|---|
| **Definition** | Average and median number of `point_events` per contributor, computed over a trailing 30-day window. |
| **SQL** | See below |
| **Phase 1 target** | Median >= 3 per user per month |
| **Alert threshold** | Median drops below 2 |

```sql
-- KPI-T2-03: Contributions per user (trailing 30 days)
WITH user_counts AS (
  SELECT
    user_id,
    COUNT(*) AS event_count
  FROM point_events
  WHERE created_at >= NOW() - INTERVAL '30 days'
  GROUP BY user_id
)
SELECT
  COUNT(*) AS active_users,
  ROUND(AVG(event_count), 1) AS avg_contributions,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY event_count) AS median_contributions,
  MAX(event_count) AS max_contributions,
  MIN(event_count) AS min_contributions
FROM user_counts;
```

---

#### KPI-T2-04: Enrichment Rate

| Field | Detail |
|---|---|
| **Definition** | Percentage of unique `point_id` values that have received at least one `ENRICH_EVENT` in addition to their initial `CREATE_EVENT`. |
| **SQL** | See below |
| **Phase 1 target** | 30% of points enriched |
| **Phase 2 target** | 60% of points enriched |
| **Alert threshold** | Enrichment rate drops below 15% |

```sql
-- KPI-T2-04: Enrichment rate
WITH point_summary AS (
  SELECT
    point_id,
    BOOL_OR(event_type = 'CREATE_EVENT') AS has_create,
    BOOL_OR(event_type = 'ENRICH_EVENT') AS has_enrich,
    COUNT(*) AS total_events
  FROM point_events
  GROUP BY point_id
)
SELECT
  COUNT(*) AS total_points,
  COUNT(*) FILTER (WHERE has_enrich) AS enriched_points,
  ROUND(100.0 * COUNT(*) FILTER (WHERE has_enrich) / GREATEST(COUNT(*), 1), 1) AS enrichment_rate_pct
FROM point_summary
WHERE has_create;
```

---

#### KPI-T2-05: Category Coverage

| Field | Detail |
|---|---|
| **Definition** | Count of unique `point_id` per category (`pharmacy`, `fuel_station`, `mobile_money`). |
| **SQL** | See below |
| **Phase 1 target** | At least 50 points per category in Bonamoussadi |
| **Alert threshold** | Any category below 10 points in an active region |

```sql
-- KPI-T2-05: Category coverage
SELECT
  category,
  COUNT(DISTINCT point_id) AS unique_points,
  COUNT(*) AS total_events,
  COUNT(DISTINCT user_id) AS unique_contributors,
  ROUND(100.0 * COUNT(DISTINCT point_id) /
    GREATEST(SUM(COUNT(DISTINCT point_id)) OVER (), 1), 1) AS pct_of_total
FROM point_events
GROUP BY category
ORDER BY unique_points DESC;
```

---

#### KPI-T2-06: Geographic Coverage

| Field | Detail |
|---|---|
| **Definition** | Number of distinct ~1km grid cells (0.01-degree buckets) that contain at least one data point, by category. |
| **SQL** | See below |
| **Phase 1 target** | 20 grid cells covered in Bonamoussadi |
| **Alert threshold** | Coverage growth stalls for 2+ weeks |

```sql
-- KPI-T2-06: Geographic coverage (1km grid cells)
SELECT
  category,
  COUNT(DISTINCT (ROUND(latitude::numeric, 2)::text || ',' || ROUND(longitude::numeric, 2)::text))
    AS covered_grid_cells,
  COUNT(DISTINCT point_id) AS unique_points,
  MIN(latitude) AS min_lat,
  MAX(latitude) AS max_lat,
  MIN(longitude) AS min_lng,
  MAX(longitude) AS max_lng
FROM point_events
GROUP BY category
ORDER BY covered_grid_cells DESC;
```

---

### 1.3 Tier 3 -- Quality & Trust

---

#### KPI-T3-01: Fraud Rate

| Field | Detail |
|---|---|
| **Definition** | Percentage of events where the `details->'fraudCheck'->'primaryPhoto'->'submissionGpsMatch'` is `false` (GPS mismatch between photo EXIF and submission location). Cross-referenced with the fraud thresholds defined in `05-fraud-strategy.md`. |
| **SQL** | See below |
| **Phase 1 target** | Fraud rate < 5% |
| **Alert threshold** | Fraud rate exceeds 10% on any given day |

```sql
-- KPI-T3-01: Fraud rate (photo GPS mismatch)
SELECT
  DATE_TRUNC('week', created_at) AS week,
  COUNT(*) AS total_events,
  COUNT(*) FILTER (
    WHERE (details->'fraudCheck'->'primaryPhoto'->>'submissionGpsMatch')::boolean = false
  ) AS gps_mismatch_count,
  COUNT(*) FILTER (
    WHERE details->'fraudCheck'->'primaryPhoto'->>'submissionGpsMatch' IS NOT NULL
  ) AS events_with_fraud_check,
  ROUND(100.0 *
    COUNT(*) FILTER (
      WHERE (details->'fraudCheck'->'primaryPhoto'->>'submissionGpsMatch')::boolean = false
    ) /
    GREATEST(COUNT(*) FILTER (
      WHERE details->'fraudCheck'->'primaryPhoto'->>'submissionGpsMatch' IS NOT NULL
    ), 1),
  1) AS fraud_rate_pct
FROM point_events
GROUP BY DATE_TRUNC('week', created_at)
ORDER BY week DESC;
```

---

#### KPI-T3-02: Verification Rate

| Field | Detail |
|---|---|
| **Definition** | Percentage of points that have been cross-validated by at least 2 distinct contributors. |
| **SQL** | See below |
| **Phase 1 target** | 25% of points verified |
| **Phase 2 target** | 50% of points verified |
| **Alert threshold** | Verification rate below 15% |

```sql
-- KPI-T3-02: Verification rate (cross-contributor validation)
WITH point_users AS (
  SELECT
    point_id,
    COUNT(DISTINCT user_id) AS distinct_users
  FROM point_events
  GROUP BY point_id
)
SELECT
  COUNT(*) AS total_points,
  COUNT(*) FILTER (WHERE distinct_users >= 2) AS verified_points,
  ROUND(100.0 * COUNT(*) FILTER (WHERE distinct_users >= 2) / GREATEST(COUNT(*), 1), 1) AS verification_rate_pct,
  ROUND(AVG(distinct_users), 2) AS avg_contributors_per_point
FROM point_users;
```

---

#### KPI-T3-03: Data Accuracy Score

| Field | Detail |
|---|---|
| **Definition** | Composite score (0-100) based on: (a) percentage of events with valid EXIF GPS data, (b) percentage where photo GPS matches submission GPS, (c) percentage where IP location is within threshold of submission location. |
| **SQL** | See below |
| **Phase 1 target** | Score >= 60 |
| **Alert threshold** | Score drops below 40 |

```sql
-- KPI-T3-03: Data accuracy score (composite)
WITH accuracy_signals AS (
  SELECT
    id,
    -- Signal 1: EXIF GPS present
    CASE
      WHEN details->'fraudCheck'->'primaryPhoto'->>'exifStatus' = 'ok' THEN 1.0
      WHEN details->'fraudCheck'->'primaryPhoto'->>'exifStatus' = 'fallback_recovered' THEN 0.7
      ELSE 0.0
    END AS exif_score,
    -- Signal 2: Photo-submission GPS match
    CASE
      WHEN (details->'fraudCheck'->'primaryPhoto'->>'submissionGpsMatch')::boolean = true THEN 1.0
      WHEN (details->'fraudCheck'->'primaryPhoto'->>'submissionGpsMatch')::boolean = false THEN 0.0
      ELSE 0.5  -- unknown
    END AS gps_match_score,
    -- Signal 3: IP-location match
    CASE
      WHEN (details->'fraudCheck'->'primaryPhoto'->>'ipGpsMatch')::boolean = true THEN 1.0
      WHEN (details->'fraudCheck'->'primaryPhoto'->>'ipGpsMatch')::boolean = false THEN 0.0
      ELSE 0.5
    END AS ip_match_score
  FROM point_events
  WHERE created_at >= NOW() - INTERVAL '30 days'
)
SELECT
  COUNT(*) AS events_evaluated,
  ROUND(100.0 * (
    0.4 * AVG(exif_score) +
    0.4 * AVG(gps_match_score) +
    0.2 * AVG(ip_match_score)
  ), 1) AS accuracy_score
FROM accuracy_signals;
```

---

#### KPI-T3-04: Completeness Score (Gaps Filled)

| Field | Detail |
|---|---|
| **Definition** | For each category, percentage of enrichable fields (as defined in `ENRICHABLE_FIELDS` in `lib/server/pointProjection.ts`) that are filled across all points. Pharmacy enrichable fields: `openingHours`, `isOpenNow`, `isOnDuty`. Mobile money: `merchantIdByProvider`, `paymentMethods`, `openingHours`, `providers`. Fuel station: `fuelTypes`, `pricesByFuel`, `quality`, `paymentMethods`, `openingHours`, `hasFuelAvailable`. |
| **SQL** | See below |
| **Phase 1 target** | 40% average completeness |
| **Phase 2 target** | 70% average completeness |
| **Alert threshold** | Completeness drops below 25% |

```sql
-- KPI-T3-04: Completeness score per category
-- Pharmacy enrichable fields: openingHours, isOpenNow, isOnDuty
-- We check the latest projected state by taking the last event per point_id
WITH latest_event AS (
  SELECT DISTINCT ON (point_id)
    point_id, category, details
  FROM point_events
  ORDER BY point_id, created_at DESC
),
pharmacy_completeness AS (
  SELECT
    point_id,
    (CASE WHEN details->>'openingHours' IS NOT NULL AND details->>'openingHours' != '' THEN 1 ELSE 0 END
     + CASE WHEN details->>'isOpenNow' IS NOT NULL THEN 1 ELSE 0 END
     + CASE WHEN details->>'isOnDuty' IS NOT NULL THEN 1 ELSE 0 END
    )::numeric / 3.0 AS completeness
  FROM latest_event
  WHERE category = 'pharmacy'
),
mobile_money_completeness AS (
  SELECT
    point_id,
    (CASE WHEN details->'merchantIdByProvider' IS NOT NULL
           AND details->'merchantIdByProvider' != '{}'::jsonb THEN 1 ELSE 0 END
     + CASE WHEN details->'paymentMethods' IS NOT NULL
             AND jsonb_array_length(details->'paymentMethods') > 0 THEN 1 ELSE 0 END
     + CASE WHEN details->>'openingHours' IS NOT NULL AND details->>'openingHours' != '' THEN 1 ELSE 0 END
     + CASE WHEN details->'providers' IS NOT NULL
             AND jsonb_array_length(details->'providers') > 0 THEN 1 ELSE 0 END
    )::numeric / 4.0 AS completeness
  FROM latest_event
  WHERE category = 'mobile_money'
),
fuel_station_completeness AS (
  SELECT
    point_id,
    (CASE WHEN details->'fuelTypes' IS NOT NULL
           AND jsonb_array_length(details->'fuelTypes') > 0 THEN 1 ELSE 0 END
     + CASE WHEN details->'pricesByFuel' IS NOT NULL
             AND details->'pricesByFuel' != '{}'::jsonb THEN 1 ELSE 0 END
     + CASE WHEN details->>'quality' IS NOT NULL AND details->>'quality' != '' THEN 1 ELSE 0 END
     + CASE WHEN details->'paymentMethods' IS NOT NULL
             AND jsonb_array_length(details->'paymentMethods') > 0 THEN 1 ELSE 0 END
     + CASE WHEN details->>'openingHours' IS NOT NULL AND details->>'openingHours' != '' THEN 1 ELSE 0 END
     + CASE WHEN details->>'hasFuelAvailable' IS NOT NULL THEN 1 ELSE 0 END
    )::numeric / 6.0 AS completeness
  FROM latest_event
  WHERE category = 'fuel_station'
)
SELECT 'pharmacy' AS category,
  COUNT(*) AS total_points,
  ROUND(100.0 * AVG(completeness), 1) AS avg_completeness_pct
FROM pharmacy_completeness
UNION ALL
SELECT 'mobile_money',
  COUNT(*),
  ROUND(100.0 * AVG(completeness), 1)
FROM mobile_money_completeness
UNION ALL
SELECT 'fuel_station',
  COUNT(*),
  ROUND(100.0 * AVG(completeness), 1)
FROM fuel_station_completeness;
```

---

#### KPI-T3-05: Photo Attachment Rate

| Field | Detail |
|---|---|
| **Definition** | Percentage of events that have a non-null `photo_url`. Since `api/submissions/index.ts` requires a photo for every submission (`if (!imageBase64) return errorResponse("Photo is required", 400)`), this should be near 100% for user-submitted events. Deviations indicate imported/legacy data. |
| **SQL** | See below |
| **Phase 1 target** | 95% for user submissions |
| **Alert threshold** | Photo rate drops below 90% |

```sql
-- KPI-T3-05: Photo attachment rate
SELECT
  CASE WHEN source IN ('osm_overpass', 'legacy_submission') THEN 'imported'
       ELSE 'user_submitted'
  END AS source_type,
  COUNT(*) AS total_events,
  COUNT(*) FILTER (WHERE photo_url IS NOT NULL AND photo_url != '') AS with_photo,
  ROUND(100.0 * COUNT(*) FILTER (WHERE photo_url IS NOT NULL AND photo_url != '') / GREATEST(COUNT(*), 1), 1) AS photo_rate_pct
FROM point_events
GROUP BY
  CASE WHEN source IN ('osm_overpass', 'legacy_submission') THEN 'imported'
       ELSE 'user_submitted'
  END;
```

---

### 1.4 Tier 4 -- Operational

---

#### KPI-T4-01: API Latency (p50/p95/p99)

| Field | Detail |
|---|---|
| **Definition** | Response time percentiles for `GET /api/submissions` and `POST /api/submissions`, measured via Vercel's built-in function analytics or custom logging. |
| **Data source** | Vercel Analytics / Edge logs (not in Postgres) |
| **Phase 1 target** | p50 < 500ms, p95 < 2s (per `02-system-design.md` performance targets) |
| **Alert threshold** | p95 exceeds 5s |

*Note: API latency metrics are captured at the infrastructure layer (Vercel Functions), not in `point_events`. The pipeline section (Section 5) describes how to land these into an analytics store.*

---

#### KPI-T4-02: Uptime

| Field | Detail |
|---|---|
| **Definition** | Percentage of time the platform is available, measured via synthetic health checks. Target from `01-cloud-architecture.md`: 99.5% in Phase 1, 99.9% in Phase 2. |
| **Data source** | External uptime monitor (e.g., BetterStack, Checkly) |
| **Alert threshold** | Any downtime exceeding 5 minutes |

---

#### KPI-T4-03: Sync Failure Rate

| Field | Detail |
|---|---|
| **Definition** | Percentage of offline-queue items that fail to sync after all retry attempts. The offline queue (`lib/client/offlineQueue.ts`) uses IndexedDB with exponential backoff. The `AdminQueue.tsx` component already surfaces `SyncErrorRecord` objects. |
| **Data source** | Client-side telemetry (requires an analytics event to be sent on sync failure) |
| **Phase 1 target** | Sync failure rate < 2% |
| **Alert threshold** | Failure rate exceeds 5% |

---

#### KPI-T4-04: Admin Review Backlog

| Field | Detail |
|---|---|
| **Definition** | Number of events that have not been reviewed by an admin. Currently, there is no `reviewed` flag in the schema; the admin queue (`AdminQueue.tsx`) displays all events. This KPI requires adding a `reviewed_at` column or a separate `admin_reviews` table. |
| **SQL (proposed, requires schema extension)** | See below |
| **Phase 1 target** | Backlog < 50 events |
| **Alert threshold** | Backlog exceeds 200 events |

```sql
-- KPI-T4-04: Admin review backlog (requires schema extension)
-- Option A: Add reviewed_at column to point_events
-- ALTER TABLE point_events ADD COLUMN reviewed_at timestamptz;

-- Pending review count (once column exists):
SELECT COUNT(*) AS pending_review
FROM point_events
WHERE reviewed_at IS NULL
  AND created_at >= NOW() - INTERVAL '30 days';

-- Option B: Track reviews in a separate table
-- CREATE TABLE admin_reviews (
--   event_id uuid PRIMARY KEY REFERENCES point_events(id),
--   reviewer_id text NOT NULL REFERENCES user_profiles(id),
--   decision text NOT NULL CHECK (decision IN ('approved', 'rejected', 'flagged')),
--   reviewed_at timestamptz NOT NULL DEFAULT now(),
--   notes text
-- );
--
-- SELECT COUNT(*) AS pending_review
-- FROM point_events pe
-- LEFT JOIN admin_reviews ar ON ar.event_id = pe.id
-- WHERE ar.event_id IS NULL
--   AND pe.created_at >= NOW() - INTERVAL '30 days';
```

---

## 2. Data Quality Framework

Data quality is measured across five dimensions. Each dimension has specific checks that run against the actual `point_events` and `user_profiles` tables.

### 2.1 Completeness Checks

**Question:** What percentage of points have all enrichable fields filled?

```sql
-- Completeness check: percentage of points with ALL enrichable fields filled
WITH latest_event AS (
  SELECT DISTINCT ON (point_id)
    point_id, category, details
  FROM point_events
  ORDER BY point_id, created_at DESC
),
completeness_flags AS (
  SELECT
    point_id,
    category,
    CASE category
      -- Pharmacy: name, openingHours, isOpenNow, isOnDuty
      WHEN 'pharmacy' THEN (
        CASE WHEN details->>'name' IS NOT NULL AND details->>'name' != ''
              AND details->>'openingHours' IS NOT NULL AND details->>'openingHours' != ''
              AND details->>'isOpenNow' IS NOT NULL
              AND details->>'isOnDuty' IS NOT NULL
        THEN true ELSE false END
      )
      -- Mobile money: providers, merchantIdByProvider, paymentMethods, openingHours
      WHEN 'mobile_money' THEN (
        CASE WHEN details->'providers' IS NOT NULL
                  AND jsonb_array_length(details->'providers') > 0
              AND details->'merchantIdByProvider' IS NOT NULL
                  AND details->'merchantIdByProvider' != '{}'::jsonb
              AND details->'paymentMethods' IS NOT NULL
                  AND jsonb_array_length(details->'paymentMethods') > 0
              AND details->>'openingHours' IS NOT NULL AND details->>'openingHours' != ''
        THEN true ELSE false END
      )
      -- Fuel station: name, fuelTypes, pricesByFuel, quality, paymentMethods, openingHours, hasFuelAvailable
      WHEN 'fuel_station' THEN (
        CASE WHEN details->>'name' IS NOT NULL AND details->>'name' != ''
              AND details->'fuelTypes' IS NOT NULL
                  AND jsonb_array_length(details->'fuelTypes') > 0
              AND details->'pricesByFuel' IS NOT NULL
                  AND details->'pricesByFuel' != '{}'::jsonb
              AND details->>'quality' IS NOT NULL
              AND details->'paymentMethods' IS NOT NULL
                  AND jsonb_array_length(details->'paymentMethods') > 0
              AND details->>'openingHours' IS NOT NULL AND details->>'openingHours' != ''
              AND details->>'hasFuelAvailable' IS NOT NULL
        THEN true ELSE false END
      )
    END AS is_complete
  FROM latest_event
)
SELECT
  category,
  COUNT(*) AS total_points,
  COUNT(*) FILTER (WHERE is_complete) AS complete_points,
  ROUND(100.0 * COUNT(*) FILTER (WHERE is_complete) / GREATEST(COUNT(*), 1), 1) AS completeness_pct
FROM completeness_flags
GROUP BY category
ORDER BY category;
```

**Field-level completeness (which fields are most commonly missing):**

```sql
-- Field-level completeness for pharmacies
WITH latest_pharmacy AS (
  SELECT DISTINCT ON (point_id)
    point_id, details
  FROM point_events
  WHERE category = 'pharmacy'
  ORDER BY point_id, created_at DESC
)
SELECT
  COUNT(*) AS total,
  ROUND(100.0 * COUNT(*) FILTER (WHERE details->>'name' IS NOT NULL AND details->>'name' != '') / GREATEST(COUNT(*), 1), 1) AS has_name_pct,
  ROUND(100.0 * COUNT(*) FILTER (WHERE details->>'openingHours' IS NOT NULL AND details->>'openingHours' != '') / GREATEST(COUNT(*), 1), 1) AS has_hours_pct,
  ROUND(100.0 * COUNT(*) FILTER (WHERE details->>'isOpenNow' IS NOT NULL) / GREATEST(COUNT(*), 1), 1) AS has_open_status_pct,
  ROUND(100.0 * COUNT(*) FILTER (WHERE details->>'isOnDuty' IS NOT NULL) / GREATEST(COUNT(*), 1), 1) AS has_on_duty_pct,
  ROUND(100.0 * COUNT(*) FILTER (WHERE details->>'phone' IS NOT NULL AND details->>'phone' != '') / GREATEST(COUNT(*), 1), 1) AS has_phone_pct
FROM latest_pharmacy;
```

---

### 2.2 Accuracy Checks (Cross-Validation Rules)

```sql
-- Accuracy check 1: Photo GPS vs submission GPS distance
-- Events where EXIF GPS is present but diverges from submitted location
SELECT
  id, point_id, user_id, category, created_at,
  details->'fraudCheck'->'primaryPhoto'->>'submissionDistanceKm' AS photo_distance_km,
  details->'fraudCheck'->'primaryPhoto'->>'submissionGpsMatch' AS gps_match,
  latitude, longitude,
  details->'fraudCheck'->'primaryPhoto'->'gps'->>'latitude' AS exif_lat,
  details->'fraudCheck'->'primaryPhoto'->'gps'->>'longitude' AS exif_lng
FROM point_events
WHERE (details->'fraudCheck'->'primaryPhoto'->>'submissionGpsMatch')::boolean = false
ORDER BY created_at DESC
LIMIT 100;

-- Accuracy check 2: IP location vs submission location
SELECT
  id, point_id, user_id, category, created_at,
  details->'fraudCheck'->'primaryPhoto'->>'ipDistanceKm' AS ip_distance_km,
  details->'fraudCheck'->'primaryPhoto'->>'ipGpsMatch' AS ip_match
FROM point_events
WHERE (details->'fraudCheck'->'primaryPhoto'->>'ipGpsMatch')::boolean = false
ORDER BY created_at DESC
LIMIT 100;

-- Accuracy check 3: Category-specific value range checks
-- Fuel price outlier detection (price < 100 or > 2000 XAF per liter is suspicious)
SELECT
  id, point_id, user_id,
  details->>'fuelPrice' AS fuel_price,
  details->'pricesByFuel' AS prices_by_fuel
FROM point_events
WHERE category = 'fuel_station'
  AND (details->>'fuelPrice')::numeric NOT BETWEEN 100 AND 2000
  AND details->>'fuelPrice' IS NOT NULL;
```

---

### 2.3 Timeliness Checks (Stale Data Detection)

```sql
-- Timeliness check: Points with no activity in the last 30/60/90 days
WITH latest_per_point AS (
  SELECT
    point_id,
    category,
    MAX(created_at) AS last_event_at,
    EXTRACT(EPOCH FROM (NOW() - MAX(created_at))) / 86400.0 AS age_days
  FROM point_events
  GROUP BY point_id, category
)
SELECT
  category,
  COUNT(*) FILTER (WHERE age_days <= 7) AS fresh_7d,
  COUNT(*) FILTER (WHERE age_days BETWEEN 8 AND 30) AS aging_8_30d,
  COUNT(*) FILTER (WHERE age_days BETWEEN 31 AND 60) AS stale_31_60d,
  COUNT(*) FILTER (WHERE age_days BETWEEN 61 AND 90) AS stale_61_90d,
  COUNT(*) FILTER (WHERE age_days > 90) AS dead_over_90d,
  COUNT(*) AS total
FROM latest_per_point
GROUP BY category
ORDER BY category;
```

---

### 2.4 Consistency Checks (Contradictory Data Detection)

```sql
-- Consistency check 1: Same point_id with conflicting categories
SELECT
  point_id,
  ARRAY_AGG(DISTINCT category) AS categories,
  COUNT(DISTINCT category) AS category_count
FROM point_events
GROUP BY point_id
HAVING COUNT(DISTINCT category) > 1;

-- Consistency check 2: Same point_id with widely divergent coordinates
-- (> 0.5km apart indicates data entry error or fraud)
WITH point_coords AS (
  SELECT
    point_id,
    MIN(latitude) AS min_lat, MAX(latitude) AS max_lat,
    MIN(longitude) AS min_lng, MAX(longitude) AS max_lng,
    -- Rough distance in km (Pythagorean approximation at equator)
    SQRT(
      POWER((MAX(latitude) - MIN(latitude)) * 111.0, 2) +
      POWER((MAX(longitude) - MIN(longitude)) * 111.0 * COS(RADIANS(AVG(latitude))), 2)
    ) AS coord_spread_km
  FROM point_events
  GROUP BY point_id
)
SELECT *
FROM point_coords
WHERE coord_spread_km > 0.5
ORDER BY coord_spread_km DESC;

-- Consistency check 3: isOpenNow=true AND availability contains "closed"
SELECT
  id, point_id, category,
  details->>'isOpenNow' AS is_open_now,
  details->>'availability' AS availability
FROM point_events
WHERE (details->>'isOpenNow')::boolean = true
  AND details->>'availability' ILIKE '%closed%';
```

---

### 2.5 Uniqueness Checks (Duplicate POI Detection)

```sql
-- Duplicate detection: Nearby points (within ~100m) with similar names
-- within the same category
WITH latest_per_point AS (
  SELECT DISTINCT ON (point_id)
    point_id, category, latitude, longitude,
    COALESCE(details->>'name', details->>'siteName', '') AS poi_name,
    created_at
  FROM point_events
  ORDER BY point_id, created_at DESC
)
SELECT
  a.point_id AS point_a,
  b.point_id AS point_b,
  a.category,
  a.poi_name AS name_a,
  b.poi_name AS name_b,
  SQRT(
    POWER((a.latitude - b.latitude) * 111000, 2) +
    POWER((a.longitude - b.longitude) * 111000 * COS(RADIANS(a.latitude)), 2)
  ) AS distance_meters
FROM latest_per_point a
JOIN latest_per_point b
  ON a.category = b.category
  AND a.point_id < b.point_id  -- avoid self-join and duplicates
  AND ABS(a.latitude - b.latitude) < 0.001   -- within ~110m lat
  AND ABS(a.longitude - b.longitude) < 0.001 -- within ~110m lng
WHERE SQRT(
  POWER((a.latitude - b.latitude) * 111000, 2) +
  POWER((a.longitude - b.longitude) * 111000 * COS(RADIANS(a.latitude)), 2)
) < 100  -- within 100 meters
ORDER BY distance_meters ASC;

-- Name similarity check (fuzzy match using trigram if pg_trgm extension is available)
-- Requires: CREATE EXTENSION IF NOT EXISTS pg_trgm;
-- SELECT
--   a.point_id AS point_a, b.point_id AS point_b,
--   a.poi_name AS name_a, b.poi_name AS name_b,
--   SIMILARITY(a.poi_name, b.poi_name) AS name_similarity
-- FROM latest_per_point a
-- JOIN latest_per_point b ON a.category = b.category AND a.point_id < b.point_id
-- WHERE SIMILARITY(a.poi_name, b.poi_name) > 0.4
--   AND ABS(a.latitude - b.latitude) < 0.01
-- ORDER BY name_similarity DESC;
```

---

## 3. Dashboard Designs

### 3.1 Executive Dashboard

**Audience:** Investors, C-suite, board members
**Refresh:** Every 15 minutes for live panels; daily for trend lines
**Access:** Admin users with `is_admin = true` (current implementation in `Analytics.tsx` gates on `adminMode`)

| Panel | Description | Data Source | SQL Reference | Visualization | Refresh |
|---|---|---|---|---|---|
| **North Star Trio** | Three large number cards: verified data points, WAC, median freshness score | `point_events` | KPI-T1-01, KPI-T1-02, KPI-T1-03 | Number cards with sparkline | 15 min |
| **Growth Trend** | Line chart of weekly new contributors and total points over 12 weeks | `point_events` | KPI-T2-01, KPI-T2-05 | Dual-axis line chart | Daily |
| **Geographic Reach Map** | Interactive map with dot density showing covered grid cells, colored by category | `point_events` latitude/longitude | KPI-T2-06 | Mapbox/Leaflet heatmap | 15 min |
| **Category Distribution** | Horizontal bar chart showing point counts per category | `point_events` | KPI-T2-05 | Horizontal bar chart (already in `Analytics.tsx`) | 15 min |
| **Completeness Gauge** | Gauge showing overall data completeness percentage | `point_events` details | KPI-T3-04 | Gauge / radial bar | Daily |
| **Investor Metrics Card** | Total users, total events, countries covered, uptime | `user_profiles`, `point_events`, infra | Multiple | Stat cards | Daily |

**North Star Trio SQL (combined query for dashboard efficiency):**

```sql
-- Executive dashboard: North Star metrics in one query
WITH verified AS (
  SELECT COUNT(DISTINCT point_id) AS verified_points
  FROM (
    SELECT point_id
    FROM point_events
    GROUP BY point_id
    HAVING COUNT(DISTINCT user_id) >= 2
  ) v
),
wac AS (
  SELECT COUNT(DISTINCT user_id) AS weekly_active
  FROM point_events
  WHERE created_at >= NOW() - INTERVAL '7 days'
),
freshness AS (
  SELECT
    ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (
      ORDER BY EXTRACT(EPOCH FROM (NOW() - last_at)) / 86400.0
    )::numeric, 1) AS median_freshness_days
  FROM (
    SELECT point_id, MAX(created_at) AS last_at
    FROM point_events
    GROUP BY point_id
  ) lp
)
SELECT
  v.verified_points,
  w.weekly_active AS wac,
  f.median_freshness_days
FROM verified v, wac w, freshness f;
```

---

### 3.2 Operations Dashboard

**Audience:** Engineering team, ops on-call, admin reviewers
**Refresh:** Every 60 seconds for real-time panels
**Access:** Admin users

| Panel | Description | Data Source | SQL | Visualization | Refresh |
|---|---|---|---|---|---|
| **Submission Pipeline** | Events per hour (last 24h) broken by `CREATE_EVENT` / `ENRICH_EVENT` | `point_events` | See below | Stacked area chart | 60s |
| **Fraud Flags** | Count of GPS-mismatched submissions in last 24h, with list of flagged events | `point_events` details.fraudCheck | KPI-T3-01 | Number card + scrollable list | 60s |
| **Admin Queue Depth** | Unreviewed events (requires `reviewed_at` column) | `point_events` | KPI-T4-04 | Number card with trend | 60s |
| **Sync Failures** | Client-side sync error count (from `SyncErrorRecord` telemetry) | Client telemetry | N/A (client-side) | Number card | 5 min |
| **API Health** | Latency p50/p95, error rate, requests/min | Vercel Analytics | Infra-level | Multi-line chart | 60s |
| **Top Submitters (24h)** | Most active contributors in last 24 hours -- useful for spotting bot-like behavior | `point_events` | See below | Horizontal bar | 5 min |

**Submission pipeline query:**

```sql
-- Operations: Submission pipeline (events per hour, last 24h)
SELECT
  DATE_TRUNC('hour', created_at) AS hour,
  event_type,
  COUNT(*) AS event_count
FROM point_events
WHERE created_at >= NOW() - INTERVAL '24 hours'
GROUP BY DATE_TRUNC('hour', created_at), event_type
ORDER BY hour DESC;
```

**Top submitters (24h) -- anomaly detection:**

```sql
-- Operations: Top submitters in last 24 hours (bot detection)
SELECT
  pe.user_id,
  up.name,
  up.email,
  COUNT(*) AS events_24h,
  COUNT(DISTINCT pe.point_id) AS unique_points,
  MIN(pe.created_at) AS first_event,
  MAX(pe.created_at) AS last_event,
  -- Suspicious if many events but few unique points (enrichment spam)
  ROUND(COUNT(*)::numeric / GREATEST(COUNT(DISTINCT pe.point_id), 1), 1) AS events_per_point
FROM point_events pe
LEFT JOIN user_profiles up ON up.id = pe.user_id
WHERE pe.created_at >= NOW() - INTERVAL '24 hours'
GROUP BY pe.user_id, up.name, up.email
ORDER BY events_24h DESC
LIMIT 20;
```

---

### 3.3 Contributor Dashboard

**Audience:** Individual contributors (shown in the app's Profile screen)
**Refresh:** On page load
**Access:** Authenticated users (their own data only)

| Panel | Description | Data Source | SQL | Visualization | Refresh |
|---|---|---|---|---|---|
| **Personal Stats** | Total submissions, XP, rank, categories contributed to | `point_events`, `user_profiles` | See below | Stat cards (partially exists in Profile.tsx) | On load |
| **Contribution Timeline** | Calendar heatmap of user's daily submissions | `point_events` | See below | GitHub-style calendar heatmap | On load |
| **Engagement Funnel** | Shows progression: first submission -> enrichment -> 10+ submissions -> streak | `point_events` | See below | Vertical funnel | On load |
| **Gamification Progress** | XP progress bar to next tier, badges earned | `user_profiles.xp` | Direct read | Progress bar + badge grid | On load |
| **Leaderboard Position** | Current rank among all contributors | `point_events` aggregation | Already in `api/leaderboard/index.ts` | Rank card with trend arrow | On load |

**Personal stats query:**

```sql
-- Contributor dashboard: Personal stats for a specific user
SELECT
  pe.user_id,
  up.name,
  up.xp,
  COUNT(*) AS total_submissions,
  COUNT(*) FILTER (WHERE pe.event_type = 'CREATE_EVENT') AS creates,
  COUNT(*) FILTER (WHERE pe.event_type = 'ENRICH_EVENT') AS enrichments,
  COUNT(DISTINCT pe.category) AS categories_touched,
  COUNT(DISTINCT pe.point_id) AS unique_points,
  MIN(pe.created_at) AS first_submission,
  MAX(pe.created_at) AS last_submission,
  COUNT(DISTINCT DATE_TRUNC('day', pe.created_at)) AS active_days
FROM point_events pe
JOIN user_profiles up ON up.id = pe.user_id
WHERE pe.user_id = $1  -- parameterized user_id
GROUP BY pe.user_id, up.name, up.xp;
```

**Contribution calendar heatmap:**

```sql
-- Contributor dashboard: Daily submission heatmap (last 90 days)
SELECT
  DATE_TRUNC('day', created_at)::date AS day,
  COUNT(*) AS submissions
FROM point_events
WHERE user_id = $1
  AND created_at >= NOW() - INTERVAL '90 days'
GROUP BY DATE_TRUNC('day', created_at)::date
ORDER BY day;
```

**Engagement funnel:**

```sql
-- Contributor dashboard: Engagement funnel (all users)
WITH user_stats AS (
  SELECT
    user_id,
    COUNT(*) AS total_events,
    COUNT(*) FILTER (WHERE event_type = 'CREATE_EVENT') AS creates,
    COUNT(*) FILTER (WHERE event_type = 'ENRICH_EVENT') AS enrichments,
    COUNT(DISTINCT DATE_TRUNC('day', created_at)) AS active_days,
    -- Check for 7-day streak
    (
      SELECT MAX(streak_len) FROM (
        SELECT COUNT(*) AS streak_len
        FROM (
          SELECT
            DATE_TRUNC('day', created_at)::date AS d,
            DATE_TRUNC('day', created_at)::date
              - (ROW_NUMBER() OVER (ORDER BY DATE_TRUNC('day', created_at)::date))::int AS grp
          FROM point_events sub
          WHERE sub.user_id = pe.user_id
          GROUP BY DATE_TRUNC('day', created_at)::date
        ) streaks
        GROUP BY grp
      ) s
    ) AS max_streak
  FROM point_events pe
  GROUP BY user_id
)
SELECT
  COUNT(*) AS total_contributors,
  COUNT(*) FILTER (WHERE total_events >= 1) AS made_first_submission,
  COUNT(*) FILTER (WHERE enrichments >= 1) AS made_enrichment,
  COUNT(*) FILTER (WHERE total_events >= 10) AS power_contributors_10plus,
  COUNT(*) FILTER (WHERE max_streak >= 7) AS streak_7_days,
  COUNT(*) FILTER (WHERE active_days >= 30) AS monthly_active
FROM user_stats;
```

---

### 3.4 Data Quality Dashboard

**Audience:** Data quality team, product managers
**Refresh:** Every 30 minutes
**Access:** Admin users

| Panel | Description | Data Source | SQL | Visualization | Refresh |
|---|---|---|---|---|---|
| **Completeness Heatmap** | Matrix: rows = categories, columns = fields; cell color = fill rate % | `point_events` details | Section 2.1 field-level query | Heatmap matrix | 30 min |
| **Freshness Map** | Geographic map colored by median freshness per grid cell | `point_events` | KPI-T1-03 geographic variant below | Choropleth map | 30 min |
| **Duplicate Candidates** | Table of nearby point pairs that may be duplicates | `point_events` | Section 2.5 | Sortable table | Daily |
| **Accuracy Trend** | Line chart of weekly accuracy score (composite) | `point_events` details.fraudCheck | KPI-T3-03 | Line chart | Daily |
| **Stale Data Buckets** | Stacked bar: Fresh (<7d) / Aging (8-30d) / Stale (31-60d) / Dead (>60d) | `point_events` | Section 2.3 | Stacked horizontal bar | 30 min |
| **Consistency Alerts** | List of points with conflicting categories or divergent coordinates | `point_events` | Section 2.4 | Alert list | Daily |

**Freshness by geographic cell:**

```sql
-- Data quality: Freshness by geographic grid cell
SELECT
  ROUND(latitude::numeric, 2) AS lat_bucket,
  ROUND(longitude::numeric, 2) AS lng_bucket,
  COUNT(DISTINCT point_id) AS point_count,
  ROUND(AVG(EXTRACT(EPOCH FROM (NOW() - last_at)) / 86400.0)::numeric, 1) AS avg_freshness_days,
  ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (
    ORDER BY EXTRACT(EPOCH FROM (NOW() - last_at)) / 86400.0
  )::numeric, 1) AS median_freshness_days
FROM (
  SELECT point_id, latitude, longitude, MAX(created_at) AS last_at
  FROM point_events
  GROUP BY point_id, latitude, longitude
) per_point
GROUP BY ROUND(latitude::numeric, 2), ROUND(longitude::numeric, 2)
ORDER BY avg_freshness_days DESC;
```

---

## 4. Analysis Queries Library

Ready-to-run SQL queries for common analytical questions. Each query is designed to run directly against the `point_events` and `user_profiles` tables.

### 4.1 Geographic Coverage Analysis

```sql
-- Q-GEO-01: Points per category per ~5km grid cell
SELECT
  category,
  ROUND(latitude::numeric, 1) AS lat_grid,
  ROUND(longitude::numeric, 1) AS lng_grid,
  COUNT(DISTINCT point_id) AS point_count,
  COUNT(*) AS event_count,
  COUNT(DISTINCT user_id) AS contributor_count
FROM point_events
GROUP BY category, ROUND(latitude::numeric, 1), ROUND(longitude::numeric, 1)
ORDER BY point_count DESC;

-- Q-GEO-02: Coverage gaps (grid cells with only 1 category present)
WITH cell_categories AS (
  SELECT
    ROUND(latitude::numeric, 2) AS lat_grid,
    ROUND(longitude::numeric, 2) AS lng_grid,
    ARRAY_AGG(DISTINCT category) AS categories_present,
    COUNT(DISTINCT category) AS category_count
  FROM point_events
  GROUP BY ROUND(latitude::numeric, 2), ROUND(longitude::numeric, 2)
)
SELECT *
FROM cell_categories
WHERE category_count < 3
ORDER BY category_count ASC, lat_grid, lng_grid;

-- Q-GEO-03: Bonamoussadi bounds check
-- (Bounds from shared/geofence.ts)
SELECT
  category,
  COUNT(DISTINCT point_id) AS inside_bonamoussadi,
  (SELECT COUNT(DISTINCT point_id) FROM point_events) AS total_all
FROM point_events
WHERE latitude BETWEEN 4.05 AND 4.09
  AND longitude BETWEEN 9.68 AND 9.74
GROUP BY category;
```

### 4.2 Contributor Behavior Analysis

```sql
-- Q-CONTRIB-01: Submission patterns by hour of day
SELECT
  EXTRACT(HOUR FROM created_at) AS hour_of_day,
  COUNT(*) AS submissions,
  COUNT(DISTINCT user_id) AS unique_users
FROM point_events
GROUP BY EXTRACT(HOUR FROM created_at)
ORDER BY hour_of_day;

-- Q-CONTRIB-02: Submission patterns by day of week
SELECT
  EXTRACT(DOW FROM created_at) AS day_of_week,  -- 0=Sunday
  TO_CHAR(created_at, 'Day') AS day_name,
  COUNT(*) AS submissions,
  COUNT(DISTINCT user_id) AS unique_users
FROM point_events
GROUP BY EXTRACT(DOW FROM created_at), TO_CHAR(created_at, 'Day')
ORDER BY day_of_week;

-- Q-CONTRIB-03: Retention cohort matrix (week-over-week)
WITH first_week AS (
  SELECT
    user_id,
    DATE_TRUNC('week', MIN(created_at)) AS cohort_week
  FROM point_events
  GROUP BY user_id
),
activity AS (
  SELECT
    fw.user_id,
    fw.cohort_week,
    DATE_TRUNC('week', pe.created_at) AS active_week,
    (DATE_TRUNC('week', pe.created_at) - fw.cohort_week) / 7 AS weeks_since_cohort
  FROM first_week fw
  JOIN point_events pe ON pe.user_id = fw.user_id
)
SELECT
  cohort_week,
  weeks_since_cohort,
  COUNT(DISTINCT user_id) AS active_users
FROM activity
WHERE weeks_since_cohort BETWEEN 0 AND 12
GROUP BY cohort_week, weeks_since_cohort
ORDER BY cohort_week DESC, weeks_since_cohort;

-- Q-CONTRIB-04: Power user identification (top 10% by volume)
WITH user_volumes AS (
  SELECT
    user_id,
    COUNT(*) AS total_events,
    PERCENT_RANK() OVER (ORDER BY COUNT(*)) AS volume_percentile
  FROM point_events
  GROUP BY user_id
)
SELECT
  uv.user_id,
  up.name,
  up.email,
  uv.total_events,
  ROUND(uv.volume_percentile * 100, 1) AS percentile
FROM user_volumes uv
LEFT JOIN user_profiles up ON up.id = uv.user_id
WHERE uv.volume_percentile >= 0.9
ORDER BY uv.total_events DESC;
```

### 4.3 Data Enrichment Funnel

```sql
-- Q-ENRICH-01: Enrichment funnel per point
-- Stage 1: Created (has CREATE_EVENT)
-- Stage 2: First enrichment (has at least 1 ENRICH_EVENT)
-- Stage 3: Fully complete (all enrichable fields filled)
WITH point_lifecycle AS (
  SELECT
    point_id,
    category,
    BOOL_OR(event_type = 'CREATE_EVENT') AS was_created,
    BOOL_OR(event_type = 'ENRICH_EVENT') AS was_enriched,
    COUNT(*) AS total_events,
    COUNT(DISTINCT user_id) AS distinct_users,
    MIN(created_at) AS created_at,
    MAX(created_at) AS last_updated
  FROM point_events
  GROUP BY point_id, category
)
SELECT
  category,
  COUNT(*) AS total_points,
  COUNT(*) FILTER (WHERE was_created) AS stage_1_created,
  COUNT(*) FILTER (WHERE was_enriched) AS stage_2_enriched,
  -- Time from creation to first enrichment
  ROUND(AVG(
    EXTRACT(EPOCH FROM (last_updated - created_at)) / 3600.0
  ) FILTER (WHERE was_enriched AND total_events > 1)::numeric, 1) AS avg_hours_to_enrich
FROM point_lifecycle
GROUP BY category;

-- Q-ENRICH-02: Average time from creation to first enrichment
WITH creates AS (
  SELECT point_id, MIN(created_at) AS created_at
  FROM point_events
  WHERE event_type = 'CREATE_EVENT'
  GROUP BY point_id
),
first_enrich AS (
  SELECT point_id, MIN(created_at) AS first_enrich_at
  FROM point_events
  WHERE event_type = 'ENRICH_EVENT'
  GROUP BY point_id
)
SELECT
  ROUND(AVG(EXTRACT(EPOCH FROM (fe.first_enrich_at - c.created_at)) / 3600.0)::numeric, 1) AS avg_hours_to_first_enrich,
  ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (
    ORDER BY EXTRACT(EPOCH FROM (fe.first_enrich_at - c.created_at)) / 3600.0
  )::numeric, 1) AS median_hours_to_first_enrich,
  COUNT(*) AS enriched_points,
  (SELECT COUNT(DISTINCT point_id) FROM point_events WHERE event_type = 'CREATE_EVENT') AS total_created
FROM creates c
JOIN first_enrich fe ON fe.point_id = c.point_id;
```

### 4.4 Fraud Pattern Analysis

```sql
-- Q-FRAUD-01: Users with highest GPS mismatch rates
WITH user_fraud AS (
  SELECT
    user_id,
    COUNT(*) AS total_events,
    COUNT(*) FILTER (
      WHERE (details->'fraudCheck'->'primaryPhoto'->>'submissionGpsMatch')::boolean = false
    ) AS gps_mismatches,
    COUNT(*) FILTER (
      WHERE details->'fraudCheck'->'primaryPhoto'->>'exifStatus' = 'missing'
    ) AS missing_exif
  FROM point_events
  GROUP BY user_id
)
SELECT
  uf.user_id,
  up.name,
  up.email,
  uf.total_events,
  uf.gps_mismatches,
  uf.missing_exif,
  ROUND(100.0 * uf.gps_mismatches / GREATEST(uf.total_events, 1), 1) AS mismatch_rate_pct,
  ROUND(100.0 * uf.missing_exif / GREATEST(uf.total_events, 1), 1) AS missing_exif_rate_pct
FROM user_fraud uf
LEFT JOIN user_profiles up ON up.id = uf.user_id
WHERE uf.total_events >= 3  -- minimum sample size
ORDER BY mismatch_rate_pct DESC
LIMIT 50;

-- Q-FRAUD-02: Rapid-fire submissions (> 5 events in 10 minutes by same user)
WITH windowed AS (
  SELECT
    user_id,
    created_at,
    COUNT(*) OVER (
      PARTITION BY user_id
      ORDER BY created_at
      RANGE BETWEEN INTERVAL '10 minutes' PRECEDING AND CURRENT ROW
    ) AS events_in_window
  FROM point_events
)
SELECT DISTINCT user_id, MAX(events_in_window) AS max_burst
FROM windowed
WHERE events_in_window > 5
GROUP BY user_id
ORDER BY max_burst DESC;

-- Q-FRAUD-03: Device fingerprint anomalies
-- Multiple users sharing the same device ID
SELECT
  details->'clientDevice'->>'deviceId' AS device_id,
  COUNT(DISTINCT user_id) AS distinct_users,
  ARRAY_AGG(DISTINCT user_id) AS user_ids,
  COUNT(*) AS total_events
FROM point_events
WHERE details->'clientDevice'->>'deviceId' IS NOT NULL
GROUP BY details->'clientDevice'->>'deviceId'
HAVING COUNT(DISTINCT user_id) > 1
ORDER BY distinct_users DESC;

-- Q-FRAUD-04: Submissions from suspiciously uniform coordinates
-- (Exact same lat/lng for multiple different point_ids = likely fabricated)
SELECT
  latitude, longitude,
  COUNT(DISTINCT point_id) AS distinct_points,
  COUNT(DISTINCT user_id) AS distinct_users,
  ARRAY_AGG(DISTINCT point_id) AS point_ids
FROM point_events
GROUP BY latitude, longitude
HAVING COUNT(DISTINCT point_id) > 3
ORDER BY distinct_points DESC;
```

### 4.5 Category Growth Trends

```sql
-- Q-GROWTH-01: Category growth over time (weekly)
SELECT
  DATE_TRUNC('week', created_at) AS week,
  category,
  COUNT(*) AS new_events,
  COUNT(*) FILTER (WHERE event_type = 'CREATE_EVENT') AS new_creates,
  COUNT(DISTINCT point_id) AS active_points,
  COUNT(DISTINCT user_id) AS active_users
FROM point_events
GROUP BY DATE_TRUNC('week', created_at), category
ORDER BY week DESC, category;

-- Q-GROWTH-02: Cumulative points over time
SELECT
  DATE_TRUNC('week', min_created) AS week,
  category,
  COUNT(*) AS new_points_this_week,
  SUM(COUNT(*)) OVER (PARTITION BY category ORDER BY DATE_TRUNC('week', min_created)) AS cumulative_points
FROM (
  SELECT point_id, category, MIN(created_at) AS min_created
  FROM point_events
  GROUP BY point_id, category
) first_seen
GROUP BY DATE_TRUNC('week', min_created), category
ORDER BY week DESC, category;
```

### 4.6 Seasonal Patterns

```sql
-- Q-SEASON-01: Monthly submission volumes
SELECT
  TO_CHAR(created_at, 'YYYY-MM') AS month,
  category,
  COUNT(*) AS events,
  COUNT(DISTINCT user_id) AS contributors
FROM point_events
GROUP BY TO_CHAR(created_at, 'YYYY-MM'), category
ORDER BY month DESC, category;

-- Q-SEASON-02: Weekday vs weekend submission patterns
SELECT
  CASE
    WHEN EXTRACT(DOW FROM created_at) IN (0, 6) THEN 'weekend'
    ELSE 'weekday'
  END AS day_type,
  category,
  COUNT(*) AS events,
  ROUND(AVG(COUNT(*)) OVER (
    PARTITION BY
      CASE WHEN EXTRACT(DOW FROM created_at) IN (0, 6) THEN 'weekend' ELSE 'weekday' END,
      category
  ), 1) AS avg_events
FROM point_events
GROUP BY
  CASE WHEN EXTRACT(DOW FROM created_at) IN (0, 6) THEN 'weekend' ELSE 'weekday' END,
  category
ORDER BY day_type, category;
```

### 4.7 Leaderboard Fairness Analysis

```sql
-- Q-FAIR-01: XP distribution analysis (Gini-like)
WITH user_xp AS (
  SELECT user_id, SUM(5) AS total_xp  -- BASE_EVENT_XP = 5 per event
  FROM point_events
  GROUP BY user_id
),
ranked AS (
  SELECT
    user_id,
    total_xp,
    ROW_NUMBER() OVER (ORDER BY total_xp) AS rank,
    COUNT(*) OVER () AS total_users,
    SUM(total_xp) OVER () AS total_xp_pool
  FROM user_xp
)
SELECT
  -- Gini coefficient approximation
  1.0 - 2.0 * SUM(
    (total_users + 1 - rank)::numeric * total_xp
  ) / (total_users::numeric * total_xp_pool) AS gini_coefficient,
  -- Top 10% share of XP
  ROUND(100.0 * SUM(total_xp) FILTER (
    WHERE rank >= 0.9 * total_users
  ) / GREATEST(SUM(total_xp), 1), 1) AS top_10_pct_share,
  -- Median XP
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY total_xp) AS median_xp,
  AVG(total_xp) AS mean_xp,
  COUNT(*) AS total_users
FROM ranked;

-- Q-FAIR-02: XP earned from creates vs enrichments
SELECT
  event_type,
  COUNT(*) AS event_count,
  COUNT(*) * 5 AS total_xp_awarded,  -- BASE_EVENT_XP = 5
  COUNT(DISTINCT user_id) AS unique_users,
  ROUND(COUNT(*)::numeric / GREATEST(COUNT(DISTINCT user_id), 1), 1) AS avg_events_per_user
FROM point_events
GROUP BY event_type;

-- Q-FAIR-03: Are some categories systematically easier to game?
-- (events per hour per user per category)
WITH user_category_velocity AS (
  SELECT
    user_id,
    category,
    COUNT(*) AS events,
    EXTRACT(EPOCH FROM (MAX(created_at) - MIN(created_at))) / 3600.0 AS active_hours,
    ROUND(COUNT(*)::numeric /
      GREATEST(EXTRACT(EPOCH FROM (MAX(created_at) - MIN(created_at))) / 3600.0, 0.1)
    , 2) AS events_per_hour
  FROM point_events
  GROUP BY user_id, category
  HAVING COUNT(*) >= 5  -- minimum activity
)
SELECT
  category,
  ROUND(AVG(events_per_hour), 2) AS avg_velocity,
  ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY events_per_hour)::numeric, 2) AS median_velocity,
  MAX(events_per_hour) AS max_velocity
FROM user_category_velocity
GROUP BY category
ORDER BY avg_velocity DESC;
```

---

## 5. Data Pipeline Architecture

### 5.1 Current State Analysis

ADL currently runs all analytics queries directly against the operational `point_events` table in Supabase (Postgres). The `api/leaderboard/index.ts` endpoint loads all `point_events` into memory, aggregates by user, and returns the top 100. The `Analytics.tsx` component fetches all projected points and events to compute client-side metrics. This works at MVP scale but will not scale to 100K+ events.

```
Current state:
  Client (Analytics.tsx)
    -> GET /api/submissions (all events)
    -> GET /api/leaderboard (aggregates in-memory)
    -> Client-side computation (completionRate, categoryData, heatmap)
```

### 5.2 Target Pipeline Architecture

```
+------------------+     +-------------------+     +--------------------+
|  point_events    | --> |  Materialized     | --> |  Dashboard API     |
|  (operational)   |     |  Views            |     |  (read-only)       |
|                  |     |  (Postgres)       |     |                    |
+------------------+     +-------------------+     +--------------------+
        |                         |                          |
        |   Triggered by          |   Queried by             |   Consumed by
        |   pg_cron or            |   /api/analytics/*       |   Executive dashboard
        |   Supabase Edge         |   endpoints              |   Ops dashboard
        |   Functions             |                          |   Quality dashboard
        |                         |                          |
        v                         v                          v
+------------------+     +-------------------+     +--------------------+
|  Aggregation     |     |  Export           |     |  External          |
|  Tables          |     |  (CSV/JSON)       |     |  Consumers         |
|  (daily_stats,   |     |  Scheduled via    |     |  (API customers,   |
|   weekly_stats)  |     |  pg_cron          |     |   NGOs, govts)     |
+------------------+     +-------------------+     +--------------------+
```

### 5.3 Materialized Views

**MV-01: Point summary (latest state per point_id)**

```sql
CREATE MATERIALIZED VIEW mv_point_summary AS
SELECT DISTINCT ON (point_id)
  point_id,
  category,
  latitude,
  longitude,
  details,
  photo_url,
  created_at AS first_event_at,
  (SELECT MAX(created_at) FROM point_events pe2 WHERE pe2.point_id = pe.point_id) AS last_event_at,
  (SELECT COUNT(*) FROM point_events pe2 WHERE pe2.point_id = pe.point_id) AS event_count,
  (SELECT COUNT(DISTINCT user_id) FROM point_events pe2 WHERE pe2.point_id = pe.point_id) AS contributor_count,
  (SELECT BOOL_OR(event_type = 'ENRICH_EVENT') FROM point_events pe2 WHERE pe2.point_id = pe.point_id) AS has_enrichment,
  source,
  external_id
FROM point_events pe
ORDER BY point_id, created_at DESC
WITH DATA;

CREATE UNIQUE INDEX ON mv_point_summary (point_id);
CREATE INDEX ON mv_point_summary (category);
CREATE INDEX ON mv_point_summary (last_event_at DESC);

-- Refresh schedule: every 15 minutes
-- REFRESH MATERIALIZED VIEW CONCURRENTLY mv_point_summary;
```

**MV-02: User activity summary**

```sql
CREATE MATERIALIZED VIEW mv_user_activity AS
SELECT
  user_id,
  COUNT(*) AS total_events,
  COUNT(*) FILTER (WHERE event_type = 'CREATE_EVENT') AS creates,
  COUNT(*) FILTER (WHERE event_type = 'ENRICH_EVENT') AS enrichments,
  COUNT(DISTINCT point_id) AS unique_points,
  COUNT(DISTINCT category) AS categories_touched,
  COUNT(DISTINCT DATE_TRUNC('day', created_at)) AS active_days,
  MIN(created_at) AS first_event_at,
  MAX(created_at) AS last_event_at,
  COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days') AS events_7d,
  COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days') AS events_30d
FROM point_events
GROUP BY user_id
WITH DATA;

CREATE UNIQUE INDEX ON mv_user_activity (user_id);
CREATE INDEX ON mv_user_activity (total_events DESC);
CREATE INDEX ON mv_user_activity (last_event_at DESC);

-- Refresh: every 15 minutes
```

**MV-03: Daily aggregates**

```sql
CREATE MATERIALIZED VIEW mv_daily_stats AS
SELECT
  DATE_TRUNC('day', created_at)::date AS day,
  category,
  event_type,
  COUNT(*) AS event_count,
  COUNT(DISTINCT user_id) AS unique_users,
  COUNT(DISTINCT point_id) AS unique_points,
  COUNT(*) FILTER (WHERE photo_url IS NOT NULL) AS with_photo,
  COUNT(*) FILTER (
    WHERE (details->'fraudCheck'->'primaryPhoto'->>'submissionGpsMatch')::boolean = false
  ) AS fraud_flags
FROM point_events
GROUP BY DATE_TRUNC('day', created_at)::date, category, event_type
WITH DATA;

CREATE UNIQUE INDEX ON mv_daily_stats (day, category, event_type);
CREATE INDEX ON mv_daily_stats (day DESC);

-- Refresh: every 30 minutes (lightweight)
```

### 5.4 Aggregation Tables

For long-term trend analysis, daily materialized view refreshes write into permanent aggregation tables that survive even if the materialized view is rebuilt.

```sql
-- Permanent weekly stats table (insert-only, idempotent)
CREATE TABLE IF NOT EXISTS analytics_weekly (
  week_start date NOT NULL,
  category text NOT NULL,
  total_events integer NOT NULL DEFAULT 0,
  total_creates integer NOT NULL DEFAULT 0,
  total_enrichments integer NOT NULL DEFAULT 0,
  unique_users integer NOT NULL DEFAULT 0,
  unique_points integer NOT NULL DEFAULT 0,
  new_users integer NOT NULL DEFAULT 0,
  verified_points integer NOT NULL DEFAULT 0,
  fraud_flags integer NOT NULL DEFAULT 0,
  avg_completeness_pct numeric(5,1),
  median_freshness_days numeric(5,1),
  PRIMARY KEY (week_start, category)
);

-- Weekly aggregation job (run via pg_cron every Monday 02:00 UTC)
INSERT INTO analytics_weekly (
  week_start, category, total_events, total_creates, total_enrichments,
  unique_users, unique_points, new_users, verified_points, fraud_flags
)
SELECT
  DATE_TRUNC('week', created_at)::date AS week_start,
  category,
  COUNT(*),
  COUNT(*) FILTER (WHERE event_type = 'CREATE_EVENT'),
  COUNT(*) FILTER (WHERE event_type = 'ENRICH_EVENT'),
  COUNT(DISTINCT user_id),
  COUNT(DISTINCT point_id),
  0,  -- Filled by a second pass
  0,  -- Filled by a second pass
  COUNT(*) FILTER (
    WHERE (details->'fraudCheck'->'primaryPhoto'->>'submissionGpsMatch')::boolean = false
  )
FROM point_events
WHERE created_at >= DATE_TRUNC('week', NOW() - INTERVAL '1 week')
  AND created_at < DATE_TRUNC('week', NOW())
GROUP BY DATE_TRUNC('week', created_at)::date, category
ON CONFLICT (week_start, category) DO UPDATE SET
  total_events = EXCLUDED.total_events,
  total_creates = EXCLUDED.total_creates,
  total_enrichments = EXCLUDED.total_enrichments,
  unique_users = EXCLUDED.unique_users,
  unique_points = EXCLUDED.unique_points,
  fraud_flags = EXCLUDED.fraud_flags;
```

### 5.5 Data Export Format

For external consumers (municipalities, NGOs, logistics providers), ADL exports data in two formats:

**GeoJSON export (API consumers):**

```sql
-- Export as GeoJSON feature collection
SELECT json_build_object(
  'type', 'FeatureCollection',
  'generated_at', NOW(),
  'features', COALESCE(json_agg(feature), '[]'::json)
)
FROM (
  SELECT json_build_object(
    'type', 'Feature',
    'geometry', json_build_object(
      'type', 'Point',
      'coordinates', json_build_array(longitude, latitude)
    ),
    'properties', json_build_object(
      'point_id', point_id,
      'category', category,
      'name', details->>'name',
      'last_updated', last_event_at,
      'event_count', event_count,
      'contributor_count', contributor_count,
      'has_enrichment', has_enrichment
    )
  ) AS feature
  FROM mv_point_summary
) features;
```

**CSV export (data analysts):**

```sql
-- CSV export query
COPY (
  SELECT
    point_id,
    category,
    latitude,
    longitude,
    details->>'name' AS name,
    details->>'openingHours' AS opening_hours,
    details->>'phone' AS phone,
    event_count,
    contributor_count,
    first_event_at,
    last_event_at,
    has_enrichment
  FROM mv_point_summary
  ORDER BY category, point_id
) TO '/tmp/adl_export.csv' WITH CSV HEADER;
```

### 5.6 Scheduled Reports

| Report | Frequency | Recipients | Content | Delivery |
|---|---|---|---|---|
| **Weekly Growth Report** | Monday 08:00 WAT | Leadership, investors | WAC, new contributors, total points by category, freshness score, fraud rate | Email (via Supabase Edge Function + Resend) |
| **Daily Ops Report** | Daily 07:00 WAT | Engineering team | Submission volume (24h), error count, sync failures, API latency summary, fraud flags | Slack webhook |
| **Monthly Quality Report** | 1st of month | Product team, data quality | Completeness by category, duplicate candidates, stale data count, accuracy trend | Email with CSV attachment |
| **Quarterly Investor Report** | End of quarter | Board, investors | Cumulative growth, geographic expansion, retention cohorts, revenue metrics | PDF export |

---

## 6. Decision Support Queries

These queries directly support business decisions by surfacing actionable insights from the data.

### 6.1 Where to Focus Next (Underserved Areas)

```sql
-- DS-01: Underserved areas -- grid cells with population indicators but few data points
-- Identifies areas where ADL should recruit more contributors
WITH cell_coverage AS (
  SELECT
    ROUND(latitude::numeric, 2) AS lat_grid,
    ROUND(longitude::numeric, 2) AS lng_grid,
    COUNT(DISTINCT point_id) AS point_count,
    COUNT(DISTINCT category) AS categories_present,
    ARRAY_AGG(DISTINCT category) AS available_categories,
    MAX(created_at) AS last_activity
  FROM point_events
  GROUP BY ROUND(latitude::numeric, 2), ROUND(longitude::numeric, 2)
)
SELECT
  lat_grid,
  lng_grid,
  point_count,
  categories_present,
  available_categories,
  -- Missing categories
  ARRAY(
    SELECT unnest(ARRAY['pharmacy', 'fuel_station', 'mobile_money'])
    EXCEPT
    SELECT unnest(available_categories)
  ) AS missing_categories,
  last_activity,
  EXTRACT(EPOCH FROM (NOW() - last_activity)) / 86400.0 AS days_since_last_activity
FROM cell_coverage
WHERE categories_present < 3
   OR point_count < 5
ORDER BY point_count ASC, categories_present ASC
LIMIT 50;

-- DS-02: Expansion frontier -- outermost points suggesting organic growth direction
SELECT
  category,
  latitude, longitude,
  details->>'name' AS poi_name,
  created_at,
  user_id,
  -- Distance from Bonamoussadi center (4.07, 9.71)
  SQRT(
    POWER((latitude - 4.07) * 111, 2) +
    POWER((longitude - 9.71) * 111 * COS(RADIANS(4.07)), 2)
  ) AS distance_from_center_km
FROM point_events
WHERE event_type = 'CREATE_EVENT'
ORDER BY distance_from_center_km DESC
LIMIT 20;
```

### 6.2 Which Contributors to Reward or Investigate

```sql
-- DS-03: Contributors to reward (high quality + high volume)
WITH user_quality AS (
  SELECT
    user_id,
    COUNT(*) AS total_events,
    COUNT(DISTINCT point_id) AS unique_points,
    COUNT(*) FILTER (WHERE event_type = 'ENRICH_EVENT') AS enrichments,
    COUNT(*) FILTER (
      WHERE (details->'fraudCheck'->'primaryPhoto'->>'submissionGpsMatch')::boolean = false
    ) AS fraud_flags,
    COUNT(*) FILTER (
      WHERE details->'fraudCheck'->'primaryPhoto'->>'exifStatus' = 'ok'
    ) AS clean_exif,
    COUNT(DISTINCT DATE_TRUNC('week', created_at)) AS active_weeks
  FROM point_events
  GROUP BY user_id
)
SELECT
  uq.user_id,
  up.name,
  up.email,
  up.xp,
  uq.total_events,
  uq.unique_points,
  uq.enrichments,
  uq.active_weeks,
  uq.fraud_flags,
  -- Quality score: high events + low fraud + high enrichment
  ROUND(
    (uq.total_events::numeric * 0.3
     + uq.enrichments::numeric * 0.3
     + uq.active_weeks::numeric * 0.2
     + (1.0 - uq.fraud_flags::numeric / GREATEST(uq.total_events, 1)) * uq.total_events * 0.2
    ), 1
  ) AS reward_score
FROM user_quality uq
LEFT JOIN user_profiles up ON up.id = uq.user_id
WHERE uq.total_events >= 5
ORDER BY reward_score DESC
LIMIT 25;

-- DS-04: Contributors to investigate (high fraud signals)
SELECT
  uq.user_id,
  up.name,
  up.email,
  uq.total_events,
  uq.fraud_flags,
  ROUND(100.0 * uq.fraud_flags / GREATEST(uq.total_events, 1), 1) AS fraud_rate_pct,
  uq.unique_points,
  ROUND(uq.total_events::numeric / GREATEST(uq.unique_points, 1), 1) AS events_per_point
FROM (
  SELECT
    user_id,
    COUNT(*) AS total_events,
    COUNT(DISTINCT point_id) AS unique_points,
    COUNT(*) FILTER (
      WHERE (details->'fraudCheck'->'primaryPhoto'->>'submissionGpsMatch')::boolean = false
    ) AS fraud_flags
  FROM point_events
  GROUP BY user_id
) uq
LEFT JOIN user_profiles up ON up.id = uq.user_id
WHERE uq.fraud_flags > 0
  AND uq.total_events >= 3
ORDER BY fraud_rate_pct DESC
LIMIT 25;
```

### 6.3 Which Categories Need More Data

```sql
-- DS-05: Category gap analysis
WITH category_health AS (
  SELECT
    category,
    COUNT(DISTINCT point_id) AS total_points,
    COUNT(*) AS total_events,
    ROUND(AVG(EXTRACT(EPOCH FROM (NOW() - last_at)) / 86400.0)::numeric, 1) AS avg_freshness_days,
    COUNT(DISTINCT user_id) AS contributors
  FROM (
    SELECT point_id, category, user_id, MAX(created_at) AS last_at
    FROM point_events
    GROUP BY point_id, category, user_id
  ) per_user_point
  GROUP BY category
)
SELECT
  category,
  total_points,
  total_events,
  contributors,
  avg_freshness_days,
  -- Priority score: fewer points + staler data = higher priority
  ROUND(
    (1.0 / GREATEST(total_points, 1)) * 1000
    + avg_freshness_days * 2
    - contributors * 5
  , 1) AS investment_priority_score
FROM category_health
ORDER BY investment_priority_score DESC;
```

### 6.4 Optimal Incentive Levels (XP per Action)

```sql
-- DS-06: XP incentive analysis
-- Currently: BASE_EVENT_XP = 5 for both CREATE and ENRICH
-- Question: Should enrichments earn more XP to incentivize completeness?
WITH user_behavior AS (
  SELECT
    user_id,
    COUNT(*) AS total_events,
    COUNT(*) FILTER (WHERE event_type = 'CREATE_EVENT') AS creates,
    COUNT(*) FILTER (WHERE event_type = 'ENRICH_EVENT') AS enrichments,
    ROUND(
      100.0 * COUNT(*) FILTER (WHERE event_type = 'ENRICH_EVENT')
      / GREATEST(COUNT(*), 1)
    , 1) AS enrich_pct
  FROM point_events
  GROUP BY user_id
)
SELECT
  CASE
    WHEN enrich_pct >= 50 THEN 'enrichment-heavy (>=50%)'
    WHEN enrich_pct >= 20 THEN 'balanced (20-50%)'
    ELSE 'creation-heavy (<20%)'
  END AS user_type,
  COUNT(*) AS user_count,
  ROUND(AVG(total_events), 1) AS avg_total_events,
  ROUND(AVG(creates), 1) AS avg_creates,
  ROUND(AVG(enrichments), 1) AS avg_enrichments,
  -- Retention proxy: active over how many weeks?
  ROUND(AVG(active_weeks), 1) AS avg_active_weeks
FROM (
  SELECT
    ub.*,
    (SELECT COUNT(DISTINCT DATE_TRUNC('week', created_at))
     FROM point_events pe WHERE pe.user_id = ub.user_id) AS active_weeks
  FROM user_behavior ub
) enriched
GROUP BY
  CASE
    WHEN enrich_pct >= 50 THEN 'enrichment-heavy (>=50%)'
    WHEN enrich_pct >= 20 THEN 'balanced (20-50%)'
    ELSE 'creation-heavy (<20%)'
  END
ORDER BY avg_active_weeks DESC;

-- Recommendation framework:
-- If creation-heavy users churn faster -> increase ENRICH XP to 8
-- If enrichment-heavy users have better retention -> model is working
-- If balanced users are rare -> consider bonus XP for 50/50 split
```

### 6.5 Geographic Expansion Readiness Score

```sql
-- DS-07: Expansion readiness score per region
-- Evaluates whether ADL has enough contributor density and data quality
-- to credibly launch in a new area
WITH region_metrics AS (
  SELECT
    ROUND(latitude::numeric, 1) AS region_lat,
    ROUND(longitude::numeric, 1) AS region_lng,
    COUNT(DISTINCT point_id) AS point_count,
    COUNT(DISTINCT user_id) AS contributor_count,
    COUNT(DISTINCT category) AS category_coverage,
    ROUND(AVG(
      EXTRACT(EPOCH FROM (NOW() - last_at)) / 86400.0
    )::numeric, 1) AS avg_freshness_days,
    COUNT(DISTINCT point_id) FILTER (
      WHERE contributor_count >= 2
    ) AS verified_points,
    SUM(CASE
      WHEN (details->'fraudCheck'->'primaryPhoto'->>'submissionGpsMatch')::boolean = false THEN 1
      ELSE 0
    END)::numeric / GREATEST(COUNT(*), 1) AS fraud_rate
  FROM (
    SELECT
      pe.*,
      (SELECT COUNT(DISTINCT pe2.user_id) FROM point_events pe2 WHERE pe2.point_id = pe.point_id) AS contributor_count,
      (SELECT MAX(pe2.created_at) FROM point_events pe2 WHERE pe2.point_id = pe.point_id) AS last_at
    FROM point_events pe
  ) enriched
  GROUP BY ROUND(latitude::numeric, 1), ROUND(longitude::numeric, 1)
)
SELECT
  region_lat,
  region_lng,
  point_count,
  contributor_count,
  category_coverage,
  avg_freshness_days,
  fraud_rate,
  -- Readiness score (0-100)
  ROUND(LEAST(100, (
    LEAST(point_count, 50)::numeric / 50 * 25    -- up to 25 pts for density
    + LEAST(contributor_count, 10)::numeric / 10 * 25  -- up to 25 pts for contributors
    + category_coverage::numeric / 3 * 25          -- up to 25 pts for category coverage
    + GREATEST(0, (1.0 - fraud_rate)) * 25         -- up to 25 pts for low fraud
  )), 1) AS readiness_score
FROM region_metrics
ORDER BY readiness_score DESC;
```

---

## Appendix A: Schema Quick Reference

The following is the complete schema as defined in `supabase/migrations/20260219_init_adl.sql`:

```sql
-- user_profiles
create table if not exists public.user_profiles (
  id text primary key,
  email text not null unique,
  name text not null,
  image text not null default '',
  occupation text not null default '',
  xp integer not null default 0 check (xp >= 0),
  password_hash text,
  is_admin boolean not null default false,
  map_scope text not null default 'bonamoussadi'
    check (map_scope in ('bonamoussadi', 'cameroon', 'global')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- point_events
create table if not exists public.point_events (
  id uuid primary key,
  point_id text not null,
  event_type text not null
    check (event_type in ('CREATE_EVENT', 'ENRICH_EVENT')),
  user_id text not null,
  category text not null
    check (category in ('pharmacy', 'fuel_station', 'mobile_money')),
  latitude double precision not null,
  longitude double precision not null,
  details jsonb not null default '{}'::jsonb,
  photo_url text,
  created_at timestamptz not null,
  source text,
  external_id text
);
```

**Key JSONB fields in `details`:**

| Path | Type | Description |
|---|---|---|
| `details.name` / `details.siteName` | string | POI name |
| `details.openingHours` | string | Opening hours text |
| `details.isOpenNow` | boolean | Current open status |
| `details.isOnDuty` | boolean | Pharmacy on-call status |
| `details.providers` | string[] | Mobile money providers |
| `details.merchantIdByProvider` | object | Merchant IDs keyed by provider |
| `details.paymentMethods` | string[] | Accepted payment methods |
| `details.fuelTypes` | string[] | Available fuel types |
| `details.pricesByFuel` | object | Prices keyed by fuel type |
| `details.hasFuelAvailable` | boolean | Fuel availability |
| `details.quality` | string | Fuel quality rating |
| `details.hasPhoto` | boolean | Whether primary photo was uploaded |
| `details.hasSecondaryPhoto` | boolean | Whether secondary photo was uploaded |
| `details.secondPhotoUrl` | string | URL of secondary photo |
| `details.fraudCheck` | object | Full fraud check metadata |
| `details.fraudCheck.primaryPhoto.submissionGpsMatch` | boolean | Photo GPS matches submission GPS |
| `details.fraudCheck.primaryPhoto.submissionDistanceKm` | number | Distance between photo and submission GPS |
| `details.fraudCheck.primaryPhoto.ipGpsMatch` | boolean | Photo GPS matches IP location |
| `details.fraudCheck.primaryPhoto.exifStatus` | string | EXIF extraction status |
| `details.clientDevice` | object | Client device fingerprint |
| `details.clientDevice.deviceId` | string | Unique device identifier |
| `details.source` | string | Data source (e.g., `osm_overpass`, `legacy_submission`) |

---

## Appendix B: Recommended Schema Extensions

The following schema additions are recommended to support the full analytics framework:

```sql
-- 1. Admin review tracking
CREATE TABLE IF NOT EXISTS admin_reviews (
  event_id uuid PRIMARY KEY REFERENCES point_events(id) ON DELETE CASCADE,
  reviewer_id text NOT NULL REFERENCES user_profiles(id),
  decision text NOT NULL CHECK (decision IN ('approved', 'rejected', 'flagged')),
  reviewed_at timestamptz NOT NULL DEFAULT now(),
  notes text
);
CREATE INDEX ON admin_reviews (reviewer_id);
CREATE INDEX ON admin_reviews (reviewed_at DESC);

-- 2. Analytics weekly aggregation table (see Section 5.4)
-- (Already defined above)

-- 3. Additional indexes for analytics queries
CREATE INDEX IF NOT EXISTS idx_point_events_category
  ON point_events (category);
CREATE INDEX IF NOT EXISTS idx_point_events_event_type
  ON point_events (event_type);
CREATE INDEX IF NOT EXISTS idx_point_events_user_category
  ON point_events (user_id, category);
CREATE INDEX IF NOT EXISTS idx_point_events_point_event_type
  ON point_events (point_id, event_type);

-- 4. GIN index on details JSONB for fraud check queries
CREATE INDEX IF NOT EXISTS idx_point_events_details_gin
  ON point_events USING gin (details);

-- 5. pg_cron for materialized view refresh (if available)
-- SELECT cron.schedule('refresh-mv-point-summary', '*/15 * * * *',
--   'REFRESH MATERIALIZED VIEW CONCURRENTLY mv_point_summary');
-- SELECT cron.schedule('refresh-mv-user-activity', '*/15 * * * *',
--   'REFRESH MATERIALIZED VIEW CONCURRENTLY mv_user_activity');
-- SELECT cron.schedule('refresh-mv-daily-stats', '*/30 * * * *',
--   'REFRESH MATERIALIZED VIEW CONCURRENTLY mv_daily_stats');
```

---

## Appendix C: Integration with Existing Codebase

| Current Component | Analytics Enhancement | Priority |
|---|---|---|
| `Analytics.tsx` (client-side computation) | Replace client-side aggregation with server-side materialized views via new `/api/analytics` endpoints | High |
| `api/leaderboard/index.ts` (in-memory aggregation) | Query `mv_user_activity` instead of loading all events | High |
| `AdminQueue.tsx` (forensic review) | Add `admin_reviews` table, track review decisions, surface backlog metric | Medium |
| `api/submissions/index.ts` (submission endpoint) | Emit structured telemetry event on each submission for real-time dashboards | Medium |
| `lib/client/offlineQueue.ts` (sync errors) | Send sync failure telemetry to server for KPI-T4-03 tracking | Medium |
| `lib/server/pointProjection.ts` (gap calculation) | Use `mv_point_summary` for faster completeness checks | Low |
