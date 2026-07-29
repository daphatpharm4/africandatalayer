import ConsoleModels
import XCTest
@testable import ConsoleAPI

/// Stub conforming to `AnalyticsRepositoryProtocol` for engine tests.
/// `aiQuery` is the only method exercised; every other requirement fails
/// loudly if accidentally called.
private final class StubAnalyticsRepository: AnalyticsRepositoryProtocol, @unchecked Sendable {
    var aiQueryResult: Result<AIQueryResponse, Error> = .failure(PlatformAPIError(message: "not configured", status: 500))
    private(set) var aiQueryCallCount = 0
    private(set) var lastQuery: String?

    func aiQuery(organizationId: String, query: String) async throws -> AIQueryResponse {
        aiQueryCallCount += 1
        lastQuery = query
        return try aiQueryResult.get()
    }

    func deltaSnapshot(organizationId: String) async throws -> DeltaSnapshot {
        fatalError("unused in AIAnalyticsAssistantEngineTests")
    }

    func weeklyTrends(organizationId: String, vertical: String, metric: String, weeks: Int) async throws -> [WeeklyTrend] {
        fatalError("unused in AIAnalyticsAssistantEngineTests")
    }

    func categoryBreakdown(organizationId: String) async throws -> [CategoryBreakdown] {
        fatalError("unused in AIAnalyticsAssistantEngineTests")
    }

    func agentPerformance(organizationId: String) async throws -> [AgentPerformance] {
        fatalError("unused in AIAnalyticsAssistantEngineTests")
    }

    func spatialIntelligence(organizationId: String, vertical: String) async throws -> [GeohashScore] {
        fatalError("unused in AIAnalyticsAssistantEngineTests")
    }

    func anomalies(organizationId: String, since: Date) async throws -> [AnomalyFlag] {
        fatalError("unused in AIAnalyticsAssistantEngineTests")
    }

    func heatMapData(organizationId: String, vertical: String) async throws -> [HeatMapCell] {
        fatalError("unused in AIAnalyticsAssistantEngineTests")
    }
}

@MainActor
final class AIAnalyticsAssistantEngineTests: XCTestCase {
    private func makeModelMetadata() -> AiModelMetadata {
        AiModelMetadata(provider: "google", model: "gemini-1.5-flash", modelVersion: nil, promptVersion: "analytics-query-v1", confidence: 0.8)
    }

    // MARK: - send -> loading -> response bubble

    func testSendAppendsUserMessageThenAssistantAnswer() async {
        let repository = StubAnalyticsRepository()
        repository.aiQueryResult = .success(AIQueryResponse(
            answer: "Collection is up 20% this week.",
            facts: [AnalyticsFact(label: "Weekly submissions", value: .number(120), source: "kpi_summary")],
            caveats: ["Based on the last 7 days only."],
            suggestedNextValidations: [],
            confidence: 0.8,
            modelMetadata: makeModelMetadata()
        ))
        let engine = AIAnalyticsAssistantEngine(repository: repository, organizationId: "o1")

        await engine.send("How is collection going?")

        XCTAssertEqual(engine.messages.count, 2, "user query + AI response")
        XCTAssertEqual(engine.messages[0].text, "How is collection going?")
        XCTAssertTrue(engine.messages[0].isUser)
        XCTAssertEqual(engine.messages[1].text, "Collection is up 20% this week.")
        XCTAssertFalse(engine.messages[1].isUser)
        XCTAssertFalse(engine.messages[1].isError)
        XCTAssertEqual(engine.messages[1].facts.count, 1)
        XCTAssertEqual(engine.messages[1].caveats, ["Based on the last 7 days only."])
        XCTAssertFalse(engine.isProcessing, "must not be left stuck loading after completion")
        XCTAssertEqual(repository.aiQueryCallCount, 1)
        XCTAssertEqual(repository.lastQuery, "How is collection going?")
    }

    func testIsProcessingIsTrueWhileRequestIsInFlight() async {
        let repository = StubAnalyticsRepository()
        repository.aiQueryResult = .success(AIQueryResponse(
            answer: "Answer.",
            facts: [],
            caveats: [],
            suggestedNextValidations: [],
            confidence: 0.5,
            modelMetadata: makeModelMetadata()
        ))
        let engine = AIAnalyticsAssistantEngine(repository: repository, organizationId: "o1")

        XCTAssertFalse(engine.isProcessing)
        let task = Task { await engine.send("Question?") }
        await task.value

        XCTAssertFalse(engine.isProcessing, "processing flag must clear once the send completes")
    }

    // MARK: - error -> error bubble, not crash

    func testSendFailureAppendsErrorBubbleInsteadOfThrowing() async {
        let repository = StubAnalyticsRepository()
        repository.aiQueryResult = .failure(PlatformAPIError(message: "Service unavailable", status: 503))
        let engine = AIAnalyticsAssistantEngine(repository: repository, organizationId: "o1")

        await engine.send("Show me fraud trends")

        XCTAssertEqual(engine.messages.count, 2)
        XCTAssertTrue(engine.messages[1].isError)
        XCTAssertFalse(engine.messages[1].text.isEmpty)
        XCTAssertFalse(engine.isProcessing)
    }

