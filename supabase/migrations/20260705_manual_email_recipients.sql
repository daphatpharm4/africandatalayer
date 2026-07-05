-- Manual recipient support for admin email campaigns.

ALTER TABLE public.email_campaigns
  ADD COLUMN IF NOT EXISTS recipient_mode TEXT NOT NULL DEFAULT 'audience',
  ADD COLUMN IF NOT EXISTS cc_emails TEXT[] NOT NULL DEFAULT '{}'::text[];

ALTER TABLE public.email_campaigns
  DROP CONSTRAINT IF EXISTS email_campaigns_recipient_mode_check;

ALTER TABLE public.email_campaigns
  ADD CONSTRAINT email_campaigns_recipient_mode_check
  CHECK (recipient_mode IN ('audience', 'manual'));

ALTER TABLE public.email_campaign_recipients
  DROP CONSTRAINT IF EXISTS email_campaign_recipients_pkey;

ALTER TABLE public.email_campaign_recipients
  DROP CONSTRAINT IF EXISTS email_campaign_recipients_user_id_fkey;

ALTER TABLE public.email_campaign_recipients
  ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE public.email_campaign_recipients
  ADD COLUMN IF NOT EXISTS recipient_key TEXT;

UPDATE public.email_campaign_recipients
SET recipient_key = COALESCE(recipient_key, user_id, 'manual:' || LOWER(email))
WHERE recipient_key IS NULL;

ALTER TABLE public.email_campaign_recipients
  ALTER COLUMN recipient_key SET NOT NULL;

ALTER TABLE public.email_campaign_recipients
  ADD CONSTRAINT email_campaign_recipients_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.user_profiles(id) ON DELETE CASCADE;

ALTER TABLE public.email_campaign_recipients
  ADD PRIMARY KEY (campaign_id, recipient_key);
