-- Password reset tokens (africandatalayer-2ef)
-- DIY reset flow. Token is hashed at rest; verification compares hashes.

CREATE TABLE IF NOT EXISTS public.password_reset_tokens (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  ip_hash TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_unused
  ON public.password_reset_tokens (user_id, created_at DESC)
  WHERE used_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_expires_at
  ON public.password_reset_tokens (expires_at);
