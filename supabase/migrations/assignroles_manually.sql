

-- Run the migration first
-- (copy contents of supabase/migrations/20260308_add_user_role.sql)

-- Then assign roles manually:
-- You (admin)
UPDATE user_profiles SET role = 'admin' WHERE email = 'your-email@example.com';

-- A client account (after they sign up)
UPDATE user_profiles SET role = 'client' WHERE email = 'client@sabc.com';

-- Field agents are 'agent' by default, no action needed