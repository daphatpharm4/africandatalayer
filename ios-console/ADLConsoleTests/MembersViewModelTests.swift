@testable import ADLConsole
import ConsoleAPI
import ConsoleModels
import XCTest

/// Covers Task 7a's `MembersViewModel` — especially the guard rules ported
/// from `components/Console/MembersScreen.tsx`: owner-only role
/// change/remove, the self-removal guard, and the last-owner protection
/// (pre-emptive client-side block + the 409 "last_owner" fallback copy).
@MainActor
final class MembersViewModelTests: XCTestCase {
    private func memberJSON(userId: String, role: String) -> String {
        """
        {"organizationId": "org-1", "userId": "\(userId)", "role": "\(role)", "createdAt": "2026-07-01T00:00:00.000Z"}
        """
    }

    private func inviteJSON(id: String, email: String, role: String = "collector", acceptedAt: String? = nil) -> String {
        """
        {
            "id": "\(id)",
            "organizationId": "org-1",
            "email": "\(email)",
            "role": "\(role)",
            "expiresAt": "2026-08-01T00:00:00.000Z",
            "acceptedAt": \(acceptedAt.map { "\"\($0)\"" } ?? "null"),
            "createdAt": "2026-07-01T00:00:00.000Z"
        }
        """
    }

    private func membersResponse(members: [(String, String)], invites: [String] = []) -> Data {
        let membersJSON = members.map { memberJSON(userId: $0.0, role: $0.1) }.joined(separator: ",")
        return Data("{\"members\": [\(membersJSON)], \"invites\": [\(invites.joined(separator: ","))]}".utf8)
    }

    private func makeViewModel(
        transport: RoutingMockPlatformTransport,
        viewerRole: PlatformRole = .owner,
        viewerUserId: String? = "user-me",
        viewerIsAdlAdmin: Bool = false
    ) -> MembersViewModel {
        MembersViewModel(
            apiClient: PlatformAPIClient(baseURL: URL(string: "https://example.com")!, transport: transport),
            organizationId: "org-1",
            viewerRole: viewerRole,
            viewerUserId: viewerUserId,
            viewerIsAdlAdmin: viewerIsAdlAdmin,
            language: .en
        )
    }

    // MARK: - Load

    func testLoadPopulatesMembersAndInvites() async {
        let transport = RoutingMockPlatformTransport()
        transport.setResponse(
            membersResponse(members: [("user-me", "owner"), ("user-2", "collector")], invites: [inviteJSON(id: "inv-1", email: "a@b.com")]),
            forView: "platform_org_members"
        )
        let viewModel = makeViewModel(transport: transport)

        await viewModel.load()

        XCTAssertEqual(viewModel.members?.map(\.userId), ["user-me", "user-2"])
        XCTAssertEqual(viewModel.invites?.map(\.id), ["inv-1"])
        XCTAssertNil(viewModel.loadError)

        let components = URLComponents(url: transport.lastRequest!.url!, resolvingAgainstBaseURL: false)
        XCTAssertEqual(components?.queryItems?.first { $0.name == "organizationId" }?.value, "org-1")
    }

    // MARK: - Owner-only gating

    func testCanEditRoleAndCanRemoveAreFalseForNonOwnerViewer() async {
        let transport = RoutingMockPlatformTransport()
        transport.setResponse(membersResponse(members: [("user-2", "collector")]), forView: "platform_org_members")
        let viewModel = makeViewModel(transport: transport, viewerRole: .manager, viewerUserId: "user-me")
        await viewModel.load()
        let member = viewModel.members![0]

        XCTAssertFalse(viewModel.canEditRole(for: member))
        XCTAssertFalse(viewModel.canRemove(member))
    }

    func testCanEditRoleAndCanRemoveAreFalseForSelfEvenAsOwner() async {
        let transport = RoutingMockPlatformTransport()
        transport.setResponse(membersResponse(members: [("user-me", "owner")]), forView: "platform_org_members")
        let viewModel = makeViewModel(transport: transport, viewerRole: .owner, viewerUserId: "user-me")
        await viewModel.load()
        let member = viewModel.members![0]

        XCTAssertFalse(viewModel.canEditRole(for: member))
        XCTAssertFalse(viewModel.canRemove(member))
    }

