import ConsoleModels
import SwiftUI

/// Presented when `CaptureViewModel.dedupState` is `.prompt` — lets the
/// collector resolve a possible duplicate before the capture submits: attach
/// to one of the nearby existing points instead of creating a new one,
/// submit as a new point anyway, or cancel and keep editing.
struct DedupWarningSheet: View {
    let candidates: [DedupCandidate]
    let bestPointId: String?
    let language: ConsoleLanguage
    let onSubmitAsNew: () -> Void
    let onUseExisting: (DedupCandidate) -> Void
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
                        title: t("Submit as new point", "Soumettre comme nouveau point"),
                        systemImage: "plus.circle.fill"
                    ) {
                        onSubmitAsNew()
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
                "We found \(candidates.count) nearby point(s) that look similar. Attach your capture to one of them, or submit as a new point if it's genuinely different.",
                "Nous avons trouvé \(candidates.count) point(s) similaire(s) à proximité. Associez votre relevé à l'un d'eux, ou soumettez comme nouveau point s'il est réellement différent."
            ))
            .font(ADLConsoleFont.footnote)
            .foregroundStyle(ADLConsoleColor.inkMuted)
            .fixedSize(horizontal: false, vertical: true)
        }
    }

    private func candidateRow(_ candidate: DedupCandidate) -> some View {
        let isBest = candidate.pointId == bestPointId
        return Button {
            onUseExisting(candidate)
            dismiss()
        } label: {
            HStack(spacing: 12) {
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
                Image(systemName: "chevron.right")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(ADLConsoleColor.inkMuted)
            }
            .padding(12)
            .background(ADLConsoleColor.surface)
            .clipShape(RoundedRectangle(cornerRadius: ADLConsoleRadius.input, style: .continuous))
            .adlShadowBorder()
        }
        .buttonStyle(ADLConsolePressStyle())
        .accessibilityLabel(candidate.siteName ?? candidate.category)
    }
}
