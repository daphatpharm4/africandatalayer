import bcrypt from "bcryptjs";
import { createHash } from "node:crypto";
import { z } from "zod";
import { errorResponse, jsonResponse } from "../http.js";
import { logInfo, logWarn } from "../logger.js";
import { consumeRateLimit, extractRateLimitIp } from "../rateLimit.js";
import { getUserProfile } from "../storage/index.js";
import { normalizeIdentifier } from "../../shared/identifier.js";
import { sendTransactional } from "../email/provider.js";
import { buildPasswordResetEmail } from "../email/templates/passwordReset.js";
import {
  RESET_TOKEN_TTL_MINUTES,
  buildResetLandingUrl,
  consumeResetToken,
  findActiveResetToken,
  generateResetToken,
  invalidateAllResetTokensForUser,
  isResetTokenValid,
  persistResetToken,
  setUserPasswordHash,
} from "./passwordReset.js";

const RESET_REQUEST_IP_LIMIT_PER_HOUR = Number(process.env.RESET_REQUEST_IP_LIMIT_PER_HOUR ?? "10") || 10;
const RESET_REQUEST_IDENTIFIER_LIMIT_PER_HOUR =
  Number(process.env.RESET_REQUEST_IDENTIFIER_LIMIT_PER_HOUR ?? "5") || 5;
const RESET_CONFIRM_IP_LIMIT_PER_HOUR =
  Number(process.env.RESET_CONFIRM_IP_LIMIT_PER_HOUR ?? "20") || 20;

const requestSchema = z.object({
  action: z.literal("password-reset-request"),
  identifier: z.string().min(3).max(254),
  language: z.union([z.literal("en"), z.literal("fr")]).optional(),
});

const confirmSchema = z.object({
  action: z.literal("password-reset-confirm"),
  token: z.string().min(16).max(256),
  password: z.string().min(8).max(128),
});

const GENERIC_REQUEST_RESPONSE = {
  ok: true,
  message:
    "If an account exists for this phone or email, a password reset link has been sent.",
};

export async function handlePasswordResetRequest(
  request: Request,
  rawBody: unknown,
): Promise<Response> {
  const validation = requestSchema.safeParse(rawBody);
  if (!validation.success) {
    return errorResponse(validation.error.issues[0]?.message ?? "Invalid request", 400);
  }
  const body = validation.data;

  const ip = extractRateLimitIp(request);
  if (ip) {
    const ipRate = await consumeRateLimit({
      route: "POST /api/auth/register:reset-request:ip",
      key: ip,
      windowSeconds: 60 * 60,
      max: RESET_REQUEST_IP_LIMIT_PER_HOUR,
      request,
    });
    if (!ipRate.allowed) {
      return jsonResponse(GENERIC_REQUEST_RESPONSE, { status: 200 });
    }
  }

  const normalized = normalizeIdentifier(body.identifier);
  if (!normalized) {
    return jsonResponse(GENERIC_REQUEST_RESPONSE, { status: 200 });
  }

  const idRate = await consumeRateLimit({
    route: "POST /api/auth/register:reset-request:identifier",
    key: normalized.value,
    windowSeconds: 60 * 60,
    max: RESET_REQUEST_IDENTIFIER_LIMIT_PER_HOUR,
    request,
    userId: normalized.value,
  });
  if (!idRate.allowed) {
    return jsonResponse(GENERIC_REQUEST_RESPONSE, { status: 200 });
  }

  let profile;
  try {
    profile = await getUserProfile(normalized.value);
  } catch {
    return jsonResponse(GENERIC_REQUEST_RESPONSE, { status: 200 });
  }
  if (!profile) {
    return jsonResponse(GENERIC_REQUEST_RESPONSE, { status: 200 });
  }
  if (!profile.email) {
    logWarn("password_reset.no_email", { userId: profile.id });
    return jsonResponse(GENERIC_REQUEST_RESPONSE, { status: 200 });
  }

  const baseUrl = process.env.APP_BASE_URL?.trim();
  if (!baseUrl) {
    logWarn("password_reset.missing_app_base_url", {});
    return jsonResponse(GENERIC_REQUEST_RESPONSE, { status: 200 });
  }

  const issued = generateResetToken();
  const ipHash = ip ? createHash("sha256").update(ip).digest("hex") : null;
  const userAgent = request.headers.get("user-agent");

  try {
    await persistResetToken({
      userId: profile.id,
      tokenHash: issued.tokenHash,
      expiresAt: issued.expiresAt,
      ipHash,
      userAgent,
    });
  } catch (error) {
    logWarn("password_reset.persist_failed", {
      userId: profile.id,
      error: error instanceof Error ? error.message : "unknown",
    });
    return jsonResponse(GENERIC_REQUEST_RESPONSE, { status: 200 });
  }

  const resetUrl = buildResetLandingUrl(baseUrl, issued.token);
  const language = body.language ?? "en";
  const email = buildPasswordResetEmail({
    resetUrl,
    ttlMinutes: RESET_TOKEN_TTL_MINUTES,
    language,
  });

  try {
    await sendTransactional({
      recipient: { email: profile.email, userId: profile.id },
      templateId: `password_reset_${language}`,
      subject: email.subject,
      html: email.html,
      text: email.text,
      idempotencyKey: `password_reset:${issued.tokenHash}`,
      emailClass: "transactional",
    });
    logInfo("password_reset.email_dispatched", { userId: profile.id });
  } catch (error) {
    logWarn("password_reset.email_dispatch_failed", {
      userId: profile.id,
      error: error instanceof Error ? error.message : "unknown",
    });
  }

  return jsonResponse(GENERIC_REQUEST_RESPONSE, { status: 200 });
}

export async function handlePasswordResetConfirm(
  request: Request,
  rawBody: unknown,
): Promise<Response> {
  const validation = confirmSchema.safeParse(rawBody);
  if (!validation.success) {
    return errorResponse(validation.error.issues[0]?.message ?? "Invalid request", 400);
  }
  const body = validation.data;

  const ip = extractRateLimitIp(request);
  if (ip) {
    const ipRate = await consumeRateLimit({
      route: "POST /api/auth/register:reset-confirm:ip",
      key: ip,
      windowSeconds: 60 * 60,
      max: RESET_CONFIRM_IP_LIMIT_PER_HOUR,
      request,
    });
    if (!ipRate.allowed) {
      return jsonResponse(
        { error: "Too many requests", code: "rate_limited" },
        { status: 429, headers: { "retry-after": String(ipRate.retryAfterSeconds) } },
      );
    }
  }

  const record = await findActiveResetToken(body.token);
  if (!record || !isResetTokenValid(record)) {
    return errorResponse("Invalid or expired reset token", 400, { code: "reset_token_invalid" });
  }

  const consumed = await consumeResetToken(body.token);
  if (!consumed) {
    return errorResponse("Invalid or expired reset token", 400, { code: "reset_token_invalid" });
  }

  const passwordHash = await bcrypt.hash(body.password, 12);
  await setUserPasswordHash(record.userId, passwordHash);
  await invalidateAllResetTokensForUser(record.userId);

  logInfo("password_reset.completed", { userId: record.userId });
  return jsonResponse({ ok: true }, { status: 200 });
}