    func testCanEditRoleAndCanRemoveAreTrueForOwnerActingOnOtherMember() async {
        let transport = RoutingMockPlatformTransport()
        transport.setResponse(membersResponse(members: [("user-me", "owner"), ("user-2", "collector")]), forView: "platform_org_members")
        let viewModel = makeViewModel(transport: transport, viewerRole: .owner, viewerUserId: "user-me")
        await viewModel.load()
        let member = viewModel.members![1]

        XCTAssertTrue(viewModel.canEditRole(for: member))
        XCTAssertTrue(viewModel.canRemove(member))
    }

    // MARK: - Role change

    func testChangeRoleCallsUpdateMemberWithCorrectPayloadAndUpdatesList() async {
        let transport = RoutingMockPlatformTransport()
        transport.setResponse(membersResponse(members: [("user-me", "owner"), ("user-2", "collector")]), forView: "platform_org_members")
        let viewModel = makeViewModel(transport: transport)
        await viewModel.load()

        await viewModel.changeRole(userId: "user-2", role: .manager)

        XCTAssertEqual(viewModel.members?.first { $0.userId == "user-2" }?.role, .manager)
        XCTAssertNil(viewModel.rowError)

        let requests = transport.requests(forView: "platform_member_update")
        XCTAssertEqual(requests.count, 1)
        XCTAssertEqual(requests[0].httpMethod, "POST")
        let body = try? JSONSerialization.jsonObject(with: requests[0].httpBody ?? Data()) as? [String: Any]
        XCTAssertEqual(body?["organizationId"] as? String, "org-1")
        XCTAssertEqual(body?["userId"] as? String, "user-2")
        XCTAssertEqual(body?["role"] as? String, "manager")
    }

    func testChangeRoleBlockedForNonOwnerViewerMakesNoApiCall() async {
        let transport = RoutingMockPlatformTransport()
        transport.setResponse(membersResponse(members: [("user-2", "collector")]), forView: "platform_org_members")
        let viewModel = makeViewModel(transport: transport, viewerRole: .manager, viewerUserId: "user-me")
        await viewModel.load()

        await viewModel.changeRole(userId: "user-2", role: .viewer)

        XCTAssertTrue(transport.requests(forView: "platform_member_update").isEmpty)
    }

    func testChangeRoleBlockedForSelfMakesNoApiCall() async {
        let transport = RoutingMockPlatformTransport()
        transport.setResponse(membersResponse(members: [("user-me", "owner")]), forView: "platform_org_members")
        let viewModel = makeViewModel(transport: transport, viewerRole: .owner, viewerUserId: "user-me")
        await viewModel.load()

        await viewModel.changeRole(userId: "user-me", role: .manager)

        XCTAssertTrue(transport.requests(forView: "platform_member_update").isEmpty)
    }

    func testChangeRoleDemotingOneOfTwoOwnersIsNotBlocked() async {
        let transport = RoutingMockPlatformTransport()
        transport.setResponse(membersResponse(members: [("user-me", "owner"), ("owner-2", "owner")]), forView: "platform_org_members")
        let viewModel = makeViewModel(transport: transport, viewerRole: .owner, viewerUserId: "user-me")
        await viewModel.load()

        // Two owners: demoting one is fine (not the last owner).
        await viewModel.changeRole(userId: "owner-2", role: .manager)

        XCTAssertEqual(transport.requests(forView: "platform_member_update").count, 1)
        XCTAssertEqual(viewModel.members?.first { $0.userId == "owner-2" }?.role, .manager)
    }

    func testChangeRoleAwayFromSoleOwnerIsBlockedClientSideWithNoApiCall() async {
        // "owner-only" is the sole owner; the viewer ("user-me") is a
        // different, non-owner account acting with owner privileges is not
        // representative on the web (only owners see the role select at
        // all), but here we need viewerRole == .owner to pass the isOwner
        // gate while targeting a DIFFERENT user id than the viewer so the
        // self-guard doesn't also block the call — isolating the
        // last-owner guard specifically.
        let transport = RoutingMockPlatformTransport()
        transport.setResponse(membersResponse(members: [("owner-only", "owner"), ("user-me", "manager")]), forView: "platform_org_members")
        let viewModel = makeViewModel(transport: transport, viewerRole: .owner, viewerUserId: "user-me")
        await viewModel.load()

        await viewModel.changeRole(userId: "owner-only", role: .manager)

        XCTAssertTrue(transport.requests(forView: "platform_member_update").isEmpty)
        XCTAssertEqual(viewModel.rowError, "An organization needs at least one owner")
        // List is unchanged — no optimistic update happened.
        XCTAssertEqual(viewModel.members?.first { $0.userId == "owner-only" }?.role, .owner)
    }

