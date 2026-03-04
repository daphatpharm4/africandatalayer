-- Fraud + analytics foundation aligned to team strategy docs.

-- 1) Additional columns / indexes on operational events.
ALTER TABLE point_events
  ADD COLUMN IF NOT EXISTS content_hash text;

CREATE INDEX IF NOT EXISTS idx_point_events_content_hash
  ON point_events (content_hash)
  WHERE content_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_point_events_category
  ON point_events (category);

CREATE INDEX IF NOT EXISTS idx_point_events_event_type
  ON point_events (event_type);

CREATE INDEX IF NOT EXISTS idx_point_events_user_category
  ON point_events (user_id, category);

CREATE INDEX IF NOT EXISTS idx_point_events_point_event_type
  ON point_events (point_id, event_type);

CREATE INDEX IF NOT EXISTS idx_point_events_details_gin
  ON point_events USING gin (details);

-- 2) Fraud detection support tables.
CREATE TABLE IF NOT EXISTS submission_image_hashes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES point_events(id) ON DELETE CASCADE,
  point_id text NOT NULL,
  user_id text NOT NULL,
  sha256_hash text NOT NULL,
  perceptual_hash text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_submission_image_hashes_event
  ON submission_image_hashes(event_id);

CREATE INDEX IF NOT EXISTS idx_submission_image_hashes_sha256
  ON submission_image_hashes(sha256_hash);

CREATE INDEX IF NOT EXISTS idx_submission_image_hashes_user
  ON submission_image_hashes(user_id);

CREATE TABLE IF NOT EXISTS device_user_map (
  device_id text NOT NULL,
  user_id text NOT NULL,
  first_seen timestamptz NOT NULL DEFAULT now(),
  last_seen timestamptz NOT NULL DEFAULT now(),
  submission_count integer NOT NULL DEFAULT 1,
  PRIMARY KEY (device_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_device_user_map_device
  ON device_user_map(device_id);

CREATE TABLE IF NOT EXISTS fraud_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid REFERENCES point_events(id) ON DELETE SET NULL,
  user_id text NOT NULL,
  action text NOT NULL,
  risk_score integer,
  risk_components jsonb,
  rule_triggered text,
  admin_user_id text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fraud_audit_log_user
  ON fraud_audit_log(user_id);

CREATE INDEX IF NOT EXISTS idx_fraud_audit_log_event
  ON fraud_audit_log(event_id);

CREATE INDEX IF NOT EXISTS idx_fraud_audit_log_action_created
  ON fraud_audit_log(action, created_at DESC);

-- 3) Admin review table for moderation workflows + analytics backlog KPI.
CREATE TABLE IF NOT EXISTS admin_reviews (
  event_id uuid PRIMARY KEY REFERENCES point_events(id) ON DELETE CASCADE,
  reviewer_id text NOT NULL REFERENCES user_profiles(id),
  decision text NOT NULL CHECK (decision IN ('approved', 'rejected', 'flagged')),
  reviewed_at timestamptz NOT NULL DEFAULT now(),
  notes text
);

CREATE INDEX IF NOT EXISTS idx_admin_reviews_reviewer
  ON admin_reviews(reviewer_id);

CREATE INDEX IF NOT EXISTS idx_admin_reviews_reviewed_at
  ON admin_reviews(reviewed_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_reviews_decision
  ON admin_reviews(decision);

-- 4) Weekly analytics rollup table.
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
  median_freshness_days numeric(7,2),
  PRIMARY KEY (week_start, category)
);

CREATE INDEX IF NOT EXISTS idx_analytics_weekly_week
  ON analytics_weekly(week_start DESC);

CREATE INDEX IF NOT EXISTS idx_analytics_weekly_category_week
  ON analytics_weekly(category, week_start DESC);

