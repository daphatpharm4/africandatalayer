import type * as SentryNode from "@sentry/node";

type SentryNodeModule = typeof SentryNode;

let initialized = false;
let sentryModulePromise: Promise<SentryNodeModule> | null = null;

function scrubString(value: string): string {
  return value
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[redacted-email]")
    .replace(/\+?\d[\d\s().-]{7,}\d/g, "[redacted-phone]")
    .replace(/bearer\s+[a-z0-9._-]+/gi, "bearer [redacted-token]");
}

function scrubValue(value: unknown): unknown {
  if (typeof value === "string") return scrubString(value);
  if (Array.isArray(value)) return value.map(scrubValue);
  if (!value || typeof value !== "object") return value;

  const output: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    const normalizedKey = key.toLowerCase();
    if (
      normalizedKey.includes("password") ||
      normalizedKey.includes("cookie") ||
      normalizedKey.includes("authorization") ||
      normalizedKey.includes("secret") ||
      normalizedKey.includes("token")
    ) {
      output[key] = "[redacted]";
      continue;
    }
    output[key] = scrubValue(entry);
  }
  return output;
}

export function initServerSentry(): void {
  if (initialized) return;
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;

  void loadSentryModule()
    .then((Sentry) => {
      if (initialized) return;
      Sentry.init({
        dsn,
        environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "development",
        sendDefaultPii: false,
        beforeSend(event) {
          return scrubValue(event) as typeof event;
        },
      });
      initialized = true;
    })
    .catch((error) => {
      console.error("[sentry] failed to initialize", error);
    });
}

function loadSentryModule(): Promise<SentryNodeModule> {
  sentryModulePromise ??= import("@sentry/node");
  return sentryModulePromise;
}

function ensureSentryInitialized(Sentry: SentryNodeModule): boolean {
  if (initialized) return true;
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return false;

  Sentry.init({
    dsn,
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "development",
    sendDefaultPii: false,
    beforeSend(event) {
      return scrubValue(event) as typeof event;
    },
  });

  initialized = true;
  return true;
}

const SENTRY_FLUSH_TIMEOUT_MS = Number(process.env.SENTRY_FLUSH_TIMEOUT_MS ?? "2000") || 2000;

/**
 * Capture an exception and flush it before resolving. On Vercel the serverless
 * instance freezes once the response is sent, so the SDK's async transport send
 * must be awaited or the event is silently dropped. Callers MUST `await` this
 * before returning or rethrowing. Never throws, and the flush is bounded by
 * SENTRY_FLUSH_TIMEOUT_MS so a slow or unreachable Sentry cannot stall the
 * response. Returns true only when an event was captured and flushed.
 */
export async function captureServerException(
  error: unknown,
  context?: Record<string, unknown>,
): Promise<boolean> {
  if (!process.env.SENTRY_DSN) return false;
  try {
    const Sentry = await loadSentryModule();
    if (!ensureSentryInitialized(Sentry)) return false;
    Sentry.captureException(error, {
      extra: scrubValue(context ?? {}) as Record<string, unknown>,
    });
    return await Sentry.flush(SENTRY_FLUSH_TIMEOUT_MS);
  } catch (captureError) {
    console.error("[sentry] failed to capture exception", captureError);
    return false;
  }
}
