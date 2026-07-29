# ADL Bug Fixes Design

**Status:** Revised after code verification (2026-07-24)

**Bug tracking:** C1, H1, H2, M3, M4, L1, L2, L3 (verified real). Withdrawn after verification: C2, M1, M2, L4.

## Objective

Fix the **8 verified real bugs** across the iOS console app and web API, ordered by severity. Each fix is small, targeted at the specific code path, and verified by existing test suites plus added regression tests where coverage is absent.

## Verification note (why 4 items were withdrawn)

A code re-derivation pass against the real files invalidated four originally-listed items. They are documented in the "Withdrawn / false-positive" section below so the analysis is not silently lost. Do **not** implement them.

- **C2** — premise contradicted by `getReviewFinality` (finality derives from `reviewDecision`, not `reviewStatus`).
- **M1** — `NSCache` is thread-safe per Apple docs; no race exists.
- **M2** — the described race is prevented by `actor` isolation (no suspension point between check and set).
- **L4** — was never actually defined; no such bug.

## Bug Inventory

### C1 (CRITICAL) — SyncEngine.swift:78 return on retryable error exits drain loop

**File:** `ios-console/ADLConsole/Runtime/SyncEngine.swift`

**Problem:** The `drain()` while-loop calls `return` on `.retryable` error at line 78 instead of `continue`. This exits the entire drain loop after a single retryable failure, skipping every remaining record in the queue. Those records are not processed until the next `trigger()` call.

**⚠️ Behavior-change caveat (needs a product call, not a blind fix):** `return` on `.retryable` currently acts as a **circuit-breaker** — on a network outage the first failure stops the drain and the queue waits for the next `trigger()` (foreground/reconnect). Changing to `continue` makes the engine walk the *entire* queue on every drain even during an outage, where each record fails retryable in turn — more radio wake-ups and battery drain. That directly tensions CLAUDE.md's field-first / 2G / low-battery principle. Recommended: keep `.retryable` as `return` (or `break`) — a network failure is queue-wide, not record-specific — and only reconsider if a *single* poison record is proven to block others. The `.authentication`/`.authorization` returns (lines 81/83) are correct as-is (auth failure is queue-wide). The `.validation`/`.storage` cases already fall through and `continue` naturally, which is correct (per-record failures).

**Fix (conditional):** Only apply `return → continue` on line 78 if the product decision favors per-record progress over the circuit-breaker. Otherwise C1 is **not a bug**. Do not touch lines 81/83.

**Verification:** `SyncEngineTests.swift` — if applied, add a test enqueuing 3 records where the middle fails retryable, asserting r1 and r3 are acknowledged and r2 has a retry recorded.

### H1 (HIGH) — CaptureMediaStore.swift:110 existingCount ignores .webp

**File:** `ios-console/ADLConsole/CaptureStorage/CaptureMediaStore.swift`

**Problem:** `existingCount` at line 110 filters only `.jpg`, `.jpeg`, `.png`. The `fileExtension` helper (lines 113-118) maps `image/webp → "webp"`, so a staged webp file is written as `.webp` but **not counted** by `existingCount`. When multiple files are staged in the same directory, ordinal assignment collides — a webp and a jpg may both get ordinal `0`.

**Scope correction:** Only `.webp` is affected. `image/heic` is **not** mapped by `fileExtension` — it falls through to the `default: "jpg"` case, so heic files are already written as `.jpg` and already counted. Adding `.heic`/`.heif` suffixes is dead code. Fix is `.webp` only.

**Fix:** Add `|| $0.hasSuffix(".webp")` to the filter (or route through the `fileExtension` helper).

**Verification:** `CaptureMediaStoreTests.swift` — stage a `.webp` file then a `.jpg` file, assert ordinals are 0 and 1.

### H2 (HIGH) — CaptureViewModel.swift:367 hardcoded "pending" ownerUserID

**File:** `ios-console/ADLConsole/Screens/Capture/CaptureViewModel.swift`

**Problem:** Line 367 uses `ownerUserID: "pending"` instead of the view model's `ownerUserID` property (available at line 99). This means staged media is stored under a literal `"pending"` owner directory rather than the real user, breaking retrieval and cleanup.

**Fix:** Replace `"pending"` with `ownerUserID ?? "pending"`.

**Verification:** `CaptureCoordinatorTests.swift` or `CaptureViewModelTests.swift` — assert the stored media path contains the user ID.

### M3 (MEDIUM) — SyncEngine.swift:65 try? swallows DB errors silently

**File:** `ios-console/ADLConsole/Runtime/SyncEngine.swift`

**Problem:** Line 65 uses `try?` in the `while let` condition: `while let record = try? await ledger.claimNextDue(...)`. If the database call throws (e.g., disk full, corruption), `try?` converts the throw to `nil`, terminating the while loop and the entire drain operation. No error is logged, and the engine silently stops processing.

