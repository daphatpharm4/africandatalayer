import ConsoleAPI
import ConsoleModels
import ConsolePersistence
import SwiftUI
import UIKit

@MainActor
final class LeadQueueViewModel: ObservableObject {
    enum Filter: String, CaseIterable {
        case all
        case open
        case reviewing
        case resolved
        case rejected
    }

    @Published private(set) var reports: [IpReport] = []
    @Published private(set) var isLoading = false
    @Published private(set) var errorMessage: String?
    @Published private(set) var updatingID: String?
    @Published var filter: Filter = .all

    let language: ConsoleLanguage
    private let apiClient: PlatformAPIClient

    init(apiClient: PlatformAPIClient, language: ConsoleLanguage) {
        self.apiClient = apiClient
        self.language = language
    }

    var filteredReports: [IpReport] {
        guard filter != .all else { return reports }
        return reports.filter { $0.status == filter.rawValue }
    }

    func load() async {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }
        do {
            reports = try await apiClient.listIpReports()
        } catch {
            errorMessage = describePlatformError(error, language: language)
        }
    }

    func update(_ report: IpReport, status: Filter, notes: String) async -> Bool {
        guard status != .all else { return false }
        updatingID = report.id
        errorMessage = nil
        defer { updatingID = nil }
        do {
            let updated = try await apiClient.updateIpReport(
                id: report.id,
                status: status.rawValue,
                resolutionNotes: notes.trimmingCharacters(in: .whitespacesAndNewlines).nilIfEmpty
            )
            if let index = reports.firstIndex(where: { $0.id == updated.id }) {
                reports[index] = updated
            }
            return true
        } catch {
            errorMessage = describePlatformError(error, language: language)
            return false
        }
    }
}

struct AdminOperationsView: View {
    @EnvironmentObject private var appState: AppState
    @StateObject private var communicationsViewModel: CommunicationsViewModel
    @StateObject private var leadQueueViewModel: LeadQueueViewModel
    private let pendingWorkViewModel: PendingWorkViewModel?

    init(
        communicationsViewModel: @autoclosure @escaping () -> CommunicationsViewModel,
        leadQueueViewModel: @autoclosure @escaping () -> LeadQueueViewModel,
        pendingWorkViewModel: PendingWorkViewModel?
    ) {
        _communicationsViewModel = StateObject(wrappedValue: communicationsViewModel())
        _leadQueueViewModel = StateObject(wrappedValue: leadQueueViewModel())
        self.pendingWorkViewModel = pendingWorkViewModel
    }

