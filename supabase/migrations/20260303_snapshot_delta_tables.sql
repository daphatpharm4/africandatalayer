-- Snapshot & Delta Analytics Tables
-- Weekly snapshots of projected point state, deltas between snapshots, and pre-computed stats.

-- 1. snapshots: frozen projected state per point per snapshot date
CREATE TABLE IF NOT EXISTS snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_date date NOT NULL,
  vertical_id text NOT NULL,
  point_id text NOT NULL,
  category text NOT NULL,
  site_name text,
  latitude double precision,
  longitude double precision,
  details jsonb DEFAULT '{}',
  gaps text[] DEFAULT '{}',
  events_count integer DEFAULT 0,
  photo_url text,
  source text,
  external_id text,
  UNIQUE(snapshot_date, point_id)
);

CREATE INDEX IF NOT EXISTS idx_snapshots_date_vertical ON snapshots (snapshot_date DESC, vertical_id);
CREATE INDEX IF NOT EXISTS idx_snapshots_vertical_date ON snapshots (vertical_id, snapshot_date DESC);
CREATE INDEX IF NOT EXISTS idx_snapshots_point_date ON snapshots (point_id, snapshot_date DESC);

-- 2. snapshot_deltas: one row per point per delta type per changed field
CREATE TABLE IF NOT EXISTS snapshot_deltas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_date date NOT NULL,
  baseline_snapshot_date date NOT NULL,
  vertical_id text NOT NULL,
  point_id text NOT NULL,
  delta_type text NOT NULL CHECK (delta_type IN ('new', 'removed', 'changed', 'unchanged')),
  delta_field text,
  previous_value text,
  current_value text,
  delta_magnitude numeric,
  delta_direction text CHECK (delta_direction IN ('increase', 'decrease', 'stable', 'not_applicable')),
  delta_summary text
);

CREATE INDEX IF NOT EXISTS idx_deltas_date_vertical ON snapshot_deltas (snapshot_date DESC, vertical_id);
CREATE INDEX IF NOT EXISTS idx_deltas_date_type ON snapshot_deltas (snapshot_date DESC, delta_type);
CREATE INDEX IF NOT EXISTS idx_deltas_point_date ON snapshot_deltas (point_id, snapshot_date DESC);

-- 3. snapshot_stats: one row per vertical per snapshot date
CREATE TABLE IF NOT EXISTS snapshot_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_date date NOT NULL,
  vertical_id text NOT NULL,
  total_points integer DEFAULT 0,
  completed_points integer DEFAULT 0,
  completion_rate numeric DEFAULT 0,
  new_count integer DEFAULT 0,
  removed_count integer DEFAULT 0,
  changed_count integer DEFAULT 0,
  unchanged_count integer DEFAULT 0,
  avg_price numeric,
  week_over_week_growth numeric,
  moving_avg_4w numeric,
  z_score_total_points numeric,
  z_score_new_count numeric,
  z_score_removed_count numeric,
  anomaly_flags jsonb DEFAULT '[]',
  UNIQUE(snapshot_date, vertical_id)
);

CREATE INDEX IF NOT EXISTS idx_stats_date_vertical ON snapshot_stats (snapshot_date DESC, vertical_id);
CREATE INDEX IF NOT EXISTS idx_stats_vertical_date ON snapshot_stats (vertical_id, snapshot_date DESC);
