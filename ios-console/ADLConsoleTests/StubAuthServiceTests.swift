@testable import ADLConsole
import XCTest

/// `StubAuthService` is a deliberate placeholder (see the TODO in
/// `Auth/AuthService.swift`) — these tests only pin down its current
/// input-validation behavior so a future real implementation is a visible,
/// intentional change rather than a silent one.
final class StubAuthServiceTests: XCTestCase {
    func testRejectsEmptyPassword() async {
        let service = StubAuthService()
        await XCTAssertThrowsErrorAsync(try await service.signIn(email: "a@b.com", password: "")) { error in
            XCTAssertEqual(error as? AuthServiceError, .invalidCredentials)
        }
    }

    func testRejectsMalformedEmail() async {
        let service = StubAuthService()
        await XCTAssertThrowsErrorAsync(try await service.signIn(email: "not-an-email", password: "hunter2")) { error in
            XCTAssertEqual(error as? AuthServiceError, .invalidCredentials)
        }
    }

    func testAcceptsWellFormedEmailAndNonEmptyPassword() async throws {
        let service = StubAuthService()
        try await service.signIn(email: "a@b.com", password: "hunter2")
        // No throw == success.
    }
}

/// Small async-throwing assertion helper — XCTest's `XCTAssertThrowsError`
/// has no async overload as of this Swift toolchain.
func XCTAssertThrowsErrorAsync<T>(
    _ expression: @autoclosure () async throws -> T,
    _ errorHandler: (Error) -> Void = { _ in },
    file: StaticString = #filePath,
    line: UInt = #line
) async {
    do {
        _ = try await expression()
        XCTFail("Expected an error to be thrown", file: file, line: line)
    } catch {
        errorHandler(error)
    }
}
