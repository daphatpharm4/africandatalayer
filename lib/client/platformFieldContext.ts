import {
  getSchemaRequest,
  listMyOrganizations,
  listProjectsRequest,
  type PlatformApiDeps,
} from "./platformApi.js";
import type {
  PlatformOrganization,
  PlatformProject,
  PlatformRole,
  PlatformSchemaVersion,
} from "../../shared/platformTypes.js";

export interface PlatformFieldProjectContext {
  project: PlatformProject;
  publishedSchema: PlatformSchemaVersion | null;
  hasDraftSchema: boolean;
}

export interface PlatformFieldOrganizationContext {
  organization: PlatformOrganization;
  role: PlatformRole;
  projects: PlatformFieldProjectContext[];
}

export interface PlatformFieldContext {
  organizations: PlatformFieldOrganizationContext[];
}

export async function loadPlatformFieldContext(deps?: PlatformApiDeps): Promise<PlatformFieldContext> {
  const organizations = await listMyOrganizations(deps);
  const contexts = await Promise.all(organizations.map(async ({ role, ...organization }) => {
    const projects = await listProjectsRequest(organization.id, deps);
    const projectContexts = await Promise.all(projects.map(async (project) => {
      const schema = await getSchemaRequest(project.id, deps);
      return {
        project,
        publishedSchema: schema.published,
        hasDraftSchema: Boolean(schema.draft),
      };
    }));
    return { organization, role, projects: projectContexts };
  }));
  return { organizations: contexts };
}

export function collectablePlatformProjects(context: PlatformFieldContext | null): Array<{
  organization: PlatformOrganization;
  role: PlatformRole;
  project: PlatformProject;
  publishedSchema: PlatformSchemaVersion;
}> {
  if (!context) return [];
  return context.organizations.flatMap(({ organization, role, projects }) => projects
    .filter((entry): entry is PlatformFieldProjectContext & { publishedSchema: PlatformSchemaVersion } => (
      entry.project.status !== "archived" && Boolean(entry.publishedSchema)
    ))
    .map((entry) => ({ organization, role, project: entry.project, publishedSchema: entry.publishedSchema })));
}
