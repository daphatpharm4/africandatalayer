-- Tenant-scoped field records captured against an immutable published schema.
CREATE TABLE IF NOT EXISTS public.platform_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.platform_organizations(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.platform_projects(id) ON DELETE CASCADE,
  schema_version_id uuid NOT NULL REFERENCES public.platform_project_schema_versions(id),
  record_type_key text NOT NULL CHECK (char_length(record_type_key) BETWEEN 2 AND 40),
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  evidence jsonb NOT NULL DEFAULT '{"photos":[]}'::jsonb,
  status text NOT NULL DEFAULT 'pending_review' CHECK (status IN ('pending_review', 'approved', 'rejected')),
  captured_by text NOT NULL REFERENCES public.user_profiles(id),
  idempotency_key text NOT NULL CHECK (char_length(idempotency_key) BETWEEN 8 AND 160),
  request_hash text NOT NULL CHECK (char_length(request_hash) = 64),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, captured_by, idempotency_key)
);

CREATE INDEX IF NOT EXISTS platform_records_review_queue
  ON public.platform_records(organization_id, project_id, status, created_at DESC);
