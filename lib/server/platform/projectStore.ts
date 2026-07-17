// Persistence for platform projects and versioned schema definitions.
import type {
  PlatformProject,
  PlatformSchemaDefinition,
  PlatformSchemaVersion,
} from "../../../shared/platformTypes.js";
import { query } from "../db.js";
import type { QueryFn, StoreDeps } from "./orgStore.js";

function db(deps: StoreDeps): QueryFn {
  return deps.queryFn ?? (query as unknown as QueryFn);
}

function toIso(value: unknown): string {
  return value instanceof Date ? value.toISOString() : String(value);
}

function rowToProject(row: any): PlatformProject {
  return {
    id: row.id,
    organizationId: row.organization_id,
    name: row.name,
    status: row.status,
    createdAt: toIso(row.created_at),
  };
}

function rowToSchemaVersion(row: any): PlatformSchemaVersion {
  return {
    id: row.id,
    projectId: row.project_id,
    organizationId: row.organization_id,
    version: Number(row.version),
    status: row.status,
    definition: (typeof row.definition === "string" ? JSON.parse(row.definition) : row.definition) as PlatformSchemaDefinition,
    publishedAt: row.published_at === null ? null : toIso(row.published_at),
  };
}

const SCHEMA_COLUMNS = "id, project_id, organization_id, version, status, definition, published_at, created_at";

export async function createProject(
  input: { organizationId: string; name: string; createdBy: string },
  deps: StoreDeps = {},
): Promise<PlatformProject> {
  const result = await db(deps)(
    `INSERT INTO public.platform_projects (organization_id, name, created_by)
     VALUES ($1, $2, $3)
     RETURNING id, organization_id, name, status, created_at`,
    [input.organizationId, input.name, input.createdBy],
  );
  return rowToProject(result.rows[0]);
}

export async function listProjects(organizationId: string, deps: StoreDeps = {}): Promise<PlatformProject[]> {
  const result = await db(deps)(
    `SELECT id, organization_id, name, status, created_at
     FROM public.platform_projects
     WHERE organization_id = $1
     ORDER BY created_at DESC`,
    [organizationId],
  );
  return result.rows.map(rowToProject);
}

export async function getProject(projectId: string, deps: StoreDeps = {}): Promise<PlatformProject | null> {
  const result = await db(deps)(
    `SELECT id, organization_id, name, status, created_at
     FROM public.platform_projects
     WHERE id = $1`,
    [projectId],
  );
  return result.rows[0] ? rowToProject(result.rows[0]) : null;
}

export async function activateProject(projectId: string, organizationId: string, deps: StoreDeps = {}): Promise<void> {
  await db(deps)(
    `UPDATE public.platform_projects
     SET status = 'active'
     WHERE id = $1 AND organization_id = $2 AND status = 'draft'`,
    [projectId, organizationId],
  );
}

export async function getDraftSchema(
  projectId: string,
  organizationId: string,
  deps: StoreDeps = {},
): Promise<PlatformSchemaVersion | null> {
  const result = await db(deps)(
    `SELECT ${SCHEMA_COLUMNS}
     FROM public.platform_project_schema_versions
     WHERE project_id = $1 AND organization_id = $2 AND status = 'draft'`,
    [projectId, organizationId],
  );
  return result.rows[0] ? rowToSchemaVersion(result.rows[0]) : null;
}

export async function saveDraftSchema(
  input: { projectId: string; organizationId: string; definition: PlatformSchemaDefinition; userId: string },
  deps: StoreDeps = {},
): Promise<PlatformSchemaVersion> {
  const result = await db(deps)(
    `INSERT INTO public.platform_project_schema_versions
       (project_id, organization_id, version, status, definition, created_by)
     SELECT $1, $2,
       COALESCE((SELECT MAX(version) FROM public.platform_project_schema_versions WHERE project_id = $1), 0) + 1,
       'draft', $3::jsonb, $4
     ON CONFLICT (project_id) WHERE status = 'draft'
     DO UPDATE SET definition = EXCLUDED.definition
     RETURNING ${SCHEMA_COLUMNS}`,
    [input.projectId, input.organizationId, JSON.stringify(input.definition), input.userId],
  );
  return rowToSchemaVersion(result.rows[0]);
}

export async function publishDraftSchema(
  input: { projectId: string; organizationId: string },
  deps: StoreDeps = {},
): Promise<PlatformSchemaVersion | null> {
  const result = await db(deps)(
    `UPDATE public.platform_project_schema_versions
     SET status = 'published', published_at = now()
     WHERE project_id = $1 AND organization_id = $2 AND status = 'draft'
     RETURNING ${SCHEMA_COLUMNS}`,
    [input.projectId, input.organizationId],
  );
  return result.rows[0] ? rowToSchemaVersion(result.rows[0]) : null;
}

export async function getPublishedSchema(
  projectId: string,
  organizationId: string,
  deps: StoreDeps = {},
): Promise<PlatformSchemaVersion | null> {
  const result = await db(deps)(
    `SELECT ${SCHEMA_COLUMNS}
     FROM public.platform_project_schema_versions
     WHERE project_id = $1 AND organization_id = $2 AND status = 'published'
     ORDER BY version DESC
     LIMIT 1`,
    [projectId, organizationId],
  );
  return result.rows[0] ? rowToSchemaVersion(result.rows[0]) : null;
}

export async function listSchemaVersions(
  projectId: string,
  organizationId: string,
  deps: StoreDeps = {},
): Promise<PlatformSchemaVersion[]> {
  const result = await db(deps)(
    `SELECT ${SCHEMA_COLUMNS}
     FROM public.platform_project_schema_versions
     WHERE project_id = $1 AND organization_id = $2
     ORDER BY version DESC`,
    [projectId, organizationId],
  );
  return result.rows.map(rowToSchemaVersion);
}
