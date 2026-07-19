import ConsoleModels
import Foundation

/// Why a single field failed validation. Mirrors the failure modes a
/// TypeScript port of this same check would surface for
/// `PlatformFieldDefinition` + entered value: an empty required field, an
/// unparseable number, and an option value outside the field's declared
/// `options` list.
public enum FormFieldErrorReason: Equatable, Sendable {
    case required
    case invalidNumber
    case belowMinimum(Double)
    case aboveMaximum(Double)
    case invalidSelectValue
    case invalidMultiSelectValue
}

public struct FormFieldError: Equatable, Sendable {
    public let key: String
    public let reason: FormFieldErrorReason

    public init(key: String, reason: FormFieldErrorReason) {
        self.key = key
        self.reason = reason
    }
}

/// Why the record-level evidence failed `PlatformEvidenceRules`, independent
/// of any individual field.
public enum EvidenceError: Equatable, Sendable {
    case gpsRequired
    case gpsAccuracyTooLow(requiredMeters: Double, actualMeters: Double)
    case notEnoughPhotos(required: Int, actual: Int)
    case notesRequired
}

public struct FormValidationResult: Equatable, Sendable {
    public let fieldErrors: [FormFieldError]
    public let evidenceErrors: [EvidenceError]

    public init(fieldErrors: [FormFieldError], evidenceErrors: [EvidenceError]) {
        self.fieldErrors = fieldErrors
        self.evidenceErrors = evidenceErrors
    }

    public var isValid: Bool { fieldErrors.isEmpty && evidenceErrors.isEmpty }

    public func error(for key: String) -> FormFieldError? {
        fieldErrors.first { $0.key == key }
    }
}

/// The evidence a draft has captured so far — the inputs `FormValidator`
/// checks against a record type's `PlatformEvidenceRules`. Kept separate
/// from the per-field `FormValues` map because evidence (GPS fix, photo
/// count, notes) is record-level, not tied to any single schema field.
public struct FormEvidenceInput: Equatable, Sendable {
    public var gps: FormGpsValue?
    public var photoCount: Int
    public var notes: String?

    public init(gps: FormGpsValue? = nil, photoCount: Int = 0, notes: String? = nil) {
        self.gps = gps
        self.photoCount = photoCount
        self.notes = notes
    }
}

/// Pure validation engine: given a `PlatformRecordType` (its field
/// definitions + evidence rules) and the values entered so far, returns
/// every violation — never throws, never mutates, safe to call on every
/// keystroke.
public enum FormValidator {
    public static func validate(
        recordType: PlatformRecordType,
        values: FormValues,
        evidence evidenceInput: FormEvidenceInput
    ) -> FormValidationResult {
        let fieldErrors = recordType.fields.compactMap { field in
            fieldError(for: field, input: values[field.key])
        }
        let evidenceErrors = evidenceErrors(rules: recordType.evidence, input: evidenceInput)
        return FormValidationResult(fieldErrors: fieldErrors, evidenceErrors: evidenceErrors)
    }

    // MARK: - Field validation

