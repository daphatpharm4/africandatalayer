import ConsoleModels
import SwiftUI

/// Read-only detail sheet for one `PlatformRecord`: submitted field values,
/// capture metadata, and photo evidence. Mirrors the "expanded" state of a
/// record card in `components/Console/ReviewQueueScreen.tsx` (field/value
/// list from `record.data`, capture metadata block, photo grid) — the web
/// screen renders `Object.entries(record.data)` directly rather than through
/// a schema-derived descriptor list (it has no schema loaded on this
/// screen), so this view mirrors that exact behavior: fields are formatted
/// generically from the record's own `data` map, key by key, the same way
/// `formatFieldValue`/`key.replaceAll('_', ' ')` render them on the web.
struct ReviewRecordDetailView: View {
    @Environment(\.dismiss) private var dismiss
    let record: PlatformRecord
    let language: ConsoleLanguage

    private var t: (String, String) -> String { language.t }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    fieldsSection
                    metadataSection
                    if !record.evidence.photos.isEmpty {
                        photosSection
                    }
                    if let notes = record.evidence.notes, !notes.isEmpty {
                        notesSection(notes)
                    }
                }
                .padding(20)
            }
            .background(ADLConsoleColor.page)
            .navigationTitle(record.recordTypeKey.replacingOccurrences(of: "_", with: " ").capitalized)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(t("Close", "Fermer")) { dismiss() }
                }
            }
        }
    }

    private var fieldsSection: some View {
        ADLConsoleCard {
            VStack(alignment: .leading, spacing: 12) {
                ADLConsoleMicroLabel(text: t("Submitted form", "Formulaire soumis"))
                ForEach(sortedFields, id: \.key) { key, value in
                    VStack(alignment: .leading, spacing: 2) {
                        Text(key.replacingOccurrences(of: "_", with: " "))
                            .font(ADLConsoleFont.microLabel)
                            .foregroundStyle(ADLConsoleColor.inkMuted)
                        Text(RecordFieldFormatter.format(value, language: language))
                            .font(ADLConsoleFont.body)
                            .foregroundStyle(ADLConsoleColor.ink)
                    }
                }
            }
            .padding(16)
        }
    }

    private var sortedFields: [(key: String, value: JSONValue)] {
        record.data.map { (key: $0.key, value: $0.value) }.sorted { $0.key < $1.key }
    }

    private var metadataSection: some View {
        ADLConsoleCard {
            VStack(alignment: .leading, spacing: 10) {
                ADLConsoleMicroLabel(text: t("Capture metadata", "Métadonnées de capture"))
                ADLConsoleMetadataRow(label: t("Record ID", "ID de donnée"), value: record.id)
                ADLConsoleMetadataRow(label: t("Captured by", "Capturé par"), value: record.capturedBy)
                ADLConsoleMetadataRow(label: t("Captured at", "Capturé le"), value: record.evidence.capturedAt ?? record.createdAt)
                ADLConsoleMetadataRow(label: "GPS", value: gpsText)
                if let reviewedAt = record.reviewedAt {
                    ADLConsoleMetadataRow(label: t("Reviewed at", "Révisé le"), value: reviewedAt)
                }
            }
            .padding(16)
        }
    }

    private var gpsText: String {
        guard let gps = record.evidence.gps else {
            return t("Not captured", "Non capturé")
        }
        let accuracy = gps.accuracyMeters.map { " · ±\(Int($0))m" } ?? ""
        return String(format: "%.6f, %.6f%@", gps.latitude, gps.longitude, accuracy)
    }

    private var photosSection: some View {
        ADLConsoleCard {
            VStack(alignment: .leading, spacing: 12) {
                ADLConsoleMicroLabel(text: t("Field photos", "Photos terrain") + " (\(record.evidence.photos.count))")
                ADLConsolePhotoGrid(photoURLs: record.evidence.photos)
            }
            .padding(16)
        }
    }

    private func notesSection(_ notes: String) -> some View {
        ADLConsoleCard {
            VStack(alignment: .leading, spacing: 8) {
                ADLConsoleMicroLabel(text: t("Collector notes", "Notes du collecteur"))
                Text(notes)
                    .font(ADLConsoleFont.body)
                    .foregroundStyle(ADLConsoleColor.ink)
            }
            .padding(16)
        }
    }
}

/// Pure formatter for one `record.data` value — mirrors `formatFieldValue`
/// in `ReviewQueueScreen.tsx` branch-for-branch (empty/null → "—",
/// bool → localized Yes/No, array → comma-joined, object → pretty JSON,
/// everything else → its string form).
enum RecordFieldFormatter {
    static func format(_ value: JSONValue, language: ConsoleLanguage) -> String {
        switch value {
        case .null:
            return "—"
        case .string(let string):
            return string.isEmpty ? "—" : string
        case .bool(let bool):
            return language.t(bool ? "Yes" : "No", bool ? "Oui" : "Non")
        case .number(let number):
            return number == number.rounded() ? String(Int(number)) : String(number)
        case .array(let values):
            return values.isEmpty ? "—" : values.map { format($0, language: language) }.joined(separator: ", ")
        case .object:
            let data = (try? JSONEncoder().encode(value)) ?? Data()
            return String(data: data, encoding: .utf8) ?? "—"
        }
    }
}
