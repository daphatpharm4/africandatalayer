ALTER TABLE public.user_profiles
  DROP CONSTRAINT IF EXISTS user_profiles_role_check;

ALTER TABLE public.user_profiles
  ADD CONSTRAINT user_profiles_role_check
  CHECK (role IN ('agent', 'admin', 'client', 'point_operator'));

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT false;

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS session_version integer NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.point_operator_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operator_user_id text NOT NULL REFERENCES public.user_profiles(id),
  point_id text NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
  granted_by text NOT NULL REFERENCES public.user_profiles(id),
  granted_at timestamptz NOT NULL DEFAULT now(),
  revoked_by text REFERENCES public.user_profiles(id),
  revoked_at timestamptz,
  revoke_reason text,
  CHECK (
    (status = 'active' AND revoked_by IS NULL AND revoked_at IS NULL)
    OR
    (status = 'revoked' AND revoked_by IS NOT NULL AND revoked_at IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS point_operator_one_active_per_user
  ON public.point_operator_assignments(operator_user_id)
  WHERE status = 'active';

CREATE UNIQUE INDEX IF NOT EXISTS point_operator_one_active_per_point
  ON public.point_operator_assignments(point_id)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS point_operator_assignments_point_history
  ON public.point_operator_assignments(point_id, granted_at DESC);

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
    'admin_account_created',
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
    'ip_report_updated',
    'point_operator_account_created',
    'point_operator_assignment_granted',
    'point_operator_assignment_revoked',
    'point_operator_assignment_replaced',
    'point_operator_password_changed'
  ));
