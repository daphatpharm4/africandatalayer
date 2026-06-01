-- supabase/migrations/20260601_api_idempotency_keys.sql
CREATE TABLE IF NOT EXISTS api_idempotency_keys (
  scope            TEXT        NOT NULL,
  user_id          TEXT        NOT NULL,
  idempotency_key  TEXT        NOT NULL,
  request_hash     TEXT        NOT NULL,
  response_json    JSONB,
  response_status  INTEGER     NOT NULL DEFAULT 200,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (scope, user_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_api_idempotency_created_at
  ON api_idempotency_keys (created_at);