    func testChangeRoleToOwnerForLastOwnerIsNotBlocked() async {
        // Assigning `.owner` to the sole owner (a no-op role change) must
        // not trip the "demoting the last owner" guard — only a change AWAY
        // from `.owner` is guarded.
        let transport = RoutingMockPlatformTransport()
        transport.setResponse(membersResponse(members: [("owner-only", "owner"), ("user-me", "manager")]), forView: "platform_org_members")
        let viewModel = makeViewModel(transport: transport, viewerRole: .owner, viewerUserId: "user-me")
        await viewModel.load()

        await viewModel.changeRole(userId: "owner-only", role: .owner)

        XCTAssertEqual(transport.requests(forView: "platform_member_update").count, 1)
    }

    func testChangeRoleServerLastOwner409SurfacesFriendlyMessage() async {
        let transport = RoutingMockPlatformTransport()
        // Two owners client-side (so the pre-emptive guard doesn't fire),
        // but the server still says 409 last_owner (race with another client).
        transport.setResponse(membersResponse(members: [("user-me", "owner"), ("owner-2", "owner")]), forView: "platform_org_members")
        let failing = LastOwner409Transport(inner: transport, view: "platform_member_update")
        let viewModel = MembersViewModel(
            apiClient: PlatformAPIClient(baseURL: URL(string: "https://example.com")!, transport: failing),
            organizationId: "org-1",
            viewerRole: .owner,
            viewerUserId: "user-me",
            language: .en
        )
        await viewModel.load()

        await viewModel.changeRole(userId: "owner-2", role: .manager)

        XCTAssertEqual(viewModel.rowError, "An organization needs at least one owner")
    }

    // MARK: - Remove

    func testRemoveCallsRemoveMemberAndUpdatesList() async {
        let transport = RoutingMockPlatformTransport()
        transport.setResponse(membersResponse(members: [("user-me", "owner"), ("user-2", "collector")]), forView: "platform_org_members")
        let viewModel = makeViewModel(transport: transport)
        await viewModel.load()

        await viewModel.remove(userId: "user-2")

        XCTAssertEqual(viewModel.members?.map(\.userId), ["user-me"])
        let requests = transport.requests(forView: "platform_member_remove")
        XCTAssertEqual(requests.count, 1)
        let body = try? JSONSerialization.jsonObject(with: requests[0].httpBody ?? Data()) as? [String: Any]
        XCTAssertEqual(body?["organizationId"] as? String, "org-1")
        XCTAssertEqual(body?["userId"] as? String, "user-2")
    }

    func testRemoveBlockedForSelfMakesNoApiCall() async {
        let transport = RoutingMockPlatformTransport()
        transport.setResponse(membersResponse(members: [("user-me", "owner"), ("user-2", "collector")]), forView: "platform_org_members")
        let viewModel = makeViewModel(transport: transport, viewerUserId: "user-me")
        await viewModel.load()

        await viewModel.remove(userId: "user-me")

        XCTAssertTrue(transport.requests(forView: "platform_member_remove").isEmpty)
        XCTAssertEqual(viewModel.members?.map(\.userId).sorted(), ["user-2", "user-me"])
    }

    func testRemoveBlockedForNonOwnerViewerMakesNoApiCall() async {
        let transport = RoutingMockPlatformTransport()
        transport.setResponse(membersResponse(members: [("user-2", "collector")]), forView: "platform_org_members")
        let viewModel = makeViewModel(transport: transport, viewerRole: .manager, viewerUserId: "user-me")
        await viewModel.load()

        await viewModel.remove(userId: "user-2")

        XCTAssertTrue(transport.requests(forView: "platform_member_remove").isEmpty)
    }

