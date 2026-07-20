import ConsoleModels
import SwiftUI

/// Standard console card — white surface, soft navy border, continuous corners.
struct ADLConsoleCard<Content: View>: View {
    var padding: CGFloat = 0
    @ViewBuilder var content: Content

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            content
        }
        .padding(padding)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(ADLConsoleColor.surface)
        .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 20, style: .continuous)
                .stroke(ADLConsoleColor.navyBorder.opacity(0.9), lineWidth: 1)
        )
        .shadow(color: Color.black.opacity(0.04), radius: 8, x: 0, y: 2)
    }
}

/// Navy hero card used for workspace headers (matches web RoleWorkspaceScreen).
struct ADLConsoleHeroCard<Content: View>: View {
    @ViewBuilder var content: Content

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            content
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(20)
        .background(
            LinearGradient(
                colors: [ADLConsoleColor.navy, ADLConsoleColor.navyDark],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
        )
        .clipShape(RoundedRectangle(cornerRadius: 24, style: .continuous))
        .shadow(color: ADLConsoleColor.navy.opacity(0.25), radius: 12, x: 0, y: 6)
    }
}

/// Primary navy action button — mirrors web `.btn-primary`.
struct ADLConsolePrimaryButton: View {
    let title: String
    var systemImage: String? = nil
    var isBusy: Bool = false
    var isDisabled: Bool = false
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            ZStack {
                if isBusy {
                    ProgressView()
                        .progressViewStyle(.circular)
                        .tint(.white)
                } else {
                    HStack(spacing: 8) {
                        if let systemImage {
                            Image(systemName: systemImage)
                        }
                        Text(title)
                            .font(ADLConsoleFont.headline)
                    }
                }
            }
            .frame(maxWidth: .infinity)
            .frame(height: 52)
        }
        .background(isDisabled ? ADLConsoleColor.navy.opacity(0.45) : ADLConsoleColor.navy)
        .foregroundStyle(.white)
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
        .disabled(isDisabled || isBusy)
        .buttonStyle(ADLConsolePressStyle())
    }
}

/// Outlined secondary button — language toggle, refresh, etc.
struct ADLConsoleSecondaryButton: View {
    let title: String
    var systemImage: String? = nil
    var tint: Color = ADLConsoleColor.navy
    var border: Color = ADLConsoleColor.navyBorder
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 6) {
                if let systemImage {
                    Image(systemName: systemImage)
                }
                Text(title)
                    .font(ADLConsoleFont.subheadline)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 12)
            .padding(.horizontal, 14)
            .foregroundStyle(tint)
            .background(ADLConsoleColor.surface)
            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .stroke(border, lineWidth: 1)
            )
        }
        .buttonStyle(ADLConsolePressStyle())
    }
}

/// Destructive outline button (sign out / delete).
struct ADLConsoleDestructiveButton: View {
    let title: String
    var systemImage: String? = nil
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 6) {
                if let systemImage {
                    Image(systemName: systemImage)
                }
                Text(title)
                    .font(ADLConsoleFont.subheadline)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 12)
            .padding(.horizontal, 14)
            .foregroundStyle(ADLConsoleColor.danger)
            .background(ADLConsoleColor.surface)
            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .stroke(ADLConsoleColor.danger.opacity(0.45), lineWidth: 1)
            )
        }
        .buttonStyle(ADLConsolePressStyle())
    }
}

struct ADLConsolePressStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? 0.97 : 1)
            .opacity(configuration.isPressed ? 0.92 : 1)
            .animation(.easeOut(duration: 0.12), value: configuration.isPressed)
    }
}

/// Compact chip-style button used for row actions (Inspect, Reject, Approve).
/// Ensures ≥44pt touch target via minimum height. Supports outlined and filled variants.
struct ADLConsoleChipStyle: ButtonStyle {
    var outlined: Bool = false
    var filled: Bool = false
    var tinted: Color = ADLConsoleColor.navy
    var fillColor: Color = ADLConsoleColor.navy

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .padding(.horizontal, 14)
            .frame(minHeight: 36)
            .foregroundStyle(filled ? .white : tinted)
            .background(filled ? fillColor : Color.clear)
            .clipShape(Capsule())
            .overlay(
                Capsule()
                    .stroke(filled ? Color.clear : tinted.opacity(0.45), lineWidth: 1)
            )
            .scaleEffect(configuration.isPressed ? 0.95 : 1)
            .opacity(configuration.isPressed ? 0.9 : 1)
            .animation(.easeOut(duration: 0.12), value: configuration.isPressed)
    }
}

