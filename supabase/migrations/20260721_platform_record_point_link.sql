-- Link tenant records to public projected points (private org overlay).
-- point_id has no FK: projection identity lives in events, not a table.
ALTER TABLE public.platform_records
  ADD COLUMN IF NOT EXISTS point_id text NULL;
ALTER TABLE public.platform_records
  ADD COLUMN IF NOT EXISTS capture_lat double precision NULL;
ALTER TABLE public.platform_records
  ADD COLUMN IF NOT EXISTS capture_lng double precision NULL;

CREATE INDEX IF NOT EXISTS platform_records_point_overlay
  ON public.platform_records (organization_id, point_id, status);
