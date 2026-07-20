import ConsoleAPI
import Foundation

/// Direct port of the `describeError` helper duplicated verbatim across
/// `ProjectsScreen.tsx`, `MembersScreen.tsx`, and `SettingsScreen.tsx`
/// (identical logic in all three, per their own doc comments: "Same
/// error-copy convention as ProjectsScreen/MembersScreen/OnboardingWizard"):
///
///   - A `PlatformApiError` with `status >= 500` gets a generic bilingual
///     fallback ("Something went wrong...").
///   - Any other `PlatformApiError` surfaces the server's own
///     `body.error` message verbatim (`error.message`).
///   - A non-`PlatformApiError` JS `Error` surfaces `error.message`.
///   - Anything else falls back to a second, slightly different generic
///     bilingual string ("s'est produite" vs. "est survenue" — an existing
///     inconsistency in the three web source files, preserved here rather
///     than "fixed", since this is a byte-for-byte port).
///
/// `lastOwnerHint` mirrors `MembersScreen.tsx`'s extra handling: a 409 with
/// `member_update`/`member_remove`'s "last_owner" semantics gets its own
/// friendlier copy instead of the raw server message.
///
/// Modeling note: Swift has no "any thrown value has a `.message`" bridge
/// the way JS's `error instanceof Error` branch does. Every error this app's
/// `apiClient` throws is a `PlatformAPIError` (see `PlatformAPIClient`), so
/// the generic-`Error`-with-message branch is ported as "any `LocalizedError`
/// with a description", and only a truly untyped thrown value falls through
/// to the final generic fallback.
func describePlatformError(_ error: Error, language: ConsoleLanguage, lastOwnerHint: Bool = false) -> String {
    if let apiError = error as? PlatformAPIError {
        if lastOwnerHint && apiError.status == 409 {
            return lastOwnerMessage(language: language)
        }
        if apiError.status >= 500 {
            return language.t(
                "Something went wrong. Please try again.",
                "Une erreur est survenue. Veuillez réessayer."
            )
        }
        return apiError.message
    }
    if let localizedError = error as? LocalizedError, let description = localizedError.errorDescription {
        return description
    }
    return language.t(
        "Something went wrong. Please try again.",
        "Une erreur s'est produite. Veuillez réessayer."
    )
}

/// The bilingual copy `MembersScreen.tsx`'s `describeError(..., {
/// lastOwnerHint: true })` shows for a 409 "last_owner" response — factored
/// out so `MembersViewModel`'s pre-emptive, no-API-call last-owner guard can
/// show the exact same copy a server-driven 409 would.
func lastOwnerMessage(language: ConsoleLanguage) -> String {
    language.t(
        "An organization needs at least one owner",
        "Une organisation doit avoir au moins un propriétaire"
    )
}
