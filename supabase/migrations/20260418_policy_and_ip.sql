-- Legal & compliance: versioned policy acceptance tracking + IP infringement intake.
-- Also extends security_audit_log event_type CHECK to allow new event types.

-- 1) Policy versioning.
CREATE TABLE IF NOT EXISTS public.policy_versions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_kind  TEXT NOT NULL CHECK (policy_kind IN ('privacy', 'terms')),
  version      TEXT NOT NULL,
  effective_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (policy_kind, version)
);

CREATE TABLE IF NOT EXISTS public.policy_acceptance (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     TEXT NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  policy_kind TEXT NOT NULL CHECK (policy_kind IN ('privacy', 'terms')),
  version     TEXT NOT NULL,
  accepted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_hash     TEXT,
  user_agent  TEXT,
  UNIQUE (user_id, policy_kind, version)
);

CREATE INDEX IF NOT EXISTS idx_policy_acceptance_user
  ON public.policy_acceptance(user_id);

CREATE INDEX IF NOT EXISTS idx_policy_acceptance_kind_version
  ON public.policy_acceptance(policy_kind, version);

-- 2) IP infringement reports.
CREATE TABLE IF NOT EXISTS public.ip_reports (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_name    TEXT NOT NULL,
  reporter_email   TEXT NOT NULL,
  reporter_user    TEXT REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  target_kind      TEXT NOT NULL CHECK (target_kind IN ('submission', 'point', 'other')),
  target_ref       TEXT,
  description      TEXT NOT NULL,
  sworn            BOOLEAN NOT NULL,
  status           TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'reviewing', 'resolved', 'rejected')),
  resolution_notes TEXT,
  ip_hash          TEXT,
  user_agent       TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ip_reports_status_created
  ON public.ip_reports(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ip_reports_reporter_user
  ON public.ip_reports(reporter_user);

-- 3) Seed initial policy versions (idempotent).
INSERT INTO public.policy_versions (policy_kind, version)
VALUES ('privacy', '1.0.0'), ('terms', '1.0.0')
ON CONFLICT (policy_kind, version) DO NOTHING;

-- 4) Extend security_audit_log event_type CHECK to cover new event types.
ALTER TABLE public.security_audit_log
  DROP CONSTRAINT IF EXISTS security_audit_log_event_type_check;

ALTER TABLE public.security_audit_log
  ADD CONSTRAINT security_audit_log_event_type_check CHECK (event_type IN (
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
    'suspicious_activity',
    'policy_accepted',
    'ip_report_filed',
    'ip_report_updated'
  ));
