-- Stage B embedding-drain hardening.
--
-- The schema for this hardening was originally edited into
-- 20260518_image_similarity_v2.sql, but scripts/migrate.mjs tracks applied
-- migrations by filename only. Any environment that already applied 20260518
-- (production did, during the 2026-07-05 backfill) will never re-run it, so
-- those edits never reach prod. This standalone migration delivers the deltas
-- idempotently. It is safe to run whether or not the 20260518 edits were
-- applied (every statement is guarded).

BEGIN;

-- Embedding queue retry/observability columns + the 'processing' claim state.
ALTER TABLE public.submission_image_hashes
  ADD COLUMN IF NOT EXISTS embedding_attempts smallint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS embedding_last_error text,
  ADD COLUMN IF NOT EXISTS embedding_updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.submission_image_hashes
  DROP CONSTRAINT IF EXISTS submission_image_hashes_embedding_status_check;

ALTER TABLE public.submission_image_hashes
  ADD CONSTRAINT submission_image_hashes_embedding_status_check
  CHECK (embedding_status IN ('pending', 'processing', 'done', 'failed', 'skipped'));

CREATE INDEX IF NOT EXISTS idx_submission_image_hashes_embedding_status
  ON public.submission_image_hashes(embedding_status)
  WHERE embedding_status = 'pending';

-- Semantic-duplicate evidence table (logged pre-activation, gates review upgrades).
CREATE TABLE IF NOT EXISTS public.submission_image_similarity_matches (
  id               bigserial PRIMARY KEY,
  event_id         uuid NOT NULL REFERENCES public.point_events(id) ON DELETE CASCADE,
  matched_event_id uuid NOT NULL REFERENCES public.point_events(id) ON DELETE CASCADE,
  similarity       double precision NOT NULL,
  model_version    text NOT NULL,
  rule_triggered   text NOT NULL,
  decision         text NOT NULL CHECK (decision IN ('logged', 'pending_review')),
  created_at       timestamptz NOT NULL DEFAULT now(),
  last_seen_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, matched_event_id, model_version, rule_triggered)
);

-- last_seen_at preserves the original detection timestamp (created_at) as forensic
-- evidence while still tracking the most recent re-observation on conflict.
ALTER TABLE public.submission_image_similarity_matches
  ADD COLUMN IF NOT EXISTS last_seen_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_sism_event_id
  ON public.submission_image_similarity_matches(event_id);

COMMIT;
