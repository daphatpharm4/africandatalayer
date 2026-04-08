# Admin Mass Approve & Filter by User — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add batch review API, user filter dropdown, and widened mass-approve to the admin queue.

**Architecture:** Extract `applyReviewDecision()` to a shared module, create a new `POST /api/submissions/batch-review` endpoint that processes multiple events in one request, and extend `AdminQueue.tsx` with a user filter dropdown and updated bulk-approve logic that calls the batch endpoint.

**Tech Stack:** TypeScript, Zod, Node test runner, React (existing patterns)

**Spec:** `docs/superpowers/specs/2026-04-08-admin-mass-approve-user-filter-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `lib/server/reviewDecision.ts` | **Create** | Shared `applyReviewDecision()` function |
| `api/submissions/[id].ts` | **Modify** | Import from shared module instead of local function |
| `lib/server/validation.ts` | **Modify** | Add `batchReviewBodySchema` |
| `api/submissions/batch-review.ts` | **Create** | Batch review POST endpoint |
| `tests/batchReview.test.ts` | **Create** | Unit tests for batch review logic |
| `components/Screens/AdminQueue.tsx` | **Modify** | User filter + batch approve |

---

### Task 1: Extract `applyReviewDecision` to shared module

**Files:**
- Create: `lib/server/reviewDecision.ts`
- Modify: `api/submissions/[id].ts:1-115`
- Test: `tests/batchReview.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/batchReview.test.ts`:

```ts
import assert from "node:assert/strict";
import test from "node:test";

