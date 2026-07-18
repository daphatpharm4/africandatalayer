import { query } from './db.js';

export interface AccountDeletionRequirements {
  requiresPassword: boolean;
  blockers: Array<{ code: 'last_organization_owner' | 'last_adl_admin'; label: string }>;
}

type QueryFn = typeof query;

export async function getAccountDeletionRequirements(
  userId: string,
  deps: { queryFn?: QueryFn } = {},
): Promise<AccountDeletionRequirements | null> {
  const queryFn = deps.queryFn ?? query;
  const profileResult = await queryFn<Record<string, unknown>>(
    `SELECT password_hash, role, is_admin
     FROM public.user_profiles
     WHERE id = $1 AND deleted_at IS NULL
     LIMIT 1`,
    [userId],
  );
  const profile = profileResult.rows[0];
  if (!profile) return null;

  const ownerResult = await queryFn<{ name: string }>(
    `SELECT organization.name
     FROM public.platform_organization_members membership
     JOIN public.platform_organizations organization ON organization.id = membership.organization_id
     WHERE membership.user_id = $1
       AND membership.role = 'owner'
       AND NOT EXISTS (
         SELECT 1 FROM public.platform_organization_members other_owner
         WHERE other_owner.organization_id = membership.organization_id
           AND other_owner.role = 'owner'
           AND other_owner.user_id <> $1
       )
     ORDER BY organization.name`,
    [userId],
  );

  const blockers: AccountDeletionRequirements['blockers'] = ownerResult.rows.map((row) => ({
    code: 'last_organization_owner',
    label: row.name,
  }));

  if (profile.is_admin === true || profile.role === 'admin') {
    const admins = await queryFn<{ count: number | string }>(
      `SELECT COUNT(*)::int AS count
       FROM public.user_profiles
       WHERE id <> $1 AND deleted_at IS NULL AND (is_admin = true OR role = 'admin')`,
      [userId],
    );
    if (Number(admins.rows[0]?.count ?? 0) === 0) {
      blockers.push({ code: 'last_adl_admin', label: 'African Data Layer' });
    }
  }

  return {
    requiresPassword: typeof profile.password_hash === 'string' && profile.password_hash.length > 0,
    blockers,
  };
}

export async function anonymizeUserAccount(
  userId: string,
  deps: { queryFn?: QueryFn } = {},
): Promise<string> {
  const queryFn = deps.queryFn ?? query;
  const result = await queryFn<{ tombstone: string }>(
    'SELECT public.adl_anonymize_user_account($1) AS tombstone',
    [userId],
  );
  const tombstone = result.rows[0]?.tombstone;
  if (!tombstone) throw new Error('account_erasure_failed');
  return tombstone;
}
