alter table public.user_profiles
  drop constraint if exists user_profiles_role_check;

alter table public.user_profiles
  add constraint user_profiles_role_check
  check (role in ('agent', 'admin', 'client', 'point_operator'));

alter table public.user_profiles
  add column if not exists must_change_password boolean not null default false;

create table if not exists public.point_operator_assignments (
  id uuid primary key default gen_random_uuid(),
  operator_user_id text not null references public.user_profiles(id),
  point_id text not null,
  status text not null default 'active' check (status in ('active', 'revoked')),
  granted_by text not null references public.user_profiles(id),
  granted_at timestamptz not null default now(),
  revoked_by text references public.user_profiles(id),
  revoked_at timestamptz,
  revoke_reason text,
  check (
    (
      status = 'active'
      and revoked_by is null
      and revoked_at is null
      and revoke_reason is null
    )
    or
    (
      status = 'revoked'
      and revoked_by is not null
      and revoked_at is not null
    )
  )
);

create unique index if not exists point_operator_one_active_per_user
  on public.point_operator_assignments(operator_user_id)
  where status = 'active';

create unique index if not exists point_operator_one_active_per_point
  on public.point_operator_assignments(point_id)
  where status = 'active';

create index if not exists point_operator_assignments_point_history
  on public.point_operator_assignments(point_id, granted_at desc);

alter table public.security_audit_log
  drop constraint if exists security_audit_log_event_type_check;

alter table public.security_audit_log
  add constraint security_audit_log_event_type_check check (event_type in (
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
