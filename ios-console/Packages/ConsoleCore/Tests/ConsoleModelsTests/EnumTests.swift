import XCTest
@testable import ConsoleModels

final class EnumTests: XCTestCase {
    func testPlatformRoleRawValues() {
        XCTAssertEqual(PlatformRole.owner.rawValue, "owner")
        XCTAssertEqual(PlatformRole.manager.rawValue, "manager")
        XCTAssertEqual(PlatformRole.reviewer.rawValue, "reviewer")
        XCTAssertEqual(PlatformRole.collector.rawValue, "collector")
        XCTAssertEqual(PlatformRole.viewer.rawValue, "viewer")
        XCTAssertEqual(PlatformRole.allCases.count, 5)
    }

    func testPlatformFieldTypeRawValues() {
        XCTAssertEqual(PlatformFieldType.text.rawValue, "text")
        XCTAssertEqual(PlatformFieldType.number.rawValue, "number")
        XCTAssertEqual(PlatformFieldType.select.rawValue, "select")
        XCTAssertEqual(PlatformFieldType.multiSelect.rawValue, "multi_select")
        XCTAssertEqual(PlatformFieldType.date.rawValue, "date")
        XCTAssertEqual(PlatformFieldType.boolean.rawValue, "boolean")
        XCTAssertEqual(PlatformFieldType.photo.rawValue, "photo")
        XCTAssertEqual(PlatformFieldType.gps.rawValue, "gps")
    }

    func testPlatformProjectStatusRawValues() {
        XCTAssertEqual(PlatformProjectStatus.draft.rawValue, "draft")
        XCTAssertEqual(PlatformProjectStatus.active.rawValue, "active")
        XCTAssertEqual(PlatformProjectStatus.archived.rawValue, "archived")
    }

    func testPlatformProjectCoverageScopeRawValues() {
        XCTAssertEqual(PlatformProjectCoverageScope.town.rawValue, "town")
        XCTAssertEqual(PlatformProjectCoverageScope.country.rawValue, "country")
        XCTAssertEqual(PlatformProjectCoverageScope.worldwide.rawValue, "worldwide")
    }

    func testPlatformOrganizationAccessStatusRawValues() {
        XCTAssertEqual(PlatformOrganizationAccessStatus.active.rawValue, "active")
        XCTAssertEqual(PlatformOrganizationAccessStatus.suspended.rawValue, "suspended")
    }

    func testPlatformRecordStatusRawValues() {
        XCTAssertEqual(PlatformRecordStatus.pendingReview.rawValue, "pending_review")
        XCTAssertEqual(PlatformRecordStatus.approved.rawValue, "approved")
        XCTAssertEqual(PlatformRecordStatus.rejected.rawValue, "rejected")
    }

    func testPlatformSchemaVersionStatusRawValues() {
        XCTAssertEqual(PlatformSchemaVersionStatus.draft.rawValue, "draft")
        XCTAssertEqual(PlatformSchemaVersionStatus.published.rawValue, "published")
    }

    func testEnumsAreCodable() throws {
        let encoder = JSONEncoder()
        let decoder = JSONDecoder()
        let data = try encoder.encode(PlatformRole.manager)
        let decoded = try decoder.decode(PlatformRole.self, from: data)
        XCTAssertEqual(decoded, .manager)
    }
}
