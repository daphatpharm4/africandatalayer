import assert from "node:assert/strict";
import test from "node:test";
import { collectablePlatformProjects, loadPlatformFieldContext } from "../lib/client/platformFieldContext.ts";

function response(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
}

test("loadPlatformFieldContext joins memberships, projects, and published company forms", async () => {
  const fetchFn = (async (url: string) => {
    if (url.includes("platform_org_list")) return response({ organizations: [{ id: "org-1", name: "Usiku", slug: "usiku", logoUrl: null, accentColor: null, createdAt: "", role: "collector" }] });
    if (url.includes("platform_project_list")) return response({ projects: [{ id: "project-1", organizationId: "org-1", name: "Retail census", status: "draft", createdAt: "" }] });
    if (url.includes("platform_schema_get")) return response({ draft: null, published: { id: "schema-1", projectId: "project-1", organizationId: "org-1", version: 1, status: "published", definition: { recordTypes: [] }, publishedAt: "" }, versions: [] });
    throw new Error(`Unexpected URL ${url}`);
  }) as typeof fetch;

  const context = await loadPlatformFieldContext({ fetchFn });
  assert.equal(context.organizations[0].organization.name, "Usiku");
  assert.equal(context.organizations[0].role, "collector");
  assert.equal(collectablePlatformProjects(context).length, 1, "published draft-status projects remain collectable for pre-fix data");
});

test("collectablePlatformProjects excludes archived and unpublished projects", () => {
  const organization = { id: "org-1", name: "Usiku", slug: "usiku", logoUrl: null, accentColor: null, createdAt: "" };
  const context: any = { organizations: [{ organization, role: "collector", projects: [
    { project: { id: "p1", organizationId: "org-1", name: "No form", status: "active", createdAt: "" }, publishedSchema: null, hasDraftSchema: true },
    { project: { id: "p2", organizationId: "org-1", name: "Old", status: "archived", createdAt: "" }, publishedSchema: { id: "s2" }, hasDraftSchema: false },
  ] }] };
  assert.deepEqual(collectablePlatformProjects(context), []);
});

test("suspended company context stays company-scoped without loading forms", async () => {
  const calls: string[] = [];
  const fetchFn = (async (url: string) => {
    calls.push(url);
    return response({ organizations: [{
      id: "org-1", name: "Usiku", slug: "usiku", logoUrl: null, accentColor: null,
      accessStatus: "suspended", suspensionReason: "Subscription overdue", suspendedAt: "2026-07-18T00:00:00.000Z",
      createdAt: "", role: "collector",
    }] });
  }) as typeof fetch;

  const context = await loadPlatformFieldContext({ fetchFn });
  assert.equal(calls.length, 1, "suspended workspaces never request project forms");
  assert.equal(context.organizations[0].organization.accessStatus, "suspended");
  assert.deepEqual(context.organizations[0].projects, []);
  assert.deepEqual(collectablePlatformProjects(context), []);
});
