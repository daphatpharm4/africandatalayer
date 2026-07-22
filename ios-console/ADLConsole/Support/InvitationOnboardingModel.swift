import Foundation

struct InvitationAction: Equatable {
    let identifier: String
    let title: String
    let url: URL?
}

struct InvitationOnboardingModel: Equatable {
    let body: String
    let actions: [InvitationAction]
    let supportURL: URL
    let privacyURL: URL

    init(locale: Locale = .current) {
        let isFrench = locale.identifier.lowercased().hasPrefix("fr")
        self.supportURL = SupportLinks.support
        self.privacyURL = SupportLinks.privacy

        if isFrench {
            self.body = "ADL Console est réservé aux membres invités d'une organisation African Data Layer. Connectez-vous avec les identifiants fournis par votre organisation. Besoin d'un accès ? Contactez votre administrateur ou l'assistance ADL."
            self.actions = [
                InvitationAction(identifier: "sign-in", title: "Se connecter", url: nil),
                InvitationAction(identifier: "contact-support", title: "Contacter l'assistance", url: SupportLinks.support),
                InvitationAction(identifier: "privacy", title: "Confidentialité", url: SupportLinks.privacy),
            ]
        } else {
            self.body = "ADL Console is for invited members of an African Data Layer organization. Sign in with credentials supplied by your organization. Need access? Contact your organization administrator or ADL Support."
            self.actions = [
                InvitationAction(identifier: "sign-in", title: "Sign In", url: nil),
                InvitationAction(identifier: "contact-support", title: "Contact Support", url: SupportLinks.support),
                InvitationAction(identifier: "privacy", title: "Privacy", url: SupportLinks.privacy),
            ]
        }
    }
}
