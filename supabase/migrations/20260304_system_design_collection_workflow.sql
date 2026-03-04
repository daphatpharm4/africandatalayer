-- Align schema with 2026 system design collection workflow.

-- 1) Categories: replace retail_kiosk with transport_road + census_proxy.
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

-- 2) Collection assignments table for route/zone planning.
CREATE TABLE IF NOT EXISTS collection_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_user_id text NOT NULL REFERENCES user_profiles(id),
  zone_id text NOT NULL,
  zone_label text NOT NULL,
  zone_bounds jsonb NOT NULL,
  assigned_verticals text[] NOT NULL,
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

-- 3) Snapshot enhancements.
ALTER TABLE snapshot_stats
  ADD COLUMN IF NOT EXISTS is_baseline boolean NOT NULL DEFAULT false;

ALTER TABLE snapshot_deltas
  ADD COLUMN IF NOT EXISTS significance text NOT NULL DEFAULT 'medium'
    CHECK (significance IN ('high', 'medium', 'low'));
ALTER TABLE snapshot_deltas
  ADD COLUMN IF NOT EXISTS is_publishable boolean NOT NULL DEFAULT false;
ALTER TABLE snapshot_deltas
  ADD COLUMN IF NOT EXISTS is_from_partial_snapshot boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_deltas_publishable_date
  ON snapshot_deltas (is_publishable, snapshot_date DESC);

-- 4) Monthly rollup table.
CREATE TABLE IF NOT EXISTS monthly_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  month date NOT NULL,
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

CREATE INDEX IF NOT EXISTS idx_monthly_stats_month_vertical
  ON monthly_stats (month DESC, vertical_id);
