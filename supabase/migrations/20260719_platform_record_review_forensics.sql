-- Preserve who reviewed each company record and the reasoning behind the decision.
ALTER TABLE public.platform_records
  ADD COLUMN IF NOT EXISTS reviewed_by text REFERENCES public.user_profiles(id) ON UPDATE CASCADE,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS review_notes text;

CREATE INDEX IF NOT EXISTS platform_records_reviewer_history
  ON public.platform_records(organization_id, reviewed_by, reviewed_at DESC)
  WHERE reviewed_by IS NOT NULL;