struct ADLConsoleMicroLabel: View {
    let text: String
    var color: Color = ADLConsoleColor.inkMuted

    var body: some View {
        Text(text.uppercased())
            .font(ADLConsoleFont.microLabel)
            .tracking(0.7)
            .foregroundStyle(color)
    }
}

/// Status / role pill matching web badges.
struct ADLConsolePill: View {
    let text: String
    var foreground: Color = ADLConsoleColor.navy
    var background: Color = ADLConsoleColor.navyWash

    var body: some View {
        Text(text.uppercased())
            .font(ADLConsoleFont.microLabel)
            .tracking(0.4)
            .foregroundStyle(foreground)
            .padding(.horizontal, 10)
            .padding(.vertical, 5)
            .background(background)
            .clipShape(Capsule())
    }
}

/// Horizontal filter chip (review filters, map/list toggle).
struct ADLConsoleChip: View {
    let title: String
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(title)
                .font(ADLConsoleFont.subheadline)
                .padding(.horizontal, 14)
                .padding(.vertical, 9)
                .foregroundStyle(isSelected ? Color.white : ADLConsoleColor.ink)
                .background(isSelected ? ADLConsoleColor.navy : Color.white)
                .clipShape(Capsule())
                .overlay(
                    Capsule()
                        .stroke(isSelected ? Color.clear : ADLConsoleColor.navyBorder, lineWidth: 1)
                )
        }
        .buttonStyle(ADLConsolePressStyle())
    }
}

/// Tappable workspace action row (web RoleWorkspaceScreen cards).
struct ADLConsoleActionRow: View {
    let title: String
    let subtitle: String
    let systemImage: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 14) {
                ZStack {
                    Circle()
                        .fill(ADLConsoleColor.navyWash)
                        .frame(width: 44, height: 44)
                    Image(systemName: systemImage)
                        .font(.system(size: 17, weight: .semibold))
                        .foregroundStyle(ADLConsoleColor.navy)
                }
                VStack(alignment: .leading, spacing: 3) {
                    Text(title)
                        .font(ADLConsoleFont.headline)
                        .foregroundStyle(ADLConsoleColor.ink)
                        .multilineTextAlignment(.leading)
                    Text(subtitle)
                        .font(ADLConsoleFont.footnote)
                        .foregroundStyle(ADLConsoleColor.inkMuted)
                        .multilineTextAlignment(.leading)
                }
                Spacer(minLength: 8)
                Image(systemName: "chevron.right")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(ADLConsoleColor.inkMuted)
            }
            .padding(16)
            .background(ADLConsoleColor.surface)
            .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 18, style: .continuous)
                    .stroke(ADLConsoleColor.navyBorder, lineWidth: 1)
            )
        }
        .buttonStyle(ADLConsolePressStyle())
    }
}

/// Soft text field chrome matching web inputs.
struct ADLConsoleFieldChrome<Content: View>: View {
    @ViewBuilder var content: Content

    var body: some View {
        content
            .padding(14)
            .background(ADLConsoleColor.surface)
            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .stroke(ADLConsoleColor.navyBorder, lineWidth: 1)
            )
    }
}

// MARK: - Extracted reusable patterns

/// Standard empty state: SF Symbol + headline + description + optional action button centered in a card.
/// Used across DataBrowseView, ReviewQueueView, ProjectsView, CompanyMapView, CaptureView.
struct ADLConsoleEmptyState: View {
    let systemImage: String
    let headline: String
    let description: String
    var iconColor: Color = ADLConsoleColor.inkMuted
    var actionTitle: String? = nil
    var action: (() -> Void)? = nil

    var body: some View {
        VStack(spacing: 10) {
            Image(systemName: systemImage)
                .font(.system(size: 30))
                .foregroundStyle(iconColor)
                .accessibilityHidden(true)
            Text(headline)
                .font(ADLConsoleFont.headline)
                .foregroundStyle(ADLConsoleColor.ink)
                .multilineTextAlignment(.center)
            if !description.isEmpty {
                Text(description)
                    .font(ADLConsoleFont.footnote)
                    .foregroundStyle(ADLConsoleColor.inkMuted)
                    .multilineTextAlignment(.center)
            }
            if let actionTitle, let action {
                Button(actionTitle) { action() }
                    .font(ADLConsoleFont.subheadline)
                    .foregroundStyle(ADLConsoleColor.navy)
            }
        }
        .frame(maxWidth: .infinity)
        .padding(24)
    }
}

