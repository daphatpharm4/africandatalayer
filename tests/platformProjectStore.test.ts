import assert from "node:assert/strict";
import test from "node:test";
import {
  createProject,
  activateProject,
  getDraftSchema,
  getProject,
  getPublishedSchema,
  listProjects,
  publishDraftSchema,
  saveDraftSchema,
} from "../lib/server/platform/projectStore.js";

const PROJECT_ROW = {
  id: "proj-1", organization_id: "org-1", name: "Bin census",
  status: "draft", created_at: "2026-07-16T00:00:00.000Z",
};
const DEFINITION = { recordTypes: [{ key: "bin", label: { en: "Bin", fr: "Bac" }, fields: [
  { key: "state", label: { en: "State", fr: "État" }, type: "text", required: true },
], evidence: { gpsRequired: true, minPhotos: 1, notesRequired: false } }] };
const DRAFT_ROW = {
  id: "sv-1", project_id: "proj-1", organization_id: "org-1", version: 1,
  status: "draft", definition: DEFINITION, published_at: null, created_at: "2026-07-16T00:00:00.000Z",
};

function fakeQuery(rowsPerCall: Array<{ rows: any[] }>) {
  const calls: Array<{ text: string; values: unknown[] }> = [];
  let index = 0;
  const queryFn = async (text: string, values: unknown[] = []) => {
    calls.push({ text, values });
    const result = rowsPerCall[Math.min(index, rowsPerCall.length - 1)] ?? { rows: [] };
    index += 1;
    return { rows: result.rows, rowCount: result.rows.length };
  };
  return { queryFn, calls };
}

test("createProject inserts with organization scope", async () => {
  const { queryFn, calls } = fakeQuery([{ rows: [PROJECT_ROW] }]);
  const project = await createProject({ organizationId: "org-1", name: "Bin census", createdBy: "u1" }, { queryFn });
  assert.equal(project.organizationId, "org-1");
  assert.equal(calls[0].values[0], "org-1");
});

test("listProjects scopes by organization", async () => {
  const { queryFn, calls } = fakeQuery([{ rows: [PROJECT_ROW] }]);
  await listProjects("org-1", { queryFn });
  assert.match(calls[0].text, /where organization_id = \$1/i);
});

test("getProject returns organizationId for tenancy resolution", async () => {
  const { queryFn } = fakeQuery([{ rows: [PROJECT_ROW] }]);
  const project = await getProject("proj-1", { queryFn });
  assert.equal(project?.organizationId, "org-1");
});

test("activateProject scopes the status change to draft projects in the organization", async () => {
  const { queryFn, calls } = fakeQuery([{ rows: [] }]);
  await activateProject("proj-1", "org-1", { queryFn });
  assert.match(calls[0].text, /set status = 'active'/i);
  assert.match(calls[0].text, /organization_id = \$2/i);
  assert.deepEqual(calls[0].values, ["proj-1", "org-1"]);
});

test("saveDraftSchema upserts against the one-draft partial index with both scopes", async () => {
  const { queryFn, calls } = fakeQuery([{ rows: [DRAFT_ROW] }]);
  const version = await saveDraftSchema(
    { projectId: "proj-1", organizationId: "org-1", definition: DEFINITION as any, userId: "u1" },
    { queryFn },
  );
  assert.equal(version.status, "draft");
  assert.deepEqual(version.definition, DEFINITION);
  assert.match(calls[0].text, /on conflict \(project_id\) where status = 'draft'/i);
  assert.ok(calls[0].values.includes("org-1"));
});

test("publishDraftSchema flips draft to published, scoped by org", async () => {
  const published = { ...DRAFT_ROW, status: "published", published_at: "2026-07-16T01:00:00.000Z" };
  const { queryFn, calls } = fakeQuery([{ rows: [published] }]);
  const version = await publishDraftSchema({ projectId: "proj-1", organizationId: "org-1" }, { queryFn });
  assert.equal(version?.status, "published");
  assert.match(calls[0].text, /status = 'draft'/i);
  assert.match(calls[0].text, /organization_id = \$2/i);
});

test("publishDraftSchema returns null when no draft exists", async () => {
  const { queryFn } = fakeQuery([{ rows: [] }]);
  assert.equal(await publishDraftSchema({ projectId: "proj-1", organizationId: "org-1" }, { queryFn }), null);
});

test("getDraftSchema and getPublishedSchema scope by project AND organization", async () => {
  const { queryFn, calls } = fakeQuery([{ rows: [DRAFT_ROW] }]);
  await getDraftSchema("proj-1", "org-1", { queryFn });
  await getPublishedSchema("proj-1", "org-1", { queryFn });
  for (const call of calls) {
    assert.match(call.text, /project_id = \$1/i);
    assert.match(call.text, /organization_id = \$2/i);
  }
});
