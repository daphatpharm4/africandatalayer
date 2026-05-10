-- SMS opt-in / opt-out audit trail (africandatalayer-q6g follow-up)
-- Append-only log so every consent state change is recoverable for ARTP /
-- regulator inquiries. user_profiles.sms_opt_in remains the source of truth
-- for "is this user opted in right now"; this table is the why/when/how.

CREATE TABLE IF NOT EXISTS public.sms_consent_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  consented BOOLEAN NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('signup', 'settings', 'inbound_stop', 'admin', 'import')),
  copy_version TEXT NOT NULL,
  ip_hash TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sms_consent_log_user_created_at
  ON public.sms_consent_log (user_id, created_at DESC);
