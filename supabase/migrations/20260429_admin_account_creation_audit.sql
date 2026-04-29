-- Allows admin-created account events in the security audit log.

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
    'ip_report_updated'
  ));