    func testRemoveSoleOwnerIsBlockedClientSideWithNoApiCall() async {
        let transport = RoutingMockPlatformTransport()
        transport.setResponse(membersResponse(members: [("owner-only", "owner"), ("user-me", "manager")]), forView: "platform_org_members")
        let viewModel = makeViewModel(transport: transport, viewerRole: .owner, viewerUserId: "user-me")
        await viewModel.load()

        await viewModel.remove(userId: "owner-only")

        XCTAssertTrue(transport.requests(forView: "platform_member_remove").isEmpty)
        XCTAssertEqual(viewModel.rowError, "An organization needs at least one owner")
        XCTAssertEqual(viewModel.members?.count, 2)
    }

    func testRemoveOneOfTwoOwnersIsNotBlocked() async {
        let transport = RoutingMockPlatformTransport()
        transport.setResponse(membersResponse(members: [("user-me", "owner"), ("owner-2", "owner")]), forView: "platform_org_members")
        let viewModel = makeViewModel(transport: transport, viewerRole: .owner, viewerUserId: "user-me")
        await viewModel.load()

        await viewModel.remove(userId: "owner-2")

        XCTAssertEqual(transport.requests(forView: "platform_member_remove").count, 1)
        XCTAssertEqual(viewModel.members?.map(\.userId), ["user-me"])
    }

    // MARK: - Role options

    func testRoleOptionsIncludesOwnerOnlyForAdlAdminOrExistingOwner() async {
        let transport = RoutingMockPlatformTransport()
        transport.setResponse(membersResponse(members: [("owner-1", "owner"), ("manager-1", "manager")]), forView: "platform_org_members")
        let viewModel = makeViewModel(transport: transport, viewerRole: .owner, viewerIsAdlAdmin: false)
        await viewModel.load()

        let ownerRowOptions = viewModel.roleOptions(for: viewModel.members![0])
        XCTAssertTrue(ownerRowOptions.contains(.owner)) // existing owner row keeps owner in the list

        let managerRowOptions = viewModel.roleOptions(for: viewModel.members![1])
        XCTAssertFalse(managerRowOptions.contains(.owner)) // non-owner row, non-admin viewer: no owner option

        XCTAssertTrue(viewModel.isRoleOptionDisabled(.owner)) // disabled without ADL-admin
        XCTAssertFalse(viewModel.isRoleOptionDisabled(.manager))
    }

    func testRoleOptionsIncludeOwnerForAdlAdminOnAnyRow() async {
        let transport = RoutingMockPlatformTransport()
        transport.setResponse(membersResponse(members: [("manager-1", "manager")]), forView: "platform_org_members")
        let viewModel = makeViewModel(transport: transport, viewerRole: .owner, viewerIsAdlAdmin: true)
        await viewModel.load()

        let options = viewModel.roleOptions(for: viewModel.members![0])
        XCTAssertTrue(options.contains(.owner))
        XCTAssertFalse(viewModel.isRoleOptionDisabled(.owner))
    }

    // MARK: - Invite gating (roleAtLeast port)

    func testCanInviteRequiresManagerOrOwner() {
        let transport = RoutingMockPlatformTransport()
        XCTAssertTrue(makeViewModel(transport: transport, viewerRole: .owner).canInvite)
        XCTAssertTrue(makeViewModel(transport: transport, viewerRole: .manager).canInvite)
        XCTAssertFalse(makeViewModel(transport: transport, viewerRole: .reviewer).canInvite)
        XCTAssertFalse(makeViewModel(transport: transport, viewerRole: .collector).canInvite)
        XCTAssertFalse(makeViewModel(transport: transport, viewerRole: .viewer).canInvite)
    }

    // MARK: - Invite

