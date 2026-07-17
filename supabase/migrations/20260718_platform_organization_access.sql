-- ADL-admin company access controls.
-- Suspension is reversible and never deletes tenant data.

ALTER TABLE public.platform_organizations
  ADD COLUMN IF NOT EXISTS access_status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS suspension_reason text,
  ADD COLUMN IF NOT EXISTS suspended_at timestamptz,
  ADD COLUMN IF NOT EXISTS suspended_by text REFERENCES public.user_profiles(id);

ALTER TABLE public.platform_organizations
  DROP CONSTRAINT IF EXISTS platform_organizations_access_status_check;

ALTER TABLE public.platform_organizations
  ADD CONSTRAINT platform_organizations_access_status_check
  CHECK (access_status IN ('active', 'suspended'));

ALTER TABLE public.platform_organizations
  DROP CONSTRAINT IF EXISTS platform_organizations_suspension_state_check;

ALTER TABLE public.platform_organizations
  ADD CONSTRAINT platform_organizations_suspension_state_check
  CHECK (
    (
      access_status = 'active'
      AND suspension_reason IS NULL
      AND suspended_at IS NULL
      AND suspended_by IS NULL
    )
    OR
    (
      access_status = 'suspended'
      AND char_length(suspension_reason) BETWEEN 3 AND 500
      AND suspended_at IS NOT NULL
      AND suspended_by IS NOT NULL
    )
  );

CREATE INDEX IF NOT EXISTS platform_organizations_by_access_status
  ON public.platform_organizations(access_status, created_at DESC);
