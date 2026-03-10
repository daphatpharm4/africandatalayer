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
  })
  .strict();

export const userUpdateSchema = z
  .object({
    occupation: z.string().trim().max(120).optional(),
    mapScope: z.enum(["bonamoussadi", "cameroon", "global"]).optional(),
    avatarPreset: z.enum(AVATAR_PRESETS).optional(),
  })
  .strict();

export const reviewBodySchema = z
  .object({
    decision: z.enum(["approved", "rejected", "flagged"]),
    notes: z.string().trim().max(1000).optional(),
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

export const privacyRequestSchema = z
  .object({
    requestType: z.enum(["access", "rectification", "erasure"]),
    subjectReference: z.string().trim().min(1).max(160),
    notes: z.string().trim().max(1000).optional(),
  })
  .strict();

export const privacyActionSchema = z
  .object({
    subjectReference: z.string().trim().min(1).max(160),
    notes: z.string().trim().max(1000).optional(),
  })
  .strict();
