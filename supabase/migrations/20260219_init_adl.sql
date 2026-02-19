create table if not exists public.user_profiles (
  id text primary key,
  email text not null unique,
  name text not null,
  image text not null default '',
  occupation text not null default '',
  xp integer not null default 0 check (xp >= 0),
  password_hash text,
  is_admin boolean not null default false,
  map_scope text not null default 'bonamoussadi' check (map_scope in ('bonamoussadi', 'cameroon', 'global')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.point_events (
  id uuid primary key,
  point_id text not null,
  event_type text not null check (event_type in ('CREATE_EVENT', 'ENRICH_EVENT')),
  user_id text not null,
  category text not null check (category in ('pharmacy', 'fuel_station', 'mobile_money')),
  latitude double precision not null,
  longitude double precision not null,
  details jsonb not null default '{}'::jsonb,
  photo_url text,
  created_at timestamptz not null,
  source text,
  external_id text
);

create index if not exists idx_point_events_created_at_desc on public.point_events (created_at desc);
create index if not exists idx_point_events_point_id_created_at_desc on public.point_events (point_id, created_at desc);
create index if not exists idx_point_events_user_id_created_at_desc on public.point_events (user_id, created_at desc);
create index if not exists idx_point_events_external_id on public.point_events (external_id);
