-- Add role column to user_profiles.
-- Values: 'agent' (default for field agents), 'admin', 'client'
-- Keeps is_admin for backwards compatibility; role is the new source of truth.
alter table public.user_profiles
  add column if not exists role text not null default 'agent'
  check (role in ('agent', 'admin', 'client'));

-- Sync existing admins: if is_admin is true, set role to 'admin'
update public.user_profiles set role = 'admin' where is_admin = true;

