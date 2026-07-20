@testable import ADLConsole
import XCTest

/// Unit tests for `NetworkAuthService` — exercises the 3-request Auth.js
/// credentials dance (`GET csrf` → `POST callback/credentials` → `GET
/// session`) entirely against a `MockAuthTransport`, with no real network
/// activity. Mirrors `PlatformAPIClientTests`' style for `PlatformTransport`.
final class NetworkAuthServiceTests: XCTestCase {
    private let baseURL = URL(string: "https://www.app.africandatalayer.com")!

    private func makeService(transport: MockAuthTransport) -> NetworkAuthService {
        NetworkAuthService(baseURL: baseURL, transport: transport)
    }

    // MARK: - Sign-in success

    func testSignInIssuesCsrfThenCallbackThenSessionInOrder() async throws {
        let transport = MockAuthTransport(responses: [
            .json(#"{"csrfToken":"csrf-abc"}"#),
            .json(#"{"url":"https://www.app.africandatalayer.com/"}"#),
            .json(#"{"user":{"id":"user-1","email":"owner@acme.test","role":"admin","isAdmin":true}}"#),
        ])
        let service = makeService(transport: transport)

        try await service.signIn(email: "  Owner@Acme.test  ", password: "hunter2")

        XCTAssertEqual(transport.capturedRequests.count, 3)

        let csrfRequest = transport.capturedRequests[0]
        XCTAssertEqual(csrfRequest.httpMethod, "GET")
        XCTAssertEqual(csrfRequest.url?.path, "/api/auth/csrf")

        let callbackRequest = transport.capturedRequests[1]
        XCTAssertEqual(callbackRequest.httpMethod, "POST")
        XCTAssertEqual(callbackRequest.url?.path, "/api/auth/callback/credentials")
        XCTAssertEqual(
            callbackRequest.value(forHTTPHeaderField: "Content-Type"),
            "application/x-www-form-urlencoded"
        )
        XCTAssertEqual(callbackRequest.value(forHTTPHeaderField: "X-Auth-Return-Redirect"), "1")

        let fields = FormBodyFixture.fields(callbackRequest)
        XCTAssertEqual(fields["csrfToken"], "csrf-abc")
        // identifier/email are BOTH the normalized (trimmed, lowercased) email.
        XCTAssertEqual(fields["identifier"], "owner@acme.test")
        XCTAssertEqual(fields["email"], "owner@acme.test")
        XCTAssertEqual(fields["password"], "hunter2")
        XCTAssertEqual(fields["callbackUrl"], baseURL.absoluteString)
        XCTAssertEqual(fields["json"], "true")

        let sessionRequest = transport.capturedRequests[2]
        XCTAssertEqual(sessionRequest.httpMethod, "GET")
        XCTAssertEqual(sessionRequest.url?.path, "/api/auth/session")
    }

    func testSignInSucceedsWithoutThrowing() async throws {
        let transport = MockAuthTransport(responses: [
            .json(#"{"csrfToken":"csrf-abc"}"#),
            .json(#"{"url":"https://www.app.africandatalayer.com/"}"#),
            .json(#"{"user":{"id":"user-1"}}"#),
        ])
        let service = makeService(transport: transport)

        try await service.signIn(email: "owner@acme.test", password: "hunter2")
        // No throw == success.
    }

    // MARK: - Sign-in failure: invalid credentials

    func testSignInWithErrorRedirectThrowsInvalidCredentials() async {
        let transport = MockAuthTransport(responses: [
            .json(#"{"csrfToken":"csrf-abc"}"#),
            .json(#"{"url":"https://www.app.africandatalayer.com/console/auth?error=CredentialsSignin"}"#),
        ])
        let service = makeService(transport: transport)

        await XCTAssertThrowsErrorAsync(try await service.signIn(email: "wrong@acme.test", password: "bad")) { error in
            XCTAssertEqual(error as? AuthServiceError, .invalidCredentials)
        }
        // The session GET must not fire once the callback signals a credentials error.
        XCTAssertEqual(transport.capturedRequests.count, 2)
    }

    func testSignInRejectsEmptyPasswordWithoutAnyRequest() async {
        let transport = MockAuthTransport()
        let service = makeService(transport: transport)

        await XCTAssertThrowsErrorAsync(try await service.signIn(email: "owner@acme.test", password: "")) { error in
            XCTAssertEqual(error as? AuthServiceError, .invalidCredentials)
        }
        XCTAssertTrue(transport.capturedRequests.isEmpty)
    }

    // MARK: - Sign-in failure: server/network unavailable

    func testSignInWithServerErrorThrowsRetryableNetworkError() async {
        let transport = MockAuthTransport(responses: [
            .json(#"{"csrfToken":"csrf-abc"}"#),
            .json(#"{"error":"Internal Server Error"}"#, statusCode: 500),
        ])
        let service = makeService(transport: transport)

        await XCTAssertThrowsErrorAsync(try await service.signIn(email: "owner@acme.test", password: "hunter2")) { error in
            guard case .network = error as? AuthServiceError else {
                XCTFail("Expected .network, got \(error)")
                return
            }
        }
    }

    func testSignInWhenSessionComesBackEmptyThrowsNetworkError() async {
        let transport = MockAuthTransport(responses: [
            .json(#"{"csrfToken":"csrf-abc"}"#),
            .json(#"{"url":"https://www.app.africandatalayer.com/"}"#),
            .json(#"{"user":null}"#),
        ])
        let service = makeService(transport: transport)

        await XCTAssertThrowsErrorAsync(try await service.signIn(email: "owner@acme.test", password: "hunter2")) { error in
            guard case .network = error as? AuthServiceError else {
                XCTFail("Expected .network, got \(error)")
                return
            }
        }
    }

    // MARK: - Session restore

    func testRestoreSessionReturnsUserWhenSessionHasOne() async {
        let transport = MockAuthTransport(responses: [
            .json(#"{"user":{"id":"user-1","email":"owner@acme.test","role":"admin","isAdmin":true}}"#),
        ])
        let service = makeService(transport: transport)

        let user = await service.restoreSession()

        XCTAssertEqual(user, AuthSessionUser(id: "user-1", email: "owner@acme.test", role: "admin", isAdmin: true))
        XCTAssertEqual(transport.lastRequest?.url?.path, "/api/auth/session")
    }

    func testRestoreSessionReturnsNilWhenSessionHasNoUser() async {
        let transport = MockAuthTransport(responses: [
            .json(#"{"user":null}"#),
        ])
        let service = makeService(transport: transport)

        let user = await service.restoreSession()

        XCTAssertNil(user)
    }

    func testRestoreSessionReturnsNilOnServerError() async {
        let transport = MockAuthTransport(responses: [
            .json(#"{"error":"nope"}"#, statusCode: 500),
        ])
        let service = makeService(transport: transport)

        let user = await service.restoreSession()

        XCTAssertNil(user)
    }

    // MARK: - Sign-out

    func testSignOutIssuesCsrfThenSignoutRequest() async throws {
        let transport = MockAuthTransport(responses: [
            .json(#"{"csrfToken":"csrf-abc"}"#),
            .json(#"{}"#),
        ])
        let service = makeService(transport: transport)

        try await service.signOut()

        XCTAssertEqual(transport.capturedRequests.count, 2)
        let signOutRequest = transport.capturedRequests[1]
        XCTAssertEqual(signOutRequest.httpMethod, "POST")
        XCTAssertEqual(signOutRequest.url?.path, "/api/auth/signout")
        let fields = FormBodyFixture.fields(signOutRequest)
        XCTAssertEqual(fields["csrfToken"], "csrf-abc")
        XCTAssertEqual(fields["json"], "true")
    }
}
