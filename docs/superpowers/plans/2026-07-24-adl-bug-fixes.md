# Bug Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the **8 verified real bugs** across iOS console and web API. After code verification, **C2, M1, M2, and L4 were withdrawn** (false positives / never-defined — see the design doc's "Withdrawn" section). **C1** is a behavior change gated on a product decision and is **deferred by default**. Default apply set: **H1, H2, M3, M4, L1, L2, L3**.

**Architecture:** Each bug is a targeted small fix in one file, verified by existing test suites plus a regression test per bug. Tasks are grouped by source file. Order follows severity.

**Removed tasks:** original Task 2 (C2) and Task 5 (M1) are deleted — the bugs do not exist. Task numbers below are left as-is to avoid churn; skip the gaps.

**Tech Stack:** Swift 6 (iOS console), TypeScript (web API), XCTest (iOS), Node.js native test runner (web)

## Global Constraints

- All existing tests must pass before and after (`npm test` for web, `xcodebuild test` for iOS)
- No API contract changes
- Swift files use `os_log` for logging (not `print`)
- TypeScript files use existing logging patterns (`console.warn`)
- Commits use conventional commits format

---

### Task 1: Fix SyncEngine.swift (M3; C1 deferred; M2 withdrawn)

**Files:**
- Modify: `ios-console/ADLConsole/Runtime/SyncEngine.swift:64-97`
- Test: `ios-console/ADLConsoleTests/SyncEngineTests.swift`

**Interfaces:**
- Consumes: `SyncEngine`, `SyncTrigger`, `RecordLedger`, `RecordSubmitting`, `CaptureMediaStoreProtocol`
- Produces: Fixed `drain()`

**Scope note:** M2 is withdrawn (actor isolation prevents the claimed race; the old fix introduced a regression). C1 (`return → continue` on `.retryable`) is a battery/behavior trade-off deferred to a product decision — **do not apply by default**. This task implements **M3 only**.

- [ ] **Step 1: Write failing test for M3**

```swift
// In SyncEngineTests.swift, after existing tests
func testDBErrorOnClaimDoesNotHaltEngine() async {
    let ledger = MockRecordLedger()
    ledger.claimNextDueShouldThrow = true
    let submitter = MockRecordSubmitter()
    let engine = makeEngine(ledger: ledger, submitter: submitter)
    await engine.trigger(.manual)
    // Engine should return without crashing or hanging; error is logged, not swallowed silently.
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `xcodebuild test -project ADLConsole.xcodeproj -scheme ADLConsole -only-testing ADLConsoleTests/SyncEngineTests -destination 'platform=iOS Simulator,name=iPhone 15' 2>&1 | tail -30`
Expected: Test fails or hangs (current `try?` swallows the throw and terminates the loop with no signal)

- [ ] **Step 3: Fix M3 — replace `try?` with logged `do/catch`**

Replace the `drain()` while-loop condition. `self` is non-optional inside the actor method — do **not** use `self?`. Move the existing per-record submit/acknowledge/retry body verbatim into the new loop after the claim; only the loop condition and error handling change:
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
            break  // next trigger retries; break avoids a tight spin on a persistent DB error
        }
        // ... existing per-record body (submit → recordAcknowledgement → removeAcknowledged, with the
        //     SyncSubmissionError switch and the unknown-error catch), UNCHANGED ...
    }
}
```

Leave the `.retryable`/`.authentication`/`.authorization` `return`s as they are (C1 deferred; auth returns are correct).

- [ ] **Step 4: Run test to verify it passes**

Run: `xcodebuild test -project ADLConsole.xcodeproj -scheme ADLConsole -only-testing ADLConsoleTests/SyncEngineTests -destination 'platform=iOS Simulator,name=iPhone 15' 2>&1 | tail -30`
Expected: All SyncEngine tests PASS

- [ ] **Step 5: Commit**

```bash
git add ios-console/ADLConsole/Runtime/SyncEngine.swift ios-console/ADLConsoleTests/SyncEngineTests.swift
git commit -m "fix: SyncEngine drain logs and breaks on DB error instead of silently halting (M3)"
```

---

### Task 2: REMOVED (C2 was a false positive)

