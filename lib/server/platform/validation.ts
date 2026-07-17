import { z } from "zod";

const uuid = z.string().uuid();
const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/;
const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;
const INVITE_TOKEN_PATTERN = /^[0-9a-f]{64}$/;
export const MAX_LOGO_DATA_URL_LENGTH = 800_000;

export const orgCreateSchema = z.object({
  name: z.string().trim().min(2).max(80),
  slug: z.string().regex(SLUG_PATTERN, "Slug must be lowercase letters, digits, and hyphens"),
});

export const orgUpdateSchema = z.object({
  organizationId: uuid,
  name: z.string().trim().min(2).max(80).optional(),
  accentColor: z.string().regex(HEX_COLOR_PATTERN, "Accent color must be #rrggbb").optional(),
  logoDataUrl: z.string().startsWith("data:image/").max(MAX_LOGO_DATA_URL_LENGTH).optional(),
  clearLogo: z.boolean().optional(),
});

export const adminOrgAccessUpdateSchema = z.object({
  organizationId: uuid,
  accessStatus: z.enum(["active", "suspended"]),
  reason: z.string().trim().min(3).max(500).optional(),
}).superRefine((value, context) => {
  if (value.accessStatus === "suspended" && !value.reason) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["reason"],
      message: "A suspension reason is required",
    });
  }
});

export const inviteCreateSchema = z.object({
  organizationId: uuid,
  email: z.string().trim().toLowerCase().email(),
  role: z.enum(["manager", "reviewer", "collector", "viewer"]),
});

export const inviteAcceptSchema = z.object({
  token: z.string().regex(INVITE_TOKEN_PATTERN, "Invalid invite token"),
});

export const inviteRevokeSchema = z.object({
  organizationId: uuid,
  inviteId: uuid,
});

export const memberUpdateSchema = z.object({
  organizationId: uuid,
  userId: z.string().min(1),
  role: z.enum(["owner", "manager", "reviewer", "collector", "viewer"]),
});

export const memberRemoveSchema = z.object({
  organizationId: uuid,
  userId: z.string().min(1),
});

export const projectCreateSchema = z.object({
  organizationId: uuid,
  name: z.string().trim().min(2).max(120),
  coverageScope: z.enum(["town", "country", "worldwide"]).default("worldwide"),
  coverageLabel: z.string().trim().min(2).max(120).optional(),
}).superRefine((value, context) => {
  if (value.coverageScope !== "worldwide" && !value.coverageLabel) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["coverageLabel"],
      message: "Town or country name is required",
    });
  }
});

export const schemaDraftSaveSchema = z.object({
  projectId: uuid,
  definition: z.unknown(),
});

export const schemaPublishSchema = z.object({
  projectId: uuid,
});

export const recordCreateSchema = z.object({
  projectId: uuid,
  schemaVersionId: uuid,
  recordTypeKey: z.string().regex(/^[a-z][a-z0-9_]{1,39}$/),
  data: z.record(z.string(), z.unknown()),
  evidence: z.object({
    gps: z.object({
      latitude: z.number().min(-90).max(90),
      longitude: z.number().min(-180).max(180),
      accuracyMeters: z.number().nonnegative().max(100_000).optional(),
    }).optional(),
    photos: z.array(z.string().startsWith("data:image/").max(400_000)).max(10),
    notes: z.string().trim().max(2_000).optional(),
  }),
});

export const recordReviewSchema = z.object({
  organizationId: uuid,
  recordId: uuid,
  status: z.enum(["approved", "rejected"]),
});
