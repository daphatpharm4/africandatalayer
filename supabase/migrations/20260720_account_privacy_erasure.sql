-- Self-service privacy erasure keeps operational history while removing the
-- identity that history used to reference. Updating the profile primary key
-- requires every FK to follow the random tombstone identifier.
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

DO $$
DECLARE
  item record;
  definition text;
BEGIN
  FOR item IN
    SELECT c.oid, c.conname, c.conrelid::regclass AS relation
    FROM pg_constraint c
    WHERE c.contype = 'f'
      AND c.confrelid = 'public.user_profiles'::regclass
  LOOP
    definition := pg_get_constraintdef(item.oid);
    definition := regexp_replace(
      definition,
      ' ON UPDATE (NO ACTION|RESTRICT|CASCADE|SET NULL|SET DEFAULT)',
      '',
      'i'
    );
    IF definition ~* ' ON DELETE ' THEN
      definition := regexp_replace(definition, ' ON DELETE ', ' ON UPDATE CASCADE ON DELETE ', 'i');
    ELSE
      definition := definition || ' ON UPDATE CASCADE';
    END IF;
    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', item.relation, item.conname);
    EXECUTE format('ALTER TABLE %s ADD CONSTRAINT %I %s', item.relation, item.conname, definition);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.adl_anonymize_user_account(p_user_id text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  profile_row public.user_profiles%ROWTYPE;
  tombstone text := 'deleted-' || gen_random_uuid()::text;
  target record;
BEGIN
  SELECT * INTO profile_row
  FROM public.user_profiles
  WHERE id = p_user_id AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'account_not_found';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.platform_organization_members own_membership
    WHERE own_membership.user_id = p_user_id
      AND own_membership.role = 'owner'
      AND NOT EXISTS (
        SELECT 1
        FROM public.platform_organization_members other_owner
        WHERE other_owner.organization_id = own_membership.organization_id
          AND other_owner.role = 'owner'
          AND other_owner.user_id <> p_user_id
      )
  ) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'last_organization_owner';
  END IF;

  IF (profile_row.is_admin OR profile_row.role = 'admin') AND NOT EXISTS (
    SELECT 1 FROM public.user_profiles other_admin
    WHERE other_admin.id <> p_user_id
      AND other_admin.deleted_at IS NULL
      AND (other_admin.is_admin OR other_admin.role = 'admin')
  ) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'last_adl_admin';
  END IF;

  -- Access and retry artifacts have no historical value and are removed.
  DELETE FROM public.platform_project_members WHERE user_id = p_user_id;
  DELETE FROM public.platform_organization_members WHERE user_id = p_user_id;
  DELETE FROM public.platform_organization_invites
    WHERE accepted_by = p_user_id OR lower(email) = lower(coalesce(profile_row.email, ''));
  DELETE FROM public.password_reset_tokens WHERE user_id = p_user_id;
  DELETE FROM public.submission_idempotency_keys WHERE user_id = p_user_id;
  DELETE FROM public.email_suppression WHERE lower(email) = lower(coalesce(profile_row.email, ''));

  -- The PK update atomically rewrites every formal reference through the
  -- ON UPDATE CASCADE constraints installed above.
  UPDATE public.user_profiles
  SET id = tombstone,
      email = NULL,
      phone = NULL,
      name = 'Deleted user',
      image = '',
      occupation = '',
      xp = 0,
      password_hash = NULL,
      is_admin = false,
      role = 'agent',
      map_scope = 'bonamoussadi',
      trust_score = 0,
      trust_tier = 'restricted',
      suspended_until = NULL,
      wipe_requested = false,
      failed_login_count = 0,
      locked_until = NULL,
      must_change_password = false,
      session_version = coalesce(session_version, 0) + 1,
      email_opt_in = false,
      sms_opt_in = false,
      unsubscribe_token = encode(gen_random_bytes(24), 'hex'),
      deleted_at = now(),
      updated_at = now()
  WHERE id = p_user_id;

  -- Older event/audit tables intentionally stored actor IDs without FKs.
  -- Replace matching identifiers across those well-known actor columns.
  FOR target IN
    SELECT table_schema, table_name, column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND data_type = 'text'
      AND table_name <> 'user_profiles'
      AND column_name = ANY (ARRAY[
        'user_id', 'agent_user_id', 'operator_user_id', 'admin_user_id',
        'reviewer_id', 'created_by', 'accepted_by', 'assigned_to',
        'reviewed_by', 'granted_by', 'revoked_by', 'suspended_by',
        'erased_by', 'actor_user_id', 'reporter_user', 'subject_reference',
        'captured_by'
      ])
  LOOP
    EXECUTE format('UPDATE %I.%I SET %I = $1 WHERE %I = $2',
      target.table_schema, target.table_name, target.column_name, target.column_name)
      USING tombstone, p_user_id;
  END LOOP;

  -- Remove the old identifier from JSON evidence and audit payloads too.
  FOR target IN
    SELECT table_schema, table_name, column_name
    FROM information_schema.columns
    WHERE table_schema = 'public' AND data_type = 'jsonb'
  LOOP
    EXECUTE format(
      'UPDATE %I.%I SET %I = replace(%I::text, $1, $2)::jsonb WHERE %I::text LIKE $3',
      target.table_schema, target.table_name, target.column_name,
      target.column_name, target.column_name
    ) USING p_user_id, tombstone, '%' || p_user_id || '%';
  END LOOP;

  UPDATE public.communications_log
  SET recipient = 'deleted-user'
  WHERE lower(recipient) = lower(coalesce(profile_row.email, ''));

  RETURN tombstone;
END;
$$;

REVOKE ALL ON FUNCTION public.adl_anonymize_user_account(text) FROM PUBLIC;
