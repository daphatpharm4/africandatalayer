# Delta Intelligence

Delta Intelligence is ADL's weekly snapshot and diff system that tracks how field data changes over time. It provides automated trend analysis, anomaly detection, and a visual admin dashboard.

## Architecture

```
Every Monday 03:00 UTC (Vercel Cron)
         |
         v
+-- 1. SNAPSHOT --------------------------+
|  Reads all point_events from DB         |
|  -> projectPointsFromEvents()           |
|  -> Freezes current state into          |
|     snapshots table (one row per point) |
+-----------------------------------------+
         |
         v
+-- 2. DELTA -----------------------------+
|  Compares this week's snapshot          |
|  to last week's snapshot:               |
|                                         |
|  - NEW: point exists now, not before    |
|  - REMOVED: existed before, not now     |
|  - CHANGED: exists in both, details     |
|    differ (field-by-field comparison)   |
|  - UNCHANGED: identical                 |
|                                         |
|  Stores diffs in snapshot_deltas table  |
+-----------------------------------------+
         |
         v
+-- 3. STATS -----------------------------+
|  Per vertical, computes:                |
|                                         |
|  - total_points, completion_rate        |
|  - new/removed/changed/unchanged counts |
|  - avg fuel price (fuel_station only)   |
|  - week-over-week growth %              |
|  - 4-week moving average                |
|  - z-scores (how unusual is this week   |
|    compared to last 8 weeks?)           |
|  - anomaly flags (|z-score| > 2)        |
|                                         |
|  Stores in snapshot_stats table         |
+-----------------------------------------+
```

## Database Tables

### `snapshots`

Frozen projected state per point per snapshot date.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| snapshot_date | date | Week identifier (YYYY-MM-DD) |
| vertical_id | text | Vertical category |
| point_id | text | Unique point identifier |
| category | text | Same as vertical_id |
| site_name | text | Human-readable name |
| latitude / longitude | double precision | GPS coordinates |
| details | jsonb | Full frozen details |
| gaps | text[] | Missing enrichable fields |
| events_count | integer | Number of source events |
| photo_url, source, external_id | text | Metadata |

Unique constraint: `(snapshot_date, point_id)` prevents double-runs.

### `snapshot_deltas`

One row per point per delta type per changed field.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| snapshot_date | date | Current snapshot |
| baseline_snapshot_date | date | Previous snapshot |
| vertical_id | text | Vertical category |
| point_id | text | Point identifier |
| delta_type | text | `new`, `removed`, `changed`, `unchanged` |
| delta_field | text | Which field changed (null for new/removed/unchanged) |
| previous_value / current_value | text | Before and after values |
| delta_magnitude | numeric | Numeric difference (e.g., price changes) |
| delta_direction | text | `increase`, `decrease`, `stable`, `not_applicable` |
| delta_summary | text | Human-readable one-liner |

### `snapshot_stats`

One row per vertical per snapshot date. Pre-aggregated for fast dashboard reads.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| snapshot_date | date | Week identifier |
| vertical_id | text | Vertical category |
| total_points | integer | Total points in this vertical |
| completed_points | integer | Points with no gaps |
| completion_rate | numeric | Percentage complete |
| new_count / removed_count / changed_count / unchanged_count | integer | Delta breakdown |
| avg_price | numeric | Average fuel price (fuel_station only) |
| week_over_week_growth | numeric | (current - prev) / prev as % |
| moving_avg_4w | numeric | 4-week smoothed total_points |
| z_score_total_points / z_score_new_count / z_score_removed_count | numeric | Statistical z-scores |
| anomaly_flags | jsonb | Array of flagged anomalies |

Unique constraint: `(snapshot_date, vertical_id)`.

## Statistical Methods

### Week-over-Week Growth

```
growth = ((current_total - previous_total) / previous_total) * 100
```

### Moving Average (4-week)

Smooths out noise by averaging the last 4 weeks of `total_points`. Useful for seeing the real trend vs. weekly fluctuations.

### Z-Score Anomaly Detection

```
z = (value - mean) / standard_deviation
```

Computed over the last 8 weeks of historical data. Requires at least 3 data points. A metric is flagged as anomalous when `|z-score| > 2`, meaning the value is more than 2 standard deviations from the historical average.

