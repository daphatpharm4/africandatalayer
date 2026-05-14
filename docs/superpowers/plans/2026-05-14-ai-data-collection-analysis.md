# AI Data Collection, Analysis, and POI Enrichment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first production-safe AI layer for ADL: POI candidates, field capture copilot, admin review assistant, and client analysis assistant.

**Architecture:** Add typed AI contracts under `lib/server/ai/`, a policy-safe POI candidate pipeline under `lib/server/poi/`, and small API endpoints that reuse existing auth, rate-limit, storage, validation, dedup, risk, snapshot, and spatial-intelligence patterns. External POIs remain unverified leads until admin or field verification promotes them to `point_events`.

**Tech Stack:** TypeScript, Zod, Node native tests (`node --import tsx --test`), Postgres migrations, existing Gemini client pattern, existing `apiJson`, existing `bd` issue tracking.

**Spec:** `docs/superpowers/specs/2026-05-14-ai-data-collection-analysis-design.md`

**Tracking issue:** `africandatalayer-rgk`

---

## Scope

This plan implements a thin but complete vertical slice for all approved AI tracks:

- Shared AI contracts, redaction, and audit metadata.
- OSM/manual POI candidate normalization, matching, admin review, assignment, and promotion.
- Field capture copilot API plus editable suggestions in `ContributionFlow`.
- Admin review summary API plus AdminQueue summary panel.
- Client analytics query/report API plus DeltaDashboard analyst panel.

The first release uses deterministic mocked-model tests and provider injection. Real model calls are behind one `modelClient` boundary so production can start with Gemini and tests stay stable.

---

## File Structure

### Create

```text
lib/server/ai/modelClient.ts
lib/server/ai/outputSchemas.ts
lib/server/ai/redaction.ts
lib/server/ai/audit.ts
lib/server/ai/extractSubmissionFields.ts
lib/server/ai/reviewAssistant.ts
lib/server/ai/analyticsAssistant.ts
lib/server/poi/sourceAdapters/osmOverpass.ts
lib/server/poi/sourceAdapters/manualCsv.ts
lib/server/poi/normalizePoi.ts
lib/server/poi/candidateMatcher.ts
lib/server/poi/candidateScoring.ts
lib/server/poi/promoteCandidate.ts
api/ai/extract-submission.ts
api/ai/review-summary.ts
api/ai/analytics-query.ts
api/ai/report-draft.ts
api/poi/import/osm.ts
api/poi/candidates/index.ts
api/poi/candidates/[id].ts
api/poi/candidates/[id]/promote.ts
api/poi/candidates/[id]/assign.ts
supabase/migrations/20260514_ai_and_poi_foundation.sql
tests/aiContracts.test.ts
tests/aiRedaction.test.ts
tests/poiNormalize.test.ts
tests/poiMatcher.test.ts
tests/poiPromotion.test.ts
tests/aiExtractSubmission.test.ts
tests/aiReviewAssistant.test.ts
tests/aiAnalyticsAssistant.test.ts
```

### Modify

```text
shared/types.ts
lib/server/validation.ts
components/Screens/ContributionFlow.tsx
components/Screens/AdminQueue.tsx
components/Screens/DeltaDashboard.tsx
lib/client/ai.ts
docs/ai-spatial-intelligence-reporting.md
```

---

## Milestones

- **M1 - Contracts and persistence:** migrations, shared types, schemas, redaction, audit helper.
- **M2 - POI candidate pipeline:** OSM/manual normalization, candidate matching, admin APIs, promotion.
- **M3 - Field capture copilot:** extraction API and ContributionFlow suggestion UI.
- **M4 - Admin review assistant:** review summary API and AdminQueue summary panel.
- **M5 - Client analyst:** analytics query/report APIs and DeltaDashboard panel.
- **M6 - Verification and handoff:** targeted tests, docs update, bd close, dolt push, git push.

Each milestone ends with tests and a commit.

---

# Milestone 1 - Contracts and Persistence

## Task 1: Add database foundation

**Files:**
- Create: `supabase/migrations/20260514_ai_and_poi_foundation.sql`
- Test: migration is SQL-only; validation occurs through API/unit tests that depend on these tables.

- [ ] **Step 1: Create migration**

Create `supabase/migrations/20260514_ai_and_poi_foundation.sql`:

```sql
CREATE TABLE IF NOT EXISTS public.ai_extractions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_draft_id text,
  event_id uuid,
  user_id text,
  category text,
  input_hash text NOT NULL,
  output_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  accepted_fields_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  rejected_fields_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  model_provider text NOT NULL,
  model_name text NOT NULL,
  model_version text,
  prompt_version text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_extractions_user_created_idx
  ON public.ai_extractions (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.ai_review_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid,
  point_id text NOT NULL,
  review_status_at_generation text,
  risk_score_at_generation numeric,
  summary_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  reviewer_action text,
  reviewer_feedback text,
  model_provider text NOT NULL,
  model_name text NOT NULL,
  model_version text,
  prompt_version text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_review_summaries_point_created_idx
  ON public.ai_review_summaries (point_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.ai_analytics_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  role text NOT NULL,
  client_scope text,
  question text NOT NULL,
  query_plan_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  answer_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  model_provider text NOT NULL,
  model_name text NOT NULL,
  model_version text,
  prompt_version text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_analytics_runs_user_created_idx
  ON public.ai_analytics_runs (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.external_poi_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL,
  source_license text NOT NULL,
  source_attribution text NOT NULL,
  external_id text NOT NULL,
  raw_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  normalized_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  category text NOT NULL,
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  name text,
  match_status text NOT NULL DEFAULT 'discovered',
  matched_point_id text,
  match_score numeric NOT NULL DEFAULT 0,
  confidence numeric NOT NULL DEFAULT 0,
  needs_field_verification boolean NOT NULL DEFAULT true,
  assigned_to text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT external_poi_candidates_status_check CHECK (
    match_status IN (
      'discovered',
      'normalized',
      'matched_to_existing',
      'needs_field_verification',
      'assigned_to_agent',
      'verified',
      'promoted_to_point_event',
      'rejected'
    )
  ),
  CONSTRAINT external_poi_candidates_confidence_check CHECK (confidence >= 0 AND confidence <= 1),
  CONSTRAINT external_poi_candidates_match_score_check CHECK (match_score >= 0 AND match_score <= 1),
  CONSTRAINT external_poi_candidates_source_external_unique UNIQUE (source, external_id)
);

CREATE INDEX IF NOT EXISTS external_poi_candidates_category_status_idx
  ON public.external_poi_candidates (category, match_status);

CREATE INDEX IF NOT EXISTS external_poi_candidates_assigned_to_idx
  ON public.external_poi_candidates (assigned_to)
  WHERE assigned_to IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.poi_source_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL,
  zone_id text NOT NULL,
  verticals_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  status text NOT NULL DEFAULT 'running',
  fetched_count integer NOT NULL DEFAULT 0,
  candidate_count integer NOT NULL DEFAULT 0,
  matched_count integer NOT NULL DEFAULT 0,
  error_message text,
  CONSTRAINT poi_source_runs_status_check CHECK (status IN ('running', 'completed', 'failed'))
);
```

