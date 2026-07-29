import ConsoleAPI
import ConsoleModels
import SwiftUI

/// Chat interface over the AI analytics assistant
/// (`AnalyticsRepositoryProtocol.aiQuery` → `POST
/// api/ai/search?view=analytics-query`). Routing into this screen lands in a
/// later task (Task 8); this file only needs to exist, take its dependencies
/// via `init`, and be previewable — mirroring the sibling analytics screens
/// (`CategoryBreakdownView`, `AgentPerformanceView`).
struct AIAnalyticsAssistantView: View {
    @StateObject private var viewModel: AIAnalyticsAssistantViewModel
    @FocusState private var inputFocused: Bool

    init(viewModel: @autoclosure @escaping () -> AIAnalyticsAssistantViewModel) {
        _viewModel = StateObject(wrappedValue: viewModel())
    }

    private var t: (String, String) -> String { viewModel.language.t }

    var body: some View {
        VStack(spacing: 0) {
            ScrollViewReader { proxy in
                ScrollView {
                    LazyVStack(alignment: .leading, spacing: 14) {
                        if viewModel.isEmpty {
                            emptyState
                        } else {
                            ForEach(viewModel.messages) { message in
                                ChatBubble(message: message, t: t)
                                    .id(message.id)
                            }
                            if viewModel.isProcessing {
                                TypingIndicatorBubble()
                                    .id("typing-indicator")
                            }
                        }
                    }
                    .padding(16)
                }
                .onChange(of: viewModel.messages.count) {
                    scrollToBottom(proxy: proxy)
                }
                .onChange(of: viewModel.isProcessing) {
                    scrollToBottom(proxy: proxy)
                }
            }

            inputBar
        }
        .background(ADLConsoleColor.page)
        .navigationTitle(t("AI Assistant", "Assistant IA"))
        .navigationBarTitleDisplayMode(.inline)
    }

    private func scrollToBottom(proxy: ScrollViewProxy) {
        withAnimation(.easeOut(duration: 0.2)) {
            if viewModel.isProcessing {
                proxy.scrollTo("typing-indicator", anchor: .bottom)
            } else if let lastId = viewModel.messages.last?.id {
                proxy.scrollTo(lastId, anchor: .bottom)
            }
        }
    }

    // MARK: - Empty state / suggested prompts

    private var emptyState: some View {
        VStack(alignment: .leading, spacing: 16) {
            ADLConsoleEmptyState(
                systemImage: "sparkles",
                headline: t("Ask the analytics assistant", "Interrogez l'assistant analytique"),
                description: t(
                    "Ask a question in plain language about collection, quality, or fraud trends.",
                    "Posez une question en langage courant sur la collecte, la qualité ou les tendances de fraude."
                )
            )

            ADLConsoleMicroLabel(text: t("Try asking", "Essayez de demander"))
                .padding(.horizontal, 4)

            VStack(alignment: .leading, spacing: 8) {
                ForEach(viewModel.suggestedPrompts, id: \.self) { prompt in
                    Button {
                        Task { await viewModel.sendQuery(prompt) }
                    } label: {
                        HStack(spacing: 10) {
                            Image(systemName: "sparkle")
                                .font(.system(size: 13, weight: .semibold))
                                .foregroundStyle(ADLConsoleColor.terra)
                            Text(prompt)
                                .font(ADLConsoleFont.subheadline)
                                .foregroundStyle(ADLConsoleColor.ink)
                                .multilineTextAlignment(.leading)
                            Spacer(minLength: 0)
                        }
                        .padding(.horizontal, 14)
                        .frame(minHeight: 44)
                        .frame(maxWidth: .infinity)
                        .background(ADLConsoleColor.surface)
                        .clipShape(RoundedRectangle(cornerRadius: ADLConsoleRadius.input, style: .continuous))
                        .adlShadowBorder()
                    }
                    .buttonStyle(ADLConsolePressStyle())
                    .disabled(viewModel.isProcessing)
                }
            }
        }
        .frame(maxWidth: .infinity)
    }

    // MARK: - Input bar

