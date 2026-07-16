# Data Operations Platform — Stage 1: Tenancy Core + Console Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Multi-tenant foundation for the Configurable Data Operations Platform: organizations, memberships, invites, projects, versioned configurable schemas, tenancy guard, and a new desktop console (onboarding wizard, schema builder, members, branding) — inside the existing ADL repo.

**Architecture:** New `platform_*` Postgres tables with strict `organization_id` scoping. NO new serverless route — platform views fold into the existing `api/user/index.ts` via `view=platform_*` query params delegating to a router in `lib/server/platform/` (exact same pattern as the `po_*` point-operator views; Vercel Hobby cap is 12 functions and the repo is AT the cap). New Vite entry `console.html` renders a desktop SPA using the existing design system, screen-enum navigation (no router), and `t(en, fr)` bilingual pattern.

**Tech Stack:** TypeScript 5.8, React 19, Vite 6, Tailwind 3.4, Zod 4, pg (raw SQL), @auth/core (`requireUser`), Resend via `lib/server/email/provider.ts`, node:test + tsx.

**Spec:** `docs/superpowers/specs/2026-07-16-data-operations-platform-mvp-design.md` (Stage 1 of 3). Stages 2 (collection loop) and 3 (outputs + demo) get separate plans after this lands.

## Global Constraints

