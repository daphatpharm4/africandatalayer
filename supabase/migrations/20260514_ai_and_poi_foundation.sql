CREATE TABLE IF NOT EXISTS public.ai_extractions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_draft_id text,
  event_id uuid,
  user_id text,
  category text,
  input_hash text NOT NULL,
  output_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  accepted_fields_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  rejected_fields_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  model_provider text NOT NULL,
  model_name text NOT NULL,
  model_version text,
  prompt_version text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_extractions_user_created_idx
  ON public.ai_extractions (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.ai_review_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid,
  point_id text NOT NULL,
  review_status_at_generation text,
  risk_score_at_generation numeric,
  summary_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  reviewer_action text,
  reviewer_feedback text,
  model_provider text NOT NULL,
  model_name text NOT NULL,
  model_version text,
  prompt_version text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_review_summaries_point_created_idx
  ON public.ai_review_summaries (point_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.ai_analytics_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  role text NOT NULL,
  client_scope text,
  question text NOT NULL,
  query_plan_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  answer_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  model_provider text NOT NULL,
  model_name text NOT NULL,
  model_version text,
  prompt_version text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_analytics_runs_user_created_idx
  ON public.ai_analytics_runs (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.external_poi_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL,
  source_license text NOT NULL,
  source_attribution text NOT NULL,
  external_id text NOT NULL,
  raw_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  normalized_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  category text NOT NULL,
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  name text,
  match_status text NOT NULL DEFAULT 'discovered',
  matched_point_id text,
  match_score numeric NOT NULL DEFAULT 0,
  confidence numeric NOT NULL DEFAULT 0,
  needs_field_verification boolean NOT NULL DEFAULT true,
  assigned_to text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT external_poi_candidates_status_check CHECK (
    match_status IN (
      'discovered',
      'normalized',
      'matched_to_existing',
      'needs_field_verification',
      'assigned_to_agent',
      'verified',
      'promoted_to_point_event',
      'rejected'
    )
  ),
  CONSTRAINT external_poi_candidates_confidence_check CHECK (confidence >= 0 AND confidence <= 1),
  CONSTRAINT external_poi_candidates_match_score_check CHECK (match_score >= 0 AND match_score <= 1),
  CONSTRAINT external_poi_candidates_source_external_unique UNIQUE (source, external_id)
);

CREATE INDEX IF NOT EXISTS external_poi_candidates_category_status_idx
  ON public.external_poi_candidates (category, match_status);

CREATE INDEX IF NOT EXISTS external_poi_candidates_assigned_to_idx
  ON public.external_poi_candidates (assigned_to)
  WHERE assigned_to IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.poi_source_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL,
  zone_id text NOT NULL,
  verticals_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  status text NOT NULL DEFAULT 'running',
  fetched_count integer NOT NULL DEFAULT 0,
  candidate_count integer NOT NULL DEFAULT 0,
  matched_count integer NOT NULL DEFAULT 0,
  error_message text,
  CONSTRAINT poi_source_runs_status_check CHECK (status IN ('running', 'completed', 'failed'))
);
