import type {
  PlatformAdminMemberSummary,
  PlatformAdminOrganizationSummary,
  PlatformAdminProjectSummary,
  PlatformOrganizationAccessStatus,
  PlatformProjectCoverageScope,
  PlatformProjectStatus,
  PlatformRole,
} from "../../../shared/platformTypes.js";
import { query } from "../db.js";
import type { QueryFn, StoreDeps } from "./orgStore.js";

function db(deps: StoreDeps): QueryFn {
  return deps.queryFn ?? (query as unknown as QueryFn);
}

function toIso(value: unknown): string {
  return value instanceof Date ? value.toISOString() : String(value);
}

function toNullableIso(value: unknown): string | null {
  return value == null ? null : toIso(value);
}

function toCount(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function listAdminOrganizationSummaries(
  deps: StoreDeps = {},
): Promise<PlatformAdminOrganizationSummary[]> {
  const run = db(deps);
  const organizationsResult = await run(`
    WITH member_counts AS (
      SELECT organization_id, COUNT(*)::int AS member_count
      FROM public.platform_organization_members
      GROUP BY organization_id
    ), project_counts AS (
      SELECT organization_id, COUNT(*)::int AS project_count
      FROM public.platform_projects
      GROUP BY organization_id
    ), record_counts AS (
      SELECT organization_id,
        COUNT(*)::int AS record_count,
        COUNT(*) FILTER (WHERE status = 'pending_review')::int AS pending_review_count
      FROM public.platform_records
      GROUP BY organization_id
    )
    SELECT o.id, o.name, o.slug, o.logo_url, o.accent_color, o.access_status,
      o.suspension_reason, o.suspended_at, o.suspended_by, o.created_at,
      COALESCE(mc.member_count, 0)::int AS member_count,
      COALESCE(pc.project_count, 0)::int AS project_count,
      COALESCE(rc.record_count, 0)::int AS record_count,
      COALESCE(rc.pending_review_count, 0)::int AS pending_review_count
    FROM public.platform_organizations o
    LEFT JOIN member_counts mc ON mc.organization_id = o.id
    LEFT JOIN project_counts pc ON pc.organization_id = o.id
    LEFT JOIN record_counts rc ON rc.organization_id = o.id
    ORDER BY o.created_at DESC
  `);

  const membersResult = await run(`
    SELECT m.organization_id, m.user_id, m.role, m.created_at,
      p.name, p.email, p.phone, p.suspended_until
    FROM public.platform_organization_members m
    JOIN public.user_profiles p ON p.id = m.user_id
    ORDER BY m.organization_id, m.created_at ASC
  `);

  const projectsResult = await run(`
    SELECT p.id, p.organization_id, p.name, p.status, p.coverage_scope, p.coverage_label,
      COUNT(r.id)::int AS record_count,
      COUNT(r.id) FILTER (WHERE r.status = 'pending_review')::int AS pending_review_count,
      COUNT(r.id) FILTER (WHERE r.status = 'approved')::int AS approved_count,
      COUNT(r.id) FILTER (WHERE r.status = 'rejected')::int AS rejected_count
    FROM public.platform_projects p
    LEFT JOIN public.platform_records r ON r.project_id = p.id AND r.organization_id = p.organization_id
    GROUP BY p.id, p.organization_id, p.name, p.status, p.coverage_scope, p.coverage_label, p.created_at
    ORDER BY p.organization_id, p.created_at DESC
  `);

  const membersByOrganization = new Map<string, PlatformAdminMemberSummary[]>();
  for (const row of membersResult.rows) {
    const members = membersByOrganization.get(row.organization_id) ?? [];
    members.push({
      userId: row.user_id,
      name: row.name,
      email: row.email ?? null,
      phone: row.phone ?? null,
      role: row.role as PlatformRole,
      joinedAt: toIso(row.created_at),
      suspendedUntil: toNullableIso(row.suspended_until),
    });
    membersByOrganization.set(row.organization_id, members);
  }

  const projectsByOrganization = new Map<string, PlatformAdminProjectSummary[]>();
  for (const row of projectsResult.rows) {
    const projects = projectsByOrganization.get(row.organization_id) ?? [];
    projects.push({
      id: row.id,
      name: row.name,
      status: row.status as PlatformProjectStatus,
      coverageScope: row.coverage_scope as PlatformProjectCoverageScope,
      coverageLabel: row.coverage_label ?? null,
      recordCount: toCount(row.record_count),
      pendingReviewCount: toCount(row.pending_review_count),
      approvedCount: toCount(row.approved_count),
      rejectedCount: toCount(row.rejected_count),
    });
    projectsByOrganization.set(row.organization_id, projects);
  }

  return organizationsResult.rows.map((row) => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    logoUrl: row.logo_url ?? null,
    accentColor: row.accent_color ?? null,
    accessStatus: row.access_status as PlatformOrganizationAccessStatus,
    suspensionReason: row.suspension_reason ?? null,
    suspendedAt: toNullableIso(row.suspended_at),
    suspendedBy: row.suspended_by ?? null,
    createdAt: toIso(row.created_at),
    memberCount: toCount(row.member_count),
    projectCount: toCount(row.project_count),
    recordCount: toCount(row.record_count),
    pendingReviewCount: toCount(row.pending_review_count),
    members: membersByOrganization.get(row.id) ?? [],
    projects: projectsByOrganization.get(row.id) ?? [],
  }));
}
