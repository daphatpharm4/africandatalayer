import ConsoleAPI
import ConsoleModels
import Foundation

/// Drives `AIAnalyticsAssistantView` — a chat interface over
/// `AnalyticsRepositoryProtocol.aiQuery` (`POST
/// api/ai/search?view=analytics-query`). A thin `ObservableObject` wrapper
/// around `AIAnalyticsAssistantEngine` (in `ConsoleAPI`, package-tested with
/// `swift test`, no simulator): this view-model only adds SwiftUI bindings
/// (`@Published`) and bilingual copy (`ConsoleLanguage`, which the package
/// target can't depend on).
///
/// Neither `POST api/ai/search?view=analytics-query` nor any other analytics
/// endpoint is organization-scoped server-side today — `organizationId` is
/// kept on this view-model for interface stability only, mirroring the
/// sibling `CategoryBreakdownViewModel`/`AgentPerformanceViewModel`.
@MainActor
final class AIAnalyticsAssistantViewModel: ObservableObject {
    typealias ChatMessage = AIAnalyticsAssistantEngine.ChatMessage

    @Published private(set) var messages: [ChatMessage] = []
    @Published var inputText: String = ""
    @Published private(set) var isProcessing = false

    let language: ConsoleLanguage
    let suggestedPrompts: [String]

    private let engine: AIAnalyticsAssistantEngine

    init(
        repository: AnalyticsRepositoryProtocol,
        organizationId: String,
        language: ConsoleLanguage
    ) {
        self.language = language
        self.engine = AIAnalyticsAssistantEngine(
            repository: repository,
            organizationId: organizationId,
            genericErrorMessage: language.t(
                "Sorry, I couldn't process that request. Please try again.",
                "Désolé, je n'ai pas pu traiter cette demande. Réessayez."
            ),
            emptyAnswerMessage: language.t(
                "I don't have an answer for that yet. Try rephrasing your question.",
                "Je n'ai pas encore de réponse à cela. Essayez de reformuler votre question."
            )
        )
        self.suggestedPrompts = [
            language.t("How is collection going this week?", "Comment se déroule la collecte cette semaine ?"),
            language.t("Which agents have the best quality?", "Quels agents ont la meilleure qualité ?"),
            language.t("Show me fraud trends", "Montrez-moi les tendances de fraude"),
        ]
    }

    var isEmpty: Bool { messages.isEmpty }

    /// Sends whatever is currently in `inputText` (the input bar's submit
    /// action), clearing the field immediately for a snappy feel.
    func send() async {
        let query = inputText
        inputText = ""
        await sendQuery(query)
    }

    /// Sends an arbitrary query — used both by `send()` and by the
    /// suggested-prompt chips, which bypass `inputText` entirely.
    func sendQuery(_ query: String) async {
        let trimmed = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty, !isProcessing else { return }
        isProcessing = true
        await engine.send(trimmed)
        messages = engine.messages
        isProcessing = engine.isProcessing
    }
}
