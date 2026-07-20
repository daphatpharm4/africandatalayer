import ConsoleModels
import Foundation

/// One validation failure on a `PlatformSchemaDefinition`. Direct port of
/// `SchemaValidationIssue` in `shared/platformSchema.ts` — `path` is the
/// dotted field path (matching zod's own `issue.path.join(".")`, e.g.
/// `"recordTypes.0.fields.1.key"`), `message` is the human-readable reason.
public struct SchemaValidationIssue: Equatable, Sendable {
    public let path: String
    public let message: String

    public init(path: String, message: String) {
        self.path = path
        self.message = message
    }
}

/// Pure port of `validateSchemaDefinition` in `shared/platformSchema.ts`
/// (read-only web reference) — every rule below is cross-checked line-for-
/// line against that file's zod schema (`definitionSchema` and its nested
/// `recordTypeSchema`/`fieldSchema`/`evidenceSchema`/`fieldOptionSchema`/
/// `bilingualLabelSchema`) plus its post-parse cross-field checks.
///
/// **Two-phase structure, matching the TS source exactly:** the web function
/// first runs `definitionSchema.safeParse(input)` (shape/type/length/pattern
/// constraints — "phase 1" below) and returns immediately with *only* those
/// issues if any fail, since the cross-field checks (duplicate keys,
/// options-required-for-select, min/max-only-on-number, min<=max — "phase 2"
/// below) index into `parsed.data`, which does not exist on a failed parse.
/// This ordering is preserved here: `validate` returns phase-1 issues the
/// moment any exist, and only runs phase 2 once phase 1 is completely clean.
///
/// **Message text:** every message that is an explicit custom string in the
/// zod schema (e.g. `"English label is required"`, `"Key must be snake_case
/// (a-z, 0-9, _), 2-40 chars"`, `"Define at least one record type"`) is
/// ported verbatim. A handful of *bare* length/range constraints in the TS
/// schema have no custom message (`label.max(120)`, `option.value.max(80)`,
/// `options.max(50)`, `fields.max(60)`, `recordTypes.max(20)`,
/// `gpsAccuracyMeters.max(10000)`, `minPhotos` int/0/10 bounds) and so fall
/// through to zod's own auto-generated wording at runtime — this port gives
/// those the same *rule* (same bound, same trigger condition) with clear,
/// approximate English text rather than attempting to byte-match zod 4's
/// internal formatter, since that wording is a library implementation detail
/// rather than a rule this port is responsible for mirroring.
public enum SchemaValidator {
    // `^[a-z][a-z0-9_]{1,39}$` — first char a-z, then 1-39 more of
    // [a-z0-9_], i.e. total length 2-40. Matches `KEY_PATTERN` exactly.
    private static let keyPattern = "^[a-z][a-z0-9_]{1,39}$"

    public static func validate(_ definition: PlatformSchemaDefinition) -> [SchemaValidationIssue] {
        let phase1 = validateShape(definition)
        if !phase1.isEmpty {
            return phase1
        }
        return validateCrossField(definition)
    }

    public static func isValid(_ definition: PlatformSchemaDefinition) -> Bool {
        validate(definition).isEmpty
    }

    // MARK: - Phase 1: shape/type/length/pattern (port of the zod schemas)

    private static func validateShape(_ definition: PlatformSchemaDefinition) -> [SchemaValidationIssue] {
        var issues: [SchemaValidationIssue] = []

        // definitionSchema: recordTypes.min(1, "Define at least one record type").max(20)
        if definition.recordTypes.isEmpty {
            issues.append(SchemaValidationIssue(path: "recordTypes", message: "Define at least one record type"))
        } else if definition.recordTypes.count > 20 {
            issues.append(SchemaValidationIssue(path: "recordTypes", message: "Array must contain at most 20 element(s)"))
        }

        for (typeIndex, recordType) in definition.recordTypes.enumerated() {
            let typePath = "recordTypes.\(typeIndex)"

            // recordTypeSchema.key: KEY_PATTERN
            issues.append(contentsOf: validateKey(recordType.key, path: "\(typePath).key"))
            // recordTypeSchema.label: bilingualLabelSchema
            issues.append(contentsOf: validateLabel(recordType.label, path: "\(typePath).label"))

            // recordTypeSchema.fields: min(1, "Each record type needs at least one field").max(60)
            if recordType.fields.isEmpty {
                issues.append(SchemaValidationIssue(
                    path: "\(typePath).fields",
                    message: "Each record type needs at least one field"
                ))
            } else if recordType.fields.count > 60 {
                issues.append(SchemaValidationIssue(path: "\(typePath).fields", message: "Array must contain at most 60 element(s)"))
            }

            for (fieldIndex, field) in recordType.fields.enumerated() {
                let fieldPath = "\(typePath).fields.\(fieldIndex)"

                // fieldSchema.key: KEY_PATTERN
                issues.append(contentsOf: validateKey(field.key, path: "\(fieldPath).key"))
                // fieldSchema.label: bilingualLabelSchema
                issues.append(contentsOf: validateLabel(field.label, path: "\(fieldPath).label"))

                // fieldSchema.options: z.array(fieldOptionSchema).min(1).max(50).optional()
                if let options = field.options {
                    if options.isEmpty {
                        issues.append(SchemaValidationIssue(
                            path: "\(fieldPath).options",
                            message: "Array must contain at least 1 element(s)"
                        ))
                    } else if options.count > 50 {
                        issues.append(SchemaValidationIssue(
                            path: "\(fieldPath).options",
                            message: "Array must contain at most 50 element(s)"
                        ))
                    }
                    for (optionIndex, option) in options.enumerated() {
                        let optionPath = "\(fieldPath).options.\(optionIndex)"
                        // fieldOptionSchema.value: min(1).max(80)
                        issues.append(contentsOf: validateOptionValue(option.value, path: "\(optionPath).value"))
                        // fieldOptionSchema.label: bilingualLabelSchema
                        issues.append(contentsOf: validateLabel(option.label, path: "\(optionPath).label"))
                    }
                }

                // fieldSchema.min/max: z.number().finite().optional()
                if let min = field.min, !min.isFinite {
                    issues.append(SchemaValidationIssue(path: "\(fieldPath).min", message: "Number must be finite"))
                }
                if let max = field.max, !max.isFinite {
                    issues.append(SchemaValidationIssue(path: "\(fieldPath).max", message: "Number must be finite"))
                }
            }

            // recordTypeSchema.evidence: evidenceSchema
            issues.append(contentsOf: validateEvidence(recordType.evidence, path: "\(typePath).evidence"))
        }

        return issues
    }