Monitored metrics: `total_points`, `new_count`, `removed_count`.

Example anomaly flag:
```json
[{"metric": "removed_count", "zScore": 2.4, "direction": "increase"}]
```

## API

All analytics are served from a single endpoint with a `view` query parameter.

### `GET /api/analytics?view=snapshots`

Returns pre-computed stats from `snapshot_stats`.

| Param | Description |
|-------|-------------|
| vertical | Filter by vertical (e.g., `pharmacy`) |
| limit | Max rows (default 12, max 52) |

### `GET /api/analytics?view=deltas`

Returns individual point-level changes.

| Param | Description |
|-------|-------------|
| date | Filter by snapshot date |
| vertical | Filter by vertical |
| type | Filter by delta type (`new`, `removed`, `changed`, `unchanged`) |
| limit | Max rows (default 100, max 500) |

Response: `{ deltas: [...], total: number }`

### `GET /api/analytics?view=trends`

Returns time-series data with moving averages for charting.

| Param | Description |
|-------|-------------|
| vertical | Required. Vertical to query |
| metric | `total_points`, `completion_rate`, `new_count`, `removed_count`, `avg_price`, `week_over_week_growth` |
| weeks | Number of weeks (default 12, max 52) |

Response: `{ data: [{ date, value, movingAvg }] }`

### `GET /api/analytics?view=anomalies`

Returns all stats rows where anomalies were detected. No parameters required.

### `GET /api/analytics?view=cron`

Triggers a snapshot run. Authenticated via `Authorization: Bearer <CRON_SECRET>` header, not user session.

Optional param: `date` to override the snapshot date (useful for testing).

Response: `{ snapshotDate, snapshotsInserted, deltasInserted, statsComputed, baselineDate }`

## Cron Schedule

Configured in `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/analytics?view=cron",
      "schedule": "0 3 * * 1"
    }
  ]
}
```

Runs every Monday at 03:00 UTC. Max execution time: 60 seconds.

## Dashboard

Accessible from the Analytics screen (admin only) via the "Delta Intelligence" button.

### Sections

1. **Anomaly Banner** — red alert when anomalies are detected, showing vertical, metric, and z-score
2. **Summary Cards** — total points, week-over-week growth %, completion rate, alert count
3. **Vertical Tabs** — filter all views by vertical (pharmacy, fuel_station, mobile_money, alcohol_outlet, retail_kiosk, billboard)
4. **Point Count Trend** — line chart with actual values (solid) vs 4-week moving average (dashed)
5. **Delta Breakdown** — stacked bar chart (green=new, red=removed, yellow=changed, gray=unchanged)
6. **Price Trend** — fuel station average price over time (shown only for fuel_station vertical)
7. **Recent Changes** — scrollable list of individual point changes with type badges and magnitude

## Setup

1. Run the migration `supabase/migrations/20260303_snapshot_delta_tables.sql` against your Supabase instance (SQL Editor or `supabase db push`)
2. Set `CRON_SECRET` environment variable in Vercel project settings (generate with `openssl rand -hex 32`)
3. Deploy to Vercel
4. The cron runs automatically every Monday, or trigger manually:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" "https://your-app.vercel.app/api/analytics?view=cron"
```

## Data Requirements

- **1 snapshot**: baseline data, summary cards and stats visible
- **2 snapshots**: deltas computed (new/removed/changed/unchanged), week-over-week growth, trend charts begin
- **3+ snapshots**: z-scores and anomaly detection activate
- **4+ snapshots**: 4-week moving average fully populated

## Key Files

| File | Purpose |
|------|---------|
| `lib/server/snapshotEngine.ts` | Core engine: projection, delta computation, stats, statistical helpers |
| `api/analytics/index.ts` | Unified API endpoint (snapshots, deltas, trends, anomalies, cron) |
| `components/Screens/DeltaDashboard.tsx` | Admin dashboard UI with charts |
| `supabase/migrations/20260303_snapshot_delta_tables.sql` | Database schema |
| `shared/types.ts` | TypeScript types (DeltaType, SnapshotStats, etc.) |
| `vercel.json` | Cron schedule configuration |
