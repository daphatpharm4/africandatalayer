-- Allow 'scheduled' status on email + SMS campaigns
-- Existing CHECK constraints didn't include 'scheduled'. Drop + re-add.

ALTER TABLE public.email_campaigns
  DROP CONSTRAINT IF EXISTS email_campaigns_status_check;

ALTER TABLE public.email_campaigns
  ADD CONSTRAINT email_campaigns_status_check
  CHECK (status IN ('draft', 'scheduled', 'sending', 'completed', 'failed', 'cancelled'));

ALTER TABLE public.sms_campaigns
  DROP CONSTRAINT IF EXISTS sms_campaigns_status_check;

ALTER TABLE public.sms_campaigns
  ADD CONSTRAINT sms_campaigns_status_check
  CHECK (status IN ('draft', 'scheduled', 'sending', 'completed', 'failed', 'cancelled'));

-- Speed up the drainer's lookup for due-scheduled campaigns.
CREATE INDEX IF NOT EXISTS idx_email_campaigns_scheduled_due
  ON public.email_campaigns (scheduled_at)
  WHERE status = 'scheduled';

CREATE INDEX IF NOT EXISTS idx_sms_campaigns_scheduled_due
  ON public.sms_campaigns (scheduled_at)
  WHERE status = 'scheduled';
