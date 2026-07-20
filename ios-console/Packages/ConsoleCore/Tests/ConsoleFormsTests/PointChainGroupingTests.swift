import ConsoleModels
@testable import ConsoleForms
import XCTest

/// Mirrors `tests/platformPointGrouping.test.ts` (web, read-only reference)
/// test-for-test — see `PointChainGrouping.collapseRecordChains`'s doc
/// comment for the one deliberate shape difference (`photos` as a top-level
/// field rather than spliced into `representative.evidence.photos`).
final class PointChainGroupingTests: XCTestCase {
    private func record(
        id: String,
        createdAt: String,
        pointId: String? = nil,
        data: [String: JSONValue] = [:],
        photos: [String] = []
    ) -> PlatformRecord {
        PlatformRecord(
            id: id,
            projectId: "proj-1",
            organizationId: "org-1",
            schemaVersionId: "sv-1",
            recordTypeKey: "bin",
            data: data,
            evidence: PlatformRecordEvidence(
                gps: PlatformRecordGps(latitude: 4.0, longitude: 9.0),
                photos: photos,
                notes: nil,
                capturedAt: createdAt
            ),
            status: .approved,
            capturedBy: "user-1",
            createdAt: createdAt,
            pointId: pointId
        )
    }

    func testStandaloneRecordNoChainYieldsOnePointUnchanged() {
        let r1 = record(id: "r1", createdAt: "2026-07-18T10:00:00Z", photos: ["p1"])

        let out = PointChainGrouping.collapseRecordChains([r1])

        XCTAssertEqual(out.count, 1)
        XCTAssertEqual(out[0].representative.id, "r1")
    }

    func testRootPlusEnrichmentSharingRootCollapseToOnePoint() {
        let root = record(id: "root", createdAt: "2026-07-18T10:00:00Z")
        let enrich = record(id: "e1", createdAt: "2026-07-20T10:00:00Z", pointId: "root")

        let out = PointChainGrouping.collapseRecordChains([root, enrich])

        XCTAssertEqual(out.count, 1, "chain must be a single point, not two pins")
    }

    func testNewestRecordIsTheRepresentative() {
        let root = record(id: "root", createdAt: "2026-07-18T10:00:00Z", data: ["name": .string("old")])
        let enrich = record(id: "e1", createdAt: "2026-07-20T10:00:00Z", pointId: "root", data: ["name": .string("new")])

        // Unordered input, matching the TS test.
        let out = PointChainGrouping.collapseRecordChains([enrich, root])

        XCTAssertEqual(out[0].representative.data["name"], .string("new"))
    }

    func testPhotosAggregateAcrossChainNewestFirstDeduped() {
        let root = record(id: "root", createdAt: "2026-07-18T10:00:00Z", photos: ["a", "b"])
        let enrich = record(id: "e1", createdAt: "2026-07-20T10:00:00Z", pointId: "root", photos: ["c", "a"])

        let out = PointChainGrouping.collapseRecordChains([root, enrich])

        XCTAssertEqual(out[0].photos, ["c", "a", "b"])
    }

    func testChainCountExposedForMapAndDetail() {
        let root = record(id: "root", createdAt: "2026-07-18T10:00:00Z")
        let e1 = record(id: "e1", createdAt: "2026-07-19T10:00:00Z", pointId: "root")
        let e2 = record(id: "e2", createdAt: "2026-07-20T10:00:00Z", pointId: "root")

        let out = PointChainGrouping.collapseRecordChains([root, e1, e2])

        XCTAssertEqual(out.count, 1)
        XCTAssertEqual(out[0].chainCount, 3)
    }

    func testChainCarriesEveryUpdateNewestFirst() {
        let root = record(id: "root", createdAt: "2026-07-18T10:00:00Z")
        let e1 = record(id: "e1", createdAt: "2026-07-19T10:00:00Z", pointId: "root")
        let e2 = record(id: "e2", createdAt: "2026-07-20T10:00:00Z", pointId: "root")

        // Unordered input, matching the TS test.
        let out = PointChainGrouping.collapseRecordChains([e1, root, e2])

        XCTAssertEqual(out[0].chain.map(\.id), ["e2", "e1", "root"])
    }

    // MARK: - Additional coverage beyond the TS suite

    func testMultipleIndependentPointsEachCollapseSeparatelyInFirstSeenOrder() {
        let pointA = record(id: "a-root", createdAt: "2026-07-18T10:00:00Z")
        let pointB = record(id: "b-root", createdAt: "2026-07-17T10:00:00Z")
        let pointAEnrich = record(id: "a-e1", createdAt: "2026-07-19T10:00:00Z", pointId: "a-root")

        let out = PointChainGrouping.collapseRecordChains([pointA, pointB, pointAEnrich])

        XCTAssertEqual(out.count, 2)
        XCTAssertEqual(out.map(\.representative.id), ["a-e1", "b-root"])
        XCTAssertEqual(out[0].chainCount, 2)
        XCTAssertEqual(out[1].chainCount, 1)
    }

    func testEmptyInputYieldsEmptyOutput() {
        XCTAssertEqual(PointChainGrouping.collapseRecordChains([]), [])
    }

    // MARK: - rootId / Identifiable

    func testRootIdIsTheRecordsOwnIdForAStandaloneRoot() {
        let root = record(id: "root", createdAt: "2026-07-18T10:00:00Z")

        let out = PointChainGrouping.collapseRecordChains([root])

        XCTAssertEqual(out[0].rootId, "root")
        XCTAssertEqual(out[0].id, "root")
    }

    func testRootIdStaysTheRootAcrossEnrichments() {
        let root = record(id: "root", createdAt: "2026-07-18T10:00:00Z")
        let enrich = record(id: "e1", createdAt: "2026-07-20T10:00:00Z", pointId: "root")

        let out = PointChainGrouping.collapseRecordChains([root, enrich])

        // Representative is the newest ("e1"), but rootId still identifies
        // the chain by its shared grouping key, not the representative's own id.
        XCTAssertEqual(out[0].representative.id, "e1")
        XCTAssertEqual(out[0].rootId, "root")
        XCTAssertEqual(out[0].id, "root")
    }
}
