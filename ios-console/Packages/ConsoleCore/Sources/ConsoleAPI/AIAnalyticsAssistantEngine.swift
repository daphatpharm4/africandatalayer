import ConsoleModels
import Foundation

/// Pure chat-state engine backing the AI analytics assistant chat UI
/// (`AIAnalyticsAssistantView`/`AIAnalyticsAssistantViewModel` in the app
/// target). Owns the message list and the send/loading/error state machine
/// so it's testable with `swift test` (no simulator) — the app-target
/// view-model is a thin `ObservableObject` wrapper around this that adds
/// SwiftUI bindings and bilingual copy.
///
/// Talks to `AnalyticsRepositoryProtocol.aiQuery(organizationId:query:)`,
/// which hits `POST api/ai/search?view=analytics-query` and returns the real
/// `AIQueryResponse` shape (`{ answer, facts, caveats,
/// suggestedNextValidations, confidence, modelMetadata }` — see
/// `AnalyticsRepository.swift`'s doc comment), not the task brief's guessed
/// `{ answer, data, chartSuggestion }`.
@MainActor
public final class AIAnalyticsAssistantEngine {
    /// One chat bubble. `.user` echoes what was typed; `.assistant` carries
    /// the model's answer plus any supporting facts/caveats; `.error` is a
    /// non-crashing stand-in for a failed `aiQuery` call.
    public struct ChatMessage: Identifiable, Equatable, Sendable {
        public enum Kind: Equatable, Sendable {
            case user
            case assistant
            case error
        }

        public let id: String
        public let text: String
        public let kind: Kind
        public let facts: [AnalyticsFact]
        public let caveats: [String]

        public init(
            id: String = UUID().uuidString,
            text: String,
            kind: Kind,
            facts: [AnalyticsFact] = [],
            caveats: [String] = []
        ) {
            self.id = id
            self.text = text
            self.kind = kind
            self.facts = facts
            self.caveats = caveats
        }

        public var isUser: Bool { kind == .user }
        public var isError: Bool { kind == .error }
    }

    public private(set) var messages: [ChatMessage] = []
    public private(set) var isProcessing = false

    private let repository: AnalyticsRepositoryProtocol
    private let organizationId: String
    private let genericErrorMessage: String
    private let emptyAnswerMessage: String

    public init(
        repository: AnalyticsRepositoryProtocol,
        organizationId: String,
        genericErrorMessage: String = "Sorry, I couldn't process that request. Please try again.",
        emptyAnswerMessage: String = "I don't have an answer for that yet. Try rephrasing your question."
    ) {
        self.repository = repository
        self.organizationId = organizationId
        self.genericErrorMessage = genericErrorMessage
        self.emptyAnswerMessage = emptyAnswerMessage
    }

    /// Appends the user's query as a bubble, calls `aiQuery`, then appends
    /// either the assistant's answer or a friendly error bubble. Never
    /// throws — a failed request is represented as an `.error` message, not
    /// a crash. Blank queries and re-entrant sends (while already
    /// processing) are ignored.
    public func send(_ query: String) async {
        let trimmed = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty, !isProcessing else { return }

        messages.append(ChatMessage(text: trimmed, kind: .user))
        isProcessing = true

        do {
            let response = try await repository.aiQuery(organizationId: organizationId, query: trimmed)
            let answerText = response.answer.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
                ? emptyAnswerMessage
                : response.answer
            messages.append(ChatMessage(
                text: answerText,
                kind: .assistant,
                facts: response.facts,
                caveats: response.caveats
            ))
        } catch {
            messages.append(ChatMessage(text: errorText(for: error), kind: .error))
        }

        isProcessing = false
    }

    /// Resets the conversation (e.g. when the assistant screen is dismissed
    /// and reopened, or a "clear chat" control is added later).
    public func clear() {
        messages = []
    }

    private func errorText(for error: Error) -> String {
        if let apiError = error as? PlatformAPIError, apiError.status < 500, !apiError.message.isEmpty {
            return apiError.message
        }
        return genericErrorMessage
    }
}
