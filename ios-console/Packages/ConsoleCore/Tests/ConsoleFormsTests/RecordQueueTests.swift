import XCTest
import ConsoleModels
@testable import ConsoleForms

final class RecordQueueTests: XCTestCase {
    private func sampleDraft(projectId: String = "proj-1") -> RecordDraft {
        RecordDraft(
            projectId: projectId,
            schemaVersionId: "schema-1",
            recordTypeKey: "pharmacy",
            data: ["name": .string("Acme Pharmacy")],
            photoRefs: ["photo-1"],
            gps: FormGpsValue(latitude: 4.05, longitude: 9.7),
            notes: nil,
            capturedAt: "2026-07-19T10:00:00Z"
        )
    }

    private func makeQueue(
        store: RecordQueueStore = InMemoryRecordQueueStore(),
        ids: [String] = [],
        keys: [String] = [],
        clock: ManualClock = ManualClock()
    ) -> RecordQueue {
        let idProvider = SequenceProvider(ids, fallbackPrefix: "id")
        let keyProvider = SequenceProvider(keys, fallbackPrefix: "key")
        return RecordQueue(
            store: store,
            idGenerator: { idProvider.next() },
            idempotencyKeyGenerator: { keyProvider.next() },
            now: { clock.now }
        )
    }

    // MARK: - Enqueue

    func testEnqueueAddsPendingItem() async throws {
        let queue = makeQueue(ids: ["item-1"], keys: ["idem-1"])
        let item = try await queue.enqueue(sampleDraft())
        XCTAssertEqual(item.id, "item-1")
        XCTAssertEqual(item.idempotencyKey, "idem-1")
        XCTAssertEqual(item.status, .pending)
        XCTAssertEqual(item.attempts, 0)
        XCTAssertEqual(item.retryCount, 0)

        let items = try await queue.items()
        XCTAssertEqual(items.count, 1)
        XCTAssertEqual(items[0].draft, sampleDraft())
    }

    func testEnqueueAssignsDistinctIdempotencyKeysToDifferentDrafts() async throws {
        let queue = makeQueue()
        let first = try await queue.enqueue(sampleDraft(projectId: "proj-1"))
        let second = try await queue.enqueue(sampleDraft(projectId: "proj-2"))
        XCTAssertNotEqual(first.idempotencyKey, second.idempotencyKey)
    }

    func testEnqueueThrowsFullOnceAtCapacity() async throws {
        let queue = makeQueue()
        for index in 0..<RecordQueue.maxItems {
            _ = try await queue.enqueue(sampleDraft(projectId: "proj-\(index)"))
        }
        do {
            _ = try await queue.enqueue(sampleDraft(projectId: "overflow"))
            XCTFail("expected .full to be thrown")
        } catch RecordQueueError.full(let maxItems) {
            XCTAssertEqual(maxItems, RecordQueue.maxItems)
        }
        let items = try await queue.items()
        XCTAssertEqual(items.count, RecordQueue.maxItems)
    }

    // MARK: - Snapshot

    func testSnapshotCountsByStatus() async throws {
        let queue = makeQueue()
        _ = try await queue.enqueue(sampleDraft(projectId: "a"))
        _ = try await queue.enqueue(sampleDraft(projectId: "b"))

        var snapshot = try await queue.snapshot()
        XCTAssertEqual(snapshot.pending, 2)
        XCTAssertEqual(snapshot.total, 2)
        XCTAssertEqual(snapshot.failed, 0)

        _ = await queue.sync { _, _ in throw RecordSubmitError.retryable("boom") }
        snapshot = try await queue.snapshot()
        XCTAssertEqual(snapshot.pending, 0)
        XCTAssertEqual(snapshot.failed, 2)
    }

    // MARK: - Sync success

    func testSyncSuccessRemovesItemAndReportsSyncedId() async throws {
        let queue = makeQueue(ids: ["item-1"], keys: ["idem-1"])
        _ = try await queue.enqueue(sampleDraft())
        let expectedDraft = sampleDraft()

        let capturedKey = Recorder<String>()
        let capturedDraft = Recorder<RecordDraft>()
        let summary = await queue.sync { draft, idempotencyKey in
            capturedKey.set(idempotencyKey)
            capturedDraft.set(draft)
        }

        XCTAssertEqual(summary.syncedIds, ["item-1"])
        XCTAssertEqual(summary.failedIds, [])
        XCTAssertEqual(summary.permanentFailureIds, [])
        XCTAssertEqual(summary.remaining, 0)
        XCTAssertEqual(capturedKey.value, "idem-1")
        XCTAssertEqual(capturedDraft.value, expectedDraft)

        let items = try await queue.items()
        XCTAssertTrue(items.isEmpty)

        let snapshot = try await queue.snapshot()
        XCTAssertEqual(snapshot.syncedThisSession, 1)
    }