test("applyReviewDecision module exports the function", async () => {
  const mod = await import("../lib/server/reviewDecision.js");
  assert.equal(typeof mod.applyReviewDecision, "function");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --import tsx --test tests/batchReview.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Create `lib/server/reviewDecision.ts`**

Move the `applyReviewDecision` function and its helpers out of `api/submissions/[id].ts` into this new file. The file should contain:

```ts
import { query } from "./db.js";
import { getUserProfile } from "./storage/index.js";
import { reconcileUserProfileXp } from "./xp.js";
import { adjustTrustOnReview, updateUserTrust } from "./userTrust.js";

export type ReviewDecision = "approved" | "rejected" | "flagged";

export interface ReviewResult {
  eventId: string;
  decision: ReviewDecision;
  reviewStatus: string;
  xpAwarded: number;
  userId: string;
}

function isMissingDbObjectError(error: unknown): boolean {
  const pg = error as { code?: unknown; message?: unknown } | null;
  const code = typeof pg?.code === "string" ? pg.code : "";
  if (code === "42P01" || code === "42703") return true;
  const message = typeof pg?.message === "string" ? pg.message.toLowerCase() : "";
  return message.includes("does not exist") || message.includes("undefined table") || message.includes("undefined column");
}

export async function applyReviewDecision(params: {
  eventId: string;
  reviewerId: string;
  decision: ReviewDecision;
  notes: string | null;
}): Promise<ReviewResult> {
  const result = await query<{ user_id: string; details: Record<string, unknown> }>(
    `SELECT user_id, details
     FROM point_events
     WHERE id = $1::uuid
     LIMIT 1`,
    [params.eventId],
  );
  const row = result.rows[0];
  if (!row) {
    throw new Error("Submission event not found");
  }

  const details = row.details && typeof row.details === "object" ? ({ ...row.details } as Record<string, unknown>) : {};
  const plannedXpAwarded =
    typeof details.plannedXpAwarded === "number" && Number.isFinite(details.plannedXpAwarded)
      ? Math.max(0, Math.round(details.plannedXpAwarded))
      : 0;
  const nextXpAwarded = params.decision === "approved" ? plannedXpAwarded : 0;
  const reviewStatus = params.decision === "approved" ? "auto_approved" : "pending_review";

  details.reviewStatus = reviewStatus;
  details.reviewDecision = params.decision;
  details.reviewedBy = params.reviewerId;
  details.reviewedAt = new Date().toISOString();
  if (params.notes) details.reviewNotes = params.notes;
  details.xpAwarded = nextXpAwarded;

  const existingFlags = Array.isArray(details.reviewFlags) ? details.reviewFlags.filter((f) => typeof f === "string") : [];
  if (params.decision === "rejected") {
    if (!existingFlags.includes("rejected_by_admin")) existingFlags.push("rejected_by_admin");
    details.reviewFlags = existingFlags;
  } else {
    details.reviewFlags = existingFlags.filter((flag) => flag !== "rejected_by_admin");
  }

  await query(
    `UPDATE point_events
     SET details = $2::jsonb
     WHERE id = $1::uuid`,
    [params.eventId, JSON.stringify(details)],
  );

  try {
    await query(
      `INSERT INTO admin_reviews (event_id, reviewer_id, decision, notes)
       VALUES ($1::uuid, $2, $3, $4)
       ON CONFLICT (event_id) DO UPDATE SET
         reviewer_id = EXCLUDED.reviewer_id,
         decision = EXCLUDED.decision,
         notes = EXCLUDED.notes,
         reviewed_at = NOW()`,
      [params.eventId, params.reviewerId, params.decision, params.notes],
    );
  } catch (error) {
    if (!isMissingDbObjectError(error)) throw error;
  }

  await reconcileUserProfileXp(row.user_id);

  await adjustTrustOnReview({ userId: row.user_id, decision: params.decision });
  if (params.decision === "rejected") {
    const currentProfile = await getUserProfile(row.user_id);
    if (currentProfile && (currentProfile.trustScore ?? 50) <= 20) {
      await updateUserTrust({
        userId: row.user_id,
        suspendedUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      });
    }
  }

  return {
    eventId: params.eventId,
    decision: params.decision,
    reviewStatus,
    xpAwarded: nextXpAwarded,
    userId: row.user_id,
  };
}
```

- [ ] **Step 4: Update `api/submissions/[id].ts` to import from shared module**

Remove the local `applyReviewDecision` function, the local `ReviewDecision` type, and the local `isMissingDbObjectError` helper. Replace with imports:

At the top of the file, remove:
```ts
type ReviewDecision = "approved" | "rejected" | "flagged";

function isMissingDbObjectError(error: unknown): boolean {
  // ... entire function
}

async function applyReviewDecision(params: {
  // ... entire function
}
```

Add this import:
```ts
import { applyReviewDecision, type ReviewDecision } from "../../lib/server/reviewDecision.js";
```

Also add a local `isMissingDbObjectError` is still needed in the DELETE handler — check if it's used elsewhere in the file. If only in `applyReviewDecision`, it can be fully removed. If used in DELETE too, keep a local copy.

- [ ] **Step 5: Run test to verify it passes**

Run: `node --import tsx --test tests/batchReview.test.ts`
Expected: PASS

- [ ] **Step 6: Run existing tests to verify no regressions**

Run: `npm test`
Expected: All tests pass

- [ ] **Step 7: Commit**

```bash
git add lib/server/reviewDecision.ts api/submissions/\[id\].ts tests/batchReview.test.ts
git commit -m "refactor: extract applyReviewDecision to shared module"
```

---

### Task 2: Add batch review validation schema

**Files:**
- Modify: `lib/server/validation.ts:97-102`
- Test: `tests/batchReview.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `tests/batchReview.test.ts`:

```ts
test("batchReviewBodySchema validates correct input", async () => {
  const { batchReviewBodySchema } = await import("../lib/server/validation.js");
  const result = batchReviewBodySchema.safeParse({
    eventIds: ["550e8400-e29b-41d4-a716-446655440000"],
    decision: "approved",
  });
  assert.equal(result.success, true);
});

test("batchReviewBodySchema rejects empty eventIds", async () => {
  const { batchReviewBodySchema } = await import("../lib/server/validation.js");
  const result = batchReviewBodySchema.safeParse({
    eventIds: [],
    decision: "approved",
  });
  assert.equal(result.success, false);
});

test("batchReviewBodySchema rejects more than 100 eventIds", async () => {
  const { batchReviewBodySchema } = await import("../lib/server/validation.js");
  const ids = Array.from({ length: 101 }, (_, i) => `550e8400-e29b-41d4-a716-${String(i).padStart(12, "0")}`);
  const result = batchReviewBodySchema.safeParse({
    eventIds: ids,
    decision: "approved",
  });
  assert.equal(result.success, false);
});

test("batchReviewBodySchema rejects invalid decision", async () => {
  const { batchReviewBodySchema } = await import("../lib/server/validation.js");
  const result = batchReviewBodySchema.safeParse({
    eventIds: ["550e8400-e29b-41d4-a716-446655440000"],
    decision: "deleted",
  });
  assert.equal(result.success, false);
});

test("batchReviewBodySchema accepts optional notes", async () => {
  const { batchReviewBodySchema } = await import("../lib/server/validation.js");
  const result = batchReviewBodySchema.safeParse({
    eventIds: ["550e8400-e29b-41d4-a716-446655440000"],
    decision: "rejected",
    notes: "Duplicate submission",
  });
  assert.equal(result.success, true);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --import tsx --test tests/batchReview.test.ts`
Expected: FAIL — `batchReviewBodySchema` not found

- [ ] **Step 3: Add `batchReviewBodySchema` to `lib/server/validation.ts`**

After the existing `reviewBodySchema` (around line 102), add:

```ts
export const batchReviewBodySchema = z
  .object({
    eventIds: z.array(z.string().trim().min(1)).min(1).max(100),
    decision: z.enum(["approved", "rejected", "flagged"]),
    notes: z.string().trim().max(1000).optional(),
  })
  .strict();
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --import tsx --test tests/batchReview.test.ts`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add lib/server/validation.ts tests/batchReview.test.ts
git commit -m "feat: add batchReviewBodySchema for bulk review endpoint"
```

---

### Task 3: Create batch review API endpoint

**Files:**
- Create: `api/submissions/batch-review.ts`
- Test: `tests/batchReview.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `tests/batchReview.test.ts`:

```ts
test("batch-review module exports POST handler", async () => {
  const mod = await import("../api/submissions/batch-review.js");
  assert.equal(typeof mod.POST, "function");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --import tsx --test tests/batchReview.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Create `api/submissions/batch-review.ts`**

```ts
import { requireUser } from "../../lib/auth.js";
import { errorResponse, jsonResponse } from "../../lib/server/http.js";
import { applyReviewDecision, type ReviewDecision } from "../../lib/server/reviewDecision.js";
import { logSecurityEvent } from "../../lib/server/securityAudit.js";
import { captureServerException } from "../../lib/server/sentry.js";
import { resolveAdminViewAccess, toSubmissionAuthContext } from "../../lib/server/submissionAccess.js";
import { createFraudAlert } from "../../lib/server/fraudAlerts.js";
import { batchReviewBodySchema } from "../../lib/server/validation.js";

interface BatchResultItem {
  eventId: string;
  decision: ReviewDecision;
  status: "ok" | "error";
  error?: string;
}

export async function POST(request: Request): Promise<Response> {
  const auth = await requireUser(request);
  if (!auth) return errorResponse("Unauthorized", 401);
  const viewer = toSubmissionAuthContext(auth);
  const adminAccess = resolveAdminViewAccess(viewer);
  if (adminAccess === "unauthorized") return errorResponse("Unauthorized", 401);
  if (adminAccess === "forbidden") return errorResponse("Forbidden", 403);

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return errorResponse("Invalid JSON body", 400);
  }

  const validation = batchReviewBodySchema.safeParse(rawBody);
  if (!validation.success) {
    return errorResponse(validation.error.issues[0]?.message ?? "Invalid batch review body", 400);
  }

  const { eventIds, decision, notes: rawNotes } = validation.data;
  const notes = rawNotes?.trim() ?? null;
  const results: BatchResultItem[] = [];

  for (const eventId of eventIds) {
    try {
      const updated = await applyReviewDecision({
        eventId,
        reviewerId: auth.id,
        decision,
        notes,
      });

      await logSecurityEvent({
        eventType: decision === "rejected" ? "submission_rejected" : "admin_review",
        userId: updated.userId,
        request,
        details: {
          eventId,
          reviewerId: auth.id,
          decision,
          notes,
          batch: true,
        },
      });

      if (decision !== "approved") {
        await createFraudAlert({
          eventId,
          userId: updated.userId,
          alertCode: decision === "rejected" ? "submission_rejected" : "submission_flagged",
          severity: decision === "rejected" ? "high" : "medium",
          payload: { reviewerId: auth.id, notes, batch: true },
        });
      }

      results.push({ eventId, decision, status: "ok" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      captureServerException(error, { route: "batch_review_post", eventId });
      results.push({ eventId, decision, status: "error", error: message });
    }
  }

  return jsonResponse({ results }, { status: 200 });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --import tsx --test tests/batchReview.test.ts`
Expected: All PASS

- [ ] **Step 5: Run full test suite**

Run: `npm test`
Expected: All tests pass

- [ ] **Step 6: Commit**

```bash
git add api/submissions/batch-review.ts tests/batchReview.test.ts
git commit -m "feat: add POST /api/submissions/batch-review endpoint"
```

---

### Task 4: Add user filter to AdminQueue

**Files:**
- Modify: `components/Screens/AdminQueue.tsx:325-530`

- [ ] **Step 1: Add `userFilter` state**

After line 360 (`const [riskFilter, setRiskFilter] = useState<RiskFilter>('all');`), add:

```ts
const [userFilter, setUserFilter] = useState<string>('');
```

- [ ] **Step 2: Add `uniqueUsers` memo**

After the `groupedPoints` memo (line 514), add:

```ts
const uniqueUsers = useMemo(() => {
  const map = new Map<string, { id: string; name: string }>();
  for (const item of items) {
    if (!map.has(item.user.id)) {
      map.set(item.user.id, { id: item.user.id, name: item.user.name });
    }
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
}, [items]);
```

- [ ] **Step 3: Update `filteredGroups` memo to apply user filter**

Replace the `filteredGroups` useMemo (lines 515-529) with:

```ts
const filteredGroups = useMemo(() => {
  const filtered = groupedPoints.filter((group) => {
    if (riskFilter !== 'all' && getRiskBucket(group.latestEvent) !== riskFilter) return false;
    if (userFilter && !group.events.some((e) => e.user.id === userFilter)) return false;
    return true;
  });

  return filtered.sort((a, b) => {
    const riskDelta = getRiskScore(b.latestEvent) - getRiskScore(a.latestEvent);
    if (riskDelta !== 0) return riskDelta;
    const reviewPriority = (value: string) => (value === 'pending_review' ? 1 : 0);
    const reviewDelta = reviewPriority(getReviewStatus(b.latestEvent)) - reviewPriority(getReviewStatus(a.latestEvent));
    if (reviewDelta !== 0) return reviewDelta;
    return new Date(b.latestEvent.event.createdAt).getTime() - new Date(a.latestEvent.event.createdAt).getTime();
  });
}, [groupedPoints, riskFilter, userFilter]);
```

- [ ] **Step 4: Add user filter dropdown in the UI**

In the filter bar section (around line 993, after the risk filter grid `</div>`), add the user dropdown:

```tsx
{uniqueUsers.length > 1 && (
  <select
    value={userFilter}
    onChange={(e) => setUserFilter(e.target.value)}
    className="h-10 rounded-xl border micro-label bg-page text-gray-600 border-gray-100 px-3"
  >
    <option value="">{t('All agents', 'Tous les agents')}</option>
    {uniqueUsers.map((user) => (
      <option key={user.id} value={user.id}>{user.name}</option>
    ))}
  </select>
)}
```

- [ ] **Step 5: Verify locally in the browser**

Run: `npm run dev`
- Navigate to the admin queue
- Confirm the user filter dropdown appears when there are multiple agents
- Confirm selecting a user filters the submission list
- Confirm risk filter and user filter compose correctly
- Confirm "All agents" resets the filter

- [ ] **Step 6: Commit**

```bash
git add components/Screens/AdminQueue.tsx
git commit -m "feat: add user filter dropdown to admin queue"
```

---

### Task 5: Widen mass approve and use batch endpoint

**Files:**
- Modify: `components/Screens/AdminQueue.tsx:645-700, 960-1015`

- [ ] **Step 1: Rename `selectAllLowRisk` to `selectAllEligible` and widen scope**

Replace the `selectAllLowRisk` function (lines 654-663) with:

```ts
const selectAllEligible = () => {
  const eligibleIds = filteredGroups
    .filter((g) => {
      const bucket = getRiskBucket(g.latestEvent);
      return (bucket === 'low_risk' || bucket === 'pending') && getReviewStatus(g.latestEvent) === 'pending_review';
    })
    .map((g) => g.pointId);
  setSelectedForBulk((prev) => {
    const allSelected = eligibleIds.length > 0 && eligibleIds.every((id) => prev.has(id));
    if (allSelected) return new Set();
    return new Set(eligibleIds);
  });
};
```

- [ ] **Step 2: Replace `handleBulkApproveLowRisk` with `handleBulkApprove` using batch API**

Replace the `handleBulkApproveLowRisk` function (lines 665-700) with:

```ts
const handleBulkApprove = async () => {
  if (isApplyingDecision) return;

  const targetGroups = selectedForBulk.size > 0
    ? filteredGroups.filter((g) => selectedForBulk.has(g.pointId) && getReviewStatus(g.latestEvent) === 'pending_review')
    : filteredGroups.filter((group) => {
        const bucket = getRiskBucket(group.latestEvent);
        return (bucket === 'low_risk' || bucket === 'pending') && getReviewStatus(group.latestEvent) === 'pending_review';
      });

  if (targetGroups.length === 0) {
    setActionMessage(t('No pending groups to approve.', 'Aucun groupe en attente à approuver.'));
    return;
  }

  const confirmed = window.confirm(
    t(`Approve ${targetGroups.length} submissions?`, `Approuver ${targetGroups.length} soumissions ?`),
  );
  if (!confirmed) return;

  setActionMessage('');
  setDeleteError('');
  try {
    setIsApplyingDecision(true);
    const eventIds = targetGroups.map((g) => g.latestEvent.event.id);
    const response = await apiJson<{ results: Array<{ eventId: string; status: string; error?: string }> }>(
      '/api/submissions/batch-review',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventIds, decision: 'approved' }),
      },
    );

    let okCount = 0;
    let failCount = 0;
    for (const result of response.results) {
      if (result.status === 'ok') {
        applyReviewToLocalState(result.eventId, 'approved');
        okCount++;
      } else {
        failCount++;
      }
    }

    setSelectedForBulk(new Set());
    if (failCount === 0) {
      setActionMessage(t(`${okCount} group(s) approved.`, `${okCount} groupe(s) approuves.`));
    } else {
      setActionMessage(
        t(`${okCount} approved, ${failCount} failed.`, `${okCount} approuves, ${failCount} echoues.`),
      );
    }
  } catch (error) {
    setDeleteError(error instanceof Error ? error.message : t('Bulk approve failed.', 'Approbation en lot impossible.'));
  } finally {
    setIsApplyingDecision(false);
  }
};
```

- [ ] **Step 3: Update button labels in the UI**

Find the "Select Low-Risk" button (around line 975) and replace:

```tsx
<button
  type="button"
  onClick={selectAllEligible}
  className="h-10 rounded-2xl px-3 micro-label bg-gray-50 text-gray-600 border border-gray-100"
>
  {t('Select Eligible', 'Selectionner eligibles')}
</button>
<button
  type="button"
  onClick={handleBulkApprove}
  disabled={isApplyingDecision}
  className={`h-10 rounded-2xl px-4 micro-label ${
    isApplyingDecision ? 'bg-gray-100 text-gray-400' : 'bg-navy text-white'
  }`}
>
  {isApplyingDecision
    ? t('Approving...', 'Approbation...')
    : selectedForBulk.size > 0
      ? `${t('Approve', 'Approuver')} (${selectedForBulk.size})`
      : t('Approve Eligible', 'Approuver eligibles')}
</button>
```

- [ ] **Step 4: Verify locally in the browser**

Run: `npm run dev`
- Test mass approve with no selection (should target low-risk + pending)
- Test mass approve with checkboxes selected
- Test that confirmation dialog appears with correct count
- Test that user filter + mass approve compose (filter to one agent, mass approve their submissions)
- Test the "Approving..." loading state

- [ ] **Step 5: Run full test suite**

Run: `npm test`
Expected: All tests pass

- [ ] **Step 6: Run typecheck**

Run: `npm run typecheck`
Expected: No type errors

- [ ] **Step 7: Commit**

```bash
git add components/Screens/AdminQueue.tsx
git commit -m "feat: widen mass approve to low-risk + pending and use batch API"
```

---

### Task 6: Final verification

- [ ] **Step 1: Run full CI check**

Run: `npm run test:ci`
Expected: lint + typecheck + test + build all pass

- [ ] **Step 2: Manual smoke test**

Run: `npm run dev`
Verify:
1. Admin queue loads normally
2. User filter dropdown shows all agents who have submissions
3. Selecting an agent filters the list
4. Risk filter and user filter compose correctly
5. "Select Eligible" selects all low-risk + pending items in the filtered view
6. "Approve Eligible" triggers confirmation dialog
7. Batch approve succeeds and updates local state
8. Partial failures show the count message
9. Keyboard shortcuts (A/R/H) still work on individual items

- [ ] **Step 3: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: address issues found during final verification"
```
