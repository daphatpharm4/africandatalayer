-- Communications platform foundation (africandatalayer-cnr)
-- Adds opt-in + unsubscribe tracking to user_profiles, plus tables for
-- communications log and email suppression list.

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS email_opt_in BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS sms_opt_in BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS unsubscribe_token TEXT;

UPDATE public.user_profiles
SET unsubscribe_token = encode(gen_random_bytes(24), 'hex')
WHERE unsubscribe_token IS NULL;

ALTER TABLE public.user_profiles
  ALTER COLUMN unsubscribe_token SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_profiles_unsubscribe_token
  ON public.user_profiles (unsubscribe_token);

CREATE TABLE IF NOT EXISTS public.communications_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT,
  channel TEXT NOT NULL CHECK (channel IN ('email', 'sms', 'in_app')),
  template_id TEXT NOT NULL,
  recipient TEXT NOT NULL,
  campaign_id UUID,
  idempotency_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'sent', 'delivered', 'opened', 'clicked', 'bounced', 'complained', 'failed', 'suppressed')),
  provider_message_id TEXT,
  error TEXT,
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_communications_log_idempotency
  ON public.communications_log (idempotency_key);

CREATE INDEX IF NOT EXISTS idx_communications_log_user_created_at
  ON public.communications_log (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_communications_log_campaign
  ON public.communications_log (campaign_id)
  WHERE campaign_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_communications_log_provider_message
  ON public.communications_log (provider_message_id)
  WHERE provider_message_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.email_suppression (
  email TEXT PRIMARY KEY,
  reason TEXT NOT NULL CHECK (reason IN ('unsubscribe', 'bounce', 'complaint', 'manual')),
  source TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
