-- Research gap closure: Doc 05 (Cybersecurity) + Doc 06 (Anti-Fraud)

-- 6I: Add 'elite' to trust_tier CHECK constraint
ALTER TABLE public.user_profiles
  DROP CONSTRAINT IF EXISTS user_profiles_trust_tier_check;

ALTER TABLE public.user_profiles
  ADD CONSTRAINT user_profiles_trust_tier_check
  CHECK (trust_tier IN ('new', 'standard', 'trusted', 'elite', 'restricted'));

-- 6D: Add index on perceptual_hash for duplicate detection
CREATE INDEX IF NOT EXISTS idx_submission_image_hashes_perceptual
  ON public.submission_image_hashes(perceptual_hash)
  WHERE perceptual_hash IS NOT NULL;

-- 6E: Add xp_escrow tracking (using JSONB details field is preferred,
-- but adding a boolean column for efficient querying)
ALTER TABLE public.point_events
  ADD COLUMN IF NOT EXISTS xp_escrow BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_point_events_xp_escrow
  ON public.point_events(xp_escrow)
  WHERE xp_escrow = TRUE;