    var body: some View {
        NavigationStack {
            List {
                Section {
                    NavigationLink {
                        CommunicationsView(viewModel: communicationsViewModel)
                    } label: {
                        operationRow(
                            icon: "megaphone.fill",
                            title: t("Communications & history", "Communications et historique"),
                            detail: t("Compose, schedule, monitor, and cancel campaigns.", "Composez, programmez, suivez et annulez les campagnes."),
                            tint: ADLConsoleColor.terra
                        )
                    }
                    NavigationLink {
                        LeadQueueView(viewModel: leadQueueViewModel)
                    } label: {
                        operationRow(
                            icon: "shield.lefthalf.filled",
                            title: t("IP report queue", "File des signalements PI"),
                            detail: t("Triage sworn reports and record resolution notes.", "Triez les signalements attestés et consignez leur résolution."),
                            tint: ADLConsoleColor.navy
                        )
                    }
                    if let pendingWorkViewModel {
                        NavigationLink {
                            SyncErrorAuditView(viewModel: pendingWorkViewModel)
                        } label: {
                            operationRow(
                                icon: "exclamationmark.arrow.triangle.2.circlepath",
                                title: t("Sync error audit", "Audit des erreurs de synchro"),
                                detail: t("Inspect durable, workspace-scoped failure history.", "Inspectez l’historique durable des échecs de l’espace."),
                                tint: ADLConsoleColor.danger
                            )
                        }
                    }
                } header: {
                    Text(t("Operations", "Opérations"))
                }

                Section {
                    NavigationLink(t("Data quality methodology", "Méthodologie de qualité")) {
                        QualityInfoView(language: appState.language)
                    }
                    NavigationLink(t("Data compliance", "Conformité des données")) {
                        DataComplianceView(language: appState.language)
                    }
                    NavigationLink(t("Help center", "Centre d’aide")) {
                        HelpCenterView(language: appState.language)
                    }
                } header: {
                    Text(t("Trust & guidance", "Confiance et accompagnement"))
                }
            }
            .navigationTitle(t("Admin operations", "Opérations admin"))
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Label(t("ADL admin", "Admin ADL"), systemImage: "checkmark.shield.fill")
                        .font(ADLConsoleFont.caption)
                        .foregroundStyle(ADLConsoleColor.forestDark)
                }
            }
        }
    }

    private var t: (String, String) -> String { appState.language.t }

    private func operationRow(icon: String, title: String, detail: String, tint: Color) -> some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: icon)
                .foregroundStyle(tint)
                .frame(width: 28, height: 28)
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 4) {
                Text(title).font(ADLConsoleFont.headline)
                Text(detail)
                    .font(ADLConsoleFont.caption)
                    .foregroundStyle(ADLConsoleColor.inkMuted)
            }
        }
        .padding(.vertical, 6)
    }
}

struct LeadQueueView: View {
    @StateObject private var viewModel: LeadQueueViewModel
    @State private var selectedReport: IpReport?

    init(viewModel: @autoclosure @escaping () -> LeadQueueViewModel) {
        _viewModel = StateObject(wrappedValue: viewModel())
    }

    var body: some View {
        Group {
            if viewModel.isLoading, viewModel.reports.isEmpty {
                ProgressView()
            } else if let message = viewModel.errorMessage, viewModel.reports.isEmpty {
                ADLConsoleErrorState(message: message, retryTitle: t("Try again", "Réessayer")) {
                    Task { await viewModel.load() }
                }
            } else if viewModel.filteredReports.isEmpty {
                ADLConsoleEmptyState(
                    systemImage: "checkmark.shield",
                    headline: t("No reports in this state", "Aucun signalement dans cet état"),
                    description: t("Change the filter or refresh the queue.", "Modifiez le filtre ou actualisez la file.")
                )
            } else {
                List(viewModel.filteredReports) { report in
                    Button { selectedReport = report } label: {
                        VStack(alignment: .leading, spacing: 7) {
                            HStack {
                                Text(report.targetKind.capitalized)
                                    .font(ADLConsoleFont.headline)
                                    .foregroundStyle(ADLConsoleColor.ink)
                                Spacer()
                                ADLConsolePill(
                                    text: statusLabel(report.status),
                                    foreground: statusColor(report.status),
                                    background: statusColor(report.status).opacity(0.12)
                                )
                            }
                            Text(report.description)
                                .font(ADLConsoleFont.caption)
                                .foregroundStyle(ADLConsoleColor.inkMuted)
                                .lineLimit(2)
                            Label(
                                "\(report.reporterName) · \(ADLConsoleDateFormatting.mediumDateTime(report.createdAt))",
                                systemImage: "person.crop.circle"
                            )
                            .font(ADLConsoleFont.footnote)
                            .foregroundStyle(ADLConsoleColor.inkMuted)
                        }
                        .padding(.vertical, 4)
                    }
                    .buttonStyle(.plain)
                }
                .refreshable { await viewModel.load() }
            }
        }
        .navigationTitle(t("IP report queue", "File des signalements PI"))
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Picker(t("Status", "Statut"), selection: $viewModel.filter) {
                    ForEach(LeadQueueViewModel.Filter.allCases, id: \.self) {
                        Text(statusLabel($0.rawValue)).tag($0)
                    }
                }
            }
        }
        .task { if viewModel.reports.isEmpty { await viewModel.load() } }
        .sheet(item: $selectedReport) { report in
            LeadReportDetailView(report: report, viewModel: viewModel)
        }
    }

    private var t: (String, String) -> String { viewModel.language.t }

    private func statusLabel(_ status: String) -> String {
        switch status {
        case "open": return t("Open", "Ouvert")
        case "reviewing": return t("Reviewing", "En révision")
        case "resolved": return t("Resolved", "Résolu")
        case "rejected": return t("Rejected", "Rejeté")
        default: return status.capitalized
        }
    }

    private func statusColor(_ status: String) -> Color {
        switch status {
        case "resolved": return ADLConsoleColor.forestDark
        case "rejected": return ADLConsoleColor.danger
        case "reviewing": return ADLConsoleColor.goldDark
        default: return ADLConsoleColor.navy
        }
    }
}

