-- supabase/migrations/20260729_missions.sql
-- Data Operations Platform: missions & gamification.
-- Daily missions are auto-generated per organization (one per UTC calendar
-- day); weekly missions are manager-created and explicitly assigned to
-- collectors. See docs/superpowers/specs/2026-07-24-ios-console-missions-gamification-design.md

CREATE TABLE IF NOT EXISTS public.mission_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.platform_organizations(id) ON DELETE CASCADE,
  period text NOT NULL CHECK (period IN ('daily', 'weekly')),
  title_en text NOT NULL DEFAULT '',
  title_fr text NOT NULL DEFAULT '',
  quota integer NOT NULL CHECK (quota BETWEEN 1 AND 100),
  deadline timestamptz,
  reward_xp integer NOT NULL DEFAULT 10 CHECK (reward_xp BETWEEN 0 AND 500),
  project_id uuid REFERENCES public.platform_projects(id) ON DELETE SET NULL,
  category text,
  notes_en text,
  notes_fr text,
  created_by text REFERENCES public.user_profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (char_length(title_en) > 0 OR char_length(title_fr) > 0)
);

CREATE INDEX IF NOT EXISTS mission_definitions_by_org_period
  ON public.mission_definitions(organization_id, period, created_at DESC);

-- Enforces the daily auto-generation upsert contract: at most one daily
-- mission per organization per UTC calendar day. The cron's upsert uses this
-- index as its ON CONFLICT target so re-runs never create a duplicate.
CREATE UNIQUE INDEX IF NOT EXISTS mission_definitions_daily_once_per_org
  ON public.mission_definitions(organization_id, (timezone('utc', created_at)::date))
  WHERE period = 'daily';

CREATE TABLE IF NOT EXISTS public.mission_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id uuid NOT NULL REFERENCES public.mission_definitions(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES public.user_profiles(id),
  state text NOT NULL DEFAULT 'pending' CHECK (state IN ('pending', 'in_progress', 'completed', 'expired')),
  current integer NOT NULL DEFAULT 0 CHECK (current >= 0),
  completed_at timestamptz,
  xp_awarded boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (mission_id, user_id)
);

CREATE INDEX IF NOT EXISTS mission_assignments_by_mission
  ON public.mission_assignments(mission_id);

CREATE INDEX IF NOT EXISTS mission_assignments_by_user
  ON public.mission_assignments(user_id, state);
