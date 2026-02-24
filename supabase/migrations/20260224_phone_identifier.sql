alter table if exists public.user_profiles
  alter column email drop not null;

alter table if exists public.user_profiles
  add column if not exists phone text;

create unique index if not exists idx_user_profiles_phone_unique
  on public.user_profiles (phone)
  where phone is not null;
