import type {
  PlatformFieldDefinition,
  PlatformRecordEvidence,
  PlatformRecordType,
} from "./platformTypes.js";

export interface PlatformRecordValidationIssue {
  path: string;
  message: string;
}

function isPresent(value: unknown): boolean {
  if (value === null || value === undefined || value === "") return false;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

function validateField(field: PlatformFieldDefinition, value: unknown): string | null {
  if (!isPresent(value)) return field.required ? "This field is required" : null;

  if (field.type === "text") {
    return typeof value === "string" && value.length <= 10_000 && (!field.required || value.trim().length > 0)
      ? null
      : "Expected text";
  }
  if (field.type === "boolean") return typeof value === "boolean" ? null : "Expected yes or no";
  if (field.type === "date") {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return "Expected a date";
    const [year, month, day] = value.split("-").map(Number);
    const parsed = new Date(Date.UTC(year, month - 1, day));
    return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day
      ? null
      : "Expected a date";
  }
  if (field.type === "number") {
    if (typeof value !== "number" || !Number.isFinite(value)) return "Expected a number";
    if (field.min !== undefined && value < field.min) return `Must be at least ${field.min}`;
    if (field.max !== undefined && value > field.max) return `Must be at most ${field.max}`;
    return null;
  }
  if (field.type === "select") {
    return typeof value === "string" && field.options?.some((option) => option.value === value)
      ? null
      : "Choose a valid option";
  }
  if (field.type === "multi_select") {
    const validOptions = new Set(field.options?.map((option) => option.value) ?? []);
    return Array.isArray(value) && value.length <= 50
      && value.every((item) => typeof item === "string" && validOptions.has(item))
      ? null
      : "Choose valid options";
  }
  if (field.type === "photo") {
    return typeof value === "string" && value.length <= 400_000
      && (value.startsWith("data:image/") || value.startsWith("https://"))
      ? null
      : "Capture a valid photo";
  }
  if (field.type === "gps") {
    if (!value || typeof value !== "object") return "Capture a valid GPS position";
    const gps = value as { latitude?: unknown; longitude?: unknown };
    return typeof gps.latitude === "number" && Number.isFinite(gps.latitude)
      && gps.latitude >= -90 && gps.latitude <= 90
      && typeof gps.longitude === "number" && Number.isFinite(gps.longitude)
      && gps.longitude >= -180 && gps.longitude <= 180
      ? null
      : "Capture a valid GPS position";
  }
  return "Unsupported field type";
}

export function validatePlatformRecord(
  recordType: PlatformRecordType,
  data: Record<string, unknown>,
  evidence: PlatformRecordEvidence,
): PlatformRecordValidationIssue[] {
  const issues: PlatformRecordValidationIssue[] = [];
  if (JSON.stringify(data).length > 10_000_000) {
    issues.push({ path: "data", message: "Record data is too large" });
  }
  const allowedKeys = new Set(recordType.fields.map((field) => field.key));

  for (const key of Object.keys(data)) {
    if (!allowedKeys.has(key)) issues.push({ path: `data.${key}`, message: "Unknown field" });
  }
  for (const field of recordType.fields) {
    const message = validateField(field, data[field.key]);
    if (message) issues.push({ path: `data.${field.key}`, message });
  }

  if (recordType.evidence.gpsRequired && !evidence.gps) {
    issues.push({ path: "evidence.gps", message: "GPS evidence is required" });
  }
  if (evidence.gps) {
    const { latitude, longitude, accuracyMeters } = evidence.gps;
    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90
      || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
      issues.push({ path: "evidence.gps", message: "GPS evidence is invalid" });
    }
    if (recordType.evidence.gpsAccuracyMeters !== undefined
      && (accuracyMeters === undefined || accuracyMeters > recordType.evidence.gpsAccuracyMeters)) {
      issues.push({ path: "evidence.gps.accuracyMeters", message: "GPS accuracy is below the project requirement" });
    }
  }
  if (evidence.photos.length < recordType.evidence.minPhotos) {
    issues.push({ path: "evidence.photos", message: `At least ${recordType.evidence.minPhotos} photo(s) required` });
  }
  if (recordType.evidence.notesRequired && !evidence.notes?.trim()) {
    issues.push({ path: "evidence.notes", message: "Notes are required" });
  }
  return issues;
}