    private static func fieldError(for field: PlatformFieldDefinition, input: FormFieldInput?) -> FormFieldError? {
        let resolved = input ?? .empty(for: FormControlKind(fieldType: field.type))
        switch resolved {
        case .text(let value):
            let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
            if trimmed.isEmpty {
                return field.required ? FormFieldError(key: field.key, reason: .required) : nil
            }
            return nil

        case .numberText(let raw):
            let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)
            if trimmed.isEmpty {
                return field.required ? FormFieldError(key: field.key, reason: .required) : nil
            }
            guard let parsed = Double(trimmed) else {
                return FormFieldError(key: field.key, reason: .invalidNumber)
            }
            if let min = field.min, parsed < min {
                return FormFieldError(key: field.key, reason: .belowMinimum(min))
            }
            if let max = field.max, parsed > max {
                return FormFieldError(key: field.key, reason: .aboveMaximum(max))
            }
            return nil

        case .select(let value):
            guard let value, !value.isEmpty else {
                return field.required ? FormFieldError(key: field.key, reason: .required) : nil
            }
            let validValues = Set((field.options ?? []).map(\.value))
            if !validValues.contains(value) {
                return FormFieldError(key: field.key, reason: .invalidSelectValue)
            }
            return nil

        case .multiSelect(let values):
            if values.isEmpty {
                return field.required ? FormFieldError(key: field.key, reason: .required) : nil
            }
            let validValues = Set((field.options ?? []).map(\.value))
            if !values.allSatisfy({ validValues.contains($0) }) {
                return FormFieldError(key: field.key, reason: .invalidMultiSelectValue)
            }
            return nil

        case .date(let value):
            let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
            if trimmed.isEmpty {
                return field.required ? FormFieldError(key: field.key, reason: .required) : nil
            }
            return nil

        case .boolean:
            // A boolean field is never "empty" — `false` is a complete,
            // valid answer, so it never trips `.required`.
            return nil

        case .photo(let ref):
            guard let ref, !ref.isEmpty else {
                return field.required ? FormFieldError(key: field.key, reason: .required) : nil
            }
            return nil

        case .gps(let value):
            guard value != nil else {
                return field.required ? FormFieldError(key: field.key, reason: .required) : nil
            }
            return nil
        }
    }

    // MARK: - Evidence validation

    private static func evidenceErrors(rules: PlatformEvidenceRules, input: FormEvidenceInput) -> [EvidenceError] {
        var errors: [EvidenceError] = []

        if rules.gpsRequired {
            if let gps = input.gps {
                if let requiredAccuracy = rules.gpsAccuracyMeters,
                   let actualAccuracy = gps.accuracyMeters,
                   actualAccuracy > requiredAccuracy {
                    errors.append(.gpsAccuracyTooLow(requiredMeters: requiredAccuracy, actualMeters: actualAccuracy))
                }
            } else {
                errors.append(.gpsRequired)
            }
        }

        if input.photoCount < rules.minPhotos {
            errors.append(.notEnoughPhotos(required: rules.minPhotos, actual: input.photoCount))
        }

        if rules.notesRequired {
            let trimmed = input.notes?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
            if trimmed.isEmpty {
                errors.append(.notesRequired)
            }
        }

        return errors
    }

    // MARK: - Data payload construction

    /// Converts a validated values map into the `[String: JSONValue]` shape
    /// `PlatformAPIClient.createPlatformRecord`'s `data` parameter expects.
    /// Only meaningful to call once `validate(...).isValid` is `true` —
    /// invalid/unparseable inputs degrade to `.null` rather than throwing, so
    /// this stays a total function callers never need to guard with `try`.
    public static func recordData(recordType: PlatformRecordType, values: FormValues) -> [String: JSONValue] {
        var data: [String: JSONValue] = [:]
        for field in recordType.fields {
            let resolved = values[field.key] ?? .empty(for: FormControlKind(fieldType: field.type))
            data[field.key] = jsonValue(for: resolved)
        }
        return data
    }

    private static func jsonValue(for input: FormFieldInput) -> JSONValue {
        switch input {
        case .text(let value):
            return .string(value)
        case .numberText(let raw):
            guard let parsed = Double(raw.trimmingCharacters(in: .whitespacesAndNewlines)) else { return .null }
            return .number(parsed)
        case .select(let value):
            guard let value else { return .null }
            return .string(value)
        case .multiSelect(let values):
            return .array(values.map(JSONValue.string))
        case .date(let value):
            return value.isEmpty ? .null : .string(value)
        case .boolean(let value):
            return .bool(value)
        case .photo(let ref):
            guard let ref, !ref.isEmpty else { return .null }
            return .string(ref)
        case .gps(let value):
            guard let value else { return .null }
            var object: [String: JSONValue] = [
                "latitude": .number(value.latitude),
                "longitude": .number(value.longitude),
            ]
            if let accuracy = value.accuracyMeters {
                object["accuracyMeters"] = .number(accuracy)
            }
            return .object(object)
        }
    }
}