**Fix:** Wrap the claim in `do/catch`, log the error with `os_log`, and `break` (the next `trigger()` retries — a tight `continue` loop on a persistent DB error would spin). `self` is non-optional inside the actor method — do not use `self?`.

```swift
private func drain() async {
    while true {
        if Task.isCancelled { break }
        let record: LedgerRecord
        do {
            guard let next = try await ledger.claimNextDue(ownerUserID: ownerUserID, organizationID: organizationID) else { break }
            record = next
        } catch {
            os_log(.error, "SyncEngine.drain: DB error on claimNextDue: %{public}@", String(describing: error))
            break  // on DB errors, break to avoid a tight spin; next trigger retries
        }
        // ... existing per-record submit/acknowledge/retry body, unchanged ...
    }
}
```

Note: this rewrite moves the existing per-record body (currently inside `while let record = ...`) into the loop after the claim. Preserve that body verbatim — only the loop condition and error handling change.

**Verification:** Test with a mock ledger that throws on `claimNextDue`; assert the engine returns without hanging or crashing.

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
| `ios-console/ADLConsole/Runtime/SyncEngine.swift` | M3 (C1 only if product approves the behavior change) |
| `ios-console/ADLConsole/CaptureStorage/CaptureMediaStore.swift` | 1 bug (H1, webp only) |
| `ios-console/ADLConsole/Screens/Capture/CaptureViewModel.swift` | 2 bugs (H2, L3) |
| `ios-console/ADLConsole/State/AppState.swift` | 1 bug (M4) |
| `ios-console/ADLConsole/Support/LocationService.swift` | 1 bug (L1) |
| `ios-console/ADLConsole/Screens/PendingWork/PendingWorkViewModel.swift` | 1 bug (L2) |

## Testing Strategy

- Run existing `npm test` (web) — should not regress.
- Run existing `xcodebuild test -project ADLConsole.xcodeproj` — should not regress.
- Add regression test for H1 (webp + jpg ordinals).
- Add regression test for M3 (mock ledger throws on `claimNextDue` → engine returns, no hang).
- Add regression test for M4 (engine cleanup on org switch).
- Add regression test for L1 (re-entrant location request).
- Verify L2 (media-before-ledger discard order) via a test where media discard fails and ledger discard must not run.
- C1: add a test only if the product decision is to apply it.

## Risk

- **M4** clears `syncEngines` on org switch/sign-out. Ensure no in-flight drain is silently dropped mid-sync — clearing the dict releases the actor reference; an in-progress `Task` continues to completion but its acknowledgements still land. Acceptable, but confirm no test asserts engine identity stability across a switch.
- **L1** rewrite touches `CoreLocationService` continuation handling, which already has an `NSLock` (line 41). The fix must use that existing lock consistently, not introduce a second synchronization primitive.
- **H2** uses `ownerUserID ?? "pending"` (or `"anonymous"`). Pick one fallback string and keep spec and plan consistent (the plan currently says `"anonymous"`).

## Withdrawn / false-positive items (do NOT implement)

Kept for traceability — each was invalidated by re-deriving against the actual code.

- **C2 (was CRITICAL)** — `lib/server/reviewDecision.ts:89`. Claim: rejected submissions persist in the queue forever. **False.** `getReviewFinality` (`lib/shared/adminReviewQueue.ts:145-179`) derives finality from `reviewDecision` first (set to `"rejected"` at `reviewDecision.ts:92`), yielding `isFinalized=true`. Batch-approve already skips rejected items (`getBatchApproveSkipReason` → `"already_finalized"`; `isAdminBulkApproveCandidate` → `state !== "pending"` → false). Changing `reviewStatus` to `"rejected"` is unnecessary and risks the queue-filter and risk-bucket logic that keys on `"pending_review"`.
- **M1 (was MEDIUM)** — `ADLImageCache.swift:17`. Claim: `NSCache` data race. **False.** `NSCache` is documented thread-safe by Apple; `@unchecked Sendable` is correct precisely because of that. Adding `OSAllocatedUnfairLock` is dead complexity.
- **M2 (was MEDIUM)** — `SyncEngine.swift:53-62`. Claim: check-then-set race in `trigger()`. **False.** `SyncEngine` is an `actor`; there is no `await` between the nil-check (line 54) and the set (line 59) — `Task { }` creation does not suspend — so actor isolation makes 54→59 atomic and the described interleave cannot occur. The originally-proposed "fix" also *removed* `await drainTask.value` for the concurrent case and nil'd the non-owning caller's task reference, introducing a real regression.
- **L4** — listed in the original bug-tracking line but never defined. No such bug exists.
