import { z } from "zod";
import { AVATAR_PRESETS } from "../../shared/avatarPresets.js";

const CATEGORY_VALUES = [
  "pharmacy",
  "fuel_station",
  "mobile_money",
  "alcohol_outlet",
  "billboard",
  "transport_road",
  "census_proxy",
] as const;

const EVENT_TYPE_VALUES = ["CREATE_EVENT", "ENRICH_EVENT"] as const;
const CONSENT_STATUS_VALUES = ["obtained", "refused_pii_only", "not_required", "withdrawn"] as const;
const AUTOMATION_LEAD_PRIORITY_VALUES = ["high", "medium", "low"] as const;
const AUTOMATION_LEAD_ACTION_VALUES = [
  "reject",
  "mark_assigned",
  "mark_verified",
  "promote_to_import_candidate",
] as const;
const AUTOMATION_RUN_TRIGGER_VALUES = ["schedule", "webhook", "file", "manual", "api"] as const;

export const consentStatusSchema = z.enum(CONSENT_STATUS_VALUES);

export const gpsIntegritySchema = z.object({
  mockLocationDetected: z.boolean(),
  mockLocationMethod: z.string().trim().max(160).nullable(),
  hasAccelerometerData: z.boolean(),
  hasGyroscopeData: z.boolean(),
  accelerometerSampleCount: z.number().int().min(0),
  motionDetectedDuringCapture: z.boolean(),
  gpsAccuracyMeters: z.number().finite().nullable(),
  networkType: z.string().trim().max(32).nullable(),
  gpsTimestamp: z.number().int().nullable(),
  deviceTimestamp: z.number().int(),
  timeDeltaMs: z.number().int().nullable(),
});

export const submissionInputSchema = z
  .object({
    eventType: z.enum(EVENT_TYPE_VALUES).optional(),
    pointId: z.string().trim().min(1).max(128).optional(),
    category: z.enum(CATEGORY_VALUES),
    location: z
      .object({
        latitude: z.number().finite(),
        longitude: z.number().finite(),
      })
      .optional(),
    details: z.record(z.string(), z.unknown()).optional(),
    imageBase64: z.string().min(1).max(12_000_000).optional(),
    secondImageBase64: z.string().min(1).max(12_000_000).optional(),
    clientExif: z
      .object({
        latitude: z.number().finite().nullable().optional(),
        longitude: z.number().finite().nullable().optional(),
        capturedAt: z.string().datetime().nullable().optional(),
        deviceMake: z.string().trim().max(120).nullable().optional(),
        deviceModel: z.string().trim().max(120).nullable().optional(),
      })
      .nullable()
      .optional(),
    dedupDecision: z.enum(["allow_create", "use_existing"]).optional(),
    dedupTargetPointId: z.string().trim().min(1).max(128).optional(),
    consentStatus: consentStatusSchema.optional(),
    consentRecordedAt: z.string().datetime().optional(),
    gpsIntegrity: gpsIntegritySchema.optional(),
    photoEvidenceSha256: z.string().regex(/^[a-f0-9]{64}$/i).optional(),
  })
  .strict();

const LANGUAGE_VALUES = ["en", "fr"] as const;
const POI_STATUS_VALUES = [
  "discovered",
  "normalized",
  "matched_to_existing",
  "needs_field_verification",
  "assigned_to_agent",
  "verified",
  "promoted_to_point_event",
  "rejected",
] as const;

export const aiExtractionRequestSchema = z
  .object({
    category: z.enum(CATEGORY_VALUES).nullable().optional(),
    imageData: z.string().min(1).max(12_000_000).optional(),
    photoUrl: z.string().trim().url().max(1000).optional(),
    location: z.object({
      latitude: z.number().finite(),
      longitude: z.number().finite(),
    }),
    language: z.enum(LANGUAGE_VALUES),
    draftDetails: z.record(z.string(), z.unknown()).optional(),
  })
  .strict()
  .refine((value) => Boolean(value.imageData || value.photoUrl), {
    message: "imageData or photoUrl is required",
    path: ["imageData"],
  });

export const aiReviewSummaryRequestSchema = z
  .object({
    eventId: z.string().trim().min(1).max(160),
  })
  .strict();

export const aiAnalyticsQueryRequestSchema = z
  .object({
    question: z.string().trim().min(3).max(500),
    vertical: z.enum(CATEGORY_VALUES).optional(),
    zone: z.string().trim().min(1).max(120).optional(),
    dateRange: z
      .object({
        from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      })
      .optional(),
    exportFormat: z.enum(["json", "csv", "geojson", "pdf"]).optional(),
  })
  .strict();

export const poiCandidatePatchSchema = z
  .object({
    matchStatus: z.enum(POI_STATUS_VALUES).optional(),
    assignedTo: z.string().trim().min(1).max(160).nullable().optional(),
    needsFieldVerification: z.boolean().optional(),
  })
  .strict();

const POLICY_KIND_VALUES = ["privacy", "terms"] as const;

