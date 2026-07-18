-- Supabase installs pgcrypto in the dedicated extensions schema. Keep the
-- security-definer search path explicit while allowing gen_random_bytes used
-- for the replacement unsubscribe token to resolve in production.
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

ALTER FUNCTION public.adl_anonymize_user_account(text)
  SET search_path = public, extensions, pg_temp;