- Vercel Hobby cap: 12 deployment functions; repo is AT the cap (12 route files). DO NOT create any file under `api/`. Platform endpoints ride `api/user/index.ts` via `view=platform_*` delegation to `createPlatformHandler` — identical to the proven `po_*` pattern. `npm run check:function-budget` must stay green at 12.
- Every platform view name carries the `platform_` prefix (e.g. `platform_org_create`); clients call `/api/user?view=platform_<name>`.
- Every `platform_*` table row carries `organization_id`; no query without explicit organization scope.
- Every `/api/platform` view handler calls `requireOrgRole` / `requireProjectOrgRole` before any data access — single chokepoint.
- Table names prefixed `platform_` (deviation from spec's bare names — avoids collision with existing tables, marks the product boundary).
- Role hierarchy: owner(5) > manager(4) > reviewer(3) > collector(2) > viewer(1).
- Invite tokens: only SHA-256 hashes stored; raw token appears once in the email link.
- Bilingual EN/FR everywhere: UI via `t(en, fr)`; schema labels are `{ en, fr }` objects.
- Server responses via `jsonResponse`/`errorResponse` from `lib/server/http.js`. DB via `query` from `lib/server/db.js`. Imports use `.js` extension (ESM).
- Tests: `node --import tsx --test tests/<file>.test.ts`, `node:assert/strict`, dependency-injection via optional `deps` parameter (codebase convention).
- Commit after every task. Run `npm run typecheck` before every commit that touches TS.

---

### Task 1: Tenancy migration + contract test

**Files:**
- Create: `supabase/migrations/20260716_platform_tenancy.sql`
- Test: `tests/platformMigrationContract.test.ts`

**Interfaces:**
- Produces: tables `platform_organizations`, `platform_organization_members`, `platform_organization_invites`, `platform_projects`, `platform_project_members`, `platform_project_schema_versions`, `platform_audit_events` consumed by Tasks 3–6.

- [ ] **Step 1: Write the failing contract test**

```typescript
// tests/platformMigrationContract.test.ts
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationPath = new URL("../supabase/migrations/20260716_platform_tenancy.sql", import.meta.url);

test("platform tenancy migration defines all tenant tables with organization scope", async () => {
  const sql = await readFile(migrationPath, "utf8");
  assert.match(sql, /create table if not exists public\.platform_organizations/i);
  assert.match(sql, /create table if not exists public\.platform_organization_members/i);
  assert.match(sql, /create table if not exists public\.platform_organization_invites/i);
  assert.match(sql, /create table if not exists public\.platform_projects/i);
  assert.match(sql, /create table if not exists public\.platform_project_members/i);
  assert.match(sql, /create table if not exists public\.platform_project_schema_versions/i);
  assert.match(sql, /create table if not exists public\.platform_audit_events/i);
  // every tenant table after organizations must carry organization_id
  const tenantTables = sql.split(/create table if not exists/i).slice(2);
  for (const block of tenantTables) {
    assert.match(block, /organization_id uuid not null/i);
  }
});

test("platform roles, invite hashing, and schema versioning are constrained", async () => {
  const sql = await readFile(migrationPath, "utf8");
  assert.match(sql, /'owner', 'manager', 'reviewer', 'collector', 'viewer'/);
  assert.match(sql, /token_hash text not null unique/i);
  assert.match(sql, /unique \(project_id, version\)/i);
  assert.match(sql, /where status = 'draft'/i); // one draft per project
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --import tsx --test tests/platformMigrationContract.test.ts`
Expected: FAIL — `ENOENT` reading the migration file.

- [ ] **Step 3: Write the migration**

```sql
-- supabase/migrations/20260716_platform_tenancy.sql
-- Data Operations Platform: multi-tenant foundation.
-- Every tenant-owned row carries organization_id. Strict logical isolation.

CREATE TABLE IF NOT EXISTS public.platform_organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (char_length(name) BETWEEN 2 AND 80),
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$'),
  logo_url text,
  accent_color text CHECK (accent_color IS NULL OR accent_color ~ '^#[0-9a-fA-F]{6}$'),
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by text NOT NULL REFERENCES public.user_profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.platform_organization_members (
  organization_id uuid NOT NULL REFERENCES public.platform_organizations(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES public.user_profiles(id),
  role text NOT NULL CHECK (role IN ('owner', 'manager', 'reviewer', 'collector', 'viewer')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, user_id)
);

CREATE INDEX IF NOT EXISTS platform_org_members_by_user
  ON public.platform_organization_members(user_id);

CREATE TABLE IF NOT EXISTS public.platform_organization_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.platform_organizations(id) ON DELETE CASCADE,
  email text NOT NULL,
  role text NOT NULL CHECK (role IN ('manager', 'reviewer', 'collector', 'viewer')),
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  accepted_at timestamptz,
  accepted_by text REFERENCES public.user_profiles(id),
  created_by text NOT NULL REFERENCES public.user_profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS platform_invites_by_org
  ON public.platform_organization_invites(organization_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.platform_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.platform_organizations(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(name) BETWEEN 2 AND 120),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'archived')),
  created_by text NOT NULL REFERENCES public.user_profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS platform_projects_by_org
  ON public.platform_projects(organization_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.platform_project_members (
  project_id uuid NOT NULL REFERENCES public.platform_projects(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.platform_organizations(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES public.user_profiles(id),
  role text NOT NULL CHECK (role IN ('manager', 'reviewer', 'collector', 'viewer')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.platform_project_schema_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.platform_projects(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.platform_organizations(id) ON DELETE CASCADE,
  version integer NOT NULL CHECK (version >= 1),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  definition jsonb NOT NULL DEFAULT '{"recordTypes":[]}'::jsonb,
  published_at timestamptz,
  created_by text NOT NULL REFERENCES public.user_profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, version),
  CHECK (
    (status = 'draft' AND published_at IS NULL)
    OR
    (status = 'published' AND published_at IS NOT NULL)
  )
);

-- Only one editable draft per project at any time.
CREATE UNIQUE INDEX IF NOT EXISTS platform_schema_one_draft_per_project
  ON public.platform_project_schema_versions(project_id)
  WHERE status = 'draft';

CREATE TABLE IF NOT EXISTS public.platform_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.platform_organizations(id) ON DELETE CASCADE,
  project_id uuid REFERENCES public.platform_projects(id) ON DELETE SET NULL,
  actor_user_id text NOT NULL,
  event_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS platform_audit_by_org
  ON public.platform_audit_events(organization_id, created_at DESC);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --import tsx --test tests/platformMigrationContract.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Dry-run the migration**

Run: `npm run migrate:dry`
Expected: lists `20260716_platform_tenancy.sql` as pending, no errors. (Do NOT run `npm run migrate` against production from this task; migration applies at deploy per repo convention.)

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260716_platform_tenancy.sql tests/platformMigrationContract.test.ts
git commit -m "feat(platform): add multi-tenant foundation migration"
```

---

### Task 2: Shared platform types + schema-definition validation

**Files:**
- Create: `shared/platformTypes.ts`
- Create: `shared/platformSchema.ts`
- Test: `tests/platformSchemaValidation.test.ts`

**Interfaces:**
- Produces (consumed by every later task):

```typescript
// shared/platformTypes.ts
export type PlatformRole = "owner" | "manager" | "reviewer" | "collector" | "viewer";
export interface BilingualLabel { en: string; fr: string }
export type PlatformFieldType = "text" | "number" | "select" | "multi_select" | "date" | "boolean" | "photo" | "gps";
export interface PlatformFieldOption { value: string; label: BilingualLabel }
export interface PlatformFieldDefinition {
  key: string; label: BilingualLabel; type: PlatformFieldType; required: boolean;
  options?: PlatformFieldOption[]; min?: number; max?: number;
}
export interface PlatformEvidenceRules {
  gpsRequired: boolean; gpsAccuracyMeters?: number; minPhotos: number; notesRequired: boolean;
}
export interface PlatformRecordType {
  key: string; label: BilingualLabel; fields: PlatformFieldDefinition[]; evidence: PlatformEvidenceRules;
}
export interface PlatformSchemaDefinition { recordTypes: PlatformRecordType[] }
export interface PlatformOrganization {
  id: string; name: string; slug: string; logoUrl: string | null; accentColor: string | null; createdAt: string;
}
export interface PlatformMembership { organizationId: string; userId: string; role: PlatformRole; createdAt: string }
export type PlatformProjectStatus = "draft" | "active" | "archived";
export interface PlatformProject { id: string; organizationId: string; name: string; status: PlatformProjectStatus; createdAt: string }
export interface PlatformSchemaVersion {
  id: string; projectId: string; organizationId: string; version: number;
  status: "draft" | "published"; definition: PlatformSchemaDefinition; publishedAt: string | null;
}
export interface PlatformInvite {
  id: string; organizationId: string; email: string; role: Exclude<PlatformRole, "owner">;
  expiresAt: string; acceptedAt: string | null; createdAt: string;
}
```

```typescript
// shared/platformSchema.ts
export const ROLE_RANK: Record<PlatformRole, number>; // owner:5 … viewer:1
export function roleAtLeast(role: PlatformRole, minimum: PlatformRole): boolean;
export interface SchemaValidationIssue { path: string; message: string }
export type SchemaValidationResult =
  | { ok: true; definition: PlatformSchemaDefinition }
  | { ok: false; issues: SchemaValidationIssue[] };
export function validateSchemaDefinition(input: unknown): SchemaValidationResult;
```

- [ ] **Step 1: Write the failing tests**

```typescript
// tests/platformSchemaValidation.test.ts
import assert from "node:assert/strict";
import test from "node:test";
import { roleAtLeast, validateSchemaDefinition } from "../shared/platformSchema.js";

const validDefinition = {
  recordTypes: [
    {
      key: "waste_bin",
      label: { en: "Waste bin", fr: "Bac à ordures" },
      evidence: { gpsRequired: true, gpsAccuracyMeters: 25, minPhotos: 1, notesRequired: false },
      fields: [
        { key: "condition", label: { en: "Condition", fr: "État" }, type: "select", required: true,
          options: [
            { value: "good", label: { en: "Good", fr: "Bon" } },
            { value: "damaged", label: { en: "Damaged", fr: "Endommagé" } },
          ] },
        { key: "capacity_liters", label: { en: "Capacity (L)", fr: "Capacité (L)" }, type: "number",
          required: false, min: 0, max: 5000 },
      ],
    },
  ],
};

test("role hierarchy ranks owner above viewer", () => {
  assert.equal(roleAtLeast("owner", "manager"), true);
  assert.equal(roleAtLeast("viewer", "collector"), false);
  assert.equal(roleAtLeast("reviewer", "reviewer"), true);
});

test("valid schema definition passes", () => {
  const result = validateSchemaDefinition(validDefinition);
  assert.equal(result.ok, true);
});

test("empty record types rejected", () => {
  const result = validateSchemaDefinition({ recordTypes: [] });
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.issues[0].message, /at least one record type/i);
});

test("record type without fields rejected", () => {
  const bad = structuredClone(validDefinition);
  bad.recordTypes[0].fields = [];
  const result = validateSchemaDefinition(bad);
  assert.equal(result.ok, false);
});

test("duplicate field keys rejected", () => {
  const bad = structuredClone(validDefinition);
  bad.recordTypes[0].fields[1].key = "condition";
  const result = validateSchemaDefinition(bad);
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.issues[0].message, /duplicate/i);
});

test("select without options rejected", () => {
  const bad = structuredClone(validDefinition);
  delete (bad.recordTypes[0].fields[0] as Record<string, unknown>).options;
  const result = validateSchemaDefinition(bad);
  assert.equal(result.ok, false);
});

test("missing french label rejected", () => {
  const bad = structuredClone(validDefinition);
  bad.recordTypes[0].label.fr = "";
  const result = validateSchemaDefinition(bad);
  assert.equal(result.ok, false);
});

test("number min above max rejected", () => {
  const bad = structuredClone(validDefinition);
  bad.recordTypes[0].fields[1].min = 10;
  bad.recordTypes[0].fields[1].max = 5;
  const result = validateSchemaDefinition(bad);
  assert.equal(result.ok, false);
});

test("invalid key format rejected", () => {
  const bad = structuredClone(validDefinition);
  bad.recordTypes[0].key = "Waste Bin!";
  const result = validateSchemaDefinition(bad);
  assert.equal(result.ok, false);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --import tsx --test tests/platformSchemaValidation.test.ts`
Expected: FAIL — cannot find module `../shared/platformSchema.js`.

- [ ] **Step 3: Implement `shared/platformTypes.ts`** — exactly the interfaces shown in this task's Interfaces block (copy verbatim, add nothing).

- [ ] **Step 4: Implement `shared/platformSchema.ts`**

```typescript
// shared/platformSchema.ts
import { z } from "zod";
import type { PlatformRole, PlatformSchemaDefinition } from "./platformTypes.js";

export const ROLE_RANK: Record<PlatformRole, number> = {
  owner: 5,
  manager: 4,
  reviewer: 3,
  collector: 2,
  viewer: 1,
};

export function roleAtLeast(role: PlatformRole, minimum: PlatformRole): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[minimum];
}

const KEY_PATTERN = /^[a-z][a-z0-9_]{1,39}$/;

const bilingualLabelSchema = z.object({
  en: z.string().trim().min(1, "English label is required").max(120),
  fr: z.string().trim().min(1, "French label is required").max(120),
});

const fieldOptionSchema = z.object({
  value: z.string().trim().min(1).max(80),
  label: bilingualLabelSchema,
});

const fieldSchema = z.object({
  key: z.string().regex(KEY_PATTERN, "Key must be snake_case (a-z, 0-9, _), 2-40 chars"),
  label: bilingualLabelSchema,
  type: z.enum(["text", "number", "select", "multi_select", "date", "boolean", "photo", "gps"]),
  required: z.boolean(),
  options: z.array(fieldOptionSchema).min(1).max(50).optional(),
  min: z.number().finite().optional(),
  max: z.number().finite().optional(),
});

const evidenceSchema = z.object({
  gpsRequired: z.boolean(),
  gpsAccuracyMeters: z.number().positive().max(10000).optional(),
  minPhotos: z.number().int().min(0).max(10),
  notesRequired: z.boolean(),
});

const recordTypeSchema = z.object({
  key: z.string().regex(KEY_PATTERN, "Key must be snake_case (a-z, 0-9, _), 2-40 chars"),
  label: bilingualLabelSchema,
  fields: z.array(fieldSchema).min(1, "Each record type needs at least one field").max(60),
  evidence: evidenceSchema,
});

const definitionSchema = z.object({
  recordTypes: z.array(recordTypeSchema).min(1, "Define at least one record type").max(20),
});

export interface SchemaValidationIssue {
  path: string;
  message: string;
}

export type SchemaValidationResult =
  | { ok: true; definition: PlatformSchemaDefinition }
  | { ok: false; issues: SchemaValidationIssue[] };

export function validateSchemaDefinition(input: unknown): SchemaValidationResult {
  const parsed = definitionSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      issues: parsed.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    };
  }

  const issues: SchemaValidationIssue[] = [];
  const typeKeys = new Set<string>();

  parsed.data.recordTypes.forEach((recordType, typeIndex) => {
    if (typeKeys.has(recordType.key)) {
      issues.push({ path: `recordTypes.${typeIndex}.key`, message: `Duplicate record type key "${recordType.key}"` });
    }
    typeKeys.add(recordType.key);

    const fieldKeys = new Set<string>();
    recordType.fields.forEach((field, fieldIndex) => {
      const path = `recordTypes.${typeIndex}.fields.${fieldIndex}`;
      if (fieldKeys.has(field.key)) {
        issues.push({ path: `${path}.key`, message: `Duplicate field key "${field.key}"` });
      }
      fieldKeys.add(field.key);

      const needsOptions = field.type === "select" || field.type === "multi_select";
      if (needsOptions && (!field.options || field.options.length === 0)) {
        issues.push({ path: `${path}.options`, message: "Select fields require at least one option" });
      }
      if (!needsOptions && field.options) {
        issues.push({ path: `${path}.options`, message: "Options are only allowed on select fields" });
      }
      if (field.type !== "number" && (field.min !== undefined || field.max !== undefined)) {
        issues.push({ path, message: "min/max are only allowed on number fields" });
      }
      if (field.min !== undefined && field.max !== undefined && field.min > field.max) {
        issues.push({ path, message: "min must be less than or equal to max" });
      }
    });
  });

  if (issues.length > 0) return { ok: false, issues };
  return { ok: true, definition: parsed.data as PlatformSchemaDefinition };
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `node --import tsx --test tests/platformSchemaValidation.test.ts`
Expected: PASS (9 tests).

- [ ] **Step 6: Typecheck and commit**

```bash
npm run typecheck
git add shared/platformTypes.ts shared/platformSchema.ts tests/platformSchemaValidation.test.ts
git commit -m "feat(platform): shared types and schema-definition validation"
```

---

### Task 3: Organization store (orgs, members, invites)

**Files:**
- Create: `lib/server/platform/orgStore.ts`
- Test: `tests/platformOrgStore.test.ts`

**Interfaces:**
- Consumes: `query` from `lib/server/db.js`, types from Task 2.
- Produces (consumed by Tasks 5, 8, 9):

```typescript
export type QueryFn = (text: string, values?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }>;
export interface StoreDeps { queryFn?: QueryFn }
export function createOrganization(input: { name: string; slug: string; createdBy: string }, deps?: StoreDeps): Promise<PlatformOrganization>;
export function getOrganization(organizationId: string, deps?: StoreDeps): Promise<PlatformOrganization | null>;
export function listOrganizationsForUser(userId: string, deps?: StoreDeps): Promise<Array<PlatformOrganization & { role: PlatformRole }>>;
export function updateOrganizationBranding(input: { organizationId: string; name?: string; logoUrl?: string | null; accentColor?: string | null }, deps?: StoreDeps): Promise<PlatformOrganization | null>;
export function getMembership(organizationId: string, userId: string, deps?: StoreDeps): Promise<PlatformMembership | null>;
export function listMembers(organizationId: string, deps?: StoreDeps): Promise<PlatformMembership[]>;
export function upsertMemberRole(input: { organizationId: string; userId: string; role: PlatformRole }, deps?: StoreDeps): Promise<void>;
export function removeMember(input: { organizationId: string; userId: string }, deps?: StoreDeps): Promise<void>;
export function createInvite(input: { organizationId: string; email: string; role: Exclude<PlatformRole, "owner">; tokenHash: string; expiresAt: Date; createdBy: string }, deps?: StoreDeps): Promise<PlatformInvite>;
export function findInviteByTokenHash(tokenHash: string, deps?: StoreDeps): Promise<(PlatformInvite & { tokenHash: string }) | null>;
export function listInvites(organizationId: string, deps?: StoreDeps): Promise<PlatformInvite[]>;
export function markInviteAccepted(input: { inviteId: string; userId: string }, deps?: StoreDeps): Promise<void>;
```

Implementation notes for the engineer:
- Default `queryFn` is `query` from `../db.js`. Tests inject a fake capturing SQL + values.
- `createOrganization` runs two inserts (org row, then owner membership). Sequential `queryFn` calls are acceptable here; the API layer (Task 8) treats a membership-insert failure as fatal and surfaces 500 — an orphan org row with no members is unreachable via `listOrganizationsForUser` and harmless.
- Row mappers convert snake_case columns to the camelCase interfaces from Task 2; timestamps via `.toISOString()` when `Date`, pass through when already string (fake rows in tests use strings).
- Every SELECT/UPDATE/DELETE includes `organization_id = $n` in WHERE — this is the isolation contract the tests assert.

- [ ] **Step 1: Write the failing tests**

```typescript
// tests/platformOrgStore.test.ts
import assert from "node:assert/strict";
import test from "node:test";
import {
  createOrganization,
  getMembership,
  getOrganization,
  listMembers,
  listOrganizationsForUser,
  markInviteAccepted,
  removeMember,
  updateOrganizationBranding,
  upsertMemberRole,
  createInvite,
  findInviteByTokenHash,
} from "../lib/server/platform/orgStore.js";

const ORG_ROW = {
  id: "org-1", name: "Acme Waste", slug: "acme-waste",
  logo_url: null, accent_color: null, created_at: "2026-07-16T00:00:00.000Z",
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

test("createOrganization inserts org then owner membership", async () => {
  const { queryFn, calls } = fakeQuery([{ rows: [ORG_ROW] }, { rows: [] }]);
  const org = await createOrganization({ name: "Acme Waste", slug: "acme-waste", createdBy: "u1" }, { queryFn });
  assert.equal(org.id, "org-1");
  assert.equal(org.slug, "acme-waste");
  assert.equal(calls.length, 2);
  assert.match(calls[0].text, /insert into public\.platform_organizations/i);
  assert.match(calls[1].text, /insert into public\.platform_organization_members/i);
  assert.deepEqual(calls[1].values, ["org-1", "u1", "owner"]);
});

test("getMembership scopes by organization and user", async () => {
  const { queryFn, calls } = fakeQuery([
    { rows: [{ organization_id: "org-1", user_id: "u1", role: "manager", created_at: "2026-07-16T00:00:00.000Z" }] },
  ]);
  const membership = await getMembership("org-1", "u1", { queryFn });
  assert.equal(membership?.role, "manager");
  assert.match(calls[0].text, /organization_id = \$1/i);
  assert.match(calls[0].text, /user_id = \$2/i);
});

test("getMembership returns null when absent", async () => {
  const { queryFn } = fakeQuery([{ rows: [] }]);
  assert.equal(await getMembership("org-1", "ghost", { queryFn }), null);
});

test("listOrganizationsForUser joins memberships", async () => {
  const { queryFn, calls } = fakeQuery([{ rows: [{ ...ORG_ROW, role: "owner" }] }]);
  const orgs = await listOrganizationsForUser("u1", { queryFn });
  assert.equal(orgs[0].role, "owner");
  assert.match(calls[0].text, /platform_organization_members/i);
  assert.deepEqual(calls[0].values, ["u1"]);
});

test("updateOrganizationBranding only touches provided fields and scopes by id", async () => {
  const { queryFn, calls } = fakeQuery([{ rows: [{ ...ORG_ROW, accent_color: "#c86b4a" }] }]);
  const org = await updateOrganizationBranding({ organizationId: "org-1", accentColor: "#c86b4a" }, { queryFn });
  assert.equal(org?.accentColor, "#c86b4a");
  assert.match(calls[0].text, /update public\.platform_organizations/i);
  assert.match(calls[0].text, /where id = /i);
  assert.doesNotMatch(calls[0].text, /name =/i);
});

test("member role update and removal scope by organization", async () => {
  const { queryFn, calls } = fakeQuery([{ rows: [] }]);
  await upsertMemberRole({ organizationId: "org-1", userId: "u2", role: "reviewer" }, { queryFn });
  await removeMember({ organizationId: "org-1", userId: "u2" }, { queryFn });
  assert.match(calls[0].text, /on conflict \(organization_id, user_id\)/i);
  assert.match(calls[1].text, /delete from public\.platform_organization_members/i);
  assert.match(calls[1].text, /organization_id = \$1/i);
});

test("invite lifecycle stores hash, finds by hash, marks accepted", async () => {
  const inviteRow = {
    id: "inv-1", organization_id: "org-1", email: "new@example.com", role: "collector",
    token_hash: "hash123", expires_at: "2026-07-23T00:00:00.000Z", accepted_at: null,
    created_at: "2026-07-16T00:00:00.000Z",
  };
  const { queryFn, calls } = fakeQuery([{ rows: [inviteRow] }, { rows: [inviteRow] }, { rows: [] }]);
  const invite = await createInvite(
    { organizationId: "org-1", email: "new@example.com", role: "collector", tokenHash: "hash123",
      expiresAt: new Date("2026-07-23T00:00:00.000Z"), createdBy: "u1" },
    { queryFn },
  );
  assert.equal(invite.email, "new@example.com");
  const found = await findInviteByTokenHash("hash123", { queryFn });
  assert.equal(found?.id, "inv-1");
  await markInviteAccepted({ inviteId: "inv-1", userId: "u9" }, { queryFn });
  assert.match(calls[2].text, /accepted_at = now\(\)/i);
  assert.match(calls[2].text, /accepted_at is null/i); // cannot double-accept
});

test("listMembers scopes by organization", async () => {
  const { queryFn, calls } = fakeQuery([{ rows: [] }]);
  await listMembers("org-1", { queryFn });
  assert.deepEqual(calls[0].values, ["org-1"]);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --import tsx --test tests/platformOrgStore.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `lib/server/platform/orgStore.ts`**

```typescript
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
     ORDER BY created_at DESC`,
    [organizationId],
  );
  return result.rows.map(rowToInvite);
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --import tsx --test tests/platformOrgStore.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Typecheck and commit**

```bash
npm run typecheck
git add lib/server/platform/orgStore.ts tests/platformOrgStore.test.ts
git commit -m "feat(platform): organization store with tenant-scoped queries"
```

---

### Task 4: Project + schema-version store

**Files:**
- Create: `lib/server/platform/projectStore.ts`
- Test: `tests/platformProjectStore.test.ts`

**Interfaces:**
- Consumes: `QueryFn`, `StoreDeps` re-exported from `orgStore.js`; types from Task 2.
- Produces (consumed by Tasks 5, 8):

```typescript
export function createProject(input: { organizationId: string; name: string; createdBy: string }, deps?: StoreDeps): Promise<PlatformProject>;
export function listProjects(organizationId: string, deps?: StoreDeps): Promise<PlatformProject[]>;
export function getProject(projectId: string, deps?: StoreDeps): Promise<PlatformProject | null>;
export function getDraftSchema(projectId: string, organizationId: string, deps?: StoreDeps): Promise<PlatformSchemaVersion | null>;
export function saveDraftSchema(input: { projectId: string; organizationId: string; definition: PlatformSchemaDefinition; userId: string }, deps?: StoreDeps): Promise<PlatformSchemaVersion>;
export function publishDraftSchema(input: { projectId: string; organizationId: string }, deps?: StoreDeps): Promise<PlatformSchemaVersion | null>;
export function getPublishedSchema(projectId: string, organizationId: string, deps?: StoreDeps): Promise<PlatformSchemaVersion | null>; // latest published
export function listSchemaVersions(projectId: string, organizationId: string, deps?: StoreDeps): Promise<PlatformSchemaVersion[]>;
```

Implementation notes:
- `getProject` intentionally takes only `projectId` and returns `organizationId` — the tenancy guard (Task 5) uses it to resolve the org, then checks membership. All schema functions take BOTH `projectId` and `organizationId` and include both in WHERE.
- `saveDraftSchema`: single upsert against the partial unique index:
  `INSERT ... ON CONFLICT (project_id) WHERE status = 'draft' DO UPDATE SET definition = EXCLUDED.definition`.
  New draft version number = `COALESCE((SELECT MAX(version) FROM ... WHERE project_id = $1), 0) + 1` computed in the INSERT's SELECT.
- `publishDraftSchema`: `UPDATE ... SET status = 'published', published_at = now() WHERE project_id = $1 AND organization_id = $2 AND status = 'draft' RETURNING ...`; returns null when no draft exists (API maps to 409).
- Row mapper parses `definition` when it arrives as string (fake rows), passes through when object (pg parses jsonb to object).

- [ ] **Step 1: Write the failing tests**

```typescript
// tests/platformProjectStore.test.ts
import assert from "node:assert/strict";
import test from "node:test";
import {
  createProject,
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --import tsx --test tests/platformProjectStore.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `lib/server/platform/projectStore.ts`**

```typescript
// lib/server/platform/projectStore.ts
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --import tsx --test tests/platformProjectStore.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Typecheck and commit**

```bash
npm run typecheck
git add lib/server/platform/projectStore.ts tests/platformProjectStore.test.ts
git commit -m "feat(platform): project and schema-version store"
```

---

### Task 5: Tenancy guard (the single chokepoint)

**Files:**
- Create: `lib/server/platform/tenancy.ts`
- Test: `tests/platformTenancy.test.ts`

**Interfaces:**
- Consumes: `requireUser` from `lib/auth.js`, `getMembership` (Task 3), `getProject` (Task 4), `roleAtLeast` (Task 2), `errorResponse` from `lib/server/http.js`.
- Produces (consumed by Task 8):

```typescript
export interface OrgContext { userId: string; organizationId: string; role: PlatformRole }
export interface TenancyDeps {
  requireUserFn?: typeof requireUser;
  getMembershipFn?: typeof getMembership;
  getProjectFn?: typeof getProject;
}
// Returns a Response (401/403) on failure, OrgContext on success.
export function requireOrgRole(request: Request, organizationId: string, minimumRole: PlatformRole, deps?: TenancyDeps): Promise<OrgContext | Response>;
// Resolves the project's organization first; 404 when project missing.
export function requireProjectOrgRole(request: Request, projectId: string, minimumRole: PlatformRole, deps?: TenancyDeps): Promise<(OrgContext & { projectId: string }) | Response>;
export function isTenancyFailure(value: unknown): value is Response;
```

Design rule: a non-member gets **403 with no existence hint** — same body whether the org exists or not. `requireProjectOrgRole` returns 404 for a missing project but 403 for a project in another org (no existence leak of foreign projects: the 403 body is identical to the plain non-member 403).

- [ ] **Step 1: Write the failing tests**

```typescript
// tests/platformTenancy.test.ts
import assert from "node:assert/strict";
import test from "node:test";
import { isTenancyFailure, requireOrgRole, requireProjectOrgRole } from "../lib/server/platform/tenancy.js";

const request = new Request("https://example.com/api/platform");
const authedUser = async () => ({ id: "u1", token: {}, role: "agent" as const });
const noUser = async () => null;

test("unauthenticated request gets 401", async () => {
  const result = await requireOrgRole(request, "org-1", "viewer", { requireUserFn: noUser as any });
  assert.ok(isTenancyFailure(result));
  assert.equal((result as Response).status, 401);
});

test("non-member gets 403", async () => {
  const result = await requireOrgRole(request, "org-1", "viewer", {
    requireUserFn: authedUser as any,
    getMembershipFn: async () => null,
  });
  assert.ok(isTenancyFailure(result));
  assert.equal((result as Response).status, 403);
});

test("member below minimum role gets 403", async () => {
  const result = await requireOrgRole(request, "org-1", "manager", {
    requireUserFn: authedUser as any,
    getMembershipFn: async () => ({ organizationId: "org-1", userId: "u1", role: "collector", createdAt: "" }),
  });
  assert.ok(isTenancyFailure(result));
  assert.equal((result as Response).status, 403);
});

test("member at or above minimum role gets context", async () => {
  const result = await requireOrgRole(request, "org-1", "manager", {
    requireUserFn: authedUser as any,
    getMembershipFn: async () => ({ organizationId: "org-1", userId: "u1", role: "owner", createdAt: "" }),
  });
  assert.ok(!isTenancyFailure(result));
  assert.deepEqual(result, { userId: "u1", organizationId: "org-1", role: "owner" });
});

test("cross-tenant: membership lookup is scoped to the requested org, not any org", async () => {
  const lookups: string[] = [];
  await requireOrgRole(request, "org-2", "viewer", {
    requireUserFn: authedUser as any,
    getMembershipFn: async (orgId: string) => {
      lookups.push(orgId);
      return null; // member of org-1, but org-2 requested
    },
  });
  assert.deepEqual(lookups, ["org-2"]);
});

test("requireProjectOrgRole: missing project gets 404", async () => {
  const result = await requireProjectOrgRole(request, "ghost", "viewer", {
    requireUserFn: authedUser as any,
    getProjectFn: async () => null,
  });
  assert.ok(isTenancyFailure(result));
  assert.equal((result as Response).status, 404);
});

test("requireProjectOrgRole: project in another org gets 403, body identical to plain 403", async () => {
  const foreign = await requireProjectOrgRole(request, "proj-9", "viewer", {
    requireUserFn: authedUser as any,
    getProjectFn: async () => ({ id: "proj-9", organizationId: "org-9", name: "x", status: "draft", createdAt: "" }),
    getMembershipFn: async () => null,
  });
  const plain = await requireOrgRole(request, "org-9", "viewer", {
    requireUserFn: authedUser as any,
    getMembershipFn: async () => null,
  });
  assert.equal((foreign as Response).status, 403);
  assert.equal(await (foreign as Response).text(), await (plain as Response).text());
});

test("requireProjectOrgRole: member gets context with projectId", async () => {
  const result = await requireProjectOrgRole(request, "proj-1", "reviewer", {
    requireUserFn: authedUser as any,
    getProjectFn: async () => ({ id: "proj-1", organizationId: "org-1", name: "x", status: "active", createdAt: "" }),
    getMembershipFn: async () => ({ organizationId: "org-1", userId: "u1", role: "manager", createdAt: "" }),
  });
  assert.ok(!isTenancyFailure(result));
  assert.equal((result as { projectId: string }).projectId, "proj-1");
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --import tsx --test tests/platformTenancy.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `lib/server/platform/tenancy.ts`**

```typescript
// lib/server/platform/tenancy.ts
// Single authorization chokepoint for the Data Operations Platform.
// Every /api/platform view handler MUST pass through requireOrgRole or
// requireProjectOrgRole before touching tenant data.
import { requireUser } from "../../auth.js";
import { errorResponse } from "../http.js";
import { roleAtLeast } from "../../../shared/platformSchema.js";
import type { PlatformRole } from "../../../shared/platformTypes.js";
import { getMembership } from "./orgStore.js";
import { getProject } from "./projectStore.js";

export interface OrgContext {
  userId: string;
  organizationId: string;
  role: PlatformRole;
}

export interface TenancyDeps {
  requireUserFn?: typeof requireUser;
  getMembershipFn?: typeof getMembership;
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

  const user = await requireUserFn(request);
  if (!user) {
    return errorResponse("Authentication required", 401, { code: "unauthorized" });
  }

  const membership = await getMembershipFn(organizationId, user.id);
  if (!membership) return forbidden();
  if (!roleAtLeast(membership.role, minimumRole)) return forbidden();

  return { userId: user.id, organizationId, role: membership.role };
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --import tsx --test tests/platformTenancy.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Typecheck and commit**

```bash
npm run typecheck
git add lib/server/platform/tenancy.ts tests/platformTenancy.test.ts
git commit -m "feat(platform): tenancy guard with cross-tenant denial"
```

---

### Task 6: Audit writer + request validation schemas

**Files:**
- Create: `lib/server/platform/audit.ts`
- Create: `lib/server/platform/validation.ts`
- Test: `tests/platformRequestValidation.test.ts`

**Interfaces:**
- Produces (consumed by Task 8):

```typescript
// lib/server/platform/audit.ts
export type PlatformAuditEventType =
  | "org_created" | "org_branding_updated"
  | "member_invited" | "invite_accepted" | "member_role_changed" | "member_removed"
  | "project_created" | "schema_draft_saved" | "schema_published";
export interface PlatformAuditEvent {
  organizationId: string; projectId?: string | null; actorUserId: string;
  eventType: PlatformAuditEventType; payload?: Record<string, unknown>;
}
// Never throws — audit failure logs and continues (matches logSecurityEvent convention).
export function writePlatformAudit(event: PlatformAuditEvent, deps?: StoreDeps): Promise<void>;
```

```typescript
// lib/server/platform/validation.ts — Zod request schemas
export const orgCreateSchema;      // { name: 2-80 trimmed, slug: /^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/ }
export const orgUpdateSchema;      // { organizationId: uuid, name?, accentColor?: /^#[0-9a-fA-F]{6}$/, logoDataUrl?: string data URL ≤ 800_000 chars, clearLogo?: boolean }
export const inviteCreateSchema;   // { organizationId: uuid, email: email lowercased, role: manager|reviewer|collector|viewer }
export const inviteAcceptSchema;   // { token: /^[0-9a-f]{64}$/ }
export const memberUpdateSchema;   // { organizationId: uuid, userId: min 1, role: owner|manager|reviewer|collector|viewer }
export const memberRemoveSchema;   // { organizationId: uuid, userId: min 1 }
export const projectCreateSchema;  // { organizationId: uuid, name: 2-120 trimmed }
export const schemaDraftSaveSchema; // { projectId: uuid, definition: z.unknown() — content validated by validateSchemaDefinition }
export const schemaPublishSchema;  // { projectId: uuid }
```

- [ ] **Step 1: Write the failing tests**

```typescript
// tests/platformRequestValidation.test.ts
import assert from "node:assert/strict";
import test from "node:test";
import {
  inviteAcceptSchema,
  inviteCreateSchema,
  orgCreateSchema,
  orgUpdateSchema,
  projectCreateSchema,
} from "../lib/server/platform/validation.js";
import { writePlatformAudit } from "../lib/server/platform/audit.js";

test("org create accepts valid name and slug", () => {
  const result = orgCreateSchema.safeParse({ name: "Acme Waste", slug: "acme-waste" });
  assert.equal(result.success, true);
});

test("org create rejects bad slug", () => {
  assert.equal(orgCreateSchema.safeParse({ name: "Acme", slug: "Acme Waste!" }).success, false);
  assert.equal(orgCreateSchema.safeParse({ name: "Acme", slug: "-bad" }).success, false);
});

test("invite create rejects owner role and normalizes email", () => {
  assert.equal(inviteCreateSchema.safeParse({
    organizationId: "5a2f8f18-0000-4000-8000-000000000000", email: "A@B.com", role: "owner",
  }).success, false);
  const ok = inviteCreateSchema.safeParse({
    organizationId: "5a2f8f18-0000-4000-8000-000000000000", email: "A@B.com", role: "collector",
  });
  assert.equal(ok.success, true);
  if (ok.success) assert.equal(ok.data.email, "a@b.com");
});

test("invite accept requires 64-hex token", () => {
  assert.equal(inviteAcceptSchema.safeParse({ token: "short" }).success, false);
  assert.equal(inviteAcceptSchema.safeParse({ token: "a".repeat(64) }).success, true);
});

test("org update validates accent color format", () => {
  const base = { organizationId: "5a2f8f18-0000-4000-8000-000000000000" };
  assert.equal(orgUpdateSchema.safeParse({ ...base, accentColor: "#c86b4a" }).success, true);
  assert.equal(orgUpdateSchema.safeParse({ ...base, accentColor: "red" }).success, false);
});

test("project create bounds name length", () => {
  const base = { organizationId: "5a2f8f18-0000-4000-8000-000000000000" };
  assert.equal(projectCreateSchema.safeParse({ ...base, name: "x" }).success, false);
  assert.equal(projectCreateSchema.safeParse({ ...base, name: "Bin census" }).success, true);
});

test("writePlatformAudit inserts scoped row and swallows failures", async () => {
  const calls: Array<{ text: string; values: unknown[] }> = [];
  await writePlatformAudit(
    { organizationId: "org-1", actorUserId: "u1", eventType: "org_created", payload: { slug: "acme" } },
    { queryFn: async (text, values = []) => { calls.push({ text, values }); return { rows: [], rowCount: 0 }; } },
  );
  assert.match(calls[0].text, /insert into public\.platform_audit_events/i);
  assert.equal(calls[0].values[0], "org-1");

  // failure path must not throw
  await writePlatformAudit(
    { organizationId: "org-1", actorUserId: "u1", eventType: "org_created" },
    { queryFn: async () => { throw new Error("db down"); } },
  );
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --import tsx --test tests/platformRequestValidation.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement both modules**

```typescript
// lib/server/platform/audit.ts
import { query } from "../db.js";
import { logError } from "../logger.js";
import type { StoreDeps } from "./orgStore.js";

export type PlatformAuditEventType =
  | "org_created"
  | "org_branding_updated"
  | "member_invited"
  | "invite_accepted"
  | "member_role_changed"
  | "member_removed"
  | "project_created"
  | "schema_draft_saved"
  | "schema_published";

export interface PlatformAuditEvent {
  organizationId: string;
  projectId?: string | null;
  actorUserId: string;
  eventType: PlatformAuditEventType;
  payload?: Record<string, unknown>;
}

export async function writePlatformAudit(event: PlatformAuditEvent, deps: StoreDeps = {}): Promise<void> {
  const run = deps.queryFn ?? (query as NonNullable<StoreDeps["queryFn"]>);
  try {
    await run(
      `INSERT INTO public.platform_audit_events (organization_id, project_id, actor_user_id, event_type, payload)
       VALUES ($1, $2, $3, $4, $5::jsonb)`,
      [event.organizationId, event.projectId ?? null, event.actorUserId, event.eventType, JSON.stringify(event.payload ?? {})],
    );
  } catch (error) {
    logError("platform audit write failed", { eventType: event.eventType, error });
  }
}
```

Note: check `lib/server/logger.ts` exports — it exposes `logError(message, context)`; if the signature differs, match it.

```typescript
// lib/server/platform/validation.ts
import { z } from "zod";

const uuid = z.string().uuid();
const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/;
const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;
const INVITE_TOKEN_PATTERN = /^[0-9a-f]{64}$/;
export const MAX_LOGO_DATA_URL_LENGTH = 800_000;

export const orgCreateSchema = z.object({
  name: z.string().trim().min(2).max(80),
  slug: z.string().regex(SLUG_PATTERN, "Slug must be lowercase letters, digits, and hyphens"),
});

export const orgUpdateSchema = z.object({
  organizationId: uuid,
  name: z.string().trim().min(2).max(80).optional(),
  accentColor: z.string().regex(HEX_COLOR_PATTERN, "Accent color must be #rrggbb").optional(),
  logoDataUrl: z.string().startsWith("data:image/").max(MAX_LOGO_DATA_URL_LENGTH).optional(),
  clearLogo: z.boolean().optional(),
});

export const inviteCreateSchema = z.object({
  organizationId: uuid,
  email: z.string().trim().toLowerCase().email(),
  role: z.enum(["manager", "reviewer", "collector", "viewer"]),
});

export const inviteAcceptSchema = z.object({
  token: z.string().regex(INVITE_TOKEN_PATTERN, "Invalid invite token"),
});

export const memberUpdateSchema = z.object({
  organizationId: uuid,
  userId: z.string().min(1),
  role: z.enum(["owner", "manager", "reviewer", "collector", "viewer"]),
});

export const memberRemoveSchema = z.object({
  organizationId: uuid,
  userId: z.string().min(1),
});

export const projectCreateSchema = z.object({
  organizationId: uuid,
  name: z.string().trim().min(2).max(120),
});

export const schemaDraftSaveSchema = z.object({
  projectId: uuid,
  definition: z.unknown(),
});

export const schemaPublishSchema = z.object({
  projectId: uuid,
});
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --import tsx --test tests/platformRequestValidation.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Typecheck and commit**

```bash
npm run typecheck
git add lib/server/platform/audit.ts lib/server/platform/validation.ts tests/platformRequestValidation.test.ts
git commit -m "feat(platform): audit writer and request validation schemas"
```

---

### Task 7: Invite tokens + invite email

**Files:**
- Create: `lib/server/platform/invites.ts`
- Test: `tests/platformInvites.test.ts`

**Interfaces:**
- Consumes: `sendTransactional`, `SendTransactionalParams` from `lib/server/email/provider.js`; store functions from Task 3.
- Produces (consumed by Task 8):

```typescript
export function createInviteToken(): { token: string; tokenHash: string }; // 32 random bytes hex; hash = sha256 hex
export function hashInviteToken(token: string): string;
export const INVITE_TTL_DAYS: number; // 7
export interface InviteEmailInput { orgName: string; role: string; joinUrl: string; invitedBy: string }
export function buildInviteEmail(input: InviteEmailInput): { subject: string; html: string; text: string }; // bilingual EN+FR in one email
export interface SendInviteDeps { sendFn?: typeof sendTransactional }
export function sendInviteEmail(input: InviteEmailInput & { email: string; idempotencyKey: string }, deps?: SendInviteDeps): Promise<void>;
```

- [ ] **Step 1: Write the failing tests**

```typescript
// tests/platformInvites.test.ts
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { buildInviteEmail, createInviteToken, hashInviteToken, sendInviteEmail } from "../lib/server/platform/invites.js";

test("createInviteToken returns 64-hex token and matching sha256 hash", () => {
  const { token, tokenHash } = createInviteToken();
  assert.match(token, /^[0-9a-f]{64}$/);
  assert.equal(tokenHash, createHash("sha256").update(token).digest("hex"));
  assert.equal(hashInviteToken(token), tokenHash);
});

test("tokens are unique across calls", () => {
  assert.notEqual(createInviteToken().token, createInviteToken().token);
});

test("invite email is bilingual and contains join link", () => {
  const email = buildInviteEmail({
    orgName: "Acme Waste", role: "collector",
    joinUrl: "https://console.example.com/join?token=abc", invitedBy: "owner@acme.com",
  });
  assert.match(email.subject, /Acme Waste/);
  assert.match(email.html, /https:\/\/console\.example\.com\/join\?token=abc/);
  assert.match(email.text, /https:\/\/console\.example\.com\/join\?token=abc/);
  assert.match(email.html, /invit/i);   // EN "invited" / FR "invité"
  assert.match(email.text, /rejoindre/i); // FR present
});

test("sendInviteEmail delegates to transactional provider with idempotency key", async () => {
  const sent: any[] = [];
  await sendInviteEmail(
    {
      email: "new@example.com", orgName: "Acme", role: "collector",
      joinUrl: "https://x.test/join?token=t", invitedBy: "boss@acme.com",
      idempotencyKey: "invite-inv-1",
    },
    { sendFn: async (params) => { sent.push(params); return { status: "sent", providerMessageId: "m1" }; } },
  );
  assert.equal(sent.length, 1);
  assert.equal(sent[0].recipient.email, "new@example.com");
  assert.equal(sent[0].idempotencyKey, "invite-inv-1");
  assert.equal(sent[0].emailClass, "transactional");
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --import tsx --test tests/platformInvites.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `lib/server/platform/invites.ts`**

```typescript
// lib/server/platform/invites.ts
// Invite token generation (only hashes are stored) and bilingual invite email.
import { createHash, randomBytes } from "node:crypto";
import { sendTransactional } from "../email/provider.js";

export const INVITE_TTL_DAYS = 7;

export function hashInviteToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function createInviteToken(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString("hex");
  return { token, tokenHash: hashInviteToken(token) };
}

export interface InviteEmailInput {
  orgName: string;
  role: string;
  joinUrl: string;
  invitedBy: string;
}

export function buildInviteEmail(input: InviteEmailInput): { subject: string; html: string; text: string } {
  const subject = `You're invited to join ${input.orgName} / Invitation à rejoindre ${input.orgName}`;
  const text = [
    `${input.invitedBy} invited you to join ${input.orgName} as ${input.role} on the ADL Data Operations Platform.`,
    `Accept the invitation: ${input.joinUrl}`,
    `This link expires in ${INVITE_TTL_DAYS} days.`,
    ``,
    `${input.invitedBy} vous a invité à rejoindre ${input.orgName} en tant que ${input.role} sur la plateforme ADL Data Operations.`,
    `Accepter l'invitation : ${input.joinUrl}`,
    `Ce lien expire dans ${INVITE_TTL_DAYS} jours.`,
  ].join("\n");
  const html = `
    <div style="font-family: system-ui, sans-serif; max-width: 560px; margin: 0 auto; color: #0f2b46;">
      <h2 style="color: #0f2b46;">${escapeHtml(input.orgName)}</h2>
      <p>${escapeHtml(input.invitedBy)} invited you to join <strong>${escapeHtml(input.orgName)}</strong>
        as <strong>${escapeHtml(input.role)}</strong> on the ADL Data Operations Platform.</p>
      <p><a href="${input.joinUrl}" style="display:inline-block;padding:12px 24px;background:#0f2b46;color:#ffffff;border-radius:12px;text-decoration:none;">Accept invitation</a></p>
      <hr style="border:none;border-top:1px solid #e3ebf2;margin:24px 0;" />
      <p>${escapeHtml(input.invitedBy)} vous a invité à rejoindre <strong>${escapeHtml(input.orgName)}</strong>
        en tant que <strong>${escapeHtml(input.role)}</strong>.</p>
      <p><a href="${input.joinUrl}" style="display:inline-block;padding:12px 24px;background:#c86b4a;color:#ffffff;border-radius:12px;text-decoration:none;">Accepter l'invitation</a></p>
      <p style="color:#5a708a;font-size:13px;">This link expires in ${INVITE_TTL_DAYS} days. / Ce lien expire dans ${INVITE_TTL_DAYS} jours.</p>
    </div>`;
  return { subject, html, text };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export interface SendInviteDeps {
  sendFn?: typeof sendTransactional;
}

export async function sendInviteEmail(
  input: InviteEmailInput & { email: string; idempotencyKey: string },
  deps: SendInviteDeps = {},
): Promise<void> {
  const sendFn = deps.sendFn ?? sendTransactional;
  const email = buildInviteEmail(input);
  await sendFn({
    recipient: { email: input.email, userId: null },
    templateId: "platform_org_invite",
    subject: email.subject,
    html: email.html,
    text: email.text,
    idempotencyKey: input.idempotencyKey,
    emailClass: "transactional",
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --import tsx --test tests/platformInvites.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Typecheck and commit**

```bash
npm run typecheck
git add lib/server/platform/invites.ts tests/platformInvites.test.ts
git commit -m "feat(platform): hashed invite tokens and bilingual invite email"
```

---

### Task 8: Platform API router

**Files:**
- Create: `lib/server/platform/api.ts`
- Test: `tests/platformApi.test.ts`

**Interfaces:**
- Consumes: everything from Tasks 2–7.
- Produces (consumed by Task 9):

```typescript
export interface PlatformApiDeps {
  // stores
  createOrganizationFn?; getOrganizationFn?; listOrganizationsForUserFn?; updateOrganizationBrandingFn?;
  getMembershipFn?; listMembersFn?; upsertMemberRoleFn?; removeMemberFn?;
  createInviteFn?; findInviteByTokenHashFn?; listInvitesFn?; markInviteAcceptedFn?;
  createProjectFn?; listProjectsFn?; getProjectFn?;
  getDraftSchemaFn?; saveDraftSchemaFn?; publishDraftSchemaFn?; getPublishedSchemaFn?; listSchemaVersionsFn?;
  // services
  requireUserFn?; sendInviteEmailFn?; writeAuditFn?; uploadLogoFn?; // uploadLogoFn: (dataUrl: string, organizationId: string) => Promise<string /* url */>
}
export function createPlatformHandler(deps?: PlatformApiDeps): (request: Request) => Promise<Response>;
```

**Views** (all under `GET|POST /api/user?view=platform_<name>`; body is JSON on POST; org/project ids in query on GET). The table below omits the `platform_` prefix for readability, but every view is implemented, dispatched, and requested WITH the prefix — `org_list` means `platform_org_list`:

| View | Method | Min role | Behavior |
|------|--------|----------|----------|
| `org_list` | GET | (any authed user) | orgs for current user via `listOrganizationsForUser` |
| `org_create` | POST | (any authed user) | validate `orgCreateSchema` → `createOrganization` → audit `org_created` → 201 |
| `org_get` | GET `organizationId` | viewer | `getOrganization` |
| `org_update` | POST | owner | validate `orgUpdateSchema`; if `logoDataUrl` call `uploadLogoFn` → logoUrl; if `clearLogo` → logoUrl null; `updateOrganizationBranding` → audit `org_branding_updated` |
| `org_members` | GET `organizationId` | manager | `listMembers` + `listInvites` → `{ members, invites }` |
| `member_update` | POST | owner | validate `memberUpdateSchema`; block demoting the LAST owner (fetch members, count owners) → `upsertMemberRole` → audit |
| `member_remove` | POST | owner | validate; block removing last owner → `removeMember` → audit |
| `invite_create` | POST | manager | validate `inviteCreateSchema` → `createInviteToken` → `createInvite` (expiry now + 7d) → `sendInviteEmailFn` (join URL: `${originOf(request)}/console.html#/join?token=${token}`) → audit `member_invited` → 201 `{ invite }` (never the token) |
| `invite_accept` | POST | (any authed user) | validate `inviteAcceptSchema` → `findInviteByTokenHash(hash)`; 404 if missing; 410 if expired or accepted → `upsertMemberRole` with invite role → `markInviteAccepted` → audit `invite_accepted` → `{ organizationId }` |
| `project_create` | POST | manager | validate `projectCreateSchema` → `createProject` → audit `project_created` → 201 |
| `project_list` | GET `organizationId` | viewer | `listProjects` |
| `schema_get` | GET `projectId` | viewer | `{ draft: getDraftSchema, published: getPublishedSchema, versions: listSchemaVersions }` |
| `schema_draft_save` | POST | manager | validate request; `validateSchemaDefinition(definition)` — on failure 422 `{ issues }` → `saveDraftSchema` → audit `schema_draft_saved` |
| `schema_publish` | POST | manager | require existing draft that passes `validateSchemaDefinition` (defense in depth) → `publishDraftSchema`; null → 409 `{ error: "No draft to publish" }` → audit `schema_published` |

Error contract: unknown view → 404; wrong method → 405; invalid JSON body → 400; zod failure → 400 with first issue message; `StorageUnavailableError` → 503 (wrap the whole dispatch in try/catch using `isStorageUnavailableError` — same as `api/leaderboard/index.ts`).

Authorization pattern per view: resolve org context FIRST via `requireOrgRole`/`requireProjectOrgRole` (with deps passthrough `{ requireUserFn, getMembershipFn, getProjectFn }`), return the failure Response as-is when `isTenancyFailure`.

- [ ] **Step 1: Write the failing tests** — cover at minimum:

```typescript
// tests/platformApi.test.ts
import assert from "node:assert/strict";
import test from "node:test";
import { createPlatformHandler } from "../lib/server/platform/api.js";

const OWNER = { id: "owner@acme.com", token: {}, role: "agent" as const };
const ORG = { id: "5a2f8f18-0000-4000-8000-000000000001", name: "Acme", slug: "acme", logoUrl: null, accentColor: null, createdAt: "" };
const PROJECT_ID = "5a2f8f18-0000-4000-8000-000000000002";

function jsonPost(view: string, body: unknown): Request {
  return new Request(`https://x.test/api/user?view=platform_${view}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function baseDeps(overrides: Record<string, unknown> = {}) {
  return {
    requireUserFn: async () => OWNER,
    getMembershipFn: async () => ({ organizationId: ORG.id, userId: OWNER.id, role: "owner" as const, createdAt: "" }),
    writeAuditFn: async () => {},
    ...overrides,
  };
}

test("unknown view returns 404", async () => {
  const handler = createPlatformHandler(baseDeps());
  const response = await handler(new Request("https://x.test/api/user?view=platform_nope"));
  assert.equal(response.status, 404);
});

test("org_create validates, creates, audits, returns 201", async () => {
  const audits: string[] = [];
  const handler = createPlatformHandler(baseDeps({
    createOrganizationFn: async () => ORG,
    writeAuditFn: async (event: { eventType: string }) => { audits.push(event.eventType); },
  }));
  const response = await handler(jsonPost("org_create", { name: "Acme", slug: "acme" }));
  assert.equal(response.status, 201);
  assert.deepEqual(audits, ["org_created"]);
});

test("org_create rejects invalid slug with 400", async () => {
  const handler = createPlatformHandler(baseDeps());
  const response = await handler(jsonPost("org_create", { name: "Acme", slug: "BAD SLUG" }));
  assert.equal(response.status, 400);
});

test("org_update requires owner: manager gets 403", async () => {
  const handler = createPlatformHandler(baseDeps({
    getMembershipFn: async () => ({ organizationId: ORG.id, userId: OWNER.id, role: "manager" as const, createdAt: "" }),
  }));
  const response = await handler(jsonPost("org_update", { organizationId: ORG.id, accentColor: "#c86b4a" }));
  assert.equal(response.status, 403);
});

test("cross-tenant org_get denied for non-member", async () => {
  const handler = createPlatformHandler(baseDeps({ getMembershipFn: async () => null }));
  const response = await handler(new Request(`https://x.test/api/user?view=platform_org_get&organizationId=${ORG.id}`));
  assert.equal(response.status, 403);
});

test("invite_create sends email with hashed-token invite and never leaks token", async () => {
  const sent: any[] = []; const created: any[] = [];
  const handler = createPlatformHandler(baseDeps({
    getOrganizationFn: async () => ORG,
    createInviteFn: async (input: any) => { created.push(input); return {
      id: "inv-1", organizationId: ORG.id, email: input.email, role: input.role,
      expiresAt: input.expiresAt.toISOString(), acceptedAt: null, createdAt: "",
    }; },
    sendInviteEmailFn: async (input: any) => { sent.push(input); },
  }));
  const response = await handler(jsonPost("invite_create", { organizationId: ORG.id, email: "new@x.com", role: "collector" }));
  assert.equal(response.status, 201);
  assert.match(created[0].tokenHash, /^[0-9a-f]{64}$/);
  assert.match(sent[0].joinUrl, /join\?token=[0-9a-f]{64}/);
  const body = await response.json();
  assert.equal(JSON.stringify(body).includes(created[0].tokenHash), false);
  assert.equal(/token=[0-9a-f]{64}/.test(JSON.stringify(body)), false);
});

test("invite_accept: expired invite gets 410", async () => {
  const handler = createPlatformHandler(baseDeps({
    findInviteByTokenHashFn: async () => ({
      id: "inv-1", organizationId: ORG.id, email: "new@x.com", role: "collector",
      expiresAt: "2020-01-01T00:00:00.000Z", acceptedAt: null, createdAt: "", tokenHash: "h",
    }),
  }));
  const response = await handler(jsonPost("invite_accept", { token: "a".repeat(64) }));
  assert.equal(response.status, 410);
});

test("invite_accept: valid invite adds membership and marks accepted", async () => {
  const roleUpserts: any[] = []; const accepted: any[] = [];
  const future = new Date(Date.now() + 86_400_000).toISOString();
  const handler = createPlatformHandler(baseDeps({
    findInviteByTokenHashFn: async () => ({
      id: "inv-1", organizationId: ORG.id, email: "new@x.com", role: "collector",
      expiresAt: future, acceptedAt: null, createdAt: "", tokenHash: "h",
    }),
    upsertMemberRoleFn: async (input: any) => { roleUpserts.push(input); },
    markInviteAcceptedFn: async (input: any) => { accepted.push(input); },
  }));
  const response = await handler(jsonPost("invite_accept", { token: "a".repeat(64) }));
  assert.equal(response.status, 200);
  assert.equal(roleUpserts[0].role, "collector");
  assert.equal(accepted[0].inviteId, "inv-1");
});

test("member_remove blocks removing the last owner", async () => {
  const handler = createPlatformHandler(baseDeps({
    listMembersFn: async () => [{ organizationId: ORG.id, userId: OWNER.id, role: "owner" as const, createdAt: "" }],
  }));
  const response = await handler(jsonPost("member_remove", { organizationId: ORG.id, userId: OWNER.id }));
  assert.equal(response.status, 409);
});

test("schema_draft_save returns 422 with issues for invalid definition", async () => {
  const handler = createPlatformHandler(baseDeps({
    getProjectFn: async () => ({ id: PROJECT_ID, organizationId: ORG.id, name: "p", status: "draft" as const, createdAt: "" }),
  }));
  const response = await handler(jsonPost("schema_draft_save", { projectId: PROJECT_ID, definition: { recordTypes: [] } }));
  assert.equal(response.status, 422);
  const body = await response.json();
  assert.ok(Array.isArray(body.issues));
});

test("schema_publish with no draft returns 409", async () => {
  const handler = createPlatformHandler(baseDeps({
    getProjectFn: async () => ({ id: PROJECT_ID, organizationId: ORG.id, name: "p", status: "draft" as const, createdAt: "" }),
    getDraftSchemaFn: async () => null,
  }));
  const response = await handler(jsonPost("schema_publish", { projectId: PROJECT_ID }));
  assert.equal(response.status, 409);
});

test("unauthenticated request gets 401 on every view", async () => {
  const handler = createPlatformHandler({ requireUserFn: async () => null });
  for (const view of ["org_list", "org_create", "invite_accept"]) {
    const response = await handler(jsonPost(view, {}));
    assert.equal(response.status, 401, view);
  }
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --import tsx --test tests/platformApi.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `lib/server/platform/api.ts`**

Structure (follow `pointOperatorApi.ts` conventions — file header comment listing views, deps object with defaults, one function per view):

```typescript
// lib/server/platform/api.ts
import { requireUser } from "../../auth.js";
import { isStorageUnavailableError } from "../db.js";
import { errorResponse, jsonResponse } from "../http.js";
import { validateSchemaDefinition } from "../../../shared/platformSchema.js";
import * as orgStore from "./orgStore.js";
import * as projectStore from "./projectStore.js";
import { writePlatformAudit } from "./audit.js";
import { createInviteToken, hashInviteToken, INVITE_TTL_DAYS, sendInviteEmail } from "./invites.js";
import { isTenancyFailure, requireOrgRole, requireProjectOrgRole } from "./tenancy.js";
import {
  inviteAcceptSchema, inviteCreateSchema, memberRemoveSchema, memberUpdateSchema,
  orgCreateSchema, orgUpdateSchema, projectCreateSchema, schemaDraftSaveSchema, schemaPublishSchema,
} from "./validation.js";
```

Key mechanics the engineer must implement exactly:

1. `createPlatformHandler(deps)` resolves every dep with a default (e.g. `const createOrganizationFn = deps.createOrganizationFn ?? orgStore.createOrganization;`), returns `async (request) => Response`.
2. Dispatch: `const view = new URL(request.url).searchParams.get("view")`; a `Record<string, { method: "GET" | "POST"; handler: (request: Request) => Promise<Response> }>` map whose keys are the FULL prefixed names (`platform_org_create`, `platform_invite_accept`, …); unknown view → 404 `errorResponse("Unknown view", 404)`; method mismatch → 405.
3. Wrap dispatch in try/catch: `isStorageUnavailableError(error)` → 503, else rethrow.
4. JSON body helper: `async function readJson(request) { try { return await request.json(); } catch { return null; } }` — null body → 400.
5. Zod helper: `parse(schema, body)` → `{ data }` or 400 Response with `result.error.issues[0].message`.
6. Tenancy deps passthrough: every `requireOrgRole` call receives `{ requireUserFn, getMembershipFn, getProjectFn }` from resolved deps so tests can stub them.
7. `invite_create` join URL: `const origin = new URL(request.url).origin; const joinUrl = \`${origin}/console.html#/join?token=${token}\`;`
8. Last-owner protection (member_update demoting an owner, member_remove removing an owner): `const owners = (await listMembersFn(organizationId)).filter((m) => m.role === "owner"); if (owners.length === 1 && owners[0].userId === targetUserId) return errorResponse("Cannot remove the last owner", 409, { code: "last_owner" });`
9. `org_update` logo: default `uploadLogoFn` imports `put` from `@vercel/blob` — path `platform/logos/${organizationId}.png`, `{ access: "public", addRandomSuffix: true }`, decode data URL to Buffer. Tests always stub `uploadLogoFn`.
10. `invite_accept` is available to ANY authenticated user (no org membership yet — that is the point). It uses `requireUserFn` directly, not `requireOrgRole`.
11. Every mutating view calls `writeAuditFn` after success with the matching `PlatformAuditEventType`.
12. `schema_publish`: fetch draft via `getDraftSchemaFn`; 409 if null; run `validateSchemaDefinition(draft.definition)`; 422 with issues if invalid; then `publishDraftSchemaFn`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --import tsx --test tests/platformApi.test.ts`
Expected: PASS (13 tests).

- [ ] **Step 5: Run full suite, typecheck, commit**

```bash
npm run typecheck && npm test
git add lib/server/platform/api.ts tests/platformApi.test.ts
git commit -m "feat(platform): view-dispatch API router with tenant guard on every view"
```

---

### Task 9: Wire platform views into `api/user/index.ts` (NO new route file)

**Files:**
- Modify: `api/user/index.ts` (early delegation, ~5 lines — same hook the `po_*` views use)
- Test: `tests/platformRouteDelegation.test.ts`

**Interfaces:**
- Consumes: `createPlatformHandler` from Task 8.

Vercel Hobby cap is 12 deployment functions and the repo is AT the cap. Do NOT create any file under `api/`.

- [ ] **Step 1: Read `api/user/index.ts`** — find where the `po_` view prefix is detected and delegated to `createPointOperatorHandler` (near the top of the GET/POST handlers). The platform delegation goes in the same place with the same shape.

- [ ] **Step 2: Write the failing test**

```typescript
// tests/platformRouteDelegation.test.ts
import assert from "node:assert/strict";
import test from "node:test";
import { isPlatformView } from "../lib/server/platform/api.js";

test("platform_ prefixed views are recognized", () => {
  assert.equal(isPlatformView("platform_org_create"), true);
  assert.equal(isPlatformView("platform_org_list"), true);
  assert.equal(isPlatformView("po_me"), false);
  assert.equal(isPlatformView(null), false);
  assert.equal(isPlatformView("status"), false);
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `node --import tsx --test tests/platformRouteDelegation.test.ts`
Expected: FAIL — `isPlatformView` not exported.

- [ ] **Step 4: Add `isPlatformView` to `lib/server/platform/api.ts`**

```typescript
export function isPlatformView(view: string | null): boolean {
  return typeof view === "string" && view.startsWith("platform_");
}
```

- [ ] **Step 5: Delegate in `api/user/index.ts`** — in BOTH the GET and POST entry points, mirroring the existing `po_` delegation:

```typescript
import { createPlatformHandler, isPlatformView } from "../../lib/server/platform/api.js";

const platformHandler = createPlatformHandler();

// inside GET and POST, before other view handling, next to the po_ delegation:
const view = url.searchParams.get("view");
if (isPlatformView(view)) {
  return platformHandler(request);
}
```

Match the file's existing structure exactly — if the `po_` delegation reads the view from an already-parsed URL, reuse that variable rather than re-parsing.

- [ ] **Step 6: Run tests + budget**

Run: `node --import tsx --test tests/platformRouteDelegation.test.ts && npm run check:function-budget`
Expected: test PASS; budget unchanged at `route files: 12` — green.

- [ ] **Step 7: Full suite + commit**

```bash
npm run typecheck && npm test && npm run check:function-budget
git add api/user/index.ts lib/server/platform/api.ts tests/platformRouteDelegation.test.ts
git commit -m "feat(platform): fold platform_* views into /api/user (Hobby 12-function cap)"
```

---

### Task 10: Client API wrapper

**Files:**
- Create: `lib/client/platformApi.ts`
- Test: `tests/platformClientApi.test.ts`

**Interfaces:**
- Consumes: `apiJson` from `lib/client/api.ts` — read that file first and reuse its fetch conventions (`credentials: 'include'`). If `apiJson` doesn't accept POST bodies, use `apiFetch` + JSON.parse like other client modules do.
- Produces (consumed by Tasks 12–16): typed functions, one per view:

```typescript
export interface PlatformApiDeps { fetchFn?: typeof fetch }
export function listMyOrganizations(deps?): Promise<Array<PlatformOrganization & { role: PlatformRole }>>;
export function createOrganizationRequest(input: { name: string; slug: string }, deps?): Promise<PlatformOrganization>;
export function getOrganizationRequest(organizationId: string, deps?): Promise<PlatformOrganization>;
export function updateOrganizationRequest(input: { organizationId: string; name?: string; accentColor?: string; logoDataUrl?: string; clearLogo?: boolean }, deps?): Promise<PlatformOrganization>;
export function listOrgMembersRequest(organizationId: string, deps?): Promise<{ members: PlatformMembership[]; invites: PlatformInvite[] }>;
export function createInviteRequest(input: { organizationId: string; email: string; role: string }, deps?): Promise<PlatformInvite>;
export function acceptInviteRequest(token: string, deps?): Promise<{ organizationId: string }>;
export function updateMemberRequest(input: { organizationId: string; userId: string; role: PlatformRole }, deps?): Promise<void>;
export function removeMemberRequest(input: { organizationId: string; userId: string }, deps?): Promise<void>;
export function createProjectRequest(input: { organizationId: string; name: string }, deps?): Promise<PlatformProject>;
export function listProjectsRequest(organizationId: string, deps?): Promise<PlatformProject[]>;
export function getSchemaRequest(projectId: string, deps?): Promise<{ draft: PlatformSchemaVersion | null; published: PlatformSchemaVersion | null; versions: PlatformSchemaVersion[] }>;
export function saveSchemaDraftRequest(input: { projectId: string; definition: PlatformSchemaDefinition }, deps?): Promise<PlatformSchemaVersion>;
export function publishSchemaRequest(projectId: string, deps?): Promise<PlatformSchemaVersion>;
export class PlatformApiError extends Error { status: number; issues?: SchemaValidationIssue[] }
```

Error handling: non-2xx → throw `PlatformApiError` with `status`, message from body `error`, and `issues` when the body carries them (422 from schema_draft_save/schema_publish). UI tasks rely on `error.issues`.

- [ ] **Step 1: Write failing tests** — stub `fetchFn`; assert: correct URL `\`/api/user?view=platform_org_create\``, method POST, `credentials: "include"`, JSON body; 422 response → thrown `PlatformApiError` with `issues` array; 403 → thrown with status 403. Model the test file on `tests/apiClient.test.ts` (read it first).

- [ ] **Step 2: Run to verify failure** — `node --import tsx --test tests/platformClientApi.test.ts` → module not found.

- [ ] **Step 3: Implement** — a private helper:

```typescript
async function callPlatform<T>(view: string, options: { method: "GET" | "POST"; body?: unknown; params?: Record<string, string> }, deps: PlatformApiDeps = {}): Promise<T> {
  const fetchFn = deps.fetchFn ?? fetch;
  const search = new URLSearchParams({ view: `platform_${view}`, ...(options.params ?? {}) });
  const response = await fetchFn(`/api/user?${search.toString()}`, {
    method: options.method,
    credentials: "include",
    headers: options.body !== undefined ? { "content-type": "application/json" } : undefined,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new PlatformApiError(payload.error ?? `Request failed (${response.status})`, response.status);
    if (Array.isArray(payload.issues)) error.issues = payload.issues;
    throw error;
  }
  return payload as T;
}
```

Each exported function is a one-liner over `callPlatform`.

- [ ] **Step 4: Run tests to verify they pass**, then:

```bash
npm run typecheck
git add lib/client/platformApi.ts tests/platformClientApi.test.ts
git commit -m "feat(platform): typed client API wrapper"
```

---

### Task 11: Console state logic (wizard + schema builder reducers)

**Files:**
- Create: `lib/client/consoleState.ts`
- Test: `tests/platformConsoleState.test.ts`

Pure logic extracted from UI so node:test covers it (repo convention: `pointOperatorUi.ts` + `tests/pointOperatorUiState.test.ts`).

**Interfaces:**
- Produces (consumed by Tasks 13–16):

```typescript
// Screen navigation
export type ConsoleScreen = "LOADING" | "AUTH_REQUIRED" | "ONBOARDING" | "PROJECTS" | "SCHEMA_BUILDER" | "MEMBERS" | "SETTINGS" | "JOIN";
export interface ConsoleRoute { screen: ConsoleScreen; projectId?: string; joinToken?: string }
export function parseConsoleHash(hash: string): ConsoleRoute; // "#/join?token=x" → JOIN; "#/projects/<id>/schema" → SCHEMA_BUILDER; "" → PROJECTS
export function consoleRouteToHash(route: ConsoleRoute): string;

// Onboarding wizard state machine
export type WizardStep = "org" | "project" | "record_type" | "invite" | "done";
export interface WizardState {
  step: WizardStep;
  orgName: string; orgSlug: string; slugTouched: boolean;
  projectName: string;
  recordTypeLabelEn: string; recordTypeLabelFr: string;
  inviteEmail: string; inviteRole: "manager" | "reviewer" | "collector" | "viewer";
  organizationId: string | null; projectId: string | null;
}
export const initialWizardState: WizardState;
export type WizardAction =
  | { type: "SET_FIELD"; field: keyof WizardState; value: string }
  | { type: "ORG_CREATED"; organizationId: string }
  | { type: "PROJECT_CREATED"; projectId: string }
  | { type: "RECORD_TYPE_SAVED" }
  | { type: "INVITE_SENT_OR_SKIPPED" };
export function wizardReducer(state: WizardState, action: WizardAction): WizardState;
export function slugFromName(name: string): string; // "Acme Waste!" → "acme-waste"
export function wizardStepValid(state: WizardState): boolean;
// Builds a minimal one-record-type definition from wizard inputs (one required text field "name" + GPS+1 photo evidence)
export function wizardRecordTypeDefinition(state: WizardState): PlatformSchemaDefinition;

// Schema builder editing state (operates directly on PlatformSchemaDefinition)
export type BuilderAction =
  | { type: "ADD_RECORD_TYPE" } | { type: "REMOVE_RECORD_TYPE"; typeIndex: number }
  | { type: "SET_TYPE_LABEL"; typeIndex: number; lang: "en" | "fr"; value: string }
  | { type: "SET_TYPE_KEY"; typeIndex: number; value: string }
  | { type: "ADD_FIELD"; typeIndex: number } | { type: "REMOVE_FIELD"; typeIndex: number; fieldIndex: number }
  | { type: "UPDATE_FIELD"; typeIndex: number; fieldIndex: number; patch: Partial<PlatformFieldDefinition> }
  | { type: "ADD_OPTION"; typeIndex: number; fieldIndex: number }
  | { type: "UPDATE_OPTION"; typeIndex: number; fieldIndex: number; optionIndex: number; patch: Partial<PlatformFieldOption> }
  | { type: "REMOVE_OPTION"; typeIndex: number; fieldIndex: number; optionIndex: number }
  | { type: "UPDATE_EVIDENCE"; typeIndex: number; patch: Partial<PlatformEvidenceRules> };
export function builderReducer(definition: PlatformSchemaDefinition, action: BuilderAction): PlatformSchemaDefinition; // immutable updates
export function emptyRecordType(index: number): PlatformRecordType; // key `record_type_${index+1}`, empty labels, one empty text field, default evidence {gpsRequired:true, minPhotos:0, notesRequired:false}
export function emptyField(index: number): PlatformFieldDefinition;
```

- [ ] **Step 1: Write failing tests** covering: `parseConsoleHash` for all route shapes (`""`, `"#/join?token=abc"`, `"#/projects/p1/schema"`, `"#/members"`, `"#/settings"`, `"#/onboarding"`, garbage → PROJECTS); `slugFromName` (accents stripped, spaces → hyphens, length clamp 40); wizard happy path org→project→record_type→invite→done; `SET_FIELD orgName` auto-derives slug until `slugTouched`; `wizardStepValid` false on empty required inputs; `wizardRecordTypeDefinition` passes `validateSchemaDefinition`; builder reducer immutability (`assert.notEqual(result, input)` and deep changes applied); ADD/REMOVE/UPDATE for types, fields, options, evidence.

- [ ] **Step 2: Verify failure** — module not found.

- [ ] **Step 3: Implement.** Notes: `slugFromName` = lowercase → `normalize("NFD")` strip diacritics → non-alphanumeric runs → `-` → trim `-` → slice(0, 40). Reducers use structured spread copies, never mutate. `parseConsoleHash` tolerates missing `#/` prefix and unknown paths (default PROJECTS).

- [ ] **Step 4: Run tests, verify pass.**

- [ ] **Step 5:**

```bash
npm run typecheck
git add lib/client/consoleState.ts tests/platformConsoleState.test.ts
git commit -m "feat(platform): console routing, wizard, and schema-builder state logic"
```

---

### Task 12: Console Vite entry + app shell

**Files:**
- Create: `console.html`
- Create: `console.tsx`
- Create: `components/Console/ConsoleApp.tsx`
- Create: `components/Console/ConsoleShell.tsx`
- Modify: `vite.config.ts` (add `build.rollupOptions.input`)

**Interfaces:**
- Consumes: `parseConsoleHash`, `ConsoleRoute` (Task 11), `listMyOrganizations` (Task 10), existing session helper from `lib/client/auth.ts` (read it first for the exact export — it exposes a session fetcher used by `App.tsx`).
- Produces: `ConsoleShell` props consumed by Tasks 13–16:

```typescript
interface ConsoleShellProps {
  organization: (PlatformOrganization & { role: PlatformRole }) | null;
  organizations: Array<PlatformOrganization & { role: PlatformRole }>;
  onSelectOrganization: (organizationId: string) => void;
  route: ConsoleRoute;
  onNavigate: (route: ConsoleRoute) => void;
  language: "en" | "fr";
  onToggleLanguage: () => void;
  children: React.ReactNode;
}
```

- [ ] **Step 1: `console.html`** — copy `index.html` structure (read it first for font links / meta), change title to `ADL Console`, script `src="/console.tsx"`.

- [ ] **Step 2: `vite.config.ts`** — add to the returned config object:

```typescript
build: {
  rollupOptions: {
    input: {
      main: path.resolve(__dirname, 'index.html'),
      console: path.resolve(__dirname, 'console.html'),
    },
  },
},
```

- [ ] **Step 3: `console.tsx`** — mirror the existing `index.tsx` bootstrap (read it: Sentry init, StrictMode, ErrorBoundary, `index.css` import) but render `<ConsoleApp />`.

- [ ] **Step 4: `ConsoleApp.tsx`** — owns: session check (unauthenticated → `AUTH_REQUIRED` screen linking to `/` field app to sign in, since auth screens live there); `organizations` via `listMyOrganizations()`; selected org in `localStorage("adl_console_org")`; `route` state synced with `window.location.hash` (hashchange listener → `parseConsoleHash`); language in `localStorage("adl_language")` (same key the field app uses — read `App.tsx` to confirm the key and reuse it verbatim); zero orgs → force ONBOARDING; renders screen components inside `ConsoleShell` (Tasks 13–16 fill in real screens; until then render placeholder `<div>` for each).

- [ ] **Step 5: `ConsoleShell.tsx`** — desktop layout: left sidebar (org logo or letter-initial in navy→terra gradient circle, org switcher `<select>`, nav items Projects / Members / Settings with `micro-label` styling, language toggle EN/FR at bottom), main content area `max-w-5xl mx-auto p-6`. Accent color: `style={{ "--org-accent": organization?.accentColor ?? "#c86b4a" }}` on the root div. Use existing tokens (`bg-page`, `text-ink`, `.card`) — client register: premium, data-forward, no gamification.

- [ ] **Step 6: Verify**

```bash
npm run typecheck && npm run build
```
Expected: build emits both `dist/index.html` and `dist/console.html`. Then start `npm run dev`, open `http://localhost:5173/console.html`, confirm shell renders (AUTH_REQUIRED or shell with placeholder).

- [ ] **Step 7: Commit**

```bash
git add console.html console.tsx components/Console/ vite.config.ts
git commit -m "feat(platform): console entry point and desktop shell"
```

---

### Task 13: Onboarding wizard screen

**Files:**
- Create: `components/Console/OnboardingWizard.tsx`
- Modify: `components/Console/ConsoleApp.tsx` (wire ONBOARDING screen)

**Interfaces:**
- Consumes: `wizardReducer`, `initialWizardState`, `wizardStepValid`, `slugFromName`, `wizardRecordTypeDefinition` (Task 11); `createOrganizationRequest`, `createProjectRequest`, `saveSchemaDraftRequest`, `publishSchemaRequest`, `createInviteRequest` (Task 10).
- Produces: `<OnboardingWizard language onDone={(organizationId) => void} />`.

- [ ] **Step 1: Implement.** Four steps with a progress indicator (`1 Organization → 2 Project → 3 Record type → 4 Team`), each step a `.card` with `btn-primary` continue button disabled until `wizardStepValid`:
  1. **Organization**: name input; slug input auto-filled from `slugFromName(name)` until user edits (dispatch `slugTouched`); submit → `createOrganizationRequest` → dispatch `ORG_CREATED`.
  2. **Project**: name → `createProjectRequest` → `PROJECT_CREATED`.
  3. **Record type**: EN + FR label inputs; explainer copy `t("What will your team record in the field? You can refine fields later.", "Que va enregistrer votre équipe sur le terrain ? Vous pourrez affiner les champs plus tard.")`; submit → `saveSchemaDraftRequest(wizardRecordTypeDefinition(state))` then `publishSchemaRequest` → `RECORD_TYPE_SAVED`.
  4. **Team**: email + role select, `createInviteRequest`, or "Skip for now" ghost button → `INVITE_SENT_OR_SKIPPED`.
  On `done`: call `onDone(organizationId)` → ConsoleApp selects the org and navigates to PROJECTS.
  Errors: catch `PlatformApiError`, show message in a `text-danger` line under the form; slug conflict (500/409 from unique violation) shows `t("This workspace URL is taken", "Cette URL d'espace est déjà prise")`.

- [ ] **Step 2: Verify** — `npm run typecheck && npm run build`; in `npm run dev`, walk the wizard against the dev API (requires local session; if no local DB, verify rendering and step transitions with network errors surfaced, not swallowed).

- [ ] **Step 3: Commit**

```bash
git add components/Console/OnboardingWizard.tsx components/Console/ConsoleApp.tsx
git commit -m "feat(platform): onboarding wizard (org → project → record type → invite)"
```

---

### Task 14: Schema builder screen

**Files:**
- Create: `components/Console/SchemaBuilder.tsx`
- Create: `components/Console/ProjectsScreen.tsx`
- Modify: `components/Console/ConsoleApp.tsx` (wire PROJECTS + SCHEMA_BUILDER)

**Interfaces:**
- Consumes: `builderReducer`, `emptyRecordType`, `emptyField` (Task 11); `validateSchemaDefinition` (Task 2); `getSchemaRequest`, `saveSchemaDraftRequest`, `publishSchemaRequest`, `listProjectsRequest`, `createProjectRequest` (Task 10).

- [ ] **Step 1: `ProjectsScreen.tsx`** — list projects as `.card` rows (name, status pill, created date), "New project" button (inline name prompt → `createProjectRequest`), row click → `onNavigate({ screen: "SCHEMA_BUILDER", projectId })`.

- [ ] **Step 2: `SchemaBuilder.tsx`** — load `getSchemaRequest(projectId)`; editing state = `draft?.definition ?? published?.definition ?? { recordTypes: [emptyRecordType(0)] }` in a `useReducer(builderReducer, …)`. Layout: left column = record type list + "Add record type"; main column = selected type editor (key, EN/FR labels, fields table with per-field type select / required toggle / options editor for selects / min-max for numbers, evidence panel: GPS toggle + accuracy, min photos stepper 0–10, notes toggle). Footer bar: live `validateSchemaDefinition` issue list (path + message, `text-danger`), "Save draft" (`btn-ghost`, calls `saveSchemaDraftRequest`, allowed even with issues? NO — server returns 422; disable when invalid and show issues), "Publish version N" (`btn-primary`, confirms with version number from `versions`, calls `publishSchemaRequest`). Show published-version history list (version, date) under the footer. All copy via `t(en, fr)`.

- [ ] **Step 3: Verify** — `npm run typecheck && npm run build`; dev-run: create record types, watch validation issues live, save + publish against local API if DB available.

- [ ] **Step 4: Commit**

```bash
git add components/Console/SchemaBuilder.tsx components/Console/ProjectsScreen.tsx components/Console/ConsoleApp.tsx
git commit -m "feat(platform): projects list and schema builder with live validation"
```

---

### Task 15: Members screen + join flow

**Files:**
- Create: `components/Console/MembersScreen.tsx`
- Create: `components/Console/JoinScreen.tsx`
- Modify: `components/Console/ConsoleApp.tsx` (wire MEMBERS + JOIN)

**Interfaces:**
- Consumes: `listOrgMembersRequest`, `createInviteRequest`, `updateMemberRequest`, `removeMemberRequest`, `acceptInviteRequest` (Task 10).

- [ ] **Step 1: `MembersScreen.tsx`** — members table (user id/email, role select bound to `updateMemberRequest`, remove button with confirm); pending invites section (email, role, expiry, `accepted` state); invite form (email + role select + `btn-cta` send → `createInviteRequest`). Role select disabled for self and when viewer's own role < owner (pass `role` from shell org context). Surface 409 `last_owner` error as `t("An organization needs at least one owner", "Une organisation doit avoir au moins un propriétaire")`.

- [ ] **Step 2: `JoinScreen.tsx`** — reads `route.joinToken`; if session absent, show sign-in prompt linking to `/` with `t("Sign in first, then reopen your invite link", "Connectez-vous d'abord, puis rouvrez votre lien d'invitation")`; else call `acceptInviteRequest(token)` on mount (guard double-fire with a ref); success → select org, navigate PROJECTS, show success banner; 410 → `t("This invitation has expired", "Cette invitation a expiré")`; 404 → invalid-link message.

- [ ] **Step 3: Verify** — `npm run typecheck && npm run build`.

- [ ] **Step 4: Commit**

```bash
git add components/Console/MembersScreen.tsx components/Console/JoinScreen.tsx components/Console/ConsoleApp.tsx
git commit -m "feat(platform): members management and invite join flow"
```

---

### Task 16: Branding settings screen

**Files:**
- Create: `components/Console/SettingsScreen.tsx`
- Modify: `components/Console/ConsoleApp.tsx` (wire SETTINGS; refresh org after save)

**Interfaces:**
- Consumes: `updateOrganizationRequest` (Task 10); shell accent-color CSS variable (Task 12).

- [ ] **Step 1: Implement.** `.card` sections:
  1. **Workspace name** — text input + save.
  2. **Logo** — current logo (or letter-initial fallback), file input `accept="image/png,image/jpeg"`; client-side: reject > 1 MB with message; `FileReader.readAsDataURL` → `updateOrganizationRequest({ logoDataUrl })`; remove button → `{ clearLogo: true }`.
  3. **Accent color** — `<input type="color">` + hex text input (validate `#rrggbb`), live preview swatch on the sidebar via the `--org-accent` variable; save → `updateOrganizationRequest({ accentColor })`.
  Owner-only: if shell role ≠ owner, render read-only with `t("Only owners can change workspace settings", "Seuls les propriétaires peuvent modifier les paramètres")`.

- [ ] **Step 2: Verify** — `npm run typecheck && npm run build`; dev-run: change accent, confirm sidebar updates after save.

- [ ] **Step 3: Commit**

```bash
git add components/Console/SettingsScreen.tsx components/Console/ConsoleApp.tsx
git commit -m "feat(platform): workspace branding settings"
```

---

### Task 17: Stage gate — full verification

**Files:** none new.

- [ ] **Step 1: Full CI suite**

Run: `npm run test:ci`
Expected: lint, typecheck, all node tests, publisher tests, function budget, and build ALL pass. Fix anything red before proceeding.

- [ ] **Step 2: Cross-tenant grep audit** — verify no platform store query escaped the isolation contract:

Run: `grep -n "FROM public.platform_" lib/server/platform/*.ts | grep -viv "organization_id\|token_hash\|WHERE id ="`
Manually confirm every SELECT/UPDATE/DELETE on tenant tables filters by `organization_id` (exceptions: `platform_organizations` by primary key, invites by `token_hash`, `getProject` by id — each feeds the tenancy guard).

- [ ] **Step 3: Record follow-ups in bd**

```bash
bd create --title="Platform Stage 2: dynamic mobile forms + collection loop" --description="Spec docs/superpowers/specs/2026-07-16-data-operations-platform-mvp-design.md section 8/11 stage 2. Blocked on Stage 1." --type=feature --priority=1
bd create --title="Platform Stage 3: records/map/exports/dashboard + Douala waste demo + deck" --description="Spec section 10/11 stage 3. Blocked on Stage 2." --type=feature --priority=1
bd create --title="Platform: e2e smoke for console (wizard→publish→invite)" --description="Playwright smoke covering onboarding wizard, schema publish, invite accept, cross-tenant denial. e2e/smoke/." --type=task --priority=2
```

- [ ] **Step 4: Push**

```bash
git pull --rebase && bd dolt push && git push && git status
```
Expected: `up to date with origin`.

---

## Self-Review Notes (already applied)

- Spec coverage: Stage 1 items (migrations, guard, console entry, wizard, schema builder, branding, invites/members) each map to Tasks 1–16; audit log → Task 6; EN/FR → Tasks 7, 13–16; audit events wired in Task 8 view table. Zones/assignments, dynamic forms, review queue, exports, dashboard, demo seed = Stages 2–3 (tracked in bd, Task 17).
- Type consistency: `PlatformRole`, `StoreDeps`, `QueryFn`, `OrgContext`, store function names identical across Tasks 3–10.
- Deviation from spec recorded: `platform_` table prefix (Global Constraints).
- Known risk: Vercel Hobby 12-function cap — platform rides `/api/user?view=platform_*`; Stage 2's submission endpoint must reuse the same delegation, never a new route file.
