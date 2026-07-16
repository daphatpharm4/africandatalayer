import { z } from "zod";
import type { PlatformRole, PlatformSchemaDefinition } from "./platformTypes.js";

export const ROLE_RANK: Record<PlatformRole, number> = {
  owner: 5,
  manager: 4,
  reviewer: 3,
  collector: 2,
  viewer: 1,
};

export function roleAtLeast(role: PlatformRole, minimum: PlatformRole): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[minimum];
}

const KEY_PATTERN = /^[a-z][a-z0-9_]{1,39}$/;

const bilingualLabelSchema = z.object({
  en: z.string().trim().min(1, "English label is required").max(120),
  fr: z.string().trim().min(1, "French label is required").max(120),
});

const fieldOptionSchema = z.object({
  value: z.string().trim().min(1).max(80),
  label: bilingualLabelSchema,
});

const fieldSchema = z.object({
  key: z.string().regex(KEY_PATTERN, "Key must be snake_case (a-z, 0-9, _), 2-40 chars"),
  label: bilingualLabelSchema,
  type: z.enum(["text", "number", "select", "multi_select", "date", "boolean", "photo", "gps"]),
  required: z.boolean(),
  options: z.array(fieldOptionSchema).min(1).max(50).optional(),
  min: z.number().finite().optional(),
  max: z.number().finite().optional(),
});

const evidenceSchema = z.object({
  gpsRequired: z.boolean(),
  gpsAccuracyMeters: z.number().positive().max(10000).optional(),
  minPhotos: z.number().int().min(0).max(10),
  notesRequired: z.boolean(),
});

const recordTypeSchema = z.object({
  key: z.string().regex(KEY_PATTERN, "Key must be snake_case (a-z, 0-9, _), 2-40 chars"),
  label: bilingualLabelSchema,
  fields: z.array(fieldSchema).min(1, "Each record type needs at least one field").max(60),
  evidence: evidenceSchema,
});

const definitionSchema = z.object({
  recordTypes: z.array(recordTypeSchema).min(1, "Define at least one record type").max(20),
});

export interface SchemaValidationIssue {
  path: string;
  message: string;
}

export type SchemaValidationResult =
  | { ok: true; definition: PlatformSchemaDefinition }
  | { ok: false; issues: SchemaValidationIssue[] };

export function validateSchemaDefinition(input: unknown): SchemaValidationResult {
  const parsed = definitionSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      issues: parsed.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    };
  }

  const issues: SchemaValidationIssue[] = [];
  const typeKeys = new Set<string>();

  parsed.data.recordTypes.forEach((recordType, typeIndex) => {
    if (typeKeys.has(recordType.key)) {
      issues.push({ path: `recordTypes.${typeIndex}.key`, message: `Duplicate record type key "${recordType.key}"` });
    }
    typeKeys.add(recordType.key);

    const fieldKeys = new Set<string>();
    recordType.fields.forEach((field, fieldIndex) => {
      const path = `recordTypes.${typeIndex}.fields.${fieldIndex}`;
      if (fieldKeys.has(field.key)) {
        issues.push({ path: `${path}.key`, message: `Duplicate field key "${field.key}"` });
      }
      fieldKeys.add(field.key);

      const needsOptions = field.type === "select" || field.type === "multi_select";
      if (needsOptions && (!field.options || field.options.length === 0)) {
        issues.push({ path: `${path}.options`, message: "Select fields require at least one option" });
      }
      if (!needsOptions && field.options) {
        issues.push({ path: `${path}.options`, message: "Options are only allowed on select fields" });
      }
      if (field.type !== "number" && (field.min !== undefined || field.max !== undefined)) {
        issues.push({ path, message: "min/max are only allowed on number fields" });
      }
      if (field.min !== undefined && field.max !== undefined && field.min > field.max) {
        issues.push({ path, message: "min must be less than or equal to max" });
      }
    });
  });

  if (issues.length > 0) return { ok: false, issues };
  return { ok: true, definition: parsed.data as PlatformSchemaDefinition };
}