/// Loading skeleton placeholder: three pulsing bars used as a content placeholder
/// while data loads. Gives a visual hint of the layout to come.
struct ADLConsoleSkeleton: View {
    @State private var isAnimating = false

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            RoundedRectangle(cornerRadius: 6)
                .fill(ADLConsoleColor.navyWash)
                .frame(height: 16)
                .frame(maxWidth: .infinity, alignment: .leading)
            RoundedRectangle(cornerRadius: 6)
                .fill(ADLConsoleColor.navyWash)
                .frame(height: 12)
                .frame(maxWidth: 220, alignment: .leading)
            RoundedRectangle(cornerRadius: 6)
                .fill(ADLConsoleColor.navyWash)
                .frame(height: 12)
                .frame(maxWidth: 160, alignment: .leading)
        }
        .padding(16)
        .frame(maxWidth: .infinity)
        .opacity(isAnimating ? 0.5 : 1)
        .animation(.easeInOut(duration: 1.2).repeatForever(autoreverses: true), value: isAnimating)
        .onAppear { isAnimating = true }
    }
}

/// Standard error state: SF Symbol + error message + retry button centered in available space.
/// Used across ReviewQueueView, ProjectsView, MembersView, CompanyMapView, SchemaBuilderView.
struct ADLConsoleErrorState: View {
    let message: String
    let retryTitle: String
    var systemImage: String = "exclamationmark.triangle"
    let retry: () -> Void

    init(message: String, retryTitle: String = "Retry", systemImage: String = "exclamationmark.triangle", retry: @escaping () -> Void) {
        self.message = message
        self.retryTitle = retryTitle
        self.systemImage = systemImage
        self.retry = retry
    }

    var body: some View {
        VStack(spacing: 10) {
            Image(systemName: systemImage)
                .font(.system(size: 24))
                .foregroundStyle(ADLConsoleColor.danger.opacity(0.7))
            Text(message)
                .font(ADLConsoleFont.footnote)
                .foregroundStyle(ADLConsoleColor.danger)
                .multilineTextAlignment(.center)
            Button { retry() } label: {
                HStack(spacing: 6) {
                    Image(systemName: "arrow.clockwise")
                        .font(.system(size: 13, weight: .medium))
                    Text(retryTitle)
                        .font(ADLConsoleFont.subheadline)
                }
            }
            .buttonStyle(ADLConsolePressStyle())
        }
        .padding(24)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

/// Standard section header: title + subtitle. Used across DataBrowseView, ReviewQueueView,
/// ProjectsView, MembersView, SchemaBuilderView.
struct ADLConsoleSectionHeader: View {
    let title: String
    let subtitle: String

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(title)
                .font(ADLConsoleFont.title)
                .foregroundStyle(ADLConsoleColor.ink)
            Text(subtitle)
                .font(ADLConsoleFont.footnote)
                .foregroundStyle(ADLConsoleColor.inkMuted)
        }
    }
}

/// Role label — either an interactive Menu (owner) or a read-only pill (other roles).
/// Consolidates the role-label pattern from ConsoleShellView and MembersView.
struct ADLConsoleRoleLabel: View {
    let role: String
    var isEditable: Bool = false
    var options: [String] = []
    var onSelect: ((String) -> Void)? = nil

    var body: some View {
        if isEditable, let onSelect {
            Menu {
                ForEach(options, id: \.self) { option in
                    Button(option) { onSelect(option) }
                }
            } label: {
                HStack(spacing: 4) {
                    Text(role)
                    Image(systemName: "chevron.down")
                }
                .font(ADLConsoleFont.subheadline)
                .foregroundStyle(ADLConsoleColor.navy)
            }
        } else {
            Text(role.uppercased())
                .font(ADLConsoleFont.microLabel)
                .foregroundStyle(ADLConsoleColor.navy)
                .padding(.horizontal, 10)
                .padding(.vertical, 5)
                .background(ADLConsoleColor.navyWash)
                .clipShape(Capsule())
        }
    }
}

