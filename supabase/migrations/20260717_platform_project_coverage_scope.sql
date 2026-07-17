-- Tenant projects choose their own operating geography. Existing projects
-- default to worldwide so no company inherits the public Bonamoussadi pilot.
ALTER TABLE public.platform_projects
  ADD COLUMN IF NOT EXISTS coverage_scope text NOT NULL DEFAULT 'worldwide',
  ADD COLUMN IF NOT EXISTS coverage_label text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'platform_projects_coverage_scope_check'
  ) THEN
    ALTER TABLE public.platform_projects
      ADD CONSTRAINT platform_projects_coverage_scope_check
      CHECK (coverage_scope IN ('town', 'country', 'worldwide'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'platform_projects_coverage_label_check'
  ) THEN
    ALTER TABLE public.platform_projects
      ADD CONSTRAINT platform_projects_coverage_label_check
      CHECK (
        (coverage_scope = 'worldwide' AND coverage_label IS NULL)
        OR
        (coverage_scope IN ('town', 'country') AND char_length(btrim(coverage_label)) BETWEEN 2 AND 120)
      );
  END IF;
END $$;
