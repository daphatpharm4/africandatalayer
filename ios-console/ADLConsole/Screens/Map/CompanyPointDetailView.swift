import ConsoleForms
import ConsoleModels
import SwiftUI

/// Read-only point-detail sheet for one collapsed point-chain: identity +
/// **one demarcated dated section per update**, newest first ("Latest
/// update" / "Update N" + timestamp), each with that record's fields + GPS +
/// notes + photos. Mirrors the web field app's `CompanyRecordDetails` in
/// `components/Screens/Details.tsx` (chain-section rendering, "N updates on
/// this point" banner, "Update this point" CTA gated on `status ==
/// 'approved'`) — the console equivalent of that screen for the collector's
/// native map. All chain/order logic already happened in
/// `PointChainGrouping.collapseRecordChains`; this view only renders
/// `collapsedPoint.chain` in the order it was given.
struct CompanyPointDetailView: View {
    @Environment(\.dismiss) private var dismiss

    let collapsedPoint: CollapsedPlatformPoint
    let language: ConsoleLanguage
    /// Invoked when the collector taps "Update this point" — the caller
    /// (`CompanyMapView`) is responsible for dismissing this sheet and
    /// presenting `CaptureView` pre-attached to `collapsedPoint.rootId`.
    let onUpdate: () -> Void

