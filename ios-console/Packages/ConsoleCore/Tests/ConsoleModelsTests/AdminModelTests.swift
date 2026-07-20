import XCTest
@testable import ConsoleModels

final class AdminModelTests: XCTestCase {
    func testPlatformAdminMemberSummaryRoundTripAndFixture() throws {
        let member = PlatformAdminMemberSummary(
            userId: "user_1",
            name: "Ama Biya",
            email: "ama@example.com",
            phone: "+237600000000",
            role: .collector,
            joinedAt: "2026-01-01T00:00:00.000Z",
            suspendedUntil: nil
        )
        let data = try JSONEncoder().encode(member)
        let decoded = try JSONDecoder().decode(PlatformAdminMemberSummary.self, from: data)
        XCTAssertEqual(decoded, member)

        let json = """
        {"userId":"user_1","name":"Ama Biya","email":null,"phone":null,"role":"manager","joinedAt":"2026-01-01T00:00:00.000Z","suspendedUntil":"2026-02-01T00:00:00.000Z"}
        """
        let fixtureDecoded = try JSONDecoder().decode(PlatformAdminMemberSummary.self, from: json.data(using: .utf8)!)
        XCTAssertEqual(fixtureDecoded.role, .manager)
        XCTAssertNil(fixtureDecoded.email)
        XCTAssertEqual(fixtureDecoded.suspendedUntil, "2026-02-01T00:00:00.000Z")
    }

    func testPlatformAdminProjectSummaryRoundTrip() throws {
        let summary = PlatformAdminProjectSummary(
            id: "proj_1",
            name: "Bonamoussadi Mapping",
            status: .active,
            coverageScope: .town,
            coverageLabel: "Bonamoussadi",
            recordCount: 500,
            pendingReviewCount: 20,
            approvedCount: 460,
            rejectedCount: 20
        )
        let data = try JSONEncoder().encode(summary)
        let decoded = try JSONDecoder().decode(PlatformAdminProjectSummary.self, from: data)
        XCTAssertEqual(decoded, summary)
    }

    func testPlatformAdminOrganizationSummaryRoundTripAndFixture() throws {
        let orgSummary = PlatformAdminOrganizationSummary(
            id: "org_1",
            name: "Acme",
            slug: "acme",
            logoUrl: nil,
            accentColor: nil,
            accessStatus: .active,
            suspensionReason: nil,
            suspendedAt: nil,
            suspendedBy: nil,
            createdAt: "2026-01-01T00:00:00.000Z",
            memberCount: 5,
            projectCount: 2,
            recordCount: 500,
            pendingReviewCount: 20,
            members: [
                PlatformAdminMemberSummary(
                    userId: "user_1",
                    name: "Ama Biya",
                    email: "ama@example.com",
                    phone: nil,
                    role: .owner,
                    joinedAt: "2026-01-01T00:00:00.000Z",
                    suspendedUntil: nil
                )
            ],
            projects: [
                PlatformAdminProjectSummary(
                    id: "proj_1",
                    name: "Bonamoussadi Mapping",
                    status: .active,
                    coverageScope: .town,
                    coverageLabel: "Bonamoussadi",
                    recordCount: 500,
                    pendingReviewCount: 20,
                    approvedCount: 460,
                    rejectedCount: 20
                )
            ]
        )
        let data = try JSONEncoder().encode(orgSummary)
        let decoded = try JSONDecoder().decode(PlatformAdminOrganizationSummary.self, from: data)
        XCTAssertEqual(decoded, orgSummary)

        let json = """
        {
          "id": "org_1",
          "name": "Acme",
          "slug": "acme",
          "logoUrl": null,
          "accentColor": null,
          "accessStatus": "suspended",
          "suspensionReason": "non-payment",
          "suspendedAt": "2026-02-01T00:00:00.000Z",
          "suspendedBy": "admin_1",
          "createdAt": "2026-01-01T00:00:00.000Z",
          "memberCount": 5,
          "projectCount": 2,
          "recordCount": 500,
          "pendingReviewCount": 20,
          "members": [],
          "projects": []
        }
        """
        let fixtureDecoded = try JSONDecoder().decode(PlatformAdminOrganizationSummary.self, from: json.data(using: .utf8)!)
        XCTAssertEqual(fixtureDecoded.accessStatus, .suspended)
        XCTAssertEqual(fixtureDecoded.suspendedBy, "admin_1")
        XCTAssertEqual(fixtureDecoded.members, [])
        XCTAssertEqual(fixtureDecoded.projects, [])
    }
}