-- 5) API key table for future /api/data/* consumers.
CREATE TABLE IF NOT EXISTS api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key_hash text NOT NULL UNIQUE,
  client_name text NOT NULL,
  permissions text[] NOT NULL DEFAULT ARRAY['data:read']::text[],
  rate_limit_per_minute integer NOT NULL DEFAULT 100,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_api_keys_active
  ON api_keys(is_active);

-- 6) Analytics materialized views.
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_point_summary AS
WITH latest AS (
  SELECT DISTINCT ON (pe.point_id)
    pe.point_id,
    pe.category,
    pe.latitude,
    pe.longitude,
    pe.details,
    pe.photo_url,
    pe.created_at,
    pe.source,
    pe.external_id
  FROM point_events pe
  ORDER BY pe.point_id, pe.created_at DESC, pe.id DESC
),
stats AS (
  SELECT
    pe.point_id,
    MIN(pe.created_at) AS first_event_at,
    MAX(pe.created_at) AS last_event_at,
    COUNT(*) AS event_count,
    COUNT(DISTINCT pe.user_id) AS contributor_count,
    BOOL_OR(pe.event_type = 'ENRICH_EVENT') AS has_enrichment
  FROM point_events pe
  GROUP BY pe.point_id
)
SELECT
  latest.point_id,
  latest.category,
  latest.latitude,
  latest.longitude,
  latest.details,
  latest.photo_url,
  stats.first_event_at,
  stats.last_event_at,
  stats.event_count,
  stats.contributor_count,
  stats.has_enrichment,
  latest.source,
  latest.external_id
FROM latest
JOIN stats USING (point_id)
WITH DATA;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_point_summary_point_id
  ON mv_point_summary(point_id);

CREATE INDEX IF NOT EXISTS idx_mv_point_summary_category
  ON mv_point_summary(category);

CREATE INDEX IF NOT EXISTS idx_mv_point_summary_last_event_at
  ON mv_point_summary(last_event_at DESC);

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_user_activity AS
SELECT
  pe.user_id,
  COUNT(*) AS total_events,
  COUNT(*) FILTER (WHERE pe.event_type = 'CREATE_EVENT') AS creates,
  COUNT(*) FILTER (WHERE pe.event_type = 'ENRICH_EVENT') AS enrichments,
  COUNT(DISTINCT pe.point_id) AS unique_points,
  COUNT(DISTINCT pe.category) AS categories_touched,
  COUNT(DISTINCT DATE_TRUNC('day', pe.created_at)) AS active_days,
  MIN(pe.created_at) AS first_event_at,
  MAX(pe.created_at) AS last_event_at,
  COUNT(*) FILTER (WHERE pe.created_at >= NOW() - INTERVAL '7 days') AS events_7d,
  COUNT(*) FILTER (WHERE pe.created_at >= NOW() - INTERVAL '30 days') AS events_30d
FROM point_events pe
GROUP BY pe.user_id
WITH DATA;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_user_activity_user
  ON mv_user_activity(user_id);

CREATE INDEX IF NOT EXISTS idx_mv_user_activity_total_events
  ON mv_user_activity(total_events DESC);

CREATE INDEX IF NOT EXISTS idx_mv_user_activity_last_event_at
  ON mv_user_activity(last_event_at DESC);

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_daily_stats AS
SELECT
  DATE_TRUNC('day', pe.created_at)::date AS day,
  pe.category,
  pe.event_type,
  COUNT(*) AS event_count,
  COUNT(DISTINCT pe.user_id) AS unique_users,
  COUNT(DISTINCT pe.point_id) AS unique_points,
  COUNT(*) FILTER (WHERE pe.photo_url IS NOT NULL) AS with_photo,
  COUNT(*) FILTER (
    pe.details #>> '{fraudCheck,primaryPhoto,submissionGpsMatch}' = 'false'
  ) AS fraud_flags
FROM point_events pe
GROUP BY DATE_TRUNC('day', pe.created_at)::date, pe.category, pe.event_type
WITH DATA;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_daily_stats_day_category_event_type
  ON mv_daily_stats(day, category, event_type);

CREATE INDEX IF NOT EXISTS idx_mv_daily_stats_day
  ON mv_daily_stats(day DESC);
