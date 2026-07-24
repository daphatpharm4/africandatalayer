# ADL Bug Fixes Design

**Status:** Draft design

**Bug tracking:** C1, C2, H1, H2, M1, M2, M3, M4, L1, L2, L3, L4

## Objective

Fix 12 verified bugs across the iOS console app and web API, ordered by severity. Each fix is less than 10 lines, targeted at the specific code path, and verified by existing test suites plus added regression tests where coverage is absent.

## Bug Inventory

### C1 (CRITICAL) — SyncEngine.swift:78 return on retryable error exits drain loop

**File:** `ios-console/ADLConsole/Runtime/SyncEngine.swift`

**Problem:** The `drain()` while-loop calls `return` on `.retryable` error at line 78 instead of `continue`. This exits the entire drain loop after a single retryable failure, skipping every remaining record in the queue. Those records are not processed until the next `trigger()` call.

**Fix:** Replace `return` with `continue` on line 78. Also check lines 81 and 94 for the same pattern.

**Verification:** `SyncEngineTests.swift` — add a test that enqueues 3 records where the middle one fails with a retryable error, then asserts all 3 are eventually processed.

### C2 (CRITICAL) — reviewDecision.ts:89 rejected submissions persist in queue forever

**File:** `lib/server/reviewDecision.ts`

**Problem:** Line 89 sets `reviewStatus` to `"pending_review"` for any non-approved decision (`"rejected"` or `"flagged"`). The `getBatchApproveSkipReason` function at line 168 checks that the status is `"pending_review"` before allowing batching — but a rejected submission with that status appears in the review queue permanently with no terminal state, since no other code path transitions it out.

**Fix:** 
- `"rejected"` → `reviewStatus = "rejected"` (terminal — removed from queue)
- `"flagged"` → keep `"pending_review"` (flagged items still need human review)

**Downstream audit required:** Must update `getAdminReviewStatusFromDetails` in `lib/shared/adminReviewQueue.ts` to treat `"rejected"` as finalized. Review all API consumers that filter on `"pending_review"` — the analytics query at `api/analytics/index.ts:689`, submission status checks at `api/submissions/index.ts:1195`, and the `PointOperatorReviewState` type at `shared/types.ts:15`.

**Verification:** Add test cases in the review decision test suite: assert rejected submissions are not returned by pending-review queries.

### H1 (HIGH) — CaptureMediaStore.swift:110 existingCount ignores .webp/.heic

**File:** `ios-console/ADLConsole/CaptureStorage/CaptureMediaStore.swift`

**Problem:** `existingCount` at line 110 filters only `.jpg`, `.jpeg`, `.png`. The `fileExtension` method already maps `.webp` and `.heic` mime types to their extensions, but `existingCount` won't count those files. When multiple files for different record types are staged in the same directory, ordinal assignment collides — two files may get the same ordinal `0`.

**Fix:** Change the filter to use the `fileExtension` helper or extend the suffix list to include `webp`, `heic`, `heif`.

**Verification:** `CaptureMediaStoreTests.swift` — add test staging a `.webp` file then a `.jpg` file, assert ordinals are 0 and 1.

### H2 (HIGH) — CaptureViewModel.swift:367 hardcoded "pending" ownerUserID

**File:** `ios-console/ADLConsole/Screens/Capture/CaptureViewModel.swift`

**Problem:** Line 367 uses `ownerUserID: "pending"` instead of the view model's `ownerUserID` property (available at line 99). This means staged media is stored under a literal `"pending"` owner directory rather than the real user, breaking retrieval and cleanup.

**Fix:** Replace `"pending"` with `ownerUserID ?? "pending"`.

**Verification:** `CaptureCoordinatorTests.swift` or `CaptureViewModelTests.swift` — assert the stored media path contains the user ID.

### M1 (MEDIUM) — ADLImageCache.swift:17 unsynchronized NSCache data race

**File:** `ios-console/ADLConsole/Support/ADLImageCache.swift`

**Problem:** `ADLImageCacheImpl` is `@unchecked Sendable` with a bare `NSCache<NSURL, UIImage>`. `NSCache` is not thread-safe; two concurrent `image(for:targetSize:)` calls from different tasks can race on the cache. The class is marked `@unchecked Sendable` which suppresses the compiler warning without fixing the race.

**Fix:** Add `OSAllocatedUnfairLock()` around all cache reads/writes in the `image(for:targetSize:)` method.

**Verification:** `ADLImageCache` tests — add concurrent access test with 10 parallel requests.

### M2 (MEDIUM) — SyncEngine.swift:53-62 concurrent trigger race + deadlock

**File:** `ios-console/ADLConsole/Runtime/SyncEngine.swift`