    private var inputBar: some View {
        HStack(spacing: 10) {
            TextField(
                t("Ask a question…", "Posez une question…"),
                text: $viewModel.inputText,
                axis: .vertical
            )
            .textFieldStyle(.plain)
            .lineLimit(1...4)
            .focused($inputFocused)
            .padding(.horizontal, 14)
            .padding(.vertical, 10)
            .background(ADLConsoleColor.navyWash)
            .clipShape(RoundedRectangle(cornerRadius: ADLConsoleRadius.input, style: .continuous))
            .submitLabel(.send)
            .onSubmit(submit)

            Button(action: submit) {
                ZStack {
                    Circle()
                        .fill(canSend ? ADLConsoleColor.navy : ADLConsoleColor.navy.opacity(0.35))
                        .frame(width: 44, height: 44)
                    if viewModel.isProcessing {
                        ProgressView()
                            .progressViewStyle(.circular)
                            .tint(.white)
                    } else {
                        Image(systemName: "arrow.up")
                            .font(.system(size: 16, weight: .bold))
                            .foregroundStyle(.white)
                    }
                }
            }
            .disabled(!canSend)
            .buttonStyle(ADLConsolePressStyle())
            .accessibilityLabel(t("Send", "Envoyer"))
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
        .background(ADLConsoleColor.surface)
        .overlay(alignment: .top) {
            Divider().overlay(ADLConsoleColor.navyBorder.opacity(0.4))
        }
    }

    private var canSend: Bool {
        !viewModel.isProcessing && !viewModel.inputText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    private func submit() {
        guard canSend else { return }
        Task { await viewModel.send() }
    }
}

// MARK: - Chat bubble

private struct ChatBubble: View {
    let message: AIAnalyticsAssistantViewModel.ChatMessage
    let t: (String, String) -> String

    var body: some View {
        HStack {
            if message.isUser { Spacer(minLength: 40) }

            VStack(alignment: .leading, spacing: 8) {
                Text(message.text)
                    .font(ADLConsoleFont.body)
                    .foregroundStyle(textColor)
                    .multilineTextAlignment(.leading)
                    .fixedSize(horizontal: false, vertical: true)

                if !message.facts.isEmpty {
                    VStack(alignment: .leading, spacing: 4) {
                        ForEach(Array(message.facts.enumerated()), id: \.offset) { _, fact in
                            HStack(spacing: 6) {
                                Circle()
                                    .fill(ADLConsoleColor.forest)
                                    .frame(width: 5, height: 5)
                                Text("\(fact.label): \(factValueText(fact.value))")
                                    .font(ADLConsoleFont.caption)
                                    .foregroundStyle(ADLConsoleColor.inkMuted)
                            }
                        }
                    }
                }

                if !message.caveats.isEmpty {
                    Text(message.caveats.joined(separator: " "))
                        .font(ADLConsoleFont.caption)
                        .foregroundStyle(ADLConsoleColor.inkMuted)
                        .italic()
                }
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 10)
            .background(bubbleColor)
            .clipShape(RoundedRectangle(cornerRadius: ADLConsoleRadius.card, style: .continuous))

            if !message.isUser { Spacer(minLength: 40) }
        }
    }

    private var bubbleColor: Color {
        if message.isUser { return ADLConsoleColor.navy }
        if message.isError { return ADLConsoleColor.dangerWash }
        return ADLConsoleColor.surface
    }

    private var textColor: Color {
        if message.isUser { return .white }
        if message.isError { return ADLConsoleColor.danger }
        return ADLConsoleColor.ink
    }

    private func factValueText(_ value: JSONValue) -> String {
        switch value {
        case .string(let string): return string
        case .number(let number): return number.truncatingRemainder(dividingBy: 1) == 0
            ? String(Int(number))
            : String(format: "%.1f", number)
        case .bool(let bool): return bool ? "Yes" : "No"
        case .null: return "—"
        case .array, .object: return ""
        }
    }
}

private struct TypingIndicatorBubble: View {
    @State private var isAnimating = false

    var body: some View {
        HStack {
            HStack(spacing: 4) {
                ForEach(0..<3, id: \.self) { index in
                    Circle()
                        .fill(ADLConsoleColor.inkMuted)
                        .frame(width: 6, height: 6)
                        .opacity(isAnimating ? 1 : 0.3)
                        .animation(
                            .easeInOut(duration: 0.6)
                                .repeatForever(autoreverses: true)
                                .delay(Double(index) * 0.15),
                            value: isAnimating
                        )
                }
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 12)
            .background(ADLConsoleColor.surface)
            .clipShape(RoundedRectangle(cornerRadius: ADLConsoleRadius.card, style: .continuous))

            Spacer(minLength: 40)
        }
        .onAppear { isAnimating = true }
        .accessibilityLabel("Assistant is thinking")
    }
}

// MARK: - Preview

/// Fast, deterministic stub for previews — always succeeds with a canned
/// answer, no network activity. Mirrors `CategoryBreakdownView`'s preview
/// stub.
private struct PreviewAnalyticsRepository: AnalyticsRepositoryProtocol {
    func deltaSnapshot(organizationId: String) async throws -> DeltaSnapshot {
        DeltaSnapshot(
            generatedAt: "2026-07-24T12:00:00.000Z",
            weeklyActiveContributors: 15,
            verification: KpiVerification(totalPoints: 1500, verifiedPoints: 900, verificationRatePct: 60),
            freshness: KpiFreshness(medianAgeDays: 3.5, avgAgeDays: 5.2),
            fraud: KpiFraud(eventsWithFraudCheck: 400, mismatchEvents: 8, fraudRatePct: 2.0),
            reviewQueue: KpiReviewQueue(pendingReview: 8, highRiskEvents: 3),
            enrichmentRatePct: 42.5
        )
    }

    func weeklyTrends(organizationId: String, vertical: String, metric: String, weeks: Int) async throws -> [WeeklyTrend] { [] }
    func categoryBreakdown(organizationId: String) async throws -> [CategoryBreakdown] { [] }
    func agentPerformance(organizationId: String) async throws -> [AgentPerformance] { [] }
    func spatialIntelligence(organizationId: String, vertical: String) async throws -> [GeohashScore] { [] }
    func anomalies(organizationId: String, since: Date) async throws -> [AnomalyFlag] { [] }
    func heatMapData(organizationId: String, vertical: String) async throws -> [HeatMapCell] { [] }

    func aiQuery(organizationId: String, query: String) async throws -> AIQueryResponse {
        try? await Task.sleep(nanoseconds: 400_000_000)
        return AIQueryResponse(
            answer: "Collection is up 20% this week across all verticals, driven mostly by pharmacy submissions.",
            facts: [AnalyticsFact(label: "Weekly submissions", value: .number(184), source: "kpi_summary")],
            caveats: ["Based on the last 7 days of activity only."],
            suggestedNextValidations: [],
            confidence: 0.82,
            modelMetadata: AiModelMetadata(provider: "preview", model: "preview", modelVersion: nil, promptVersion: "0", confidence: 0.82)
        )
    }
}

#Preview {
    NavigationStack {
        AIAnalyticsAssistantView(
            viewModel: AIAnalyticsAssistantViewModel(
                repository: PreviewAnalyticsRepository(),
                organizationId: "org-1",
                language: .en
            )
        )
    }
}
