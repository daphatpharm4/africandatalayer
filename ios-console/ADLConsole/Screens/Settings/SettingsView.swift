import ConsoleModels
import PhotosUI
import SwiftUI

/// The SETTINGS destination (owner-gated in `ConsoleShellView`): workspace
/// name, logo, and accent color editing. Mirrors
/// `components/Console/SettingsScreen.tsx`. All save logic lives in
/// `SettingsViewModel` — this view only renders `@Published` state and
/// converts a picked `PhotosPickerItem` into the raw byte count + base64
/// `data:` URL string the view model's `uploadLogo` expects (a platform
/// concern the web version doesn't have, since it reads a browser `File`).
///
/// `DeleteAccountPanel` (account deletion) is intentionally not ported — see
/// `SettingsViewModel`'s doc comment for why it's out of this task's scope.
@MainActor
struct SettingsView: View {
    @EnvironmentObject private var appState: AppState
    @StateObject private var viewModel: SettingsViewModel

    @State private var pickedLogoItem: PhotosPickerItem?

    private var t: (String, String) -> String { appState.language.t }

    init(viewModel: @autoclosure @escaping () -> SettingsViewModel) {
        _viewModel = StateObject(wrappedValue: viewModel())
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                if !viewModel.isOwner {
                    ADLConsoleCard {
                        Text(t("Only owners can change workspace settings", "Seuls les propriétaires peuvent modifier les paramètres"))
                            .font(ADLConsoleFont.footnote)
                            .foregroundStyle(ADLConsoleColor.navy)
                            .padding(16)
                    }
                }

                nameCard
                logoCard
                accentColorCard
            }
            .padding(20)
        }
        .background(ADLConsoleColor.page)
        .onChange(of: pickedLogoItem) { _, newItem in
            guard let newItem else { return }
            Task { await handlePickedLogo(newItem) }
        }
    }

    // MARK: - Name

    private var nameCard: some View {
        ADLConsoleCard {
            VStack(alignment: .leading, spacing: 12) {
                Text(t("Workspace name", "Nom de l'espace de travail"))
                    .font(ADLConsoleFont.headline)
                    .foregroundStyle(ADLConsoleColor.ink)

                TextField(t("Name", "Nom"), text: $viewModel.name)
                    .disabled(!viewModel.isOwner || viewModel.nameBusy)
                    .padding(12)
                    .background(ADLConsoleColor.navyWash)
                    .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))

                if let nameError = viewModel.nameError {
                    Text(nameError)
                        .font(ADLConsoleFont.footnote)
                        .foregroundStyle(ADLConsoleColor.danger)
                }

                if viewModel.isOwner {
                    ADLConsolePrimaryButton(
                        title: t("Save name", "Enregistrer le nom"),
                        isBusy: viewModel.nameBusy,
                        isDisabled: viewModel.nameBusy || !viewModel.isNameDirty,
                        pressAnimationEnabled: false
                    ) {
                        Task { await viewModel.saveName() }
                    }
                }
            }
            .padding(16)
        }
    }

    // MARK: - Logo

    private var logoCard: some View {
        ADLConsoleCard {
            VStack(alignment: .leading, spacing: 12) {
                Text(t("Logo", "Logo"))
                    .font(ADLConsoleFont.headline)
                    .foregroundStyle(ADLConsoleColor.ink)

                HStack(spacing: 16) {
                    logoAvatar

                    if viewModel.isOwner {
                        VStack(spacing: 8) {
                            // Precompute the label title on the main actor to avoid isolation warnings in the label closure
                            let logoButtonTitle: String = {
                                if viewModel.logoBusy {
                                    return t("Uploading…", "Téléversement…")
                                } else {
                                    return t("Upload logo", "Téléverser un logo")
                                }
                            }()

                            PhotosPicker(selection: $pickedLogoItem, matching: .images) {
                                HStack(spacing: 6) {
                                    Image(systemName: "photo.badge.plus")
                                    Text(logoButtonTitle)
                                }
                                .font(ADLConsoleFont.subheadline)
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 12)
                            }
                            .disabled(viewModel.logoBusy)

                            if viewModel.organization.logoUrl != nil {
                                Button(role: .destructive) {
                                    Task { await viewModel.removeLogo() }
                                } label: {
                                    Text(t("Remove logo", "Supprimer le logo"))
                                        .font(ADLConsoleFont.subheadline)
                                }
                                .disabled(viewModel.logoBusy)
                            }
                        }
                    }
                }

                if viewModel.isOwner {
                    Text(t("PNG or JPEG, up to 1 MB.", "PNG ou JPEG, jusqu'à 1 Mo."))
                        .font(ADLConsoleFont.footnote)
                        .foregroundStyle(ADLConsoleColor.inkMuted)
                }

                if let logoError = viewModel.logoError {
                    Text(logoError)
                        .font(ADLConsoleFont.footnote)
                        .foregroundStyle(ADLConsoleColor.danger)
                }
            }
            .padding(16)
        }
    }

    @ViewBuilder
    private var logoAvatar: some View {
        if let logoUrlString = viewModel.organization.logoUrl, let url = URL(string: logoUrlString) {
            AsyncImage(url: url) { phase in
                if let image = phase.image {
                    image.resizable().scaledToFill()
                } else {
                    ADLConsoleColor.navyWash
                }
            }
            .frame(width: 64, height: 64)
            .clipShape(Circle())
            .overlay(Circle().stroke(Color.primary.opacity(0.10), lineWidth: 1))
        } else {
            Circle()
                .fill(
                    LinearGradient(colors: [ADLConsoleColor.navy, ADLConsoleColor.terra], startPoint: .topLeading, endPoint: .bottomTrailing)
                )
                .frame(width: 64, height: 64)
                .overlay(
                    Text(initial(for: viewModel.organization.name))
                        .font(ADLConsoleFont.title2)
                        .foregroundStyle(.white)
                )
                .overlay(Circle().stroke(Color.primary.opacity(0.10), lineWidth: 1))
        }
    }

    private func initial(for name: String) -> String {
        let trimmed = name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard let first = trimmed.first else { return "A" }
        return String(first).uppercased()
    }

    /// Converts a `PhotosPickerItem` into the raw byte count + base64
    /// `data:` URL `SettingsViewModel.uploadLogo` expects — the platform
    /// equivalent of the web's `readFileAsDataUrl(file)`. Re-encodes through
    /// `UIImage` as JPEG to normalize the MIME type/byte layout regardless
    /// of the source format (PNG/HEIC/JPEG), matching the web's
    /// `accept="image/png,image/jpeg"` intent of "a standard raster image".
    private func handlePickedLogo(_ item: PhotosPickerItem) async {
        pickedLogoItem = nil
        guard let data = try? await item.loadTransferable(type: Data.self), let image = UIImage(data: data) else {
            return
        }
        let jpegData = image.jpegData(compressionQuality: 0.85) ?? data
        let dataURL = "data:image/jpeg;base64,\(jpegData.base64EncodedString())"
        await viewModel.uploadLogo(rawByteCount: jpegData.count, dataURL: dataURL)
    }

    // MARK: - Accent color

    private var accentColorCard: some View {
        ADLConsoleCard {
            VStack(alignment: .leading, spacing: 12) {
                Text(t("Accent color", "Couleur d'accent"))
                    .font(ADLConsoleFont.headline)
                    .foregroundStyle(ADLConsoleColor.ink)

                HStack(spacing: 12) {
                    RoundedRectangle(cornerRadius: 12, style: .continuous)
                        .fill(viewModel.isColorValid ? (colorFromHex(viewModel.colorHex) ?? Color.white) : Color.white)
                        .frame(width: 44, height: 44)
                        .overlay(
                            RoundedRectangle(cornerRadius: 12, style: .continuous)
                                .stroke(ADLConsoleColor.navyBorder, lineWidth: 1)
                        )

                    if let pickerColor = colorFromHex(viewModel.colorHex) {
                        ColorPicker(
                            "",
                            selection: Binding(
                                get: { pickerColor },
                                set: { viewModel.colorHex = $0.toHexString() }
                            )
                        )
                        .labelsHidden()
                        .disabled(!viewModel.isOwner || viewModel.colorBusy)
                    }

                    TextField("#c86b4a", text: $viewModel.colorHex)
                        .disabled(!viewModel.isOwner || viewModel.colorBusy)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled(true)
                        .padding(12)
                        .background(ADLConsoleColor.navyWash)
                        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                }

                if let colorError = viewModel.colorError {
                    Text(colorError)
                        .font(ADLConsoleFont.footnote)
                        .foregroundStyle(ADLConsoleColor.danger)
                }

                if viewModel.isOwner {
                    ADLConsolePrimaryButton(
                        title: t("Save accent color", "Enregistrer la couleur d'accent"),
                        isBusy: viewModel.colorBusy,
                        isDisabled: viewModel.colorBusy || !viewModel.isColorDirty,
                        pressAnimationEnabled: false
                    ) {
                        Task { await viewModel.saveColor() }
                    }
                }
            }
            .padding(16)
        }
    }
}

