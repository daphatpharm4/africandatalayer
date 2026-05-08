import { createHmac, timingSafeEqual } from "node:crypto";

const SVIX_SECRET_PREFIX = "whsec_";
const TIMESTAMP_TOLERANCE_SECONDS = 5 * 60;

export interface SvixVerifyParams {
  rawBody: string;
  signingSecret: string;
  headers: { id: string | null; timestamp: string | null; signature: string | null };
  now?: Date;
}

export interface SvixVerifyResult {
  valid: boolean;
  reason?: string;
}

function decodeSecret(secret: string): Buffer | null {
  const trimmed = secret.trim();
  const value = trimmed.startsWith(SVIX_SECRET_PREFIX)
    ? trimmed.slice(SVIX_SECRET_PREFIX.length)
    : trimmed;
  if (!value) return null;
  try {
    return Buffer.from(value, "base64");
  } catch {
    return null;
  }
}

function constantTimeIncludes(received: string[], expected: string): boolean {
  const expectedBuf = Buffer.from(expected, "utf8");
  for (const candidate of received) {
    const candidateBuf = Buffer.from(candidate, "utf8");
    if (candidateBuf.length !== expectedBuf.length) continue;
    if (timingSafeEqual(candidateBuf, expectedBuf)) return true;
  }
  return false;
}

export function verifySvixSignature(params: SvixVerifyParams): SvixVerifyResult {
  const { rawBody, signingSecret } = params;
  const id = params.headers.id?.trim() ?? "";
  const timestamp = params.headers.timestamp?.trim() ?? "";
  const signatureHeader = params.headers.signature?.trim() ?? "";

  if (!id || !timestamp || !signatureHeader) {
    return { valid: false, reason: "missing_signature_headers" };
  }

  const timestampSeconds = Number(timestamp);
  if (!Number.isFinite(timestampSeconds)) {
    return { valid: false, reason: "invalid_timestamp" };
  }

  const nowMs = (params.now ?? new Date()).getTime();
  const skewSeconds = Math.abs(nowMs / 1000 - timestampSeconds);
  if (skewSeconds > TIMESTAMP_TOLERANCE_SECONDS) {
    return { valid: false, reason: "stale_timestamp" };
  }

  const secretBytes = decodeSecret(signingSecret);
  if (!secretBytes || secretBytes.length === 0) {
    return { valid: false, reason: "invalid_signing_secret" };
  }

  const signedPayload = `${id}.${timestamp}.${rawBody}`;
  const expected = createHmac("sha256", secretBytes).update(signedPayload).digest("base64");

  const candidates = signatureHeader
    .split(/\s+/)
    .filter((entry) => entry.startsWith("v1,"))
    .map((entry) => entry.slice("v1,".length));

  if (candidates.length === 0) {
    return { valid: false, reason: "no_v1_signatures" };
  }

  if (!constantTimeIncludes(candidates, expected)) {
    return { valid: false, reason: "signature_mismatch" };
  }

  return { valid: true };
}

export function readSvixHeaders(headers: Headers): {
  id: string | null;
  timestamp: string | null;
  signature: string | null;
} {
  return {
    id: headers.get("svix-id") ?? headers.get("webhook-id"),
    timestamp: headers.get("svix-timestamp") ?? headers.get("webhook-timestamp"),
    signature: headers.get("svix-signature") ?? headers.get("webhook-signature"),
  };
}