    private static func validateKey(_ key: String, path: String) -> [SchemaValidationIssue] {
        guard key.range(of: keyPattern, options: .regularExpression) != nil else {
            return [SchemaValidationIssue(path: path, message: "Key must be snake_case (a-z, 0-9, _), 2-40 chars")]
        }
        return []
    }

    private static func validateLabel(_ label: BilingualLabel, path: String) -> [SchemaValidationIssue] {
        var issues: [SchemaValidationIssue] = []
        let en = label.en.trimmingCharacters(in: .whitespacesAndNewlines)
        let fr = label.fr.trimmingCharacters(in: .whitespacesAndNewlines)
        if en.isEmpty {
            issues.append(SchemaValidationIssue(path: "\(path).en", message: "English label is required"))
        } else if label.en.count > 120 {
            issues.append(SchemaValidationIssue(path: "\(path).en", message: "String must contain at most 120 character(s)"))
        }
        if fr.isEmpty {
            issues.append(SchemaValidationIssue(path: "\(path).fr", message: "French label is required"))
        } else if label.fr.count > 120 {
            issues.append(SchemaValidationIssue(path: "\(path).fr", message: "String must contain at most 120 character(s)"))
        }
        return issues
    }

    private static func validateOptionValue(_ value: String, path: String) -> [SchemaValidationIssue] {
        let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
        if trimmed.isEmpty {
            return [SchemaValidationIssue(path: path, message: "String must contain at least 1 character(s)")]
        }
        if value.count > 80 {
            return [SchemaValidationIssue(path: path, message: "String must contain at most 80 character(s)")]
        }
        return []
    }

    private static func validateEvidence(_ evidence: PlatformEvidenceRules, path: String) -> [SchemaValidationIssue] {
        var issues: [SchemaValidationIssue] = []
        // evidenceSchema.gpsAccuracyMeters: z.number().positive().max(10000).optional()
        if let accuracy = evidence.gpsAccuracyMeters {
            if accuracy <= 0 {
                issues.append(SchemaValidationIssue(path: "\(path).gpsAccuracyMeters", message: "Number must be greater than 0"))
            } else if accuracy > 10000 {
                issues.append(SchemaValidationIssue(path: "\(path).gpsAccuracyMeters", message: "Number must be less than or equal to 10000"))
            }
        }
        // evidenceSchema.minPhotos: z.number().int().min(0).max(10)
        if evidence.minPhotos < 0 {
            issues.append(SchemaValidationIssue(path: "\(path).minPhotos", message: "Number must be greater than or equal to 0"))
        } else if evidence.minPhotos > 10 {
            issues.append(SchemaValidationIssue(path: "\(path).minPhotos", message: "Number must be less than or equal to 10"))
        }
        return issues
    }

    // MARK: - Phase 2: cross-field checks (only run once phase 1 is fully clean)

    private static func validateCrossField(_ definition: PlatformSchemaDefinition) -> [SchemaValidationIssue] {
        var issues: [SchemaValidationIssue] = []
        var typeKeys = Set<String>()

        for (typeIndex, recordType) in definition.recordTypes.enumerated() {
            let typePath = "recordTypes.\(typeIndex)"

            if typeKeys.contains(recordType.key) {
                issues.append(SchemaValidationIssue(
                    path: "\(typePath).key",
                    message: "Duplicate record type key \"\(recordType.key)\""
                ))
            }
            typeKeys.insert(recordType.key)

            var fieldKeys = Set<String>()
            for (fieldIndex, field) in recordType.fields.enumerated() {
                let fieldPath = "\(typePath).fields.\(fieldIndex)"

                if fieldKeys.contains(field.key) {
                    issues.append(SchemaValidationIssue(
                        path: "\(fieldPath).key",
                        message: "Duplicate field key \"\(field.key)\""
                    ))
                }
                fieldKeys.insert(field.key)

                let needsOptions = field.type == .select || field.type == .multiSelect
                if needsOptions && (field.options?.isEmpty ?? true) {
                    issues.append(SchemaValidationIssue(
                        path: "\(fieldPath).options",
                        message: "Select fields require at least one option"
                    ))
                }
                if !needsOptions && field.options != nil {
                    issues.append(SchemaValidationIssue(
                        path: "\(fieldPath).options",
                        message: "Options are only allowed on select fields"
                    ))
                }
                if field.type != .number && (field.min != nil || field.max != nil) {
                    issues.append(SchemaValidationIssue(path: fieldPath, message: "min/max are only allowed on number fields"))
                }
                if let min = field.min, let max = field.max, min > max {
                    issues.append(SchemaValidationIssue(path: fieldPath, message: "min must be less than or equal to max"))
                }
            }
        }

        return issues
    }
}