- [ ] **Step 2: Run migration dry check**

Run:

```bash
npm run migrate:dry
```

Expected: migration list includes `20260514_ai_and_poi_foundation.sql`, no SQL syntax failure.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260514_ai_and_poi_foundation.sql
git commit -m "feat(ai): add AI and POI persistence foundation"
```

## Task 2: Add shared types and validation schemas

**Files:**
- Modify: `shared/types.ts`
- Modify: `lib/server/validation.ts`
- Test: `tests/aiContracts.test.ts`

- [ ] **Step 1: Write failing contract tests**

Create `tests/aiContracts.test.ts`:

```ts
import assert from "node:assert/strict";
import test from "node:test";
import {
  aiExtractionRequestSchema,
  aiReviewSummaryRequestSchema,
  aiAnalyticsQueryRequestSchema,
  poiCandidatePatchSchema,
} from "../lib/server/validation.js";

test("aiExtractionRequestSchema accepts a minimal image extraction request", () => {
  const result = aiExtractionRequestSchema.safeParse({
    category: "pharmacy",
    imageData: "data:image/jpeg;base64,abcd",
    location: { latitude: 4.071, longitude: 9.736 },
    language: "en",
    draftDetails: { name: "Pharmacie Test" },
  });

  assert.equal(result.success, true);
});

test("aiReviewSummaryRequestSchema requires an event id", () => {
  const result = aiReviewSummaryRequestSchema.safeParse({});
  assert.equal(result.success, false);
});

test("aiAnalyticsQueryRequestSchema accepts aggregate-only client query", () => {
  const result = aiAnalyticsQueryRequestSchema.safeParse({
    question: "What changed in fuel this week?",
    vertical: "fuel_station",
    zone: "bonamoussadi",
    dateRange: { from: "2026-05-01", to: "2026-05-14" },
  });

  assert.equal(result.success, true);
});