private struct LeadReportDetailView: View {
    let report: IpReport
    @ObservedObject var viewModel: LeadQueueViewModel
    @Environment(\.dismiss) private var dismiss
    @State private var status: LeadQueueViewModel.Filter
    @State private var notes: String

    init(report: IpReport, viewModel: LeadQueueViewModel) {
        self.report = report
        self.viewModel = viewModel
        _status = State(initialValue: LeadQueueViewModel.Filter(rawValue: report.status) ?? .reviewing)
        _notes = State(initialValue: report.resolutionNotes ?? "")
    }

    var body: some View {
        NavigationStack {
            Form {
                Section(t("Report", "Signalement")) {
                    LabeledContent(t("Reporter", "Déclarant"), value: report.reporterName)
                    LabeledContent(t("Email", "Email"), value: report.reporterEmail)
                    LabeledContent(t("Target", "Cible"), value: report.targetRef ?? report.targetKind)
                    Text(report.description)
                    Label(
                        report.sworn ? t("Sworn declaration", "Déclaration attestée") : t("Not sworn", "Non attestée"),
                        systemImage: report.sworn ? "checkmark.seal.fill" : "exclamationmark.triangle"
                    )
                }
                Section(t("Decision", "Décision")) {
                    Picker(t("Status", "Statut"), selection: $status) {
                        ForEach(LeadQueueViewModel.Filter.allCases.filter { $0 != .all }, id: \.self) {
                            Text($0.rawValue.capitalized).tag($0)
                        }
                    }
                    TextEditor(text: $notes).frame(minHeight: 120)
                }
            }
            .navigationTitle(t("Report detail", "Détail du signalement"))
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(t("Close", "Fermer")) { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button(t("Save", "Enregistrer")) {
                        Task {
                            if await viewModel.update(report, status: status, notes: notes) {
                                dismiss()
                            }
                        }
                    }
                    .disabled(viewModel.updatingID == report.id)
                }
            }
        }
    }

    private var t: (String, String) -> String { viewModel.language.t }
}

struct SyncErrorAuditView: View {
    @StateObject private var viewModel: PendingWorkViewModel
    @State private var selectedRecord: LedgerRecord?

    init(viewModel: @autoclosure @escaping () -> PendingWorkViewModel) {
        _viewModel = StateObject(wrappedValue: viewModel())
    }

