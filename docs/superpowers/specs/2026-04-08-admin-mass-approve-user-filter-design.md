# Admin Mass Approve & Filter by User

**Date**: 2026-04-08
**Status**: Approved
**Scope**: AdminQueue component + new batch review API endpoint

## Problem

Admins reviewing submissions in the AdminQueue need two capabilities that are missing or incomplete:

1. **Mass approve**: The existing bulk approve only targets low-risk pending items via sequential API calls (one per submission). This is slow and unreliable on flaky connections. Admins also need to approve pending (medium-risk) items in bulk.
2. **Filter by user**: There is no way to filter submissions by the agent who submitted them. Admins investigating a specific agent's work must scroll through the entire list.

## Design Decisions

- Mass approve scope: low-risk + pending risk buckets (flagged/high-risk must be reviewed individually)
- Batch API: single endpoint accepting multiple event IDs in one request (replaces sequential calls)
- User filter: single-user select derived from loaded items (no extra API call)
- Filters compose with bulk: mass approve acts on whatever is visible after all active filters (risk + user)

## 1. Batch Review API Endpoint

### New file: `api/submissions/batch-review.ts`

**Export**: `POST` handler

**Request body**:
```ts
{
  eventIds: string[];        // max 100
  decision: "approved" | "rejected" | "flagged";
  notes?: string;
}
```

**Auth**: `requireUser()` + `resolveAdminViewAccess()` (same admin check as existing single-item review in `api/submissions/[id].ts`)

**Validation**:
- `eventIds` must be a non-empty string array, max 100 items
- `decision` must be one of the three valid values
- Reject with 400 if validation fails

**Processing**:
- For each event ID, execute the same logic as `applyReviewDecision()` in `api/submissions/[id].ts`:
  - Load event row from `point_events`
  - Update `details` JSONB: `reviewStatus`, `reviewDecision`, `reviewedBy`, `reviewedAt`, `xpAwarded`, `reviewFlags`
  - Insert into `admin_reviews` table
  - Reconcile user XP via `reconcileUserProfileXp()`
  - Adjust trust via `adjustTrustOnReview()` + `updateUserTrust()`
- Process sequentially within the single request (not parallel) to avoid DB contention
- On individual event failure: log the error, continue processing remaining events

**Response** (200):
```ts
{
  results: Array<{
    eventId: string;
    decision: "approved" | "rejected" | "flagged";
    status: "ok" | "error";
    error?: string;
  }>;
}
```

**Error responses**:
- 400: invalid body
- 401: not authenticated
- 403: not admin

### Imports to reuse

- `requireUser` from `lib/auth.ts`
- `resolveAdminViewAccess`, `toSubmissionAuthContext` from `lib/server/submissionAccess.ts`
- `query` from `lib/server/db.ts`
- `jsonResponse`, `errorResponse` from `lib/server/http.ts`
- `reconcileUserProfileXp` from `lib/server/xp.ts`
- `adjustTrustOnReview`, `updateUserTrust` from `lib/server/userTrust.ts`
- `logSecurityEvent` from `lib/server/securityAudit.ts`
- `captureServerException` from `lib/server/sentry.ts`
- `reviewBodySchema` from `lib/server/validation.ts` (extend or create batch variant)

### Shared logic extraction

The `applyReviewDecision()` function currently lives inside `api/submissions/[id].ts`. To avoid duplication, extract it to a shared module (e.g. `lib/server/reviewDecision.ts`) and import from both `[id].ts` and `batch-review.ts`.

## 2. User Filter (Frontend)

### New state in `AdminQueue.tsx`

```ts
const [userFilter, setUserFilter] = useState<string>('');
```

### Derive unique users

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

### UI placement

A `<select>` dropdown in the filter bar, placed between the risk filter pills and the "Select Low-Risk" button. Styled consistently:

```
h-10 rounded-xl border micro-label bg-page text-gray-600 border-gray-100
```

Options:
- Default: "All agents" / "Tous les agents" (value: `""`)
- One option per unique user: `user.name` (value: `user.id`)