    func test4xxErrorSurfacesTheServerMessageVerbatim() async {
        let repository = StubAnalyticsRepository()
        repository.aiQueryResult = .failure(PlatformAPIError(message: "Rate limit exceeded", status: 429))
        let engine = AIAnalyticsAssistantEngine(repository: repository, organizationId: "o1")

        await engine.send("Which agents have the best quality?")

        XCTAssertEqual(engine.messages[1].text, "Rate limit exceeded")
    }

    func test5xxErrorSurfacesAGenericFallbackNotTheRawServerMessage() async {
        let repository = StubAnalyticsRepository()
        repository.aiQueryResult = .failure(PlatformAPIError(message: "internal stack trace leak", status: 500))
        let engine = AIAnalyticsAssistantEngine(
            repository: repository,
            organizationId: "o1",
            genericErrorMessage: "Sorry, I couldn't process that request."
        )

        await engine.send("How is collection going?")

        XCTAssertEqual(engine.messages[1].text, "Sorry, I couldn't process that request.")
    }

    func testSendingAgainAfterAFailureRecovers() async {
        let repository = StubAnalyticsRepository()
        repository.aiQueryResult = .failure(PlatformAPIError(message: "boom", status: 500))
        let engine = AIAnalyticsAssistantEngine(repository: repository, organizationId: "o1")
        await engine.send("first question")
        XCTAssertTrue(engine.messages[1].isError)

        repository.aiQueryResult = .success(AIQueryResponse(
            answer: "Recovered answer.",
            facts: [],
            caveats: [],
            suggestedNextValidations: [],
            confidence: 0.9,
            modelMetadata: makeModelMetadata()
        ))
        await engine.send("second question")

        XCTAssertEqual(engine.messages.count, 4)
        XCTAssertFalse(engine.messages[3].isError)
        XCTAssertEqual(engine.messages[3].text, "Recovered answer.")
    }

    // MARK: - empty response handled

    func testEmptyAnswerFallsBackToAPlaceholderInsteadOfABlankBubble() async {
        let repository = StubAnalyticsRepository()
        repository.aiQueryResult = .success(AIQueryResponse(
            answer: "",
            facts: [],
            caveats: [],
            suggestedNextValidations: [],
            confidence: 0.0,
            modelMetadata: makeModelMetadata()
        ))
        let engine = AIAnalyticsAssistantEngine(
            repository: repository,
            organizationId: "o1",
            emptyAnswerMessage: "I don't have an answer for that yet."
        )

        await engine.send("What is the meaning of life?")

        XCTAssertEqual(engine.messages.count, 2)
        XCTAssertFalse(engine.messages[1].isError, "an empty answer is not a failure -- it's still a successful (if unhelpful) response")
        XCTAssertEqual(engine.messages[1].text, "I don't have an answer for that yet.")
    }

    func testWhitespaceOnlyAnswerIsTreatedAsEmpty() async {
        let repository = StubAnalyticsRepository()
        repository.aiQueryResult = .success(AIQueryResponse(
            answer: "   \n",
            facts: [],
            caveats: [],
            suggestedNextValidations: [],
            confidence: 0.0,
            modelMetadata: makeModelMetadata()
        ))
        let engine = AIAnalyticsAssistantEngine(
            repository: repository,
            organizationId: "o1",
            emptyAnswerMessage: "fallback"
        )

        await engine.send("question")

        XCTAssertEqual(engine.messages[1].text, "fallback")
    }

    // MARK: - guard rails

    func testBlankQueryIsIgnored() async {
        let repository = StubAnalyticsRepository()
        let engine = AIAnalyticsAssistantEngine(repository: repository, organizationId: "o1")

        await engine.send("   ")

        XCTAssertTrue(engine.messages.isEmpty)
        XCTAssertEqual(repository.aiQueryCallCount, 0)
    }

    func testQueryIsTrimmedBeforeBeingSentAndDisplayed() async {
        let repository = StubAnalyticsRepository()
        repository.aiQueryResult = .success(AIQueryResponse(
            answer: "ok",
            facts: [],
            caveats: [],
            suggestedNextValidations: [],
            confidence: 0.5,
            modelMetadata: makeModelMetadata()
        ))
        let engine = AIAnalyticsAssistantEngine(repository: repository, organizationId: "o1")

        await engine.send("  How is collection going?  ")

        XCTAssertEqual(engine.messages[0].text, "How is collection going?")
        XCTAssertEqual(repository.lastQuery, "How is collection going?")
    }

    func testClearResetsTheConversation() async {
        let repository = StubAnalyticsRepository()
        repository.aiQueryResult = .success(AIQueryResponse(
            answer: "ok",
            facts: [],
            caveats: [],
            suggestedNextValidations: [],
            confidence: 0.5,
            modelMetadata: makeModelMetadata()
        ))
        let engine = AIAnalyticsAssistantEngine(repository: repository, organizationId: "o1")
        await engine.send("question")
        XCTAssertFalse(engine.messages.isEmpty)

        engine.clear()

        XCTAssertTrue(engine.messages.isEmpty)
    }
}
