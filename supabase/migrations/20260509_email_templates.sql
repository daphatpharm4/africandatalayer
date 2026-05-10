-- Email template library (africandatalayer follow-up: template + variables)
-- Stored bilingually so renderers can pick per-recipient language at dispatch.
-- Variable definitions are kept on the template so the dispatcher knows which
-- per-recipient fields to fetch.

CREATE TABLE IF NOT EXISTS public.email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  subject_en TEXT NOT NULL,
  subject_fr TEXT NOT NULL,
  html_en TEXT NOT NULL,
  html_fr TEXT NOT NULL,
  text_en TEXT NOT NULL,
  text_fr TEXT NOT NULL,
  variables JSONB NOT NULL DEFAULT '[]'::jsonb,
  archived BOOLEAN NOT NULL DEFAULT FALSE,
  created_by TEXT NOT NULL REFERENCES public.user_profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_templates_archived_slug
  ON public.email_templates (archived, slug);