export const registerBodySchema = z
  .object({
    identifier: z.string().trim().min(3).max(160).optional(),
    email: z.string().trim().min(3).max(160).optional(),
    password: z
      .string()
      .min(10)
      .max(128)
      .regex(/[A-Z]/, "Password must include an uppercase letter")
      .regex(/[a-z]/, "Password must include a lowercase letter")
      .regex(/[0-9]/, "Password must include a number"),
    name: z.string().trim().max(160).optional(),
    acceptedPolicies: z
      .array(z.enum(POLICY_KIND_VALUES))
      .min(2)
      .refine((kinds) => kinds.includes("privacy") && kinds.includes("terms"), {
        message: "Must accept both the Privacy Policy and Terms of Use",
      }),
    smsOptIn: z.boolean().optional(),
  })
  .strict();

export const adminAccountCreateSchema = z
  .object({
    identifier: z.string().trim().min(3).max(160),
    password: z
      .string()
      .min(10)
      .max(128)
      .regex(/[A-Z]/, "Password must include an uppercase letter")
      .regex(/[a-z]/, "Password must include a lowercase letter")
      .regex(/[0-9]/, "Password must include a number"),
    name: z.string().trim().max(160).optional(),
    role: z.enum(["agent", "admin", "client"]).default("client"),
  })
  .strict();

export const userUpdateSchema = z
  .object({
    name: z.string().trim().max(160).optional(),
    occupation: z.string().trim().max(120).optional(),
    mapScope: z.enum(["bonamoussadi", "cameroon", "global"]).optional(),
    avatarPreset: z.enum(AVATAR_PRESETS).optional(),
    imageBase64: z.string().min(1).max(10_000_000).optional(),
  })
  .strict();

export const reviewBodySchema = z
  .object({
    decision: z.enum(["approved", "rejected", "flagged"]),
    notes: z.string().trim().max(1000).optional(),
  })
  .strict();

export const batchReviewBodySchema = z
  .object({
    eventIds: z.array(z.string().trim().min(1)).min(1).max(100),
    decision: z.enum(["approved", "rejected", "flagged"]),
    notes: z.string().trim().max(1000).optional(),
  })
  .strict();

export const automationLeadInputSchema = z
  .object({
    sourceRecordId: z.string().trim().min(1).max(200),
    sourceUrl: z.string().trim().url().max(1000).nullable().optional(),
    category: z.string().trim().min(1).max(80),
    location: z.object({
      latitude: z.number().finite(),
      longitude: z.number().finite(),
    }),
    normalizedDetails: z.record(z.string(), z.unknown()).optional(),
    rawPayload: z.record(z.string(), z.unknown()).optional(),
    evidenceUrls: z.array(z.string().trim().url().max(1000)).max(20).optional(),
    freshnessAt: z.string().datetime().nullable().optional(),
    priority: z.enum(AUTOMATION_LEAD_PRIORITY_VALUES).optional(),
  })
  .strict();

export const automationRunInputSchema = z
  .object({
    runKey: z.string().trim().min(1).max(200),
    workflowName: z.string().trim().min(1).max(160),
    sourceSystem: z.string().trim().min(1).max(120),
    triggerType: z.enum(AUTOMATION_RUN_TRIGGER_VALUES).optional(),
    startedAt: z.string().datetime().nullable().optional(),
    completedAt: z.string().datetime().nullable().optional(),
    leads: z.array(automationLeadInputSchema).min(1).max(500),
  })
  .strict();

export const automationLeadActionSchema = z
  .object({
    action: z.enum(AUTOMATION_LEAD_ACTION_VALUES),
    assignmentId: z.string().trim().uuid().nullable().optional(),
  })
  .strict();

export const userStatusPatchSchema = z
  .object({
    userId: z.string().trim().min(1).max(160),
    trustScore: z.number().int().min(0).max(100).optional(),
    suspendedUntil: z.string().datetime().nullable().optional(),
    wipeRequested: z.boolean().optional(),
  })
  .strict();

export const adminUserAccessPatchSchema = z
  .object({
    userId: z.string().trim().min(1).max(160),
    role: z.enum(["agent", "admin", "client"]),
  })
  .strict();

export const privacyRequestSchema = z
  .object({
    requestType: z.enum(["access", "rectification", "erasure"]),
    subjectReference: z.string().trim().max(160).optional(),
    notes: z.string().trim().max(1000).optional(),
  })
  .strict();

export const privacyActionSchema = z
  .object({
    subjectReference: z.string().trim().min(1).max(160),
    notes: z.string().trim().max(1000).optional(),
  })
  .strict();

export const policyAcceptanceSchema = z
  .object({
    accept: z.array(z.enum(POLICY_KIND_VALUES)).min(1).max(2),
  })
  .strict();

export const ipReportSchema = z
  .object({
    reporterName: z.string().trim().min(2).max(160),
    reporterEmail: z.string().trim().email().max(160),
    targetKind: z.enum(["submission", "point", "other"]),
    targetRef: z.string().trim().max(160).optional(),
    description: z.string().trim().min(20).max(4000),
    sworn: z.literal(true),
  })
  .strict();

export const ipReportPatchSchema = z
  .object({
    id: z.string().trim().uuid(),
    status: z.enum(["open", "reviewing", "resolved", "rejected"]),
    resolutionNotes: z.string().trim().max(4000).optional(),
  })
  .strict();
