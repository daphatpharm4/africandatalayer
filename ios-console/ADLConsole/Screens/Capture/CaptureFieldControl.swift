import ConsoleForms
import ConsoleModels
import PhotosUI
import SwiftUI

/// Renders exactly one SwiftUI control for a `FormFieldDescriptor`, dispatching
/// on `descriptor.control` — the one place that maps `FormControlKind` to an
/// actual view (`TextField`, `Picker`, `Toggle`, ...). Every other piece of
/// the capture flow only ever deals in `FormFieldDescriptor`/`FormFieldInput`.
struct CaptureFieldControl: View {
    let descriptor: FormFieldDescriptor
    let language: ConsoleLanguage
    @Binding var value: FormFieldInput
    let error: FormFieldError?
    var onPhotoSelected: ((Data, String) async throws -> String)? = nil
    var onPhotoCleared: ((String) -> Void)? = nil
    @State private var photoPickerItem: PhotosPickerItem?
    @State private var photoError: String?

    private var t: (String, String) -> String { language.t }

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 4) {
                Text(descriptor.label.en == descriptor.label.fr ? descriptor.label.en : t(descriptor.label.en, descriptor.label.fr))
                    .font(ADLConsoleFont.subheadline)
                    .foregroundStyle(ADLConsoleColor.ink)
                if descriptor.required {
                    Text("*").foregroundStyle(ADLConsoleColor.terraDark)
                }
            }

            control

            if let error {
                Text(errorMessage(error.reason))
                    .font(ADLConsoleFont.footnote)
                    .foregroundStyle(ADLConsoleColor.danger)
            }
        }
    }

    @ViewBuilder
    private var control: some View {
        switch descriptor.control {
        case .text:
            TextField(t("Enter text", "Saisir un texte"), text: textBinding)
                .font(ADLConsoleFont.body)
                .padding(12)
                .background(ADLConsoleColor.surface)
                .clipShape(RoundedRectangle(cornerRadius: ADLConsoleRadius.input, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: ADLConsoleRadius.input, style: .continuous)
                        .stroke(ADLConsoleColor.navyBorder, lineWidth: 1)
                )

        case .number:
            TextField(t("Enter a number", "Saisir un nombre"), text: numberTextBinding)
                .font(ADLConsoleFont.body)
                .keyboardType(.decimalPad)
                .padding(12)
                .background(ADLConsoleColor.surface)
                .clipShape(RoundedRectangle(cornerRadius: ADLConsoleRadius.input, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: ADLConsoleRadius.input, style: .continuous)
                        .stroke(ADLConsoleColor.navyBorder, lineWidth: 1)
                )

        case .singleSelect:
            Menu {
                Button(t("Select…", "Choisir…")) { value = .select(nil) }
                ForEach(descriptor.options, id: \.value) { option in
                    Button(t(option.label.en, option.label.fr)) { value = .select(option.value) }
                }
            } label: {
                HStack {
                    Text(selectBinding.wrappedValue.map { key in
                        descriptor.options.first { $0.value == key }.map { t($0.label.en, $0.label.fr) } ?? key
                    } ?? t("Select…", "Choisir…"))
                        .font(ADLConsoleFont.body)
                        .foregroundStyle(selectBinding.wrappedValue == nil ? ADLConsoleColor.inkMuted : ADLConsoleColor.ink)
                    Spacer()
                    Image(systemName: "chevron.down")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(ADLConsoleColor.inkMuted)
                }
                .padding(12)
                .background(ADLConsoleColor.surface)
                .clipShape(RoundedRectangle(cornerRadius: ADLConsoleRadius.input, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: ADLConsoleRadius.input, style: .continuous)
                        .stroke(ADLConsoleColor.navyBorder, lineWidth: 1)
                )
            }

        case .multiSelect:
            multiSelectControl

        case .date:
            DatePicker(
                "",
                selection: dateBinding,
                displayedComponents: .date
            )
            .labelsHidden()
            .padding(12)
            .background(ADLConsoleColor.surface)
            .clipShape(RoundedRectangle(cornerRadius: ADLConsoleRadius.input, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: ADLConsoleRadius.input, style: .continuous)
                    .stroke(ADLConsoleColor.navyBorder, lineWidth: 1)
            )

        case .boolean:
            HStack(spacing: 8) {
                Button {
                    booleanBinding.wrappedValue = true
                } label: {
                    Text(t("Yes", "Oui"))
                        .font(ADLConsoleFont.subheadline)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 12)
                        .foregroundStyle(booleanBinding.wrappedValue ? .white : ADLConsoleColor.navy)
                        .background(booleanBinding.wrappedValue ? ADLConsoleColor.navy : ADLConsoleColor.surface)
                        .clipShape(RoundedRectangle(cornerRadius: ADLConsoleRadius.input, style: .continuous))
                        .overlay(
                            RoundedRectangle(cornerRadius: ADLConsoleRadius.input, style: .continuous)
                                .stroke(ADLConsoleColor.navyBorder, lineWidth: 1)
                        )
                }
                .buttonStyle(ADLConsolePressStyle())

                Button {
                    booleanBinding.wrappedValue = false
                } label: {
                    Text(t("No", "Non"))
                        .font(ADLConsoleFont.subheadline)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 12)
                        .foregroundStyle(!booleanBinding.wrappedValue ? .white : ADLConsoleColor.inkMuted)
                        .background(!booleanBinding.wrappedValue ? ADLConsoleColor.navyMid : ADLConsoleColor.surface)
                        .clipShape(RoundedRectangle(cornerRadius: ADLConsoleRadius.input, style: .continuous))
                        .overlay(
                            RoundedRectangle(cornerRadius: ADLConsoleRadius.input, style: .continuous)
                                .stroke(ADLConsoleColor.navyBorder, lineWidth: 1)
                        )
                }
                .buttonStyle(ADLConsolePressStyle())
            }

        case .photo:
            photoFieldControl

        case .gps:
            gpsFieldControl
        }
    }

    // MARK: - Bindings

    private var textBinding: Binding<String> {
        Binding(
            get: { if case .text(let value) = value { return value }; return "" },
            set: { value = .text($0) }
        )
    }

    private var numberTextBinding: Binding<String> {
        Binding(
            get: { if case .numberText(let value) = value { return value }; return "" },
            set: { value = .numberText($0) }
        )
    }

    private var selectBinding: Binding<String?> {
        Binding(
            get: { if case .select(let value) = value { return value }; return nil },
            set: { value = .select($0) }
        )
    }

    private var dateBinding: Binding<Date> {
        Binding(
            get: {
                if case .date(let raw) = value, let parsed = Self.dateFormatter.date(from: raw) {
                    return parsed
                }
                return Date()
            },
            set: { value = .date(Self.dateFormatter.string(from: $0)) }
        )
    }

    private var booleanBinding: Binding<Bool> {
        Binding(
            get: { if case .boolean(let value) = value { return value }; return false },
            set: { value = .boolean($0) }
        )
    }

    private static let dateFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.timeZone = TimeZone(identifier: "UTC")
        return formatter
    }()

    // MARK: - Multi-select

    private var multiSelectControl: some View {
        let selectedValues: [String] = { if case .multiSelect(let values) = value { return values }; return [] }()
        return VStack(alignment: .leading, spacing: 4) {
            ForEach(descriptor.options, id: \.value) { option in
                Button {
                    toggleMultiSelect(option.value)
                } label: {
                    HStack {
                        Image(systemName: selectedValues.contains(option.value) ? "checkmark.square.fill" : "square")
                            .foregroundStyle(selectedValues.contains(option.value) ? ADLConsoleColor.navy : ADLConsoleColor.inkMuted)
                        Text(t(option.label.en, option.label.fr))
                            .foregroundStyle(ADLConsoleColor.ink)
                    }
                }
                .buttonStyle(.plain)
            }
        }
    }

    private func toggleMultiSelect(_ optionValue: String) {
        var selectedValues: [String] = { if case .multiSelect(let values) = value { return values }; return [] }()
        if let index = selectedValues.firstIndex(of: optionValue) {
            selectedValues.remove(at: index)
        } else {
            selectedValues.append(optionValue)
        }
        value = .multiSelect(selectedValues)
    }

    // MARK: - Field-level photo / GPS

    private var photoFieldControl: some View {
        let ref: String? = { if case .photo(let value) = value { return value }; return nil }()
        let attachLabel = language.t("Attach", "Joindre")
        return VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text(ref == nil ? t("No photo attached", "Aucune photo jointe") : t("Photo attached", "Photo jointe"))
                    .font(ADLConsoleFont.footnote)
                    .foregroundStyle(ADLConsoleColor.inkMuted)
                Spacer()
                if let ref {
                    Button(t("Clear", "Effacer")) {
                        onPhotoCleared?(ref)
                        value = .photo(nil)
                    }
                } else {
                    PhotosPicker(selection: $photoPickerItem, matching: .images) {
                        Text(attachLabel)
                    }
                }
            }
            .font(ADLConsoleFont.footnote)
            if let photoError {
                Text(photoError)
                    .font(ADLConsoleFont.caption)
                    .foregroundStyle(ADLConsoleColor.danger)
            }
        }
        .onChange(of: photoPickerItem) { _, item in
            guard let item, let onPhotoSelected else { return }
            Task { @MainActor in
                do {
                    guard let data = try await item.loadTransferable(type: Data.self) else {
                        throw CaptureAttachmentPickerError.imageProcessingFailed
                    }
                    value = .photo(try await onPhotoSelected(data, descriptor.key))
                    photoError = nil
                } catch {
                    value = .photo(nil)
                    photoError = t("Could not attach this photo.", "Impossible de joindre cette photo.")
                }
                photoPickerItem = nil
            }
        }
    }

    private var gpsFieldControl: some View {
        let gps: FormGpsValue? = { if case .gps(let value) = value { return value }; return nil }()
        return HStack {
            Text(gps.map { String(format: "%.5f, %.5f", $0.latitude, $0.longitude) } ?? t("Not captured", "Non capturée"))
                .font(ADLConsoleFont.footnote)
                .foregroundStyle(ADLConsoleColor.inkMuted)
                .monospacedDigit()
            Spacer()
        }
    }

    // MARK: - Error messages

    private func errorMessage(_ reason: FormFieldErrorReason) -> String {
        switch reason {
        case .required:
            return t("This field is required.", "Ce champ est requis.")
        case .invalidNumber:
            return t("Enter a valid number.", "Saisissez un nombre valide.")
        case .belowMinimum(let min):
            return t("Must be at least \(Self.format(min)).", "Doit être au moins \(Self.format(min)).")
        case .aboveMaximum(let max):
            return t("Must be at most \(Self.format(max)).", "Doit être au plus \(Self.format(max)).")
        case .invalidSelectValue:
            return t("Choose a valid option.", "Choisissez une option valide.")
        case .invalidMultiSelectValue:
            return t("Choose only valid options.", "Choisissez uniquement des options valides.")
        }
    }

    private static func format(_ value: Double) -> String {
        value.truncatingRemainder(dividingBy: 1) == 0 ? String(Int(value)) : String(value)
    }
}
