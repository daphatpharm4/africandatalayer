-- Image similarity v2: stronger hashes (pHash + dHash) and semantic embeddings.
-- See docs/data-science/image-similarity-design.md (Stages A + B).

-- 1) Stage A: pHash + dHash columns and 16-bit segments for indexed lookup.
ALTER TABLE public.submission_image_hashes
  ADD COLUMN IF NOT EXISTS phash text,
  ADD COLUMN IF NOT EXISTS dhash text,
  ADD COLUMN IF NOT EXISTS hash_version smallint NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS phash_seg_0 smallint,
  ADD COLUMN IF NOT EXISTS phash_seg_1 smallint,
  ADD COLUMN IF NOT EXISTS phash_seg_2 smallint,
  ADD COLUMN IF NOT EXISTS phash_seg_3 smallint;

-- Pigeonhole-style segment indexes: any two 64-bit hashes within Hamming <= 8
-- share at least one identical 16-bit segment, so an OR-on-segments query
-- yields a small candidate set we refine in-process with full Hamming.
CREATE INDEX IF NOT EXISTS idx_submission_image_hashes_phash_seg_0
  ON public.submission_image_hashes(phash_seg_0)
  WHERE phash_seg_0 IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_submission_image_hashes_phash_seg_1
  ON public.submission_image_hashes(phash_seg_1)
  WHERE phash_seg_1 IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_submission_image_hashes_phash_seg_2
  ON public.submission_image_hashes(phash_seg_2)
  WHERE phash_seg_2 IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_submission_image_hashes_phash_seg_3
  ON public.submission_image_hashes(phash_seg_3)
  WHERE phash_seg_3 IS NOT NULL;

-- Drop the legacy partial index on perceptual_hash (btree useless for Hamming search).
-- The column itself is retained for backfill/compat.
DROP INDEX IF EXISTS public.idx_submission_image_hashes_perceptual;

-- Embedding queue state, drained by cron_dispatch.
ALTER TABLE public.submission_image_hashes
  ADD COLUMN IF NOT EXISTS embedding_status text NOT NULL DEFAULT 'pending';

ALTER TABLE public.submission_image_hashes
  DROP CONSTRAINT IF EXISTS submission_image_hashes_embedding_status_check;

ALTER TABLE public.submission_image_hashes
  ADD CONSTRAINT submission_image_hashes_embedding_status_check
  CHECK (embedding_status IN ('pending', 'done', 'failed', 'skipped'));

CREATE INDEX IF NOT EXISTS idx_submission_image_hashes_embedding_status
  ON public.submission_image_hashes(embedding_status)
  WHERE embedding_status = 'pending';

-- 2) Stage B: pgvector + semantic embedding store.
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS public.submission_image_embeddings (
  event_id      uuid PRIMARY KEY REFERENCES public.point_events(id) ON DELETE CASCADE,
  embedding     vector(1408) NOT NULL,
  model_version text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sie_embedding_hnsw
  ON public.submission_image_embeddings
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
