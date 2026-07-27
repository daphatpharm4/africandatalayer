import ConsoleModels
import SwiftUI

/// Presented when `CaptureViewModel.dedupState` is `.prompt` — informs the
/// collector about nearby points that look similar to the in-progress
/// capture before it submits. This sheet is informational only: the listed
/// candidates are legacy public *projected points*, and
/// `platform_record_create`'s `pointId` parameter only resolves org
/// *platform records* (`lib/server/platform/pointLookup.ts`) — there is no
/// way for this flow to "attach" a capture to one of these candidates, so
/// the sheet doesn't offer that action. The collector reviews the list, then
/// either submits anyway (as a new record) or cancels and keeps editing. The
/// separate, pre-existing "attach to an existing point" mechanism
/// (`CaptureViewModel.attach(to:)`/`preAttachPointId`, driven from the
/// company-map flow) is unrelated and unaffected by this sheet.
struct DedupWarningSheet: View {
    let candidates: [DedupCandidate]
    let bestPointId: String?
    let language: ConsoleLanguage
    let onSubmitAnyway: () -> Void
    let onCancel: () -> Void

    @Environment(\.dismiss) private var dismiss

    private var t: (String, String) -> String { language.t }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    header
                    VStack(alignment: .leading, spacing: 10) {
                        ADLConsoleMicroLabel(text: t("Nearby points", "Points à proximité"))
                        ForEach(candidates) { candidate in
                            candidateRow(candidate)
                        }
                    }
                    ADLConsolePrimaryButton(
                        title: t("Submit anyway", "Soumettre quand même"),
                        systemImage: "checkmark.circle.fill"
                    ) {
                        onSubmitAnyway()
                        dismiss()
                    }
                }
                .padding(20)
            }
            .background(ADLConsoleColor.page)
            .navigationTitle(t("Possible duplicate", "Doublon possible"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(t("Cancel", "Annuler")) {
                        onCancel()
                        dismiss()
                    }
                }
            }
        }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 8) {
                Image(systemName: "exclamationmark.triangle.fill")
                    .foregroundStyle(ADLConsoleColor.terraDark)
                Text(t("This might already exist", "Ce point existe peut-être déjà"))
                    .font(ADLConsoleFont.headline)
                    .foregroundStyle(ADLConsoleColor.ink)
            }
            Text(t(
                "We found \(candidates.count) nearby point(s) that look similar. Review them below, then submit anyway if this is genuinely different, or cancel to keep editing.",
                "Nous avons trouvé \(candidates.count) point(s) similaire(s) à proximité. Consultez-les ci-dessous, puis soumettez quand même si ce relevé est réellement différent, ou annulez pour continuer à modifier."
            ))
            .font(ADLConsoleFont.footnote)
            .foregroundStyle(ADLConsoleColor.inkMuted)
            .fixedSize(horizontal: false, vertical: true)
        }
    }

    /// A plain (non-interactive) informational row — no "use existing"
    /// action. Distance + match score help the collector judge for
    /// themselves whether the in-progress capture is really a duplicate.
    private func candidateRow(_ candidate: DedupCandidate) -> some View {
        let isBest = candidate.pointId == bestPointId
        return HStack(spacing: 12) {
            ZStack {
                Circle()
                    .fill(isBest ? ADLConsoleColor.forestWash : ADLConsoleColor.navyWash)
                    .frame(width: 44, height: 44)
                Image(systemName: "mappin.circle.fill")
                    .font(.system(size: 18, weight: .semibold))
                    .foregroundStyle(isBest ? ADLConsoleColor.forestDark : ADLConsoleColor.navy)
            }
            VStack(alignment: .leading, spacing: 3) {
                Text(candidate.siteName ?? candidate.category)
                    .font(ADLConsoleFont.subheadline)
                    .foregroundStyle(ADLConsoleColor.ink)
                    .lineLimit(1)
                Text(t(
                    "\(Int(candidate.distanceMeters.rounded()))m away · \(Int((candidate.matchScore * 100).rounded()))% match",
                    "à \(Int(candidate.distanceMeters.rounded()))m · \(Int((candidate.matchScore * 100).rounded()))% de correspondance"
                ))
                .font(ADLConsoleFont.caption)
                .foregroundStyle(ADLConsoleColor.inkMuted)
            }
            Spacer()
            if isBest {
                ADLConsolePill(
                    text: t("Best match", "Meilleure correspondance"),
                    foreground: ADLConsoleColor.forestDark,
                    background: ADLConsoleColor.forestWash
                )
            }
        }
        .padding(12)
        .background(ADLConsoleColor.surface)
        .clipShape(RoundedRectangle(cornerRadius: ADLConsoleRadius.input, style: .continuous))
        .adlShadowBorder()
        .accessibilityElement(children: .combine)
    }
}
