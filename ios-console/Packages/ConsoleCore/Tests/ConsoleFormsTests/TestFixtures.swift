import ConsoleModels
@testable import ConsoleForms

/// Shared sample schema fixtures for `ConsoleFormsTests` — one field of
/// every `PlatformFieldType`, plus a couple of narrower record types for
/// evidence-only tests.

enum Fixtures {
    static func label(_ en: String) -> BilingualLabel {
        BilingualLabel(en: en, fr: en + " (fr)")
    }

    static let statusOptions: [PlatformFieldOption] = [
        PlatformFieldOption(value: "open", label: label("Open")),
        PlatformFieldOption(value: "closed", label: label("Closed")),
    ]

    static let servicesOptions: [PlatformFieldOption] = [
        PlatformFieldOption(value: "diesel", label: label("Diesel")),
        PlatformFieldOption(value: "petrol", label: label("Petrol")),
        PlatformFieldOption(value: "premium", label: label("Premium")),
    ]

    /// A record type exercising every `PlatformFieldType` exactly once, all
    /// `required: true`, in a fixed order used by ordering assertions.
    static let allFieldTypesRecordType = PlatformRecordType(
        key: "sample",
        label: label("Sample"),
        fields: [
            PlatformFieldDefinition(key: "name", label: label("Name"), type: .text, required: true),
            PlatformFieldDefinition(key: "price", label: label("Price"), type: .number, required: true, min: 0, max: 100000),
            PlatformFieldDefinition(key: "status", label: label("Status"), type: .select, required: true, options: statusOptions),
            PlatformFieldDefinition(key: "services", label: label("Services"), type: .multiSelect, required: true, options: servicesOptions),
            PlatformFieldDefinition(key: "openedOn", label: label("Opened on"), type: .date, required: true),
            PlatformFieldDefinition(key: "hasGenerator", label: label("Has generator"), type: .boolean, required: true),
            PlatformFieldDefinition(key: "storefrontPhoto", label: label("Storefront photo"), type: .photo, required: true),
            PlatformFieldDefinition(key: "pinLocation", label: label("Pin location"), type: .gps, required: true),
        ],
        evidence: PlatformEvidenceRules(gpsRequired: true, gpsAccuracyMeters: 30, minPhotos: 1, notesRequired: false)
    )

    /// Same fields, all optional — for pass-when-empty assertions.
    static let allFieldTypesOptionalRecordType = PlatformRecordType(
        key: "sample_optional",
        label: label("Sample Optional"),
        fields: allFieldTypesRecordType.fields.map { field in
            PlatformFieldDefinition(
                key: field.key,
                label: field.label,
                type: field.type,
                required: false,
                options: field.options,
                min: field.min,
                max: field.max
            )
        },
        evidence: PlatformEvidenceRules(gpsRequired: false, gpsAccuracyMeters: nil, minPhotos: 0, notesRequired: false)
    )

    /// Minimal record type (a single required text field) with strict
    /// evidence rules, for isolated evidence-rule tests.
    static let strictEvidenceRecordType = PlatformRecordType(
        key: "strict",
        label: label("Strict"),
        fields: [
            PlatformFieldDefinition(key: "name", label: label("Name"), type: .text, required: true),
        ],
        evidence: PlatformEvidenceRules(gpsRequired: true, gpsAccuracyMeters: 20, minPhotos: 2, notesRequired: true)
    )

    static func validValues(for recordType: PlatformRecordType) -> FormValues {
        var values: FormValues = [:]
        for field in recordType.fields {
            switch field.type {
            case .text: values[field.key] = .text("Acme Pharmacy")
            case .number: values[field.key] = .numberText("42")
            case .select: values[field.key] = .select("open")
            case .multiSelect: values[field.key] = .multiSelect(["diesel", "petrol"])
            case .date: values[field.key] = .date("2026-07-01")
            case .boolean: values[field.key] = .boolean(true)
            case .photo: values[field.key] = .photo("local-photo-ref-1")
            case .gps: values[field.key] = .gps(FormGpsValue(latitude: 4.05, longitude: 9.7))
            }
        }
        return values
    }
}