/// Parses a `#RRGGBB` string into a `Color` for display/`ColorPicker`
/// purposes only — `SettingsViewModel.isValidHexColor` (a direct port of the
/// web's `HEX_COLOR_PATTERN`) remains the single source of truth for
/// validity; this returns `nil` for anything that doesn't match.
private func colorFromHex(_ hex: String) -> Color? {
    let trimmed = hex.trimmingCharacters(in: .whitespacesAndNewlines)
    guard SettingsViewModel.isValidHexColor(trimmed) else { return nil }
    let scanner = Scanner(string: String(trimmed.dropFirst()))
    var rgb: UInt64 = 0
    guard scanner.scanHexInt64(&rgb) else { return nil }
    return Color(hex: UInt32(rgb))
}

private extension Color {
    /// Best-effort hex string round-trip for `ColorPicker`'s binding — not
    /// used by any tested logic (`SettingsViewModel.isValidHexColor` is the
    /// source of truth for validity), only for reflecting a system color
    /// picker selection back into the text field.
    func toHexString() -> String {
        guard let components = UIColor(self).cgColor.components, components.count >= 3 else {
            return SettingsViewModel.defaultAccent
        }
        let r = Int((components[0] * 255).rounded())
        let g = Int((components[1] * 255).rounded())
        let b = Int((components[2] * 255).rounded())
        return String(format: "#%02x%02x%02x", r, g, b)
    }
}