    func testInviteCallsCreateInviteWithRoleFromAllowedSetAndPrepends() async {
        let transport = RoutingMockPlatformTransport()
        transport.setResponse(Data("{\"invite\": \(inviteJSON(id: "inv-new", email: "new@co.com", role: "reviewer"))}".utf8), forView: "platform_invite_create")
        let viewModel = makeViewModel(transport: transport)
        viewModel.inviteEmail = "  new@co.com  "
        viewModel.inviteRole = .reviewer

        let succeeded = await viewModel.invite()

        XCTAssertTrue(succeeded)
        XCTAssertEqual(viewModel.invites?.first?.id, "inv-new")
        XCTAssertEqual(viewModel.inviteEmail, "")

        let requests = transport.requests(forView: "platform_invite_create")
        let body = try? JSONSerialization.jsonObject(with: requests[0].httpBody ?? Data()) as? [String: Any]
        XCTAssertEqual(body?["organizationId"] as? String, "org-1")
        XCTAssertEqual(body?["email"] as? String, "new@co.com")
        XCTAssertEqual(body?["role"] as? String, "reviewer")
        XCTAssertTrue(MembersViewModel.inviteRoles.contains(.reviewer))
    }

    func testInviteWithEmptyEmailDoesNotCallApi() async {
        let transport = RoutingMockPlatformTransport()
        let viewModel = makeViewModel(transport: transport)
        viewModel.inviteEmail = "   "

        let succeeded = await viewModel.invite()

        XCTAssertFalse(succeeded)
        XCTAssertTrue(transport.requests(forView: "platform_invite_create").isEmpty)
    }

    // MARK: - Revoke invite

    func testRevokeInviteCallsRevokeInviteAndRemovesFromList() async {
        let transport = RoutingMockPlatformTransport()
        transport.setResponse(
            membersResponse(members: [("user-me", "owner")], invites: [inviteJSON(id: "inv-1", email: "a@b.com")]),
            forView: "platform_org_members"
        )
        let viewModel = makeViewModel(transport: transport)
        await viewModel.load()
        let invite = viewModel.invites![0]

        await viewModel.revokeInvite(invite)

        XCTAssertEqual(viewModel.invites?.isEmpty, true)
        let requests = transport.requests(forView: "platform_invite_revoke")
        XCTAssertEqual(requests.count, 1)
        let body = try? JSONSerialization.jsonObject(with: requests[0].httpBody ?? Data()) as? [String: Any]
        XCTAssertEqual(body?["organizationId"] as? String, "org-1")
        XCTAssertEqual(body?["inviteId"] as? String, "inv-1")
    }

    func testCanRevokeInviteFalseForAcceptedInviteOrBelowManager() async {
        let transport = RoutingMockPlatformTransport()
        transport.setResponse(
            membersResponse(
                members: [("user-me", "owner")],
                invites: [inviteJSON(id: "inv-1", email: "a@b.com", acceptedAt: "2026-07-10T00:00:00.000Z")]
            ),
            forView: "platform_org_members"
        )
        let ownerVM = makeViewModel(transport: transport, viewerRole: .owner)
        await ownerVM.load()
        XCTAssertFalse(ownerVM.canRevokeInvite(ownerVM.invites![0])) // already accepted

        let transport2 = RoutingMockPlatformTransport()
        transport2.setResponse(
            membersResponse(members: [("user-me", "reviewer")], invites: [inviteJSON(id: "inv-2", email: "b@b.com")]),
            forView: "platform_org_members"
        )
        let reviewerVM = makeViewModel(transport: transport2, viewerRole: .reviewer)
        await reviewerVM.load()
        XCTAssertFalse(reviewerVM.canRevokeInvite(reviewerVM.invites![0])) // below manager
    }
}

/// Forces every response for a specific `view` to a 409 with `{ code:
/// "last_owner" }`, simulating the server's actual last-owner guard for the
/// defense-in-depth fallback path.
private final class LastOwner409Transport: PlatformTransport, @unchecked Sendable {
    private let inner: RoutingMockPlatformTransport
    private let view: String

    init(inner: RoutingMockPlatformTransport, view: String) {
        self.inner = inner
        self.view = view
    }

    func send(_ request: URLRequest) async throws -> (Data, HTTPURLResponse) {
        let (data, response) = try await inner.send(request)
        guard response.url?.query?.contains("view=\(view)") == true else {
            return (data, response)
        }
        let failingResponse = HTTPURLResponse(
            url: response.url!,
            statusCode: 409,
            httpVersion: "HTTP/1.1",
            headerFields: ["content-type": "application/json"]
        )!
        return (Data("{\"error\": \"Cannot remove the last owner\", \"code\": \"last_owner\"}".utf8), failingResponse)
    }
}