### Integration with filteredGroups

Extend the existing `filteredGroups` useMemo to apply the user filter:

```ts
const filteredGroups = useMemo(() => {
  return groupedPoints
    .filter((group) => {
      // Risk filter (existing)
      if (riskFilter !== 'all' && getRiskBucket(group.latestEvent) !== riskFilter) return false;
      // User filter (new)
      if (userFilter && !group.events.some((e) => e.user.id === userFilter)) return false;
      return true;
    })
    .sort(/* existing sort logic */);
}, [groupedPoints, riskFilter, userFilter]);
```

Add `userFilter` to the dependency array.

### Reset behavior

When `userFilter` changes, reset `selectedPointId` to the first item in the new filtered list (existing pattern from `riskFilter` effect).

## 3. Mass Approve (Frontend)

### Widen bulk approve scope

Rename `handleBulkApproveLowRisk` to `handleBulkApprove`. Change the targeting logic:

**If checkboxes selected** (`selectedForBulk.size > 0`):
- Target groups in `filteredGroups` where `selectedForBulk.has(group.pointId)` AND `getReviewStatus(group.latestEvent) === 'pending_review'`

**If no checkboxes selected**:
- Target groups in `filteredGroups` where risk bucket is `low_risk` OR `pending`, AND `getReviewStatus(group.latestEvent) === 'pending_review'`

### Rename selectAllLowRisk

Rename to `selectAllEligible`. Selects all `low_risk` + `pending` groups in `filteredGroups`.

### Confirmation dialog

Before firing the batch request, show:
```
window.confirm(`Approve ${targetGroups.length} submissions?`)
```

### API call

Replace the sequential loop:
```ts
// Before (sequential)
for (const group of targetGroups) {
  await apiJson(`/api/submissions/${id}?view=review`, { method: 'PATCH', ... });
}

// After (batch)
const eventIds = targetGroups.map((g) => g.latestEvent.event.id);
const result = await apiJson<BatchReviewResponse>('/api/submissions/batch-review', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ eventIds, decision: 'approved' }),
});
```

### Handle response

- For each result with `status: "ok"`, call `applyReviewToLocalState(eventId, 'approved')`
- Clear `selectedForBulk`
- Show success message: "N group(s) approved"
- If any results have `status: "error"`, show: "N approved, M failed. Failed: [list of site names]"

### Button labels

Update the button text to reflect the wider scope:
- No selection: "Approve Eligible" / "Approuver eligibles"
- With selection: "Approve (N)" / "Approuver (N)"

Update the select-all button:
- "Select Eligible" / "Selectionner eligibles"

### Button state

- Disabled while `isApplyingDecision` is true
- Shows "Approving..." / "Approbation..." while in flight

## 4. Keyboard Shortcuts

No changes. Existing A/R/H shortcuts continue to operate on the single selected item. Mass approve is button-only to prevent accidental bulk actions.

## 5. Bilingual Support

All new user-facing strings follow the existing `t(en, fr)` pattern:
- "All agents" / "Tous les agents"
- "Select Eligible" / "Selectionner eligibles"
- "Approve Eligible" / "Approuver eligibles"
- "Approving..." / "Approbation..."
- "N approved, M failed" / "N approuves, M echoues"

## Files Changed

| File | Change |
|------|--------|
| `api/submissions/batch-review.ts` | **New** - batch review endpoint |
| `lib/server/reviewDecision.ts` | **New** - extracted `applyReviewDecision()` |
| `api/submissions/[id].ts` | Import `applyReviewDecision` from shared module instead of local function |
| `components/Screens/AdminQueue.tsx` | Add user filter state/UI, widen bulk approve, use batch API |
| `lib/server/validation.ts` | Add `batchReviewBodySchema` |

## Out of Scope

- Server-side user filtering (current dataset fits client-side filtering)
- Multi-select user filter
- Mass reject/flag (only mass approve for now)
- Keyboard shortcut for mass approve
- Dark mode considerations