// MARK: - Shared role + field-type label helpers

extension PlatformRole {
    /// Localized display label for a role. Consolidates the identical
    /// `roleLabel(_:)` functions previously duplicated in ConsoleShellView
    /// and MembersView.
    func label(_ t: @escaping (String, String) -> String) -> String {
        switch self {
        case .owner:    return t("Owner", "Propriétaire")
        case .manager:  return t("Manager", "Gestionnaire")
        case .reviewer: return t("Reviewer", "Réviseur")
        case .collector: return t("Collector", "Collecteur")
        case .viewer:   return t("Viewer", "Observateur")
        }
    }
}

extension PlatformFieldType {
    /// Localized display label for a field type. Consolidates the identical
    /// `fieldTypeLabel(_:)` functions previously duplicated in SchemaBuilderView
    /// and FieldEditSheet.
    func label(_ t: @escaping (String, String) -> String) -> String {
        switch self {
        case .text:        return t("Text", "Texte")
        case .number:      return t("Number", "Nombre")
        case .select:      return t("Select (one)", "Choix (unique)")
        case .multiSelect: return t("Select (multiple)", "Choix (multiple)")
        case .date:        return t("Date", "Date")
        case .boolean:     return t("Yes/No", "Oui/Non")
        case .photo:       return t("Photo", "Photo")
        case .gps:         return t("GPS location", "Position GPS")
        }
    }
}

/// Labeled text field with micro-label + rounded-border styling.
/// Consolidates the repeated pattern from SettingsView and SchemaBuilderView.
struct ADLConsoleLabeledField: View {
    let label: String
    @Binding var text: String
    var placeholder: String = ""
    var keyboardType: UIKeyboardType = .default
    var disabled: Bool = false

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            ADLConsoleMicroLabel(text: label)
            TextField(placeholder.isEmpty ? label : placeholder, text: $text)
                .keyboardType(keyboardType)
                .disabled(disabled)
                .padding(10)
                .background(ADLConsoleColor.surface)
                .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: 10, style: .continuous)
                        .stroke(ADLConsoleColor.navyBorder, lineWidth: 1)
                )
        }
    }
}

/// Standard input field with padding + background, used across Settings, Projects, Members, Capture.
/// Different from ADLConsoleFieldChrome (which wraps arbitrary content); this wraps a TextField directly.
struct ADLConsoleInputField: View {
    let placeholder: String
    @Binding var text: String
    var disabled: Bool = false
    var contentType: UITextContentType? = nil
    var autocapitalization: TextInputAutocapitalization = .sentences
    var autocorrectionDisabled: Bool = false

    var body: some View {
        TextField(placeholder, text: $text)
            .disabled(disabled)
            .textInputAutocapitalization(autocapitalization)
            .autocorrectionDisabled(autocorrectionDisabled)
            .padding(12)
            .background(ADLConsoleColor.navyWash)
            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
    }
}

/// Photo evidence grid — used in ReviewRecordDetailView, CompanyPointDetailView, DataBrowseView.
/// Uses ADLImageCache for memory-efficient loading with automatic downsampling.
struct ADLConsolePhotoGrid: View {
    let photoURLs: [String]

    private let thumbnailSize = CGSize(width: 90, height: 90)

    var body: some View {
        LazyVGrid(columns: [GridItem(.adaptive(minimum: 90), spacing: 8)], spacing: 8) {
            ForEach(Array(photoURLs.enumerated()), id: \.offset) { index, photo in
                if let url = URL(string: photo) {
                    ADLCachedAsyncImage(url: url, targetSize: thumbnailSize) { image in
                        image.resizable().scaledToFill()
                    } placeholder: {
                        ADLConsoleColor.navyWash
                    }
                    .frame(height: 90)
                    .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                    .accessibilityLabel("Evidence photo \(index + 1) of \(photoURLs.count)")
                }
            }
        }
    }
}

/// Metadata row — key/value pair used in ReviewRecordDetailView, CompanyPointDetailView.
struct ADLConsoleMetadataRow: View {
    let label: String
    let value: String

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(label)
                .font(ADLConsoleFont.microLabel)
                .foregroundStyle(ADLConsoleColor.inkMuted)
            Text(value)
                .font(ADLConsoleFont.footnote)
                .foregroundStyle(ADLConsoleColor.ink)
        }
    }
}