    private var t: (String, String) -> String { language.t }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    header
                    if collapsedPoint.chainCount > 1 {
                        chainCountBanner
                    }
                    ForEach(Array(collapsedPoint.chain.enumerated()), id: \.element.id) { index, record in
                        updateSection(record: record, index: index)
                    }
                    updateButton
                }
                .padding(20)
            }
            .background(ADLConsoleColor.page)
            .navigationTitle(recordTypeTitle)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(t("Close", "Fermer")) { dismiss() }
                }
            }
        }
    }

    private var recordTypeTitle: String {
        collapsedPoint.representative.recordTypeKey.replacingOccurrences(of: "_", with: " ").capitalized
    }

    // MARK: - Header

    private var header: some View {
        ADLConsoleCard {
            VStack(alignment: .leading, spacing: 6) {
                ADLConsoleMicroLabel(text: t("Company point", "Point entreprise"))
                Text(recordTypeTitle)
                    .font(ADLConsoleFont.title)
                    .foregroundStyle(ADLConsoleColor.ink)
                Text(
                    "\(t("Captured", "Capturée")) "
                        + formattedDate(collapsedPoint.representative.evidence.capturedAt ?? collapsedPoint.representative.createdAt)
                )
                .font(ADLConsoleFont.footnote)
                .foregroundStyle(ADLConsoleColor.inkMuted)
            }
            .padding(16)
        }
    }

    private var chainCountBanner: some View {
        Text("\(collapsedPoint.chainCount) \(t("updates on this point", "mises à jour sur ce point"))")
            .font(ADLConsoleFont.subheadline)
            .foregroundStyle(ADLConsoleColor.inkMuted)
            .padding(.horizontal, 4)
    }

    // MARK: - Per-update section

    private func updateSection(record: PlatformRecord, index: Int) -> some View {
        ADLConsoleCard {
            VStack(alignment: .leading, spacing: 12) {
                HStack(alignment: .firstTextBaseline) {
                    ADLConsoleMicroLabel(text: sectionTitle(index: index))
                    Spacer(minLength: 8)
                    Text(formattedDate(record.evidence.capturedAt ?? record.createdAt))
                        .font(ADLConsoleFont.footnote)
                        .foregroundStyle(ADLConsoleColor.inkMuted)
                }

                ForEach(sortedFields(record), id: \.key) { key, value in
                    VStack(alignment: .leading, spacing: 2) {
                        Text(key.replacingOccurrences(of: "_", with: " "))
                            .font(ADLConsoleFont.microLabel)
                            .foregroundStyle(ADLConsoleColor.inkMuted)
                        Text(RecordFieldFormatter.format(value, language: language))
                            .font(ADLConsoleFont.body)
                            .foregroundStyle(ADLConsoleColor.ink)
                    }
                }

                evidenceBlock(record)
            }
            .padding(16)
        }
    }

    /// "Latest update" / "Update N" (N counts down from `chainCount`, newest
    /// first) — mirrors `CompanyRecordDetails`'s section-title branch in
    /// `Details.tsx` exactly, including falling back to "Submitted fields"
    /// for a standalone (non-chain) point.
    private func sectionTitle(index: Int) -> String {
        guard collapsedPoint.chainCount > 1 else {
            return t("Submitted fields", "Champs soumis")
        }
        if index == 0 {
            return t("Latest update", "Dernière mise à jour")
        }
        return "\(t("Update", "Mise à jour")) \(collapsedPoint.chainCount - index)"
    }

    private func sortedFields(_ record: PlatformRecord) -> [(key: String, value: JSONValue)] {
        record.data.map { (key: $0.key, value: $0.value) }.sorted { $0.key < $1.key }
    }

    // MARK: - Evidence (GPS + notes + photos)

    private func evidenceBlock(_ record: PlatformRecord) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 6) {
                Image(systemName: "mappin.circle")
                Text(t("Field evidence", "Justificatifs terrain"))
                    .font(ADLConsoleFont.microLabel)
            }
            .foregroundStyle(ADLConsoleColor.inkMuted)

            Text(gpsText(record))
                .font(ADLConsoleFont.footnote)
                .foregroundStyle(ADLConsoleColor.ink)

            if let notes = record.evidence.notes, !notes.isEmpty {
                Text(notes)
                    .font(ADLConsoleFont.footnote)
                    .foregroundStyle(ADLConsoleColor.ink)
            }

            if !record.evidence.photos.isEmpty {
                LazyVGrid(columns: [GridItem(.adaptive(minimum: 90), spacing: 8)], spacing: 8) {
                    ForEach(Array(record.evidence.photos.enumerated()), id: \.offset) { _, photo in
                        if let url = URL(string: photo) {
                            AsyncImage(url: url) { phase in
                                if let image = phase.image {
                                    image.resizable().scaledToFill()
                                } else {
                                    ADLConsoleColor.navyWash
                                }
                            }
                            .frame(height: 90)
                            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                        }
                    }
                }
            }
        }
        .padding(12)
        .background(ADLConsoleColor.navyWash.opacity(0.5))
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
    }

    private func gpsText(_ record: PlatformRecord) -> String {
        guard let gps = record.evidence.gps else {
            return t("Not captured", "Non capturé")
        }
        let accuracy = gps.accuracyMeters.map { " · ±\(Int($0))m" } ?? ""
        return String(format: "%.6f, %.6f%@", gps.latitude, gps.longitude, accuracy)
    }

    // MARK: - Update CTA

    /// Gated on `status == .approved`, mirroring `Details.tsx`'s
    /// `record.status === 'approved'` guard on the "Update this point" CTA
    /// section — only an approved point is a stable target to attach a
    /// fresh capture to.
    @ViewBuilder
    private var updateButton: some View {
        if collapsedPoint.representative.status == .approved {
            ADLConsolePrimaryButton(
                title: t("Update this point", "Mettre à jour ce point"),
                systemImage: "arrow.triangle.2.circlepath"
            ) {
                dismiss()
                onUpdate()
            }
        }
    }

    // MARK: - Date formatting

    private func formattedDate(_ isoString: String) -> String {
        guard let date = ISO8601Formatters.fractionalSeconds.date(from: isoString)
            ?? ISO8601Formatters.plain.date(from: isoString)
        else {
            return isoString
        }
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .short
        return formatter.string(from: date)
    }
}

/// `ISO8601DateFormatter` is not `Sendable`, but these instances are only
/// ever read (never mutated) after creation — same reasoning as
/// `DataBrowseView`'s local formatter extension.
private enum ISO8601Formatters {
    nonisolated(unsafe) static let fractionalSeconds: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter
    }()

    nonisolated(unsafe) static let plain = ISO8601DateFormatter()
}
