ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS trust_score INT NOT NULL DEFAULT 50 CHECK (trust_score BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS trust_tier TEXT NOT NULL DEFAULT 'standard' CHECK (trust_tier IN ('new', 'standard', 'trusted', 'restricted')),
  ADD COLUMN IF NOT EXISTS suspended_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS wipe_requested BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS failed_login_count INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ;

UPDATE public.user_profiles
SET trust_tier = CASE
  WHEN trust_score >= 80 THEN 'trusted'
  WHEN trust_score <= 20 THEN 'restricted'
  WHEN trust_score <= 49 THEN 'new'
  ELSE 'standard'
END
WHERE trust_tier IS DISTINCT FROM CASE
  WHEN trust_score >= 80 THEN 'trusted'
  WHEN trust_score <= 20 THEN 'restricted'
  WHEN trust_score <= 49 THEN 'new'
  ELSE 'standard'
END;

ALTER TABLE public.point_events
  ADD COLUMN IF NOT EXISTS consent_status TEXT CHECK (consent_status IN ('obtained', 'refused_pii_only', 'not_required', 'withdrawn')),
  ADD COLUMN IF NOT EXISTS consent_recorded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS erased_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS erased_by TEXT,
  ADD COLUMN IF NOT EXISTS erasure_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_point_events_consent_status
  ON public.point_events(consent_status);

CREATE INDEX IF NOT EXISTS idx_point_events_erased_at
  ON public.point_events(erased_at);

CREATE TABLE IF NOT EXISTS public.security_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL CHECK (event_type IN (
    'login_success',
    'login_failure',
    'logout',
    'session_expired',
    'session_revoked',
    'account_locked',
    'account_unlocked',
    'role_changed',
    'remote_wipe_triggered',
    'remote_wipe_executed',
    'data_export',
    'privacy_request',
    'privacy_erasure',
    'submission_flagged',
    'submission_rejected',
    'admin_review',
    'api_rate_limited',
    'idempotency_conflict',
    'suspicious_activity'
  )),
  user_id TEXT,
  ip_address TEXT,
  user_agent TEXT,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_security_audit_log_user_created
  ON public.security_audit_log(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_security_audit_log_event_created
  ON public.security_audit_log(event_type, created_at DESC);

CREATE TABLE IF NOT EXISTS public.api_rate_limits (
  route TEXT NOT NULL,
  key_hash TEXT NOT NULL,
  window_start TIMESTAMPTZ NOT NULL,
  request_count INT NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (route, key_hash, window_start)
);

CREATE INDEX IF NOT EXISTS idx_api_rate_limits_updated
  ON public.api_rate_limits(updated_at DESC);

CREATE TABLE IF NOT EXISTS public.submission_idempotency_keys (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  response_event_id UUID,
  response_status INT NOT NULL DEFAULT 201,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_submission_idempotency_last_seen
  ON public.submission_idempotency_keys(last_seen_at DESC);

CREATE TABLE IF NOT EXISTS public.privacy_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_type TEXT NOT NULL CHECK (request_type IN ('access', 'rectification', 'erasure')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'completed', 'rejected')),
  subject_reference TEXT NOT NULL,
  created_by TEXT NOT NULL,
  assigned_to TEXT,
  notes TEXT,
  resolution_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_privacy_requests_status_updated
  ON public.privacy_requests(status, updated_at DESC);

CREATE TABLE IF NOT EXISTS public.fraud_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID,
  user_id TEXT,
  alert_code TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fraud_alerts_created
  ON public.fraud_alerts(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_fraud_alerts_user
  ON public.fraud_alerts(user_id, created_at DESC);