    var body: some View {
        List {
            if let message = viewModel.errorHistoryMessage {
                Text(message).foregroundStyle(ADLConsoleColor.danger)
            }
            if viewModel.errorRecords.isEmpty {
                ADLConsoleEmptyState(
                    systemImage: "checkmark.icloud",
                    headline: t("No recorded sync errors", "Aucune erreur de synchronisation"),
                    description: t("This workspace has no durable sync failures.", "Cet espace ne contient aucun échec de synchronisation durable.")
                )
            } else {
                ForEach(viewModel.errorRecords, id: \.localID) { record in
                    Button { selectedRecord = record } label: {
                        VStack(alignment: .leading, spacing: 5) {
                            Text(record.recordTypeKey).font(ADLConsoleFont.headline)
                            Label(
                                record.lastErrorSafeMessage ?? t("Unknown sync error", "Erreur de synchronisation inconnue"),
                                systemImage: "exclamationmark.triangle.fill"
                            )
                            .font(ADLConsoleFont.caption)
                            .foregroundStyle(ADLConsoleColor.danger)
                            Text(record.updatedAt, style: .relative)
                                .font(ADLConsoleFont.footnote)
                                .foregroundStyle(ADLConsoleColor.inkMuted)
                        }
                    }
                    .buttonStyle(.plain)
                }
            }
        }
        .navigationTitle(t("Sync error audit", "Audit des erreurs de synchro"))
        .task { await viewModel.loadErrorHistory() }
        .sheet(isPresented: Binding(
            get: { selectedRecord != nil },
            set: { if !$0 { selectedRecord = nil } }
        )) {
            if let record = selectedRecord {
                NavigationStack {
                    Form {
                        LabeledContent(t("Record type", "Type de relevé"), value: record.recordTypeKey)
                        LabeledContent(t("State", "État"), value: record.state.rawValue)
                        LabeledContent(t("Classification", "Classification"), value: record.lastErrorClassification ?? "—")
                        LabeledContent(t("Code", "Code"), value: record.lastErrorCode ?? "—")
                        Text(record.lastErrorSafeMessage ?? t("No safe error message.", "Aucun message d’erreur sûr."))
                    }
                    .navigationTitle(t("Sync failure", "Échec de synchronisation"))
                }
            }
        }
    }

    private var t: (String, String) -> String { viewModel.language.t }
}

struct QualityInfoView: View {
    let language: ConsoleLanguage
    var body: some View {
        InfoArticleView(
            title: language.t("Data quality methodology", "Méthodologie de qualité"),
            sections: [
                (language.t("Verified value over volume", "La valeur vérifiée avant le volume"),
                 language.t("Quality scores combine evidence completeness, GPS integrity, review outcomes, freshness, and contributor trust. Raw submission volume never substitutes for verification.", "Les scores combinent la complétude des preuves, l’intégrité GPS, les décisions de révision, la fraîcheur et la confiance du contributeur. Le volume brut ne remplace jamais la vérification.")),
                (language.t("Transparent states", "États transparents"),
                 language.t("Every record keeps its provenance and review state. Estimated metrics are labelled as estimates, and rejected or flagged records remain auditable.", "Chaque relevé conserve sa provenance et son état de révision. Les métriques estimées sont indiquées comme telles, et les relevés rejetés ou signalés restent auditables.")),
            ]
        )
    }
}

struct DataComplianceView: View {
    let language: ConsoleLanguage
    var body: some View {
        InfoArticleView(
            title: language.t("Data compliance", "Conformité des données"),
            sections: [
                (language.t("Purpose and minimization", "Finalité et minimisation"),
                 language.t("Collect only evidence required for the configured project and record type. Do not enter sensitive personal data into free-text fields.", "Collectez uniquement les preuves nécessaires au projet et au type de relevé configurés. Ne saisissez pas de données personnelles sensibles dans les champs libres.")),
                (language.t("Retention and deletion", "Conservation et suppression"),
                 language.t("Retention follows the organization’s documented policy. Data subjects may request access, correction, or deletion through the privacy contact published for their workspace.", "La conservation suit la politique documentée de l’organisation. Les personnes concernées peuvent demander l’accès, la rectification ou la suppression via le contact de confidentialité de leur espace.")),
                (language.t("Incident reporting", "Signalement d’incident"),
                 language.t("Report suspected privacy, intellectual-property, or security incidents promptly. Admin decisions and resolution notes are retained in the audit trail.", "Signalez rapidement tout incident présumé de confidentialité, de propriété intellectuelle ou de sécurité. Les décisions admin et notes de résolution sont conservées dans la piste d’audit.")),
            ]
        )
    }
}

