import ConsoleModels
import Foundation

/// A captured GPS fix — used both as a per-field value (a schema field typed
/// `.gps`) and as the record-level evidence location. Mirrors
/// `PlatformRecordGps` in shape; kept as its own `Codable` type here (rather
/// than depending on `ConsoleAPI`, which `ConsoleForms` does not — and should
/// not — depend on) so `ConsoleForms` stays a self-contained pure-logic
/// package. The app layer converts this to `PlatformRecordGps` at the
/// `ConsoleAPI` boundary.
public struct FormGpsValue: Codable, Equatable, Sendable {
    public var latitude: Double
    public var longitude: Double
    public var accuracyMeters: Double?

    public init(latitude: Double, longitude: Double, accuracyMeters: Double? = nil) {
        self.latitude = latitude
        self.longitude = longitude
        self.accuracyMeters = accuracyMeters
    }
}

/// The raw value a SwiftUI control produces for one field, keyed by
/// `FormFieldDescriptor.key` in a `[String: FormFieldInput]` values map.
///
/// Deliberately NOT the same shape as the validated/typed value that ends up
/// in a `PlatformRecord.data` payload: `.numberText` carries the control's
/// raw text so `FormValidator` can distinguish "empty" (required-error) from
/// "non-numeric" (parse-error) — a distinction that is lost the moment a
/// `TextField` binding is force-parsed to `Double` in the view layer. Every
/// other case already matches its target shape 1:1 because those controls
/// (`Picker`, `Toggle`, `DatePicker`, photo/GPS capture) cannot produce an
/// ambiguous raw value the way free-text number entry can.
public enum FormFieldInput: Equatable, Sendable {
    case text(String)
    case numberText(String)
    case select(String?)
    case multiSelect([String])
    /// ISO-8601 date string (`yyyy-MM-dd`), matching how a `DatePicker`-backed
    /// field round-trips through `PlatformRecord.data` on the web client.
    case date(String)
    case boolean(Bool)
    /// Opaque photo reference for a `.photo`-typed *field* (not the
    /// record-level evidence photo array) — e.g. a locally-queued asset id.
    /// `nil`/empty-string both mean "not captured".
    case photo(String?)
    case gps(FormGpsValue?)

    /// The empty/default input for a control kind — what a freshly-rendered,
    /// untouched field starts from. Booleans default to `false` (matching an
    /// unchecked `Toggle`), never `.required` under validation.
    public static func empty(for control: FormControlKind) -> FormFieldInput {
        switch control {
        case .text: return .text("")
        case .number: return .numberText("")
        case .singleSelect: return .select(nil)
        case .multiSelect: return .multiSelect([])
        case .date: return .date("")
        case .boolean: return .boolean(false)
        case .photo: return .photo(nil)
        case .gps: return .gps(nil)
        }
    }
}

/// The full set of entered values for one draft, keyed by field key.
public typealias FormValues = [String: FormFieldInput]
