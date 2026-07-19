import ConsoleForms
import ConsoleModels
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
                .textFieldStyle(.roundedBorder)

        case .number:
            TextField(t("Enter a number", "Saisir un nombre"), text: numberTextBinding)
                .textFieldStyle(.roundedBorder)
                .keyboardType(.decimalPad)

        case .singleSelect:
            Picker(t("Select one", "Choisir une option"), selection: selectBinding) {
                Text(t("Select…", "Choisir…")).tag(Optional<String>.none)
                ForEach(descriptor.options, id: \.value) { option in
                    Text(t(option.label.en, option.label.fr)).tag(Optional(option.value))
                }
            }
            .pickerStyle(.menu)

        case .multiSelect:
            multiSelectControl

        case .date:
            DatePicker(
                "",
                selection: dateBinding,
                displayedComponents: .date
            )
            .labelsHidden()

        case .boolean:
            Toggle(isOn: booleanBinding) {
                EmptyView()
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
        return HStack {
            Text(ref == nil ? t("No photo attached", "Aucune photo jointe") : t("Photo attached", "Photo jointe"))
                .font(ADLConsoleFont.footnote)
                .foregroundStyle(ADLConsoleColor.inkMuted)
            Spacer()
            Button(ref == nil ? t("Attach", "Joindre") : t("Clear", "Effacer")) {
                value = .photo(ref == nil ? "field-photo-\(descriptor.key)-\(UUID().uuidString.prefix(8))" : nil)
            }
            .font(ADLConsoleFont.footnote)
        }
    }

    private var gpsFieldControl: some View {
        let gps: FormGpsValue? = { if case .gps(let value) = value { return value }; return nil }()
        return HStack {
            Text(gps.map { String(format: "%.5f, %.5f", $0.latitude, $0.longitude) } ?? t("Not captured", "Non capturée"))
                .font(ADLConsoleFont.footnote)
                .foregroundStyle(ADLConsoleColor.inkMuted)
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