struct HelpCenterView: View {
    struct Article: Identifiable {
        let id: String
        let titleEN: String
        let titleFR: String
        let bodyEN: String
        let bodyFR: String
    }

    let language: ConsoleLanguage
    @State private var searchText = ""

    private let articles = [
        Article(id: "capture", titleEN: "Capture and evidence", titleFR: "Collecte et preuves", bodyEN: "Choose the correct project and record type, capture truthful evidence, then review the summary before saving. Offline records remain visible in Pending Work.", bodyFR: "Choisissez le bon projet et type de relevé, capturez des preuves véridiques, puis vérifiez le résumé avant d’enregistrer. Les relevés hors ligne restent visibles dans Travail en attente."),
        Article(id: "review", titleEN: "Review queue", titleFR: "File de révision", bodyEN: "Prioritize flagged evidence, inspect provenance, and provide a reason for rejection. Bulk actions appear only after selecting multiple pending records.", bodyFR: "Priorisez les preuves signalées, inspectez la provenance et indiquez un motif de rejet. Les actions groupées apparaissent après sélection de plusieurs relevés en attente."),
        Article(id: "sync", titleEN: "Offline sync recovery", titleFR: "Récupération de synchronisation", bodyEN: "Open Pending Work from the sync bar. Retry recoverable failures after reconnecting; export or discard only when policy permits.", bodyFR: "Ouvrez Travail en attente depuis la barre de synchronisation. Réessayez les échecs récupérables après reconnexion ; exportez ou supprimez uniquement si la politique l’autorise."),
        Article(id: "analytics", titleEN: "Analytics and exports", titleFR: "Analytique et exports", bodyEN: "Use filters consistently across dashboards and exports. Trust scores marked Estimated are directional and must not be presented as audited guarantees.", bodyFR: "Utilisez les mêmes filtres dans les tableaux de bord et exports. Les scores de confiance marqués Estimé sont indicatifs et ne constituent pas des garanties auditées."),
    ]

    var body: some View {
        List(filteredArticles) { article in
            NavigationLink(language.t(article.titleEN, article.titleFR)) {
                InfoArticleView(
                    title: language.t(article.titleEN, article.titleFR),
                    sections: [("", language.t(article.bodyEN, article.bodyFR))]
                )
            }
        }
        .searchable(text: $searchText)
        .navigationTitle(language.t("Help center", "Centre d’aide"))
    }

    private var filteredArticles: [Article] {
        guard !searchText.isEmpty else { return articles }
        return articles.filter {
            language.t($0.titleEN, $0.titleFR).localizedCaseInsensitiveContains(searchText)
        }
    }
}

private struct InfoArticleView: View {
    let title: String
    let sections: [(String, String)]

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                ForEach(Array(sections.enumerated()), id: \.offset) { _, section in
                    VStack(alignment: .leading, spacing: 8) {
                        if !section.0.isEmpty {
                            Text(section.0).font(ADLConsoleFont.title)
                        }
                        Text(section.1)
                            .font(ADLConsoleFont.body)
                            .foregroundStyle(ADLConsoleColor.ink)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }
            }
            .padding(20)
        }
        .navigationTitle(title)
        .background(ADLConsoleColor.page)
    }
}

struct RichTextEditorView: View {
    @Binding var text: NSAttributedString
    @State private var command: RichTextCommand?

    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: 4) {
                formatButton("bold", image: "bold", command: .bold)
                formatButton("italic", image: "italic", command: .italic)
                formatButton("underline", image: "underline", command: .underline)
                formatButton("heading", image: "textformat.size.larger", command: .heading)
                Spacer()
            }
            .padding(8)
            .background(ADLConsoleColor.navyWash)

            AttributedTextView(text: $text, command: $command)
                .frame(minHeight: 180)
        }
        .background(ADLConsoleColor.surface)
        .clipShape(RoundedRectangle(cornerRadius: ADLConsoleRadius.input, style: .continuous))
        .adlShadowBorder()
    }

    private func formatButton(_ label: String, image: String, command: RichTextCommand) -> some View {
        Button { self.command = command } label: {
            Image(systemName: image).frame(width: 44, height: 44)
        }
        .accessibilityLabel(label)
    }
}

