-- Enable RLS on every public table.
-- This intentionally leaves client policies undefined so Supabase anon/authenticated
-- access is denied by default unless a later migration opens specific tables safely.
DO $$
DECLARE
  table_name text;
BEGIN
  FOR table_name IN
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', table_name);
  END LOOP;
END
$$;
