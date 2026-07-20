import XCTest
@testable import ConsoleModels

final class OrganizationModelTests: XCTestCase {
    func testPlatformOrganizationRoundTripFullyPopulated() throws {
        let org = PlatformOrganization(
            id: "org_1",
            name: "Acme",
            slug: "acme",
            logoUrl: "https://example.com/logo.png",
            accentColor: "#c86b4a",
            createdAt: "2026-01-01T00:00:00.000Z",
            accessStatus: .active,
            suspensionReason: nil,
            suspendedAt: nil
        )
        let data = try JSONEncoder().encode(org)
        let decoded = try JSONDecoder().decode(PlatformOrganization.self, from: data)
        XCTAssertEqual(decoded, org)
    }

    func testPlatformOrganizationRoundTripWithNulls() throws {
        let org = PlatformOrganization(
            id: "org_2",
            name: "No Logo Co",
            slug: "no-logo-co",
            logoUrl: nil,
            accentColor: nil,
            createdAt: "2026-01-01T00:00:00.000Z",
            accessStatus: nil,
            suspensionReason: nil,
            suspendedAt: nil
        )
        let data = try JSONEncoder().encode(org)
        let decoded = try JSONDecoder().decode(PlatformOrganization.self, from: data)
        XCTAssertEqual(decoded, org)
    }

    func testPlatformOrganizationDecodesFromFixture() throws {
        let json = """
        {
          "id": "org_1",
          "name": "Acme",
          "slug": "acme",
          "logoUrl": null,
          "accentColor": null,
          "createdAt": "2026-01-01T00:00:00.000Z",
          "accessStatus": "suspended",
          "suspensionReason": "non-payment",
          "suspendedAt": "2026-02-01T00:00:00.000Z"
        }
        """
        let decoded = try JSONDecoder().decode(PlatformOrganization.self, from: json.data(using: .utf8)!)
        XCTAssertEqual(decoded.id, "org_1")
        XCTAssertEqual(decoded.accessStatus, .suspended)
        XCTAssertEqual(decoded.suspensionReason, "non-payment")
        XCTAssertNil(decoded.logoUrl)
    }

    func testPlatformOrganizationDecodesFromFixtureMissingOptionalKeys() throws {
        let json = """
        {
          "id": "org_1",
          "name": "Acme",
          "slug": "acme",
          "logoUrl": null,
          "accentColor": null,
          "createdAt": "2026-01-01T00:00:00.000Z"
        }
        """
        let decoded = try JSONDecoder().decode(PlatformOrganization.self, from: json.data(using: .utf8)!)
        XCTAssertNil(decoded.accessStatus)
        XCTAssertNil(decoded.suspensionReason)
        XCTAssertNil(decoded.suspendedAt)
    }

    func testPlatformMembershipRoundTripAndFixture() throws {
        let membership = PlatformMembership(
            organizationId: "org_1",
            userId: "user_1",
            role: .collector,
            createdAt: "2026-01-01T00:00:00.000Z"
        )
        let data = try JSONEncoder().encode(membership)
        let decoded = try JSONDecoder().decode(PlatformMembership.self, from: data)
        XCTAssertEqual(decoded, membership)

        let json = """
        {"organizationId":"org_1","userId":"user_1","role":"collector","createdAt":"2026-01-01T00:00:00.000Z"}
        """
        let fixtureDecoded = try JSONDecoder().decode(PlatformMembership.self, from: json.data(using: .utf8)!)
        XCTAssertEqual(fixtureDecoded.role, .collector)
    }

    func testPlatformInviteRoundTripAndFixture() throws {
        let invite = PlatformInvite(
            id: "invite_1",
            organizationId: "org_1",
            email: "agent@example.com",
            role: .reviewer,
            expiresAt: "2026-02-01T00:00:00.000Z",
            acceptedAt: nil,
            createdAt: "2026-01-01T00:00:00.000Z"
        )
        let data = try JSONEncoder().encode(invite)
        let decoded = try JSONDecoder().decode(PlatformInvite.self, from: data)
        XCTAssertEqual(decoded, invite)

        let json = """
        {"id":"invite_1","organizationId":"org_1","email":"agent@example.com","role":"reviewer","expiresAt":"2026-02-01T00:00:00.000Z","acceptedAt":null,"createdAt":"2026-01-01T00:00:00.000Z"}
        """
        let fixtureDecoded = try JSONDecoder().decode(PlatformInvite.self, from: json.data(using: .utf8)!)
        XCTAssertEqual(fixtureDecoded.role, .reviewer)
        XCTAssertNil(fixtureDecoded.acceptedAt)
    }
}
