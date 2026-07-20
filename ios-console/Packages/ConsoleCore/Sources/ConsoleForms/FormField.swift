import ConsoleModels
import Foundation

/// The SwiftUI control family a `PlatformFieldType` renders as. A thin,
/// 1:1 mirror of `PlatformFieldType` kept as its own type (rather than reusing
/// `PlatformFieldType` directly) so the form-rendering layer has a name that
/// reads as "how to draw this field" rather than "the wire type" — the two
/// happen to be isomorphic today, but view code should depend on the
/// UI-facing vocabulary, not the wire enum.
public enum FormControlKind: String, Equatable, Sendable, CaseIterable {
    case text
    case number
    case singleSelect
    case multiSelect
    case date
    case boolean
    case photo
    case gps

    public init(fieldType: PlatformFieldType) {
        switch fieldType {
        case .text: self = .text
        case .number: self = .number
        case .select: self = .singleSelect
        case .multiSelect: self = .multiSelect
        case .date: self = .date
        case .boolean: self = .boolean
        case .photo: self = .photo
        case .gps: self = .gps
        }
    }
}

/// A single ordered form-field descriptor derived from a
/// `PlatformFieldDefinition` — everything a SwiftUI renderer needs to draw
/// one control (label, control kind, options, numeric bounds) without
/// re-deriving anything from `PlatformFieldType` itself. Renderers should
/// only ever consume `FormFieldDescriptor`, never raw `PlatformFieldDefinition`.
public struct FormFieldDescriptor: Equatable, Sendable, Identifiable {
    public var id: String { key }

    public let key: String
    public let label: BilingualLabel
    public let control: FormControlKind
    public let required: Bool
    public let options: [PlatformFieldOption]
    public let min: Double?
    public let max: Double?

    public init(
        key: String,
        label: BilingualLabel,
        control: FormControlKind,
        required: Bool,
        options: [PlatformFieldOption] = [],
        min: Double? = nil,
        max: Double? = nil
    ) {
        self.key = key
        self.label = label
        self.control = control
        self.required = required
        self.options = options
        self.min = min
        self.max = max
    }
}

/// Pure form-engine entry point: turns a `PlatformRecordType`'s field list
/// into an ordered list of `FormFieldDescriptor`s. Field order is preserved
/// exactly as authored in the schema — the form renders top-to-bottom in
/// schema order, same as the schema builder's field list.
public enum FormEngine {
    public static func descriptors(for recordType: PlatformRecordType) -> [FormFieldDescriptor] {
        recordType.fields.map { field in
            FormFieldDescriptor(
                key: field.key,
                label: field.label,
                control: FormControlKind(fieldType: field.type),
                required: field.required,
                options: field.options ?? [],
                min: field.min,
                max: field.max
            )
        }
    }
}