test("poiCandidatePatchSchema rejects invalid status", () => {
  const result = poiCandidatePatchSchema.safeParse({ matchStatus: "trusted" });
  assert.equal(result.success, false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
node --import tsx --test tests/aiContracts.test.ts
```

Expected: FAIL because schemas are not exported.

- [ ] **Step 3: Add shared TypeScript types**

Append to `shared/types.ts` after `ProjectedPoint`:

```ts
export type AiLanguage = "en" | "fr";

export interface AiModelMetadata {
  provider: string;
  model: string;
  modelVersion: string | null;
  promptVersion: string;
  confidence: number;
}

export interface AiFieldSuggestion {
  field: string;
  value: unknown;
  confidence: number;
  evidence: string;
}

export interface AiQualityWarning {
  code: string;
  severity: "info" | "warning" | "blocker";
  messageEn: string;
  messageFr: string;
}

export interface AiExtractionResponse {
  detectedCategory: SubmissionCategory | null;
  fieldSuggestions: AiFieldSuggestion[];
  qualityWarnings: AiQualityWarning[];
  duplicateCandidates: DedupCandidate[];
  confidence: number;
  modelMetadata: AiModelMetadata;
}

export interface AiReviewSummaryResponse {
  summary: string;
  recommendedChecks: string[];
  riskDrivers: string[];
  supportingEvidence: string[];
  caveats: string[];
  agentFeedbackDraft: { en: string; fr: string };
  confidence: number;
  modelMetadata: AiModelMetadata;
}

export interface AiAnalyticsResponse {
  answer: string;
  facts: Array<{ label: string; value: string | number; source: string }>;
  caveats: string[];
  suggestedNextValidations: string[];
  confidence: number;
  modelMetadata: AiModelMetadata;
}

export type ExternalPoiMatchStatus =
  | "discovered"
  | "normalized"
  | "matched_to_existing"
  | "needs_field_verification"
  | "assigned_to_agent"
  | "verified"
  | "promoted_to_point_event"
  | "rejected";

export interface ExternalPoiCandidate {
  id: string;
  source: string;
  sourceLicense: string;
  sourceAttribution: string;
  externalId: string;
  raw: Record<string, unknown>;
  normalized: SubmissionDetails;
  category: SubmissionCategory;
  location: SubmissionLocation;
  name: string | null;
  matchStatus: ExternalPoiMatchStatus;
  matchedPointId: string | null;
  matchScore: number;
  confidence: number;
  needsFieldVerification: boolean;
  assignedTo: string | null;
  createdAt: string;
  updatedAt: string;
}
```

- [ ] **Step 4: Add validation schemas**

In `lib/server/validation.ts`, add these constants after `submissionInputSchema`:

```ts
const LANGUAGE_VALUES = ["en", "fr"] as const;
const POI_STATUS_VALUES = [
  "discovered",
  "normalized",
  "matched_to_existing",
  "needs_field_verification",
  "assigned_to_agent",
  "verified",
  "promoted_to_point_event",
  "rejected",
] as const;

export const aiExtractionRequestSchema = z
  .object({
    category: z.enum(CATEGORY_VALUES).nullable().optional(),
    imageData: z.string().min(1).max(12_000_000).optional(),
    photoUrl: z.string().trim().url().max(1000).optional(),
    location: z.object({
      latitude: z.number().finite(),
      longitude: z.number().finite(),
    }),
    language: z.enum(LANGUAGE_VALUES),
    draftDetails: z.record(z.string(), z.unknown()).optional(),
  })
  .strict()
  .refine((value) => Boolean(value.imageData || value.photoUrl), {
    message: "imageData or photoUrl is required",
    path: ["imageData"],
  });

export const aiReviewSummaryRequestSchema = z
  .object({
    eventId: z.string().trim().min(1).max(160),
  })
  .strict();

export const aiAnalyticsQueryRequestSchema = z
  .object({
    question: z.string().trim().min(3).max(500),
    vertical: z.enum(CATEGORY_VALUES).optional(),
    zone: z.string().trim().min(1).max(120).optional(),
    dateRange: z
      .object({
        from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      })
      .optional(),
    exportFormat: z.enum(["json", "csv", "geojson", "pdf"]).optional(),
  })
  .strict();

export const poiCandidatePatchSchema = z
  .object({
    matchStatus: z.enum(POI_STATUS_VALUES).optional(),
    assignedTo: z.string().trim().min(1).max(160).nullable().optional(),
    needsFieldVerification: z.boolean().optional(),
  })
  .strict();
```

- [ ] **Step 5: Run contract tests**

Run:

```bash
node --import tsx --test tests/aiContracts.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add shared/types.ts lib/server/validation.ts tests/aiContracts.test.ts
git commit -m "feat(ai): define AI and POI contracts"
```

## Task 3: Add AI redaction and model boundary

**Files:**
- Create: `lib/server/ai/redaction.ts`
- Create: `lib/server/ai/modelClient.ts`
- Create: `lib/server/ai/outputSchemas.ts`
- Test: `tests/aiRedaction.test.ts`

- [ ] **Step 1: Write failing redaction tests**

Create `tests/aiRedaction.test.ts`:

```ts
import assert from "node:assert/strict";
import test from "node:test";
import { redactDetailsForAi, hashAiInput } from "../lib/server/ai/redaction.js";

test("redactDetailsForAi removes direct contact fields by default", () => {
  const result = redactDetailsForAi({
    name: "Pharmacie Lumiere",
    phone: "+237699000000",
    email: "owner@example.com",
    website: "https://example.com",
    brand: "Known Brand",
  });

  assert.equal(result.name, "Pharmacie Lumiere");
  assert.equal("phone" in result, false);
  assert.equal("email" in result, false);
  assert.equal(result.website, "https://example.com");
});

test("hashAiInput is stable for object key order", () => {
  const a = hashAiInput({ b: 2, a: 1 });
  const b = hashAiInput({ a: 1, b: 2 });
  assert.equal(a, b);
  assert.match(a, /^[a-f0-9]{64}$/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
node --import tsx --test tests/aiRedaction.test.ts
```

Expected: FAIL because `redaction.ts` does not exist.

- [ ] **Step 3: Implement redaction**

Create `lib/server/ai/redaction.ts`:

```ts
import { createHash } from "node:crypto";
import type { SubmissionDetails } from "../../../shared/types.js";

const DEFAULT_REMOVE_KEYS = new Set([
  "phone",
  "email",
  "merchantId",
  "merchantIdByProvider",
  "clientDevice",
  "fraudCheck",
  "gpsIntegrity",
]);

function stableSort(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableSort);
  if (!value || typeof value !== "object") return value;
  const out: Record<string, unknown> = {};
  for (const [key, next] of Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b))) {
    if (next !== undefined) out[key] = stableSort(next);
  }
  return out;
}

export function redactDetailsForAi(details: SubmissionDetails, keepKeys: string[] = []): SubmissionDetails {
  const keep = new Set(keepKeys);
  const out: SubmissionDetails = {};
  for (const [key, value] of Object.entries(details ?? {})) {
    if (DEFAULT_REMOVE_KEYS.has(key) && !keep.has(key)) continue;
    out[key] = value;
  }
  return out;
}

export function hashAiInput(input: unknown): string {
  return createHash("sha256").update(JSON.stringify(stableSort(input))).digest("hex");
}
```

- [ ] **Step 4: Add model boundary and output schemas**

Create `lib/server/ai/modelClient.ts`:

```ts
export interface AiGenerateInput {
  task: "extract_submission" | "review_summary" | "analytics_query" | "report_draft";
  promptVersion: string;
  payload: Record<string, unknown>;
}

export interface AiGenerateOutput {
  json: unknown;
  metadata: {
    provider: string;
    model: string;
    modelVersion: string | null;
    promptVersion: string;
    confidence: number;
  };
}

export type AiModelClient = (input: AiGenerateInput) => Promise<AiGenerateOutput>;

export const deterministicAiModelClient: AiModelClient = async (input) => ({
  json: {},
  metadata: {
    provider: "deterministic",
    model: "test-double",
    modelVersion: null,
    promptVersion: input.promptVersion,
    confidence: 0,
  },
});
```

Create `lib/server/ai/outputSchemas.ts`:

```ts
import { z } from "zod";

export const aiFieldSuggestionSchema = z.object({
  field: z.string().min(1),
  value: z.unknown(),
  confidence: z.number().min(0).max(1),
  evidence: z.string().min(1),
});

export const aiQualityWarningSchema = z.object({
  code: z.string().min(1),
  severity: z.enum(["info", "warning", "blocker"]),
  messageEn: z.string().min(1),
  messageFr: z.string().min(1),
});

export const aiExtractionOutputSchema = z.object({
  detectedCategory: z.string().nullable(),
  fieldSuggestions: z.array(aiFieldSuggestionSchema),
  qualityWarnings: z.array(aiQualityWarningSchema),
  confidence: z.number().min(0).max(1),
});

export const aiReviewOutputSchema = z.object({
  summary: z.string().min(1),
  recommendedChecks: z.array(z.string()),
  riskDrivers: z.array(z.string()),
  supportingEvidence: z.array(z.string()),
  caveats: z.array(z.string()),
  agentFeedbackDraft: z.object({ en: z.string(), fr: z.string() }),
  confidence: z.number().min(0).max(1),
});

export const aiAnalyticsOutputSchema = z.object({
  answer: z.string().min(1),
  facts: z.array(z.object({
    label: z.string().min(1),
    value: z.union([z.string(), z.number()]),
    source: z.string().min(1),
  })),
  caveats: z.array(z.string()),
  suggestedNextValidations: z.array(z.string()),
  confidence: z.number().min(0).max(1),
});
```

- [ ] **Step 5: Run tests**

Run:

```bash
node --import tsx --test tests/aiRedaction.test.ts tests/aiContracts.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/server/ai/redaction.ts lib/server/ai/modelClient.ts lib/server/ai/outputSchemas.ts tests/aiRedaction.test.ts
git commit -m "feat(ai): add redaction and model boundary"
```

---

# Milestone 2 - POI Candidate Pipeline

## Task 4: Normalize external POIs

**Files:**
- Create: `lib/server/poi/normalizePoi.ts`
- Test: `tests/poiNormalize.test.ts`

- [ ] **Step 1: Write failing normalization tests**

Create `tests/poiNormalize.test.ts`:

```ts
import assert from "node:assert/strict";
import test from "node:test";
import { normalizeOsmElementToPoi } from "../lib/server/poi/normalizePoi.js";

test("normalizeOsmElementToPoi maps amenity=pharmacy to ADL pharmacy", () => {
  const candidate = normalizeOsmElementToPoi({
    type: "node",
    id: 123,
    lat: 4.071,
    lon: 9.736,
    tags: { amenity: "pharmacy", name: "Pharmacie Lumiere", phone: "+237699000000" },
  });

  assert.equal(candidate?.category, "pharmacy");
  assert.equal(candidate?.externalId, "node/123");
  assert.equal(candidate?.name, "Pharmacie Lumiere");
  assert.equal(candidate?.normalized.name, "Pharmacie Lumiere");
  assert.equal(candidate?.sourceAttribution, "OpenStreetMap contributors");
});

test("normalizeOsmElementToPoi maps amenity=fuel to fuel_station", () => {
  const candidate = normalizeOsmElementToPoi({
    type: "way",
    id: 456,
    center: { lat: 4.072, lon: 9.737 },
    tags: { amenity: "fuel", brand: "Tradex" },
  });

  assert.equal(candidate?.category, "fuel_station");
  assert.equal(candidate?.location.latitude, 4.072);
  assert.equal(candidate?.normalized.brand, "Tradex");
});

test("normalizeOsmElementToPoi returns null for unsupported tags", () => {
  const candidate = normalizeOsmElementToPoi({
    type: "node",
    id: 999,
    lat: 4.07,
    lon: 9.73,
    tags: { amenity: "bench" },
  });

  assert.equal(candidate, null);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
node --import tsx --test tests/poiNormalize.test.ts
```

Expected: FAIL because module is missing.

- [ ] **Step 3: Implement normalizer**

Create `lib/server/poi/normalizePoi.ts`:

```ts
import type { ExternalPoiCandidate, SubmissionCategory, SubmissionDetails, SubmissionLocation } from "../../../shared/types.js";

export interface OsmElement {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat?: number; lon?: number };
  tags?: Record<string, string>;
}

export interface NormalizedPoiDraft {
  source: string;
  sourceLicense: string;
  sourceAttribution: string;
  externalId: string;
  raw: Record<string, unknown>;
  normalized: SubmissionDetails;
  category: SubmissionCategory;
  location: SubmissionLocation;
  name: string | null;
  confidence: number;
}

function trim(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const value = input.trim();
  return value || null;
}

function resolveOsmCategory(tags: Record<string, string>): SubmissionCategory | null {
  if (tags.amenity === "pharmacy") return "pharmacy";
  if (tags.amenity === "fuel") return "fuel_station";
  if (tags.amenity === "bar" || tags.amenity === "pub" || tags.shop === "alcohol") return "alcohol_outlet";
  if (tags.highway === "bus_stop" || tags.public_transport) return "transport_road";
  if (tags.advertising === "billboard" || tags.man_made === "advertising") return "billboard";
  if (tags.building && tags.building !== "no") return "census_proxy";
  if (tags.amenity === "bank" || tags.amenity === "money_transfer" || tags.shop === "mobile_money") return "mobile_money";
  return null;
}

function resolveLocation(element: OsmElement): SubmissionLocation | null {
  const latitude = typeof element.lat === "number" ? element.lat : element.center?.lat;
  const longitude = typeof element.lon === "number" ? element.lon : element.center?.lon;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return { latitude: latitude as number, longitude: longitude as number };
}

export function normalizeOsmElementToPoi(element: OsmElement): NormalizedPoiDraft | null {
  const tags = element.tags ?? {};
  const category = resolveOsmCategory(tags);
  const location = resolveLocation(element);
  if (!category || !location) return null;

  const name = trim(tags.name) ?? trim(tags.operator) ?? trim(tags.brand);
  const normalized: SubmissionDetails = {
    name: name ?? undefined,
    siteName: name ?? undefined,
    brand: trim(tags.brand) ?? undefined,
    operator: trim(tags.operator) ?? undefined,
    phone: trim(tags.phone) ?? trim(tags["contact:phone"]) ?? undefined,
    openingHours: trim(tags.opening_hours) ?? undefined,
    source: "osm",
    externalId: `${element.type}/${element.id}`,
    isImported: true,
  };

  return {
    source: "osm",
    sourceLicense: "ODbL-1.0",
    sourceAttribution: "OpenStreetMap contributors",
    externalId: `${element.type}/${element.id}`,
    raw: element as unknown as Record<string, unknown>,
    normalized,
    category,
    location,
    name,
    confidence: name ? 0.72 : 0.55,
  };
}
```

- [ ] **Step 4: Run tests**

Run:

```bash
node --import tsx --test tests/poiNormalize.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/server/poi/normalizePoi.ts tests/poiNormalize.test.ts
git commit -m "feat(poi): normalize external POI candidates"
```

## Task 5: Match POI candidates against projected points

**Files:**
- Create: `lib/server/poi/candidateMatcher.ts`
- Test: `tests/poiMatcher.test.ts`

- [ ] **Step 1: Write failing matcher tests**

Create `tests/poiMatcher.test.ts`:

```ts
import assert from "node:assert/strict";
import test from "node:test";
import { matchPoiCandidate } from "../lib/server/poi/candidateMatcher.js";
import type { ProjectedPoint } from "../shared/types.js";

const existing: ProjectedPoint = {
  id: "p1",
  pointId: "p1",
  category: "pharmacy",
  location: { latitude: 4.071, longitude: 9.736 },
  details: { name: "Pharmacie Lumiere" },
  createdAt: "2026-05-01T00:00:00.000Z",
  updatedAt: "2026-05-01T00:00:00.000Z",
  gaps: [],
  eventsCount: 1,
  eventIds: ["e1"],
};

test("matchPoiCandidate marks close same-name POI as existing match", () => {
  const result = matchPoiCandidate(
    {
      source: "osm",
      sourceLicense: "ODbL-1.0",
      sourceAttribution: "OpenStreetMap contributors",
      externalId: "node/123",
      raw: {},
      normalized: { name: "Pharmacie Lumiere" },
      category: "pharmacy",
      location: { latitude: 4.07101, longitude: 9.73601 },
      name: "Pharmacie Lumiere",
      confidence: 0.8,
    },
    [existing],
  );

  assert.equal(result.matchStatus, "matched_to_existing");
  assert.equal(result.matchedPointId, "p1");
  assert.ok(result.matchScore >= 0.85);
});

test("matchPoiCandidate sends unmatched POI to field verification", () => {
  const result = matchPoiCandidate(
    {
      source: "osm",
      sourceLicense: "ODbL-1.0",
      sourceAttribution: "OpenStreetMap contributors",
      externalId: "node/124",
      raw: {},
      normalized: { name: "New Pharmacy" },
      category: "pharmacy",
      location: { latitude: 4.09, longitude: 9.75 },
      name: "New Pharmacy",
      confidence: 0.8,
    },
    [existing],
  );

  assert.equal(result.matchStatus, "needs_field_verification");
  assert.equal(result.matchedPointId, null);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
node --import tsx --test tests/poiMatcher.test.ts
```

Expected: FAIL because module is missing.

- [ ] **Step 3: Implement matcher**

Create `lib/server/poi/candidateMatcher.ts`:

```ts
import type { ExternalPoiMatchStatus, ProjectedPoint } from "../../../shared/types.js";
import { buildDedupCandidates } from "../dedup.js";
import type { NormalizedPoiDraft } from "./normalizePoi.js";

export interface PoiMatchResult {
  matchStatus: ExternalPoiMatchStatus;
  matchedPointId: string | null;
  matchScore: number;
  needsFieldVerification: boolean;
}

export function matchPoiCandidate(candidate: NormalizedPoiDraft, points: ProjectedPoint[]): PoiMatchResult {
  const dedup = buildDedupCandidates(candidate.category, candidate.location, candidate.normalized, points);
  const best = dedup.candidates[0];
  if (best && best.matchScore >= 0.85) {
    return {
      matchStatus: "matched_to_existing",
      matchedPointId: best.pointId,
      matchScore: best.matchScore,
      needsFieldVerification: false,
    };
  }

  return {
    matchStatus: "needs_field_verification",
    matchedPointId: null,
    matchScore: best?.matchScore ?? 0,
    needsFieldVerification: true,
  };
}
```

- [ ] **Step 4: Run tests**

Run:

```bash
node --import tsx --test tests/poiMatcher.test.ts tests/dedup.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/server/poi/candidateMatcher.ts tests/poiMatcher.test.ts
git commit -m "feat(poi): match candidates against projected points"
```

## Task 6: Add POI source adapter and import API

**Files:**
- Create: `lib/server/poi/sourceAdapters/osmOverpass.ts`
- Create: `api/poi/import/osm.ts`
- Modify: `lib/server/storage/index.ts`
- Test: `tests/poiNormalize.test.ts` extended with fixture import function.

- [ ] **Step 1: Add OSM adapter**

Create `lib/server/poi/sourceAdapters/osmOverpass.ts`:

```ts
import { normalizeOsmElementToPoi, type NormalizedPoiDraft, type OsmElement } from "../normalizePoi.js";

export interface OverpassResponse {
  elements?: OsmElement[];
}

export function normalizeOverpassResponse(response: OverpassResponse): NormalizedPoiDraft[] {
  return (response.elements ?? [])
    .map((element) => normalizeOsmElementToPoi(element))
    .filter((candidate): candidate is NormalizedPoiDraft => Boolean(candidate));
}

export function buildOverpassQuery(bounds: { south: number; west: number; north: number; east: number }): string {
  const bbox = `${bounds.south},${bounds.west},${bounds.north},${bounds.east}`;
  return `
[out:json][timeout:25];
(
  node["amenity"="pharmacy"](${bbox});
  way["amenity"="pharmacy"](${bbox});
  node["amenity"="fuel"](${bbox});
  way["amenity"="fuel"](${bbox});
  node["amenity"~"bar|pub"](${bbox});
  way["amenity"~"bar|pub"](${bbox});
  node["highway"="bus_stop"](${bbox});
  way["public_transport"](${bbox});
  node["advertising"="billboard"](${bbox});
  way["advertising"="billboard"](${bbox});
  node["building"](${bbox});
  way["building"](${bbox});
);
out center tags;
`;
}
```

- [ ] **Step 2: Extend normalizer test**

Append to `tests/poiNormalize.test.ts`:

```ts
import { normalizeOverpassResponse } from "../lib/server/poi/sourceAdapters/osmOverpass.js";

test("normalizeOverpassResponse drops unsupported elements and keeps supported candidates", () => {
  const candidates = normalizeOverpassResponse({
    elements: [
      { type: "node", id: 1, lat: 4.071, lon: 9.736, tags: { amenity: "pharmacy", name: "P1" } },
      { type: "node", id: 2, lat: 4.072, lon: 9.737, tags: { amenity: "bench" } },
    ],
  });

  assert.equal(candidates.length, 1);
  assert.equal(candidates[0]?.externalId, "node/1");
});
```

- [ ] **Step 3: Run tests**

Run:

```bash
node --import tsx --test tests/poiNormalize.test.ts
```

Expected: PASS.

- [ ] **Step 4: Add import API stub with injected functions**

Create `api/poi/import/osm.ts` with an admin-only handler that:

- Requires `requireUser`.
- Confirms role `admin` through `getUserProfile`.
- Validates bounds from JSON body.
- Builds Overpass query.
- Returns normalized candidates in dry-run mode.
- Leaves DB persistence to Task 7.

Use this function signature so tests can inject fetch/storage:

```ts
export function createOsmImportHandler(deps: {
  requireUserFn?: typeof requireUser;
  getUserProfileFn?: typeof getUserProfile;
  fetchFn?: typeof fetch;
} = {}): (request: Request) => Promise<Response>
```

- [ ] **Step 5: Commit**

```bash
git add lib/server/poi/sourceAdapters/osmOverpass.ts api/poi/import/osm.ts tests/poiNormalize.test.ts
git commit -m "feat(poi): add OSM import adapter"
```

## Task 7: Persist, list, patch, assign, and promote POI candidates

**Files:**
- Create: `lib/server/poi/promoteCandidate.ts`
- Create: `api/poi/candidates/index.ts`
- Create: `api/poi/candidates/[id].ts`
- Create: `api/poi/candidates/[id]/promote.ts`
- Create: `api/poi/candidates/[id]/assign.ts`
- Test: `tests/poiPromotion.test.ts`

- [ ] **Step 1: Write promotion test**

Create `tests/poiPromotion.test.ts`:

```ts
import assert from "node:assert/strict";
import test from "node:test";
import { buildPointEventFromVerifiedCandidate } from "../lib/server/poi/promoteCandidate.js";
import type { ExternalPoiCandidate } from "../shared/types.js";

const candidate: ExternalPoiCandidate = {
  id: "11111111-1111-1111-1111-111111111111",
  source: "osm",
  sourceLicense: "ODbL-1.0",
  sourceAttribution: "OpenStreetMap contributors",
  externalId: "node/123",
  raw: {},
  normalized: { name: "Pharmacie Lumiere" },
  category: "pharmacy",
  location: { latitude: 4.071, longitude: 9.736 },
  name: "Pharmacie Lumiere",
  matchStatus: "verified",
  matchedPointId: null,
  matchScore: 0,
  confidence: 0.8,
  needsFieldVerification: false,
  assignedTo: null,
  createdAt: "2026-05-14T00:00:00.000Z",
  updatedAt: "2026-05-14T00:00:00.000Z",
};

test("buildPointEventFromVerifiedCandidate creates imported point event with attribution", () => {
  const event = buildPointEventFromVerifiedCandidate(candidate, "admin-1");
  assert.equal(event.category, "pharmacy");
  assert.equal(event.eventType, "CREATE_EVENT");
  assert.equal(event.userId, "admin-1");
  assert.equal(event.source, "osm");
  assert.equal(event.externalId, "node/123");
  assert.equal(event.details.sourceAttribution, "OpenStreetMap contributors");
  assert.equal(event.details.isImported, true);
});

test("buildPointEventFromVerifiedCandidate rejects unverified candidates", () => {
  assert.throws(() => {
    buildPointEventFromVerifiedCandidate({ ...candidate, matchStatus: "needs_field_verification" }, "admin-1");
  }, /verified/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
node --import tsx --test tests/poiPromotion.test.ts
```

Expected: FAIL because module is missing.

- [ ] **Step 3: Implement promotion builder**

Create `lib/server/poi/promoteCandidate.ts`:

```ts
import crypto from "node:crypto";
import type { ExternalPoiCandidate, PointEvent } from "../../../shared/types.js";
import { generatePointId } from "../../shared/pointId.js";

export function buildPointEventFromVerifiedCandidate(candidate: ExternalPoiCandidate, actorUserId: string): PointEvent {
  if (candidate.matchStatus !== "verified") {
    throw new Error("Candidate must be verified before promotion");
  }

  const pointId = candidate.matchedPointId ?? generatePointId({
    category: candidate.category,
    latitude: candidate.location.latitude,
    longitude: candidate.location.longitude,
  });

  return {
    id: crypto.randomUUID(),
    pointId,
    eventType: "CREATE_EVENT",
    userId: actorUserId,
    category: candidate.category,
    location: candidate.location,
    details: {
      ...candidate.normalized,
      source: candidate.source,
      externalId: candidate.externalId,
      sourceLicense: candidate.sourceLicense,
      sourceAttribution: candidate.sourceAttribution,
      isImported: true,
      reviewerApproved: true,
    },
    createdAt: new Date().toISOString(),
    source: candidate.source,
    externalId: candidate.externalId,
    consentStatus: "not_required",
  };
}
```

- [ ] **Step 4: Add candidate APIs**

Implement APIs with admin guard:

- `GET /api/poi/candidates` returns candidates filtered by `status`, `category`, `assignedTo`.
- `PATCH /api/poi/candidates/:id` updates `match_status`, `assigned_to`, `needs_field_verification`.
- `POST /api/poi/candidates/:id/assign` sets `assigned_to`, `match_status='assigned_to_agent'`.
- `POST /api/poi/candidates/:id/promote` loads verified candidate, builds point event, calls `insertPointEvent`, updates status to `promoted_to_point_event`.

Keep SQL in each handler small and parameterized through `query`.

- [ ] **Step 5: Run promotion test**

Run:

```bash
node --import tsx --test tests/poiPromotion.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/server/poi/promoteCandidate.ts api/poi/candidates tests/poiPromotion.test.ts
git commit -m "feat(poi): add candidate review and promotion"
```

---

# Milestone 3 - Field Capture Copilot

## Task 8: Add extraction service and API

**Files:**
- Create: `lib/server/ai/extractSubmissionFields.ts`
- Create: `api/ai/extract-submission.ts`
- Modify: `lib/client/ai.ts`
- Test: `tests/aiExtractSubmission.test.ts`

- [ ] **Step 1: Write extraction service test**

Create `tests/aiExtractSubmission.test.ts`:

```ts
import assert from "node:assert/strict";
import test from "node:test";
import { extractSubmissionFields } from "../lib/server/ai/extractSubmissionFields.js";

test("extractSubmissionFields validates model output and preserves metadata", async () => {
  const result = await extractSubmissionFields(
    {
      category: "pharmacy",
      location: { latitude: 4.071, longitude: 9.736 },
      language: "en",
      draftDetails: { name: "Pharmacie Lumiere", phone: "+237699000000" },
    },
    async (input) => ({
      json: {
        detectedCategory: "pharmacy",
        fieldSuggestions: [{ field: "name", value: "Pharmacie Lumiere", confidence: 0.9, evidence: "Visible sign" }],
        qualityWarnings: [],
        confidence: 0.9,
      },
      metadata: {
        provider: "test",
        model: "mock",
        modelVersion: null,
        promptVersion: input.promptVersion,
        confidence: 0.9,
      },
    }),
  );

  assert.equal(result.detectedCategory, "pharmacy");
  assert.equal(result.fieldSuggestions[0]?.field, "name");
  assert.equal(result.modelMetadata.provider, "test");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
node --import tsx --test tests/aiExtractSubmission.test.ts
```

Expected: FAIL because service module is missing.

- [ ] **Step 3: Implement extraction service**

Create `lib/server/ai/extractSubmissionFields.ts`:

```ts
import type { AiExtractionResponse, DedupCandidate, SubmissionCategory, SubmissionDetails, SubmissionLocation } from "../../../shared/types.js";
import { aiExtractionOutputSchema } from "./outputSchemas.js";
import type { AiModelClient } from "./modelClient.js";
import { redactDetailsForAi } from "./redaction.js";

export interface ExtractSubmissionFieldsInput {
  category?: SubmissionCategory | null;
  location: SubmissionLocation;
  language: "en" | "fr";
  draftDetails?: SubmissionDetails;
}

const PROMPT_VERSION = "extract-submission-v1";

export async function extractSubmissionFields(
  input: ExtractSubmissionFieldsInput,
  modelClient: AiModelClient,
  duplicateCandidates: DedupCandidate[] = [],
): Promise<AiExtractionResponse> {
  const model = await modelClient({
    task: "extract_submission",
    promptVersion: PROMPT_VERSION,
    payload: {
      category: input.category ?? null,
      location: input.location,
      language: input.language,
      draftDetails: redactDetailsForAi(input.draftDetails ?? {}),
    },
  });

  const parsed = aiExtractionOutputSchema.parse(model.json);
  return {
    detectedCategory: parsed.detectedCategory as SubmissionCategory | null,
    fieldSuggestions: parsed.fieldSuggestions,
    qualityWarnings: parsed.qualityWarnings,
    duplicateCandidates,
    confidence: parsed.confidence,
    modelMetadata: model.metadata,
  };
}
```

- [ ] **Step 4: Implement API handler**

Create `api/ai/extract-submission.ts` with:

- `requireUser`.
- `aiExtractionRequestSchema`.
- rate limit key `POST /api/ai/extract-submission:user`.
- `extractSubmissionFields`.
- deterministic fallback model if `GEMINI_API_KEY` is not configured.
- JSON response.

Export `createAiExtractSubmissionHandler(deps)` so tests can inject model/client/auth.

- [ ] **Step 5: Extend client helper**

Add to `lib/client/ai.ts`:

```ts
export interface AiExtractSubmissionPayload {
  category?: string | null;
  imageData?: string;
  photoUrl?: string;
  location: { latitude: number; longitude: number };
  language: "en" | "fr";
  draftDetails?: Record<string, unknown>;
}

export async function extractSubmission(payload: AiExtractSubmissionPayload): Promise<unknown> {
  return apiJson<unknown>("/api/ai/extract-submission", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}
```

- [ ] **Step 6: Run tests**

Run:

```bash
node --import tsx --test tests/aiExtractSubmission.test.ts tests/aiRedaction.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add lib/server/ai/extractSubmissionFields.ts api/ai/extract-submission.ts lib/client/ai.ts tests/aiExtractSubmission.test.ts
git commit -m "feat(ai): add capture extraction service"
```

## Task 9: Add editable capture suggestions to ContributionFlow

**Files:**
- Modify: `components/Screens/ContributionFlow.tsx`

- [ ] **Step 1: Add local state**

In `ContributionFlow.tsx`, add state near existing form state:

```ts
const [aiSuggestions, setAiSuggestions] = useState<Array<{ field: string; value: unknown; confidence: number; evidence: string }>>([]);
const [aiWarnings, setAiWarnings] = useState<Array<{ code: string; severity: string; messageEn: string; messageFr: string }>>([]);
const [aiLoading, setAiLoading] = useState(false);
```

- [ ] **Step 2: Add extraction trigger**

After photo capture succeeds and `location` is available, call `extractSubmission` with current category/location/details. On success, set suggestions and warnings. On failure, keep manual flow and avoid blocking submit.

- [ ] **Step 3: Add suggestion UI**

Render a compact "AI suggestions" panel in the details step:

```tsx
{aiSuggestions.length > 0 && (
  <div className="rounded-2xl border border-navy/10 bg-navy-wash p-4 space-y-3">
    <div className="text-sm font-bold text-navy">{t('Suggested from photo', 'Suggere depuis la photo')}</div>
    {aiSuggestions.map((suggestion) => (
      <button
        key={suggestion.field}
        type="button"
        onClick={() => setDetails((current) => ({ ...current, [suggestion.field]: suggestion.value }))}
        className="w-full min-h-12 rounded-xl bg-white px-4 py-3 text-left text-sm font-semibold text-ink"
      >
        {suggestion.field}: {String(suggestion.value)}
      </button>
    ))}
  </div>
)}
```

- [ ] **Step 4: Run type check**

Run:

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add components/Screens/ContributionFlow.tsx
git commit -m "feat(ai): show capture copilot suggestions"
```

---

# Milestone 4 - Admin Review Assistant

## Task 10: Add review summary service and API

**Files:**
- Create: `lib/server/ai/reviewAssistant.ts`
- Create: `api/ai/review-summary.ts`
- Test: `tests/aiReviewAssistant.test.ts`

- [ ] **Step 1: Write review summary test**

Create `tests/aiReviewAssistant.test.ts`:

```ts
import assert from "node:assert/strict";
import test from "node:test";
import { buildReviewSummary } from "../lib/server/ai/reviewAssistant.js";

test("buildReviewSummary returns human-readable drivers and metadata", async () => {
  const result = await buildReviewSummary(
    {
      eventId: "event-1",
      pointId: "point-1",
      riskScore: 72,
      reviewFlags: ["gps_integrity_mock_location", "high_velocity"],
      riskComponents: { locationRisk: 30, photoRisk: 10, temporalRisk: 20, userRisk: 5, behavioralRisk: 7 },
    },
    async (input) => ({
      json: {
        summary: "High risk because GPS integrity and velocity signals need review.",
        recommendedChecks: ["Check GPS path", "Review photo metadata"],
        riskDrivers: ["Mock location signal", "High velocity"],
        supportingEvidence: ["riskScore=72"],
        caveats: ["AI does not make the final decision"],
        agentFeedbackDraft: { en: "Retake with GPS enabled.", fr: "Reprenez avec le GPS active." },
        confidence: 0.8,
      },
      metadata: { provider: "test", model: "mock", modelVersion: null, promptVersion: input.promptVersion, confidence: 0.8 },
    }),
  );

  assert.equal(result.riskDrivers.length, 2);
  assert.equal(result.modelMetadata.provider, "test");
});
```

- [ ] **Step 2: Implement review service**

Create `lib/server/ai/reviewAssistant.ts` using `aiReviewOutputSchema`, prompt version `review-summary-v1`, and model injection.

- [ ] **Step 3: Implement API**

Create `api/ai/review-summary.ts` with admin-only guard. Load the event from `point_events`, extract `details.reviewFlags`, `details.riskScore`, and `details.riskComponents`, call `buildReviewSummary`, insert into `ai_review_summaries`, return JSON.

- [ ] **Step 4: Run tests**

Run:

```bash
node --import tsx --test tests/aiReviewAssistant.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/server/ai/reviewAssistant.ts api/ai/review-summary.ts tests/aiReviewAssistant.test.ts
git commit -m "feat(ai): add admin review assistant"
```

## Task 11: Add AdminQueue summary panel

**Files:**
- Modify: `components/Screens/AdminQueue.tsx`
- Modify: `lib/client/ai.ts`

- [ ] **Step 1: Add client helper**

Add to `lib/client/ai.ts`:

```ts
export async function getAiReviewSummary(eventId: string): Promise<unknown> {
  return apiJson<unknown>("/api/ai/review-summary", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ eventId }),
  });
}
```

- [ ] **Step 2: Add AdminQueue panel**

In `AdminQueue.tsx`, render a button inside selected submission details:

```tsx
<button
  type="button"
  onClick={() => void loadAiReviewSummary(selectedGroup.primaryEvent.id)}
  className="min-h-12 rounded-xl bg-navy px-4 py-3 text-sm font-bold text-white"
>
  {t('Summarize risk', 'Resumer le risque')}
</button>
```

Render returned summary in a bordered panel. Keep approve/reject controls unchanged.

- [ ] **Step 3: Run type check**

Run:

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add components/Screens/AdminQueue.tsx lib/client/ai.ts
git commit -m "feat(ai): surface review summaries in admin queue"
```

---

# Milestone 5 - Client Analyst

## Task 12: Add analytics assistant services and APIs

**Files:**
- Create: `lib/server/ai/analyticsAssistant.ts`
- Create: `api/ai/analytics-query.ts`
- Create: `api/ai/report-draft.ts`
- Test: `tests/aiAnalyticsAssistant.test.ts`

- [ ] **Step 1: Write analytics assistant test**

Create `tests/aiAnalyticsAssistant.test.ts`:

```ts
import assert from "node:assert/strict";
import test from "node:test";
import { answerAnalyticsQuestion } from "../lib/server/ai/analyticsAssistant.js";

test("answerAnalyticsQuestion cites source facts and caveats", async () => {
  const result = await answerAnalyticsQuestion(
    {
      question: "What changed in fuel?",
      facts: [{ label: "New points", value: 3, source: "snapshot_deltas" }],
    },
    async (input) => ({
      json: {
        answer: "Fuel station coverage added 3 publishable new points.",
        facts: [{ label: "New points", value: 3, source: "snapshot_deltas" }],
        caveats: ["Only publishable deltas included."],
        suggestedNextValidations: ["Verify high-change cells."],
        confidence: 0.82,
      },
      metadata: { provider: "test", model: "mock", modelVersion: null, promptVersion: input.promptVersion, confidence: 0.82 },
    }),
  );

  assert.equal(result.facts[0]?.source, "snapshot_deltas");
  assert.equal(result.caveats.length, 1);
});
```

- [ ] **Step 2: Implement service**

Create `lib/server/ai/analyticsAssistant.ts` with prompt version `analytics-query-v1`, `aiAnalyticsOutputSchema`, and model injection.

- [ ] **Step 3: Implement APIs**

Create:

- `api/ai/analytics-query.ts`: client/admin-only, validates query, gathers aggregate facts from `snapshot_stats` and `snapshot_deltas`, calls service.
- `api/ai/report-draft.ts`: client/admin-only, accepts same schema, returns structured report sections using same service.

Both APIs must avoid exposing agent/user identities.

- [ ] **Step 4: Run tests**

Run:

```bash
node --import tsx --test tests/aiAnalyticsAssistant.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/server/ai/analyticsAssistant.ts api/ai/analytics-query.ts api/ai/report-draft.ts tests/aiAnalyticsAssistant.test.ts
git commit -m "feat(ai): add client analytics assistant"
```

## Task 13: Add DeltaDashboard analyst panel

**Files:**
- Modify: `components/Screens/DeltaDashboard.tsx`
- Modify: `lib/client/ai.ts`

- [ ] **Step 1: Add client helper**

Add to `lib/client/ai.ts`:

```ts
export async function askAnalyticsAssistant(payload: {
  question: string;
  vertical?: string;
  zone?: string;
  dateRange?: { from: string; to: string };
}): Promise<unknown> {
  return apiJson<unknown>("/api/ai/analytics-query", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}
```

- [ ] **Step 2: Add panel**

In `DeltaDashboard.tsx`, add a compact analyst panel below top KPIs:

- Question input.
- Ask button.
- Result summary.
- Facts list.
- Caveats list.

Default question for selected vertical: `What changed in this vertical this week?`

- [ ] **Step 3: Run type check**

Run:

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add components/Screens/DeltaDashboard.tsx lib/client/ai.ts
git commit -m "feat(ai): add client analyst panel"
```

---

# Milestone 6 - Verification and Handoff

## Task 14: Run quality gates

**Files:** none

- [ ] **Step 1: Run focused tests**

Run:

```bash
node --import tsx --test \
  tests/aiContracts.test.ts \
  tests/aiRedaction.test.ts \
  tests/poiNormalize.test.ts \
  tests/poiMatcher.test.ts \
  tests/poiPromotion.test.ts \
  tests/aiExtractSubmission.test.ts \
  tests/aiReviewAssistant.test.ts \
  tests/aiAnalyticsAssistant.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run existing related tests**

Run:

```bash
node --import tsx --test \
  tests/dedup.test.ts \
  tests/aiSearchApi.test.ts \
  tests/spatialIntelligence.test.ts \
  tests/submissionsValidation.test.ts
```

Expected: PASS.

- [ ] **Step 3: Run type check**

Run:

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 4: Run bd preflight**

Run:

```bash
bd preflight
```

Expected: no critical issue tracking errors.

## Task 15: Docs, issue close, and push

**Files:**
- Modify: `docs/ai-spatial-intelligence-reporting.md`

- [ ] **Step 1: Update AI reporting doc**

Append a section named `AI Collection and POI Enrichment Status` to `docs/ai-spatial-intelligence-reporting.md` with:

- Implemented APIs.
- OSM attribution rule.
- Human-in-loop enforcement rule.
- Known rollout gates.

- [ ] **Step 2: Commit docs**

```bash
git add docs/ai-spatial-intelligence-reporting.md
git commit -m "docs(ai): document AI collection rollout"
```

- [ ] **Step 3: Close bd issue**

```bash
bd close africandatalayer-rgk --reason "Implementation plan created and ready for execution" --json
```

- [ ] **Step 4: Sync Beads and git**

```bash
bd dolt push
git pull --rebase
git push
git status
```

Expected: branch is up to date with origin, working tree clean.

---

## Execution Choice

Recommended: **Subagent-Driven** for implementation because write scopes are separable:

- Worker 1: AI contracts, redaction, model boundary, audit.
- Worker 2: POI normalization, matching, import, promotion.
- Worker 3: Capture copilot API and ContributionFlow UI.
- Worker 4: Review assistant API/UI and analytics assistant API/UI.

Alternative: **Inline Execution** if branch coordination overhead matters more than speed.
