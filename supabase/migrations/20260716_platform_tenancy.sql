-- supabase/migrations/20260716_platform_tenancy.sql
-- Data Operations Platform: multi-tenant foundation.
-- Every tenant-owned row carries organization_id. Strict logical isolation.

CREATE TABLE IF NOT EXISTS public.platform_organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (char_length(name) BETWEEN 2 AND 80),
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$'),
  logo_url text,
  accent_color text CHECK (accent_color IS NULL OR accent_color ~ '^#[0-9a-fA-F]{6}$'),
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by text NOT NULL REFERENCES public.user_profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.platform_organization_members (
  organization_id uuid NOT NULL REFERENCES public.platform_organizations(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES public.user_profiles(id),
  role text NOT NULL CHECK (role IN ('owner', 'manager', 'reviewer', 'collector', 'viewer')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, user_id)
);

CREATE INDEX IF NOT EXISTS platform_org_members_by_user
  ON public.platform_organization_members(user_id);

CREATE TABLE IF NOT EXISTS public.platform_organization_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.platform_organizations(id) ON DELETE CASCADE,
  email text NOT NULL,
  role text NOT NULL CHECK (role IN ('manager', 'reviewer', 'collector', 'viewer')),
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  accepted_at timestamptz,
  accepted_by text REFERENCES public.user_profiles(id),
  created_by text NOT NULL REFERENCES public.user_profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS platform_invites_by_org
  ON public.platform_organization_invites(organization_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.platform_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.platform_organizations(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(name) BETWEEN 2 AND 120),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'archived')),
  created_by text NOT NULL REFERENCES public.user_profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS platform_projects_by_org
  ON public.platform_projects(organization_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.platform_project_members (
  project_id uuid NOT NULL REFERENCES public.platform_projects(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.platform_organizations(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES public.user_profiles(id),
  role text NOT NULL CHECK (role IN ('manager', 'reviewer', 'collector', 'viewer')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.platform_project_schema_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.platform_projects(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.platform_organizations(id) ON DELETE CASCADE,
  version integer NOT NULL CHECK (version >= 1),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  definition jsonb NOT NULL DEFAULT '{"recordTypes":[]}'::jsonb,
  published_at timestamptz,
  created_by text NOT NULL REFERENCES public.user_profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, version),
  CHECK (
    (status = 'draft' AND published_at IS NULL)
    OR
    (status = 'published' AND published_at IS NOT NULL)
  )
);

-- Only one editable draft per project at any time.
CREATE UNIQUE INDEX IF NOT EXISTS platform_schema_one_draft_per_project
  ON public.platform_project_schema_versions(project_id)
  WHERE status = 'draft';

CREATE TABLE IF NOT EXISTS public.platform_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.platform_organizations(id) ON DELETE CASCADE,
  project_id uuid REFERENCES public.platform_projects(id) ON DELETE SET NULL,
  actor_user_id text NOT NULL,
  event_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS platform_audit_by_org
  ON public.platform_audit_events(organization_id, created_at DESC);