**Problem:** `trigger()` has a race window: Task A checks `drainTask == nil` (line 54), Task B also checks `drainTask == nil`, both pass. Task A sets `drainTask` to its task. Task B sets `drainTask` to its task (overwriting A's reference). Task B awaits its drain. Task A awaits `drainTask.value` — but `drainTask` now points to B's task, and A's original drain task is orphaned. Can cause deadlock if A was supposed to drain records that B doesn't know about.

**Fix:** Use an enum-based state machine protected by an `OSAllocatedUnfairLock`:

```swift
private let triggerLock = OSAllocatedUnfairLock()
private var drainTask: Task<Void, Never>?

func trigger(_ trigger: SyncTrigger) async {
    let task: Task<Void, Never>? = triggerLock.withLock {
        if drainTask != nil { return nil }
        let t = Task { await drain() }
        drainTask = t
        return t
    }
    await task?.value
    triggerLock.withLock { drainTask = nil }
}
```

**Verification:** `SyncEngineTests.swift` — add concurrent trigger test firing 5 triggers simultaneously.

### M3 (MEDIUM) — SyncEngine.swift:65 try? swallows DB errors silently

**File:** `ios-console/ADLConsole/Runtime/SyncEngine.swift`

**Problem:** Line 65 uses `try?` in the `while let` condition: `while let record = try? await ledger.claimNextDue(...)`. If the database call throws (e.g., disk full, corruption), `try?` converts the throw to `nil`, terminating the while loop and the entire drain operation. No error is logged, and the engine silently stops processing.

**Fix:** Wrap in `do/catch`, log the error with `os.log`, and `continue` to retry on the next trigger:

```swift
private func drain() async {
    while true {
        if Task.isCancelled { break }
        let record: LedgerRecord
        do {
            guard let next = try await ledger.claimNextDue(ownerUserID: ownerUserID, organizationID: organizationID) else { break }
            record = next
        } catch {
            // Log and continue — transient DB errors should not halt the engine
            await self?.logDBError(error)  // or use os_log
            break  // on DB errors, break to avoid tight loop; next trigger retries
        }
        // ... rest of drain
    }
}
```

**Verification:** Test with a mock ledger that throws on `claimNextDue`.

### M4 (MEDIUM) — AppState.swift syncEngines dictionary grows unbounded

**File:** `ios-console/ADLConsole/State/AppState.swift`

**Problem:** `syncEngines` at line 74 is `[String: SyncEngine]`. Every call to `durableSyncEngine(organizationID:)` adds a new entry. Organizations can be switched but old engines are never removed. Over time (or with many orgs) this leaks memory and stale engine instances.

**Fix:** 
- Clear `syncEngines` in `selectOrganization()` before building the new engine.
- Clear `syncEngines` in `signOut()`.

**Verification:** Unit test that selects 3 organizations and asserts only 1 engine exists at a time.

### L1 (LOW) — LocationService.swift continuation leak

**File:** `ios-console/ADLConsole/Support/LocationService.swift`

**Problem:** `continuation` property at line 40 is overwritten if `requestOneShotLocation()` is called while a prior call's continuation is still pending. The old continuation is never resumed (leak + potential hang). Also, task cancellation is not handled — a cancelled caller will hang forever because its continuation is never resumed.

**Fix:**
- On re-entry: resume old continuation with `CancellationError()` before overwriting.
- Add `withTaskCancellationHandler` to resume with `CancellationError()` on cancellation.

**Verification:** Test calling `requestOneShotLocation()` twice in quick succession; second call resumes the first with cancellation.

### L2 (LOW) — PendingWorkViewModel.swift fragile discard

**File:** `ios-console/ADLConsole/Screens/PendingWork/PendingWorkViewModel.swift`

**Problem:** `confirmDiscard()` at line 106 calls `ledger.discard()` first, then `mediaStore.discard()`. If the ledger discard succeeds but the media store discard fails, the ledger record is gone but media files are orphaned on disk.

**Fix:** Reverse the order: discard media first, then discard from ledger. If media discard fails, don't discard from ledger (no orphaned state). Both in the same `do/catch`.

### L3 (LOW) — CaptureViewModel submit validate-then-construct gap

**File:** `ios-console/ADLConsole/Screens/Capture/CaptureViewModel.swift`

**Problem:** `submit()` calls `validate()` then separately constructs `recordData` from raw `values`. The `evidencePhotoRefs` used for the photo count in validation don't include photos in `pendingMedia` (prepared but not staged). If a user prepares a photo but doesn't attach it as evidence, validation passes but the draft is missing the photo.

**Fix:** Ensure `evidencePhotoRefs` is in sync with staged media before validation. Make `preparePhoto` add a ref that validation can count, and remove it if the user discards without staging.

## File Change Summary

| File | Change |
|------|--------|
| `ios-console/ADLConsole/Runtime/SyncEngine.swift` | 3 bugs (C1, M2, M3) |
| `lib/server/reviewDecision.ts` | 1 bug (C2) |
| `ios-console/ADLConsole/CaptureStorage/CaptureMediaStore.swift` | 1 bug (H1) |
| `ios-console/ADLConsole/Screens/Capture/CaptureViewModel.swift` | 2 bugs (H2, L3) |
| `ios-console/ADLConsole/Support/ADLImageCache.swift` | 1 bug (M1) |
| `ios-console/ADLConsole/State/AppState.swift` | 1 bug (M4) |
| `ios-console/ADLConsole/Support/LocationService.swift` | 1 bug (L1) |
| `ios-console/ADLConsole/Screens/PendingWork/PendingWorkViewModel.swift` | 1 bug (L2) |

## Testing Strategy

- Run existing `npm test` (web) — should not regress.
- Run existing `xcodebuild test -project ADLConsole.xcodeproj` — should not regress.
- Add regression test for C1 (multi-record drain with middle failure).
- Add regression test for C2 (rejected/flagged review status is terminal).
- Add regression test for H1 (webp + jpg ordinals).
- Add regression test for M1 (concurrent cache access).
- Add regression test for M2 (concurrent triggers).
- Add regression test for M4 (engine cleanup on org switch).
- Add regression test for L1 (re-entrant location request).
- Verify L2 (media-before-ledger discard order) via existing tests.

## Risk

- C2 changes the `reviewStatus` string — downstream API consumers that hardcode `"pending_review"` instead of using `getAdminReviewStatusFromDetails` will break. Need to audit all references.
- M2 introduces a lock in the hot path of `trigger()`. Lock contention is extremely unlikely (SyncEngine is an actor, trigger is serial) but the lock is held briefly.