    func testSyncSubmitsMultipleItemsInEnqueueOrder() async throws {
        let queue = makeQueue(ids: ["item-1", "item-2"], keys: ["idem-1", "idem-2"])
        _ = try await queue.enqueue(sampleDraft(projectId: "first"))
        _ = try await queue.enqueue(sampleDraft(projectId: "second"))

        let submittedProjectIds = Recorder<[String]>(initial: [])
        let summary = await queue.sync { draft, _ in
            submittedProjectIds.mutate { $0.append(draft.projectId) }
        }

        XCTAssertEqual(submittedProjectIds.value, ["first", "second"])
        XCTAssertEqual(Set(summary.syncedIds), Set(["item-1", "item-2"]))
    }

    // MARK: - Sync retry

    func testRetryableFailureMarksFailedAndIncrementsRetryCount() async throws {
        let queue = makeQueue(ids: ["item-1"], keys: ["idem-1"])
        _ = try await queue.enqueue(sampleDraft())

        let summary = await queue.sync { _, _ in throw RecordSubmitError.retryable("network down") }

        XCTAssertEqual(summary.failedIds, ["item-1"])
        XCTAssertEqual(summary.syncedIds, [])
        XCTAssertEqual(summary.permanentFailureIds, [])

        let items = try await queue.items()
        XCTAssertEqual(items.count, 1)
        XCTAssertEqual(items[0].status, .failed)
        XCTAssertEqual(items[0].retryCount, 1)
        XCTAssertEqual(items[0].lastError, "network down")
        XCTAssertNotNil(items[0].nextRetryAt)
    }

    func testIdempotencyKeyStableAcrossRetries() async throws {
        let queue = makeQueue(ids: ["item-1"], keys: ["idem-1"])
        _ = try await queue.enqueue(sampleDraft())

        let seenKeys = Recorder<[String]>(initial: [])
        _ = await queue.sync { _, key in
            seenKeys.mutate { $0.append(key) }
            throw RecordSubmitError.retryable("still down")
        }

        let items = try await queue.items()
        XCTAssertEqual(items[0].idempotencyKey, "idem-1")

        // A second sync pass is skipped (nextRetryAt hasn't elapsed) — force
        // it due by opening a fresh queue over the same store contents at
        // "now" equal to (nextRetryAt + 1s).
        let stored = try await queue.items()
        let dueClock = ManualClock(now: stored[0].nextRetryAt!.addingTimeInterval(1))
        let store = InMemoryRecordQueueStore(initial: stored)
        let secondQueue = makeQueue(store: store, clock: dueClock)

        _ = await secondQueue.sync { _, key in
            seenKeys.mutate { $0.append(key) }
            throw RecordSubmitError.retryable("still down")
        }

        XCTAssertEqual(seenKeys.value, ["idem-1", "idem-1"])
    }

    func testNotYetDueItemIsSkippedThisPass() async throws {
        let clock = ManualClock()
        let queue = makeQueue(ids: ["item-1"], keys: ["idem-1"], clock: clock)
        _ = try await queue.enqueue(sampleDraft())
        _ = await queue.sync { _, _ in throw RecordSubmitError.retryable("down") }

        let submitCallCount = Recorder<Int>(initial: 0)
        // Same clock, no time elapsed -> nextRetryAt still in the future.
        let summary = await queue.sync { _, _ in
            submitCallCount.mutate { $0 += 1 }
        }
        XCTAssertEqual(submitCallCount.value, 0)
        XCTAssertEqual(summary.failedIds, ["item-1"])
    }

    func testPermanentFailureAfterExceedingMaxRetryCount() async throws {
        let clock = ManualClock()
        let queue = makeQueue(ids: ["item-1"], keys: ["idem-1"], clock: clock)
        _ = try await queue.enqueue(sampleDraft())

        for attempt in 1...RecordQueue.maxRetryCount {
            _ = await queue.sync { _, _ in throw RecordSubmitError.retryable("down") }
            let items = try await queue.items()
            XCTAssertEqual(items.count, 1, "item should still be queued after attempt \(attempt)")
            // Fast-forward past the backoff window before the next attempt.
            clock.now = items[0].nextRetryAt!.addingTimeInterval(1)
        }

        // One more attempt pushes retryCount past maxRetryCount -> permanent failure.
        let finalSummary = await queue.sync { _, _ in throw RecordSubmitError.retryable("down") }
        XCTAssertEqual(finalSummary.permanentFailureIds, ["item-1"])
        let items = try await queue.items()
        XCTAssertTrue(items.isEmpty)
    }

