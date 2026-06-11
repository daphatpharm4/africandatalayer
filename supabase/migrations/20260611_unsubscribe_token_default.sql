-- Profile upserts (lib/server/storage/postgresStore.ts) omit unsubscribe_token.
-- 20260508_communications_foundation.sql made the column NOT NULL without a
-- DEFAULT, and Postgres enforces NOT NULL on the proposed row of
-- INSERT ... ON CONFLICT before conflict resolution — so every profile write
-- (photo upload, name change, registration) failed with a 500.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE public.user_profiles
  ALTER COLUMN unsubscribe_token SET DEFAULT encode(gen_random_bytes(24), 'hex');
