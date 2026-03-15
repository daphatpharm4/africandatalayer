-- Automation-assisted lead intake queue for low-trust external sources.

CREATE TABLE IF NOT EXISTS public.automation_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_key text NOT NULL UNIQUE,
  workflow_name text NOT NULL,
  source_system text NOT NULL,
  trigger_type text NOT NULL DEFAULT 'api'
    CHECK (trigger_type IN ('schedule', 'webhook', 'file', 'manual', 'api')),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'completed', 'partial', 'failed')),
  requested_count integer NOT NULL DEFAULT 0,
  accepted_count integer NOT NULL DEFAULT 0,
  rejected_count integer NOT NULL DEFAULT 0,
  error_count integer NOT NULL DEFAULT 0,
  failure_summary jsonb NOT NULL DEFAULT '[]'::jsonb,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_automation_runs_source_created
  ON public.automation_runs (source_system, created_at DESC);

CREATE TABLE IF NOT EXISTS public.automation_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid REFERENCES public.automation_runs(id) ON DELETE SET NULL,
  source_system text NOT NULL,
  source_record_id text NOT NULL,
  source_url text,
  category text NOT NULL
    CHECK (category IN (
      'pharmacy',
      'fuel_station',
      'mobile_money',
      'alcohol_outlet',
      'billboard',
      'transport_road',
      'census_proxy'
    )),
  zone_id text,
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  normalized_details jsonb NOT NULL DEFAULT '{}'::jsonb,
  raw_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  evidence_urls text[] NOT NULL DEFAULT '{}'::text[],
  freshness_at timestamptz,
  match_point_id text,
  match_confidence real,
  status text NOT NULL DEFAULT 'needs_field_verify'
    CHECK (status IN (
      'rejected_out_of_zone',
      'rejected_manual',
      'matched_existing',
      'needs_field_verify',
      'ready_for_assignment',
      'assignment_created',
      'verified',
      'import_candidate'
    )),
  priority text NOT NULL DEFAULT 'medium'
    CHECK (priority IN ('high', 'medium', 'low')),
  assignment_id uuid REFERENCES public.collection_assignments(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_ingested_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_system, source_record_id)
);

CREATE INDEX IF NOT EXISTS idx_automation_leads_status_created
  ON public.automation_leads (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_automation_leads_category_status
  ON public.automation_leads (category, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_automation_leads_zone_status
  ON public.automation_leads (zone_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_automation_leads_run_id
  ON public.automation_leads (run_id);

CREATE INDEX IF NOT EXISTS idx_automation_leads_match_point
  ON public.automation_leads (match_point_id);
