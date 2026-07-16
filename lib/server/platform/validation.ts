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

export const inviteCreateSchema = z.object({
  organizationId: uuid,
  email: z.string().trim().toLowerCase().email(),
  role: z.enum(["manager", "reviewer", "collector", "viewer"]),
});

export const inviteAcceptSchema = z.object({
  token: z.string().regex(INVITE_TOKEN_PATTERN, "Invalid invite token"),
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
});

export const schemaDraftSaveSchema = z.object({
  projectId: uuid,
  definition: z.unknown(),
});

export const schemaPublishSchema = z.object({
  projectId: uuid,
});
