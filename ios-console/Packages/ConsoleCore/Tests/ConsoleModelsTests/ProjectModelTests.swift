import XCTest
@testable import ConsoleModels

final class ProjectModelTests: XCTestCase {
    func testPlatformProjectRoundTrip() throws {
        let project = PlatformProject(
            id: "proj_1",
            organizationId: "org_1",
            name: "Bonamoussadi Mapping",
            status: .active,
            coverageScope: .town,
            coverageLabel: "Bonamoussadi",
            createdAt: "2026-01-01T00:00:00.000Z"
        )
        let data = try JSONEncoder().encode(project)
        let decoded = try JSONDecoder().decode(PlatformProject.self, from: data)
        XCTAssertEqual(decoded, project)
    }

    func testPlatformProjectDecodesFromFixtureWithNullCoverageLabel() throws {
        let json = """
        {"id":"proj_1","organizationId":"org_1","name":"Worldwide Fuel","status":"draft","coverageScope":"worldwide","coverageLabel":null,"createdAt":"2026-01-01T00:00:00.000Z"}
        """
        let decoded = try JSONDecoder().decode(PlatformProject.self, from: json.data(using: .utf8)!)
        XCTAssertEqual(decoded.status, .draft)
        XCTAssertEqual(decoded.coverageScope, .worldwide)
        XCTAssertNil(decoded.coverageLabel)
    }

    func testPlatformSchemaVersionRoundTripAndFixture() throws {
        let version = PlatformSchemaVersion(
            id: "schema_1",
            projectId: "proj_1",
            organizationId: "org_1",
            version: 3,
            status: .published,
            definition: PlatformSchemaDefinition(recordTypes: []),
            publishedAt: "2026-01-05T00:00:00.000Z"
        )
        let data = try JSONEncoder().encode(version)
        let decoded = try JSONDecoder().decode(PlatformSchemaVersion.self, from: data)
        XCTAssertEqual(decoded, version)

        let json = """
        {"id":"schema_1","projectId":"proj_1","organizationId":"org_1","version":1,"status":"draft","definition":{"recordTypes":[]},"publishedAt":null}
        """
        let fixtureDecoded = try JSONDecoder().decode(PlatformSchemaVersion.self, from: json.data(using: .utf8)!)
        XCTAssertEqual(fixtureDecoded.status, .draft)
        XCTAssertEqual(fixtureDecoded.version, 1)
        XCTAssertNil(fixtureDecoded.publishedAt)
    }
}
