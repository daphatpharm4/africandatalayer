// lib/server/platform/orgStore.ts
// Persistence for platform organizations, memberships, and invites.
// Isolation contract: every read/write is scoped by organization_id (or user_id for cross-org listing).
import { query } from "../db.js";
import type { PlatformInvite, PlatformMembership, PlatformOrganization, PlatformRole } from "../../../shared/platformTypes.js";

export type QueryFn = (text: string, values?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }>;
export interface StoreDeps {
  queryFn?: QueryFn;
}

function db(deps: StoreDeps): QueryFn {
  return deps.queryFn ?? (query as unknown as QueryFn);
}

function toIso(value: unknown): string {
  return value instanceof Date ? value.toISOString() : String(value);
}

interface OrgRow {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  accent_color: string | null;
  created_at: unknown;
}

function rowToOrg(row: OrgRow): PlatformOrganization {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    logoUrl: row.logo_url,
    accentColor: row.accent_color,
    createdAt: toIso(row.created_at),
  };
}

function rowToMembership(row: { organization_id: string; user_id: string; role: PlatformRole; created_at: unknown }): PlatformMembership {
  return {
    organizationId: row.organization_id,
    userId: row.user_id,
    role: row.role,
    createdAt: toIso(row.created_at),
  };
}

function rowToInvite(row: {
  id: string; organization_id: string; email: string; role: Exclude<PlatformRole, "owner">;
  expires_at: unknown; accepted_at: unknown; created_at: unknown;
}): PlatformInvite {
  return {
    id: row.id,
    organizationId: row.organization_id,
    email: row.email,
    role: row.role,
    expiresAt: toIso(row.expires_at),
    acceptedAt: row.accepted_at === null ? null : toIso(row.accepted_at),
    createdAt: toIso(row.created_at),
  };
}

export async function createOrganization(
  input: { name: string; slug: string; createdBy: string },
  deps: StoreDeps = {},
): Promise<PlatformOrganization> {
  const run = db(deps);
  const orgResult = await run(
    `INSERT INTO public.platform_organizations (name, slug, created_by)
     VALUES ($1, $2, $3)
     RETURNING id, name, slug, logo_url, accent_color, created_at`,
    [input.name, input.slug, input.createdBy],
  );
  const org = rowToOrg(orgResult.rows[0]);
  await run(
    `INSERT INTO public.platform_organization_members (organization_id, user_id, role)
     VALUES ($1, $2, $3)`,
    [org.id, input.createdBy, "owner"],
  );
  return org;
}

export async function getOrganization(organizationId: string, deps: StoreDeps = {}): Promise<PlatformOrganization | null> {
  const result = await db(deps)(
    `SELECT id, name, slug, logo_url, accent_color, created_at
     FROM public.platform_organizations WHERE id = $1`,
    [organizationId],
  );
  return result.rows[0] ? rowToOrg(result.rows[0]) : null;
}

export async function listOrganizationsForUser(
  userId: string,
  deps: StoreDeps = {},
): Promise<Array<PlatformOrganization & { role: PlatformRole }>> {
  const result = await db(deps)(
    `SELECT o.id, o.name, o.slug, o.logo_url, o.accent_color, o.created_at, m.role
     FROM public.platform_organizations o
     JOIN public.platform_organization_members m ON m.organization_id = o.id
     WHERE m.user_id = $1
     ORDER BY o.created_at ASC`,
    [userId],
  );
  return result.rows.map((row) => ({ ...rowToOrg(row), role: row.role as PlatformRole }));
}

export async function updateOrganizationBranding(
  input: { organizationId: string; name?: string; logoUrl?: string | null; accentColor?: string | null },
  deps: StoreDeps = {},
): Promise<PlatformOrganization | null> {
  const sets: string[] = [];
  const values: unknown[] = [];
  if (input.name !== undefined) {
    values.push(input.name);
    sets.push(`name = $${values.length}`);
  }
  if (input.logoUrl !== undefined) {
    values.push(input.logoUrl);
    sets.push(`logo_url = $${values.length}`);
  }
  if (input.accentColor !== undefined) {
    values.push(input.accentColor);
    sets.push(`accent_color = $${values.length}`);
  }
  if (sets.length === 0) return getOrganization(input.organizationId, deps);
  values.push(input.organizationId);
  const result = await db(deps)(
    `UPDATE public.platform_organizations SET ${sets.join(", ")}
     WHERE id = $${values.length}
     RETURNING id, name, slug, logo_url, accent_color, created_at`,
    values,
  );
  return result.rows[0] ? rowToOrg(result.rows[0]) : null;
}

