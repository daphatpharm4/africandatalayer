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
  if (initialized || !process.env.SENTRY_DSN) return;
  // Kick off the async load+init at cold start so Sentry's uncaughtException and
  // unhandledRejection handlers (registered by Sentry.init) are in place before the
  // first request — not only lazily on the first captured error. Delegates to the
  // same init path as captureServerException so the config and the `initialized`
  // guard stay single-sourced.
  void loadSentryModule()
    .then((Sentry) => {
      ensureSentryInitialized(Sentry);
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

// Cold-start instrumentation: importing this module — directly, or transitively via
// captureServerException — proactively initializes Sentry on a fresh serverless
// instance so uncaught exceptions and unhandled rejections are reported, not just
// errors routed through captureServerException. No-op when SENTRY_DSN is unset.
initServerSentry();
