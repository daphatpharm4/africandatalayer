// lib/server/platform/tenancy.ts
// Single authorization chokepoint for the Data Operations Platform.
// Every /api/platform view handler MUST pass through requireOrgRole or
// requireProjectOrgRole before touching tenant data.
import { requireUser } from "../../auth.js";
import { errorResponse } from "../http.js";
import { roleAtLeast } from "../../../shared/platformSchema.js";
import type { PlatformRole } from "../../../shared/platformTypes.js";
import { getMembership, getOrganizationAccessState } from "./orgStore.js";
import { getProject } from "./projectStore.js";

export interface OrgContext {
  userId: string;
  organizationId: string;
  role: PlatformRole;
  isAdlAdmin: boolean;
}

export interface TenancyDeps {
  requireUserFn?: typeof requireUser;
  getMembershipFn?: typeof getMembership;
  getOrganizationAccessStateFn?: typeof getOrganizationAccessState;
  getProjectFn?: typeof getProject;
}

// Identical body for every 403 so responses never leak whether a foreign
// org/project exists.
function forbidden(): Response {
  return errorResponse("You do not have access to this organization", 403, { code: "platform_forbidden" });
}

export function isTenancyFailure(value: unknown): value is Response {
  return value instanceof Response;
}

export async function requireOrgRole(
  request: Request,
  organizationId: string,
  minimumRole: PlatformRole,
  deps: TenancyDeps = {},
): Promise<OrgContext | Response> {
  const requireUserFn = deps.requireUserFn ?? requireUser;
  const getMembershipFn = deps.getMembershipFn ?? getMembership;
  const getOrganizationAccessStateFn = deps.getOrganizationAccessStateFn ?? getOrganizationAccessState;

  const user = await requireUserFn(request);
  if (!user) {
    return errorResponse("Authentication required", 401, { code: "unauthorized" });
  }

  if (user.role === "admin") {
    const accessStatus = await getOrganizationAccessStateFn(organizationId);
    if (!accessStatus) {
      return errorResponse("Organization not found", 404, { code: "platform_org_not_found" });
    }
    return { userId: user.id, organizationId, role: "owner", isAdlAdmin: true };
  }

  const membership = await getMembershipFn(organizationId, user.id);
  if (!membership) return forbidden();
  if (!roleAtLeast(membership.role, minimumRole)) return forbidden();

  const accessStatus = await getOrganizationAccessStateFn(organizationId);
  if (!accessStatus) return forbidden();
  if (accessStatus === "suspended") {
    return errorResponse("This company workspace is suspended. Contact ADL support.", 403, {
      code: "platform_org_suspended",
    });
  }

  return { userId: user.id, organizationId, role: membership.role, isAdlAdmin: false };
}

export async function requireProjectOrgRole(
  request: Request,
  projectId: string,
  minimumRole: PlatformRole,
  deps: TenancyDeps = {},
): Promise<(OrgContext & { projectId: string }) | Response> {
  const getProjectFn = deps.getProjectFn ?? getProject;

  // Authenticate before existence checks so 401 wins over 404.
  const requireUserFn = deps.requireUserFn ?? requireUser;
  const user = await requireUserFn(request);
  if (!user) {
    return errorResponse("Authentication required", 401, { code: "unauthorized" });
  }

  const project = await getProjectFn(projectId);
  if (!project) {
    return errorResponse("Project not found", 404, { code: "platform_project_not_found" });
  }

  const context = await requireOrgRole(request, project.organizationId, minimumRole, {
    ...deps,
    requireUserFn: async () => user,
  });
  if (isTenancyFailure(context)) return context;
  return { ...context, projectId };
}