export async function getMembership(
  organizationId: string,
  userId: string,
  deps: StoreDeps = {},
): Promise<PlatformMembership | null> {
  const result = await db(deps)(
    `SELECT organization_id, user_id, role, created_at
     FROM public.platform_organization_members
     WHERE organization_id = $1 AND user_id = $2`,
    [organizationId, userId],
  );
  return result.rows[0] ? rowToMembership(result.rows[0]) : null;
}

export async function listMembers(organizationId: string, deps: StoreDeps = {}): Promise<PlatformMembership[]> {
  const result = await db(deps)(
    `SELECT organization_id, user_id, role, created_at
     FROM public.platform_organization_members
     WHERE organization_id = $1
     ORDER BY created_at ASC`,
    [organizationId],
  );
  return result.rows.map(rowToMembership);
}

export async function upsertMemberRole(
  input: { organizationId: string; userId: string; role: PlatformRole },
  deps: StoreDeps = {},
): Promise<void> {
  await db(deps)(
    `INSERT INTO public.platform_organization_members (organization_id, user_id, role)
     VALUES ($1, $2, $3)
     ON CONFLICT (organization_id, user_id) DO UPDATE SET role = EXCLUDED.role`,
    [input.organizationId, input.userId, input.role],
  );
}

export async function removeMember(
  input: { organizationId: string; userId: string },
  deps: StoreDeps = {},
): Promise<void> {
  await db(deps)(
    `DELETE FROM public.platform_organization_members
     WHERE organization_id = $1 AND user_id = $2`,
    [input.organizationId, input.userId],
  );
}

export async function createInvite(
  input: {
    organizationId: string;
    email: string;
    role: Exclude<PlatformRole, "owner">;
    tokenHash: string;
    expiresAt: Date;
    createdBy: string;
  },
  deps: StoreDeps = {},
): Promise<PlatformInvite> {
  const result = await db(deps)(
    `INSERT INTO public.platform_organization_invites
       (organization_id, email, role, token_hash, expires_at, created_by)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, organization_id, email, role, token_hash, expires_at, accepted_at, created_at`,
    [input.organizationId, input.email, input.role, input.tokenHash, input.expiresAt.toISOString(), input.createdBy],
  );
  return rowToInvite(result.rows[0]);
}

export async function findInviteByTokenHash(
  tokenHash: string,
  deps: StoreDeps = {},
): Promise<(PlatformInvite & { tokenHash: string }) | null> {
  const result = await db(deps)(
    `SELECT id, organization_id, email, role, token_hash, expires_at, accepted_at, created_at
     FROM public.platform_organization_invites
     WHERE token_hash = $1`,
    [tokenHash],
  );
  if (!result.rows[0]) return null;
  return { ...rowToInvite(result.rows[0]), tokenHash: result.rows[0].token_hash };
}

export async function listInvites(organizationId: string, deps: StoreDeps = {}): Promise<PlatformInvite[]> {
  const result = await db(deps)(
    `SELECT id, organization_id, email, role, token_hash, expires_at, accepted_at, created_at
     FROM public.platform_organization_invites
     WHERE organization_id = $1
       AND accepted_at IS NULL
       AND expires_at > now()
     ORDER BY created_at DESC`,
    [organizationId],
  );
  return result.rows.map(rowToInvite);
}

export async function revokeInvite(
  input: { organizationId: string; inviteId: string },
  deps: StoreDeps = {},
): Promise<boolean> {
  const result = await db(deps)(
    `DELETE FROM public.platform_organization_invites
     WHERE organization_id = $1 AND id = $2 AND accepted_at IS NULL
     RETURNING id`,
    [input.organizationId, input.inviteId],
  );
  return (result.rowCount ?? result.rows.length) > 0;
}

export async function markInviteAccepted(
  input: { inviteId: string; userId: string },
  deps: StoreDeps = {},
): Promise<void> {
  await db(deps)(
    `UPDATE public.platform_organization_invites
     SET accepted_at = now(), accepted_by = $2
     WHERE id = $1 AND accepted_at IS NULL`,
    [input.inviteId, input.userId],
  );
}
