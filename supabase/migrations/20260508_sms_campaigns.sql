-- SMS campaigns + recipient tracking (africandatalayer-q6g)
-- Mirrors email_campaigns shape; phones tracked separately because SMS
-- opt-in is stricter (must default FALSE, set explicitly) and STOP keyword
-- handling is on the inbound webhook.

CREATE TABLE IF NOT EXISTS public.sms_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message TEXT NOT NULL,
  audience JSONB NOT NULL DEFAULT '{}'::jsonb,
  language TEXT NOT NULL DEFAULT 'en' CHECK (language IN ('en', 'fr')),
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'sending', 'completed', 'failed', 'cancelled')),
  recipient_count INT NOT NULL DEFAULT 0,
  sent_count INT NOT NULL DEFAULT 0,
  failed_count INT NOT NULL DEFAULT 0,
  suppressed_count INT NOT NULL DEFAULT 0,
  estimated_cost_units NUMERIC(10, 2),
  scheduled_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_by TEXT NOT NULL REFERENCES public.user_profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sms_campaigns_status_created_at
  ON public.sms_campaigns (status, created_at DESC);

CREATE TABLE IF NOT EXISTS public.sms_campaign_recipients (
  campaign_id UUID NOT NULL REFERENCES public.sms_campaigns(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  phone TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sent', 'failed', 'suppressed', 'duplicate', 'delivered', 'undelivered')),
  provider_message_id TEXT,
  cost_units NUMERIC(10, 4),
  error TEXT,
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  PRIMARY KEY (campaign_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_sms_campaign_recipients_status
  ON public.sms_campaign_recipients (campaign_id, status);

CREATE INDEX IF NOT EXISTS idx_sms_campaign_recipients_provider_message_id
  ON public.sms_campaign_recipients (provider_message_id)
  WHERE provider_message_id IS NOT NULL;
