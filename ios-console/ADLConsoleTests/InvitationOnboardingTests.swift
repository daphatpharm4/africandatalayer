import XCTest
@testable import ADLConsole

final class InvitationOnboardingTests: XCTestCase {
    func testSignedOutScreenHasNoSignupAndWorkingHelpLinks() {
        let model = InvitationOnboardingModel(locale: Locale(identifier: "fr"))
        XCTAssertEqual(model.body, "ADL Console est réservé aux membres invités d'une organisation African Data Layer. Connectez-vous avec les identifiants fournis par votre organisation. Besoin d'un accès ? Contactez votre administrateur ou l'assistance ADL.")
        let identifiers = model.actions.map(\.identifier)
        XCTAssertFalse(identifiers.contains("create-account"))
        XCTAssertEqual(identifiers, ["sign-in", "contact-support", "privacy"])
        XCTAssertEqual(model.supportURL.scheme, "https")
        XCTAssertEqual(model.privacyURL.scheme, "https")
    }
    
    func testEnglishOnboarding() {
        let model = InvitationOnboardingModel(locale: Locale(identifier: "en"))
        XCTAssertTrue(model.body.contains("invited members"))
        XCTAssertFalse(model.body.contains("sign up"))
    }
}