    func testPermanentSubmitErrorDropsItemImmediately() async throws {
        let queue = makeQueue(ids: ["item-1"], keys: ["idem-1"])
        _ = try await queue.enqueue(sampleDraft())

        let summary = await queue.sync { _, _ in throw RecordSubmitError.permanent("rejected: schema mismatch") }

        XCTAssertEqual(summary.permanentFailureIds, ["item-1"])
        XCTAssertEqual(summary.syncedIds, [])
        XCTAssertEqual(summary.failedIds, [])
        let items = try await queue.items()
        XCTAssertTrue(items.isEmpty)
    }

    func testUnknownThrownErrorDefaultsToRetryable() async throws {
        struct SomeOtherError: Error {}
        let queue = makeQueue(ids: ["item-1"], keys: ["idem-1"])
        _ = try await queue.enqueue(sampleDraft())

        let summary = await queue.sync { _, _ in throw SomeOtherError() }

        XCTAssertEqual(summary.failedIds, ["item-1"])
        let items = try await queue.items()
        XCTAssertEqual(items[0].retryCount, 1)
    }

    func testStaleItemDroppedAsPermanentFailureWithoutSubmitting() async throws {
        let clock = ManualClock()
        let queue = makeQueue(ids: ["item-1"], keys: ["idem-1"], clock: clock)
        _ = try await queue.enqueue(sampleDraft())

        clock.now = clock.now.addingTimeInterval(RecordQueue.maxItemAge + 1)

        let submitCalled = Recorder<Bool>(initial: false)
        let summary = await queue.sync { _, _ in submitCalled.set(true) }

        XCTAssertEqual(submitCalled.value, false)
        XCTAssertEqual(summary.permanentFailureIds, ["item-1"])
        let items = try await queue.items()
        XCTAssertTrue(items.isEmpty)
    }

    // MARK: - Persistence round trip

    func testPersistenceRoundTripViaInMemoryStore() async throws {
        let store = InMemoryRecordQueueStore()
        let queue = makeQueue(store: store, ids: ["item-1"], keys: ["idem-1"])
        _ = try await queue.enqueue(sampleDraft())

        // A second `RecordQueue` instance over the same store sees the
        // persisted item.
        let reopened = RecordQueue(store: store)
        let items = try await reopened.items()
        XCTAssertEqual(items.count, 1)
        XCTAssertEqual(items[0].id, "item-1")
        XCTAssertEqual(items[0].draft, sampleDraft())
    }

    func testRemoveAllClearsStore() async throws {
        let queue = makeQueue()
        _ = try await queue.enqueue(sampleDraft())
        try await queue.removeAll()
        let items = try await queue.items()
        XCTAssertTrue(items.isEmpty)
    }
}

/// Deterministic clock double — `RecordQueue` reads `now` on every enqueue
/// and sync pass; tests fast-forward it explicitly instead of sleeping.
final class ManualClock: @unchecked Sendable {
    var now: Date
    init(now: Date = Date(timeIntervalSince1970: 1_700_000_000)) {
        self.now = now
    }
}

/// Hands out a fixed sequence of values, then falls back to
/// `"<prefix>-<n>"` once exhausted — used to make `RecordQueue`'s
/// id/idempotency-key generation deterministic in tests.
final class SequenceProvider: @unchecked Sendable {
    private var values: [String]
    private let fallbackPrefix: String
    private var counter = 0
    private let lock = NSLock()

    init(_ values: [String], fallbackPrefix: String) {
        self.values = values
        self.fallbackPrefix = fallbackPrefix
    }

    func next() -> String {
        lock.lock()
        defer { lock.unlock() }
        if !values.isEmpty {
            return values.removeFirst()
        }
        counter += 1
        return "\(fallbackPrefix)-\(counter)"
    }
}

/// A `Sendable` mutable box for capturing values produced inside a
/// `@Sendable` closure (e.g. `RecordQueue.sync`'s `submit` closure) back out
/// into a test's assertions — plain `var` captures aren't allowed there
/// under strict concurrency checking.
final class Recorder<Value>: @unchecked Sendable {
    private var stored: Value?
    private let lock = NSLock()

    init(initial: Value? = nil) {
        self.stored = initial
    }

    func set(_ newValue: Value) {
        lock.lock()
        defer { lock.unlock() }
        stored = newValue
    }

    func mutate(_ body: (inout Value) -> Void) {
        lock.lock()
        defer { lock.unlock() }
        guard stored != nil else { return }
        body(&stored!)
    }

    var value: Value? {
        lock.lock()
        defer { lock.unlock() }
        return stored
    }
}