C2 does not exist. `getReviewFinality` (`lib/shared/adminReviewQueue.ts:145-179`) already treats a rejected submission as finalized via `reviewDecision` (set at `reviewDecision.ts:92`), so batch-approve and the queue-finality checks already exclude it. Changing `reviewStatus` to `"rejected"` would be unnecessary and would perturb the risk-bucket / queue-filter logic that keys on `"pending_review"`. See the design doc's "Withdrawn" section. **No work here.**

---

### Task 3: Fix CaptureMediaStore.swift (H1)

**Files:**
- Modify: `ios-console/ADLConsole/CaptureStorage/CaptureMediaStore.swift:110`
- Test: `ios-console/ADLConsoleTests/CaptureMediaStoreTests.swift`

- [ ] **Step 1: Write failing test for H1**

```swift
// In CaptureMediaStoreTests.swift
func testExistingCountIncludesWebp() async throws {
    let store = InMemoryCaptureMediaStore()
    let webp = PreparedCaptureMedia(data: Data([0x52, 0x49, 0x46]), mimeType: "image/webp", sha256: "def", pixelWidth: 100, pixelHeight: 100)
    let jpg = PreparedCaptureMedia(data: Data([0xFF, 0xD8, 0xFF]), mimeType: "image/jpeg", sha256: "abc", pixelWidth: 100, pixelHeight: 100)

    let a1 = try await store.stage(webp, ownerUserID: "u1", organizationID: "o1", recordLocalID: "r1")
    let a2 = try await store.stage(jpg, ownerUserID: "u1", organizationID: "o1", recordLocalID: "r1")

    XCTAssertEqual(a1.ordinal, 0, "first staged webp should be ordinal 0")
    XCTAssertEqual(a2.ordinal, 1, "second staged jpg must be ordinal 1 — regresses to 0 if webp is uncounted")
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `xcodebuild test -project ADLConsole.xcodeproj -scheme ADLConsole -test-ios ADLConsoleTests/CaptureMediaStoreTests -destination 'platform=iOS Simulator,name=iPhone 15' 2>&1 | tail-20`
Expected: Test fails (ordinal collision or wrong ordering)

- [ ] **Step 3: Fix H1 — add `.webp` to existingCount**

In `CaptureMediaStore.swift`, line 107-111. Only `.webp` is needed: `fileExtension` maps `image/webp → "webp"` but not heic (heic → default `"jpg"`, already counted). Do **not** add `.heic`/`.heif` — that would be dead code matching files that never exist.
```swift
// BEFORE:
private func existingCount(in directory: URL) throws -> Int {
    guard fileManager.fileExists(atPath: directory.path) else { return 0 }
    let contents = try fileManager.contentsOfDirectory(atPath: directory.path)
    return contents.filter { $0.hasSuffix(".jpg") || $0.hasSuffix(".jpeg") || $0.hasSuffix(".png") }.count
}
// AFTER:
private func existingCount(in directory: URL) throws -> Int {
    guard fileManager.fileExists(atPath: directory.path) else { return 0 }
    let contents = try fileManager.contentsOfDirectory(atPath: directory.path)
    return contents.filter { $0.hasSuffix(".jpg") || $0.hasSuffix(".jpeg") || $0.hasSuffix(".png") || $0.hasSuffix(".webp") }.count
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `xcodebuild test -project ADLConsole.xcodeproj -scheme ADLConsole -test-ios ADLConsoleTests/CaptureMediaStoreTests -destination 'platform=iOS Simulator,name=iPhone 15' 2>&1 | tail -20`
Expected: All CaptureMediaStore tests PASS

- [ ] **Step 5: Commit**

```bash
git add ios-console/ADLConsole/CaptureStorage/CaptureMediaStore.swift ios-console/ADLConsoleTests/CaptureMediaStoreTests.swift
git commit -m "fix: existingCount includes webp/heic/heif extensions to prevent ordinal collision (H1)"
```

---

### Task 4: Fix CaptureViewModel.swift (H2, L3)

**Files:**
- Modify: `ios-console/ADLConsole/Screens/Capture/CaptureViewModel.swift:367`
- Test: `ios-console/ADLConsoleTests/CaptureViewModelTests.swift`

- [ ] **Step 1: Write failing test for H2**

```swift
// In CaptureViewModelTests.swift
func testAddPhotoUsesRealOwnerUserID() async throws {
    let mediaStore = InMemoryCaptureMediaStore()
    let vm = CaptureViewModel(
        apiClient: MockAPIClient(),
        organizationId: "org-1",
        queue: RecordQueue(store: InMemoryRecordQueueStore()),
        language: .en,
        mediaStore: mediaStore,
        ownerUserID: "real-user-42"
    )
    let data = UIImage(systemName: "star")!.pngData()!
    _ = try await vm.addPhoto(data, placement: .recordEvidence)
    let attachments = mediaStore.allStagedAttachments()
    for attachment in attachments {
        XCTAssertTrue(attachment.relativePath.contains("real-user-42"),
            "Path should contain the real user ID, got: \(attachment.relativePath)")
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `xcodebuild test -project ADLConsole.xcodeproj -scheme ADLConsole -test-ios ADLConsoleTests/CaptureViewModelTests -destination 'platform=iOS Simulator,name=iPhone 15' 2>&1 | tail -20`
Expected: Test fails — path contains "pending" not "real-user-42"

- [ ] **Step 3: Fix H2 — replace hardcoded "pending"**

In `CaptureViewModel.swift`, line 367:
```swift
// BEFORE:
let attachment = try await mediaStore.stage(
    prepared,
    ownerUserID: "pending",
    organizationID: organizationId,
    recordLocalID: recordLocalID
)
// AFTER:
let attachment = try await mediaStore.stage(
    prepared,
    ownerUserID: ownerUserID ?? "anonymous",
    organizationID: organizationId,
    recordLocalID: recordLocalID
)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `xcodebuild test -project ADLConsole.xcodeproj -scheme ADLConsole -test-ios ADLConsoleTests/CaptureViewModelTests -destination 'platform=iOS Simulator,name=iPhone 15' 2>&1 | tail -20`
Expected: All CaptureViewModel tests PASS

- [ ] **Step 5: Commit**

```bash
git add ios-console/ADLConsole/Screens/Capture/CaptureViewModel.swift ios-console/ADLConsoleTests/CaptureViewModelTests.swift
git commit -m "fix: use real ownerUserID instead of hardcoded pending for media staging (H2)"
```

- [ ] **Step 6: Fix L3 — evidencePhotoRefs vs pendingMedia sync**

**Read first:** `submit()`, `validate()`, `preparePhoto`, and the `evidencePhotoRefs` / `pendingMedia` handling in `CaptureViewModel.swift`. The spec fix ("keep `evidencePhotoRefs` in sync with staged media before validation") is intentionally under-specified — the concrete change depends on how `preparePhoto` and staging interact, which must be read from the actual code before editing. Do not guess.

- [ ] **Step 7: Write a failing test for L3**

Assert that a photo which is *prepared but not staged as evidence* is either (a) counted by validation, or (b) explicitly excluded from the draft — matching the intended product behavior. Add to `CaptureViewModelTests.swift`. If, after reading the code, the "bug" turns out not to reproduce (validation already accounts for `pendingMedia`), record that finding and skip the fix rather than forcing a change.

- [ ] **Step 8: Apply the minimal fix and commit**

```bash
git add ios-console/ADLConsole/Screens/Capture/CaptureViewModel.swift ios-console/ADLConsoleTests/CaptureViewModelTests.swift
git commit -m "fix: keep evidencePhotoRefs consistent with prepared media before validation (L3)"
```

---

### Task 5: REMOVED (M1 was a false positive)

`NSCache` is documented thread-safe by Apple; `@unchecked Sendable` on `ADLImageCacheImpl` is correct because of that. No lock is needed. See the design doc's "Withdrawn" section. **No work here.**

---

### Task 6: Fix AppState.swift (M4)

**Files:**
- Modify: `ios-console/ADLConsole/State/AppState.swift:74, 308, 374`
- Test: `ios-console/ADLConsoleTests/AppStateTests.swift`

- [ ] **Step 1: Write failing test for M4**

```swift
// In AppStateTests.swift
func testSyncEnginesClearedOnOrgSwitch() async {
    let state = AppState(/* minimal deps */)
    state.currentUserID = "u1"
    state.organization = PlatformOrganization(id: "org-1", name: "Org 1", slug: "org-1", logoUrl: nil, accentColor: nil, createdAt: "2024-01-01")
    // First org switch creates an engine
    state.selectOrganization(organizationId: "org-1")
    let count1 = state.syncEnginesCount  // expose via @testable or internal getter
    XCTAssertEqual(count1, 1)
    // Switch to second org
    state.organization = PlatformOrganization(id: "org-2", name: "Org 2", slug: "org-2", logoUrl: nil, accentColor: nil, createdAt: "2024-01-01")
    state.selectOrganization(organizationId: "org-2")
    let count2 = state.syncEnginesCount
    XCTAssertEqual(count2, 1, "Should only have one engine after switch, not 2")
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `xcodebuild test -project ADLConsole.xcodeproj -scheme ADLConsole -test-ios ADLConsoleTests/AppStateTests -destination 'platform=iOS Simulator,name=iPhone 15' 2>&1 | tail -20`
Expected: Test fails because `syncEngines` never gets cleaned up

- [ ] **Step 3: Fix M4 — clean up syncEngines on org switch and sign out**

In `AppState.swift`, inside `selectOrganization()` (before or after the existing body), add:
```swift
func selectOrganization(organizationId: String) {
    syncEngines.removeAll()
    // ... existing body ...
}
```

Inside `signOut()`, add:
```swift
func signOut() {
    syncEngines.removeAll()
    // ... existing body ...
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `xcodebuild test -project ADLConsole.xcodeproj -scheme ADLConsole -test-ios ADLConsoleTests/AppStateTests -destination 'platform=iOS Simulator,name=iPhone 15' 2>&1 | tail -20`
Expected: Tests PASS

- [ ] **Step 5: Commit**

```bash
git add ios-console/ADLConsole/State/AppState.swift ios-console/ADLConsoleTests/AppStateTests.swift
git commit -m "fix: clear syncEngines on org switch and sign out to prevent unbounded growth (M4)"
```

---

### Task 7: Fix LocationService.swift (L1)

**Files:**
- Modify: `ios-console/ADLConsole/Support/LocationService.swift:40-68`
- Test: `ios-console/ADLConsoleTests/LocationServiceTests.swift`

- [ ] **Step 1: Write failing test for L1**

```swift
// In LocationServiceTests.swift
func testReentrantCallDoesNotLeakContinuation() async {
    let service = CoreLocationService()

    // Call requestOneShotLocation twice in quick succession
    async let first = service.requestOneShotLocation()
    async let second = service.requestOneShotLocation()

    // At least one should throw CancellationError (the first one gets cancelled)
    do {
        let _ = try await first
    } catch is CancellationError {
        // expected — first continuation was replaced
    } catch {
        XCTFail("Expected CancellationError, got \(error)")
    }

    do {
        let _ = try await second
    } catch {
        // second may also fail depending on timing, but should NOT hang
    }
}
```

- [ ] **Step 2: Run test**

Run: `xcodebuild test -project ADLConsole.xcodeproj -scheme ADLConsole -test-ios ADLConsoleTests/LocationServiceTests -destination 'platform=iOS Simulator,name=iPhone 15' 2>&1 | tail -20`
Expected: Test hangs (continuation leak) or fails

- [ ] **Step 3: Fix L1 — handle re-entry and cancellation**

In `LocationService.swift`, modify `requestOneShotLocation()`:
```swift
func requestOneShotLocation() async throws -> FormGpsValue {
    try await withTaskCancellationHandler {
        try await withCheckedThrowingContinuation { continuation in
            lock.lock()
            // Resume any prior continuation with cancellation
            if let pending = self.continuation {
                self.continuation = nil
                lock.unlock()
                pending.resume(throwing: CancellationError())
                lock.lock()
            }
            self.continuation = continuation
            lock.unlock()
            DispatchQueue.main.async {
                self.manager.delegate = self
                let status = self.manager.authorizationStatus
                switch status {
                case .notDetermined:
                    self.manager.requestWhenInUseAuthorization()
                case .denied, .restricted:
                    self.finish(.failure(LocationServiceError.permissionDenied))
                case .authorizedWhenInUse, .authorizedAlways:
                    self.manager.requestLocation()
                @unknown default:
                    self.manager.requestLocation()
                }
            }
        }
    } onCancel: {
        lock.lock()
        if let pending = continuation {
            continuation = nil
            lock.unlock()
            pending.resume(throwing: CancellationError())
        } else {
            lock.unlock()
        }
    }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `xcodebuild test -project ADLConsole.xcodeproj -scheme ADLConsole -test-ios ADLConsoleTests/LocationServiceTests -destination 'platform=iOS Simulator,name=iPhone 15' 2>&1 | tail -20`
Expected: Tests PASS (no hang)

- [ ] **Step 5: Commit**

```bash
git add ios-console/ADLConsole/Support/LocationService.swift ios-console/ADLConsoleTests/LocationServiceTests.swift
git commit -m "fix: prevent continuation leak on re-entrant location request and handle cancellation (L1)"
```

---

### Task 8: Fix PendingWorkViewModel.swift (L2)

**Files:**
- Modify: `ios-console/ADLConsole/Screens/PendingWork/PendingWorkViewModel.swift:106-118`
- Test: `ios-console/ADLConsoleTests/PendingWorkViewModelTests.swift`

- [ ] **Step 1: Write failing test for L2**

```swift
// In PendingWorkViewModelTests.swift
func testDiscardRemovesMediaBeforeLedger() async {
    let ledger = MockRecordLedger()
    let mediaStore = MockCaptureMediaStore()
    mediaStore.shouldFailOnDiscard = true
    let vm = PendingWorkViewModel(
        ledger: ledger,
        mediaStore: mediaStore,
        ownerUserID: "u1",
        organizationID: "o1",
        language: .en
    )
    ledger.recordsResult = [LedgerRecord(localID: "r1", state: .retryScheduled)]
    await vm.loadItems()
    vm.requestDiscard(PendingItem(id: "r1", recordTypeKey: "test", state: .retryScheduled, error: nil, createdAt: Date(), updatedAt: Date()))
    await vm.confirmDiscard()
    // If media discard failed, ledger discard should NOT have been called
    XCTAssertFalse(ledger.discardCalled, "Ledger discard should not be called if media discard fails")
}
```

- [ ] **Step 2: Run test**

Run: `xcodebuild test -project ADLConsole.xcodeproj -scheme ADLConsole -test-ios ADLConsoleTests/PendingWorkViewModelTests -destination 'platform=iOS Simulator,name=iPhone 15' 2>&1 | tail -20`
Expected: Test fails (ledger discard is called even when media fails)

- [ ] **Step 3: Fix L2 — swap discard order**

In `PendingWorkViewModel.swift`, lines 111-117:
```swift
// BEFORE:
        do {
            try await ledger.discard(localID: item.id, discardedAt: Date())
            try await mediaStore.discard(recordLocalID: item.id)
        } catch {
            // discard failure is surfaced on next load
        }
// AFTER:
        do {
            try await mediaStore.discard(recordLocalID: item.id)
            try await ledger.discard(localID: item.id, discardedAt: Date())
        } catch {
            // discard failure is surfaced on next load
        }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `xcodebuild test -project ADLConsole.xcodeproj -scheme ADLConsole -test-ios ADLConsoleTests/PendingWorkViewModelTests -destination 'platform=iOS Simulator,name=iPhone 15' 2>&1 | tail -20`
Expected: Tests PASS

- [ ] **Step 5: Commit**

```bash
git add ios-console/ADLConsole/Screens/PendingWork/PendingWorkViewModel.swift ios-console/ADLConsoleTests/PendingWorkViewModelTests.swift
git commit -m "fix: discard media before ledger to prevent orphaned files on partial failure (L2)"
```

---

### Task 9: Full regression run

- [ ] **Step 1: Run all web tests**

Run: `npm test`
Expected: All tests PASS

- [ ] **Step 2: Run all iOS console tests**

Run: `xcodebuild test -project ADLConsole.xcodeproj -scheme ADLConsole -destination 'platform=iOS Simulator,name=iPhone 15' 2>&1 | tail -50`
Expected: All tests PASS

- [ ] **Step 3: Verify lint**

Run: `npm run lint`
Expected: Clean (no new lint errors)

- [ ] **Step 4: Commit if needed**

```bash
git commit -m "chore: verify all tests pass after bug fix batch"
```