struct RichTextEmailEditor: View {
    @Binding private var plainText: String
    @Binding private var htmlText: String
    @State private var attributedText: NSAttributedString

    init(plainText: Binding<String>, htmlText: Binding<String>) {
        _plainText = plainText
        _htmlText = htmlText
        _attributedText = State(initialValue: NSAttributedString(string: plainText.wrappedValue))
    }

    var body: some View {
        RichTextEditorView(text: $attributedText)
            .onChange(of: attributedText) { _, value in
                plainText = value.string
                let range = NSRange(location: 0, length: value.length)
                if let data = try? value.data(
                    from: range,
                    documentAttributes: [.documentType: NSAttributedString.DocumentType.html]
                ) {
                    htmlText = String(data: data, encoding: .utf8) ?? value.string
                } else {
                    htmlText = value.string
                }
            }
            .onChange(of: plainText) { _, value in
                guard value != attributedText.string else { return }
                attributedText = NSAttributedString(string: value)
            }
    }
}

private enum RichTextCommand: Equatable {
    case bold
    case italic
    case underline
    case heading
}

private struct AttributedTextView: UIViewRepresentable {
    @Binding var text: NSAttributedString
    @Binding var command: RichTextCommand?

    func makeCoordinator() -> Coordinator { Coordinator(self) }

    func makeUIView(context: Context) -> UITextView {
        let view = UITextView()
        view.delegate = context.coordinator
        view.adjustsFontForContentSizeCategory = true
        view.font = .preferredFont(forTextStyle: .body)
        view.attributedText = text
        view.backgroundColor = .clear
        return view
    }

    func updateUIView(_ view: UITextView, context: Context) {
        if !view.attributedText.isEqual(to: text) {
            view.attributedText = text
        }
        guard let command else { return }
        context.coordinator.apply(command, to: view)
        DispatchQueue.main.async { self.command = nil }
    }

    final class Coordinator: NSObject, UITextViewDelegate {
        private var parent: AttributedTextView
        init(_ parent: AttributedTextView) { self.parent = parent }

        func textViewDidChange(_ textView: UITextView) {
            parent.text = textView.attributedText
        }

        func apply(_ command: RichTextCommand, to textView: UITextView) {
            var attributes = textView.typingAttributes
            let currentFont = (attributes[.font] as? UIFont) ?? .preferredFont(forTextStyle: .body)
            switch command {
            case .bold:
                attributes[.font] = currentFont.withTraits(.traitBold)
            case .italic:
                attributes[.font] = currentFont.withTraits(.traitItalic)
            case .underline:
                attributes[.underlineStyle] = NSUnderlineStyle.single.rawValue
            case .heading:
                attributes[.font] = UIFont.preferredFont(forTextStyle: .title3)
            }
            textView.typingAttributes = attributes
            if textView.selectedRange.length > 0 {
                let mutable = NSMutableAttributedString(attributedString: textView.attributedText)
                mutable.addAttributes(attributes, range: textView.selectedRange)
                textView.attributedText = mutable
                parent.text = mutable
            }
        }
    }
}

private extension UIFont {
    func withTraits(_ traits: UIFontDescriptor.SymbolicTraits) -> UIFont {
        guard let descriptor = fontDescriptor.withSymbolicTraits(fontDescriptor.symbolicTraits.union(traits)) else {
            return self
        }
        return UIFont(descriptor: descriptor, size: pointSize)
    }
}

private extension String {
    var nilIfEmpty: String? { isEmpty ? nil : self }
}
