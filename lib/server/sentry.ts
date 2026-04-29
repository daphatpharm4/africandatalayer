let initialized = false;
let sentryModulePromise: Promise<typeof import("@sentry/node")> | null = null;

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

function loadSentryModule(): Promise<typeof import("@sentry/node")> {
  sentryModulePromise ??= import("@sentry/node");
  return sentryModulePromise;
}

function ensureSentryInitialized(Sentry: typeof import("@sentry/node")): boolean {
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

export function captureServerException(error: unknown, context?: Record<string, unknown>): void {
  if (!process.env.SENTRY_DSN) return;
  void loadSentryModule()
    .then((Sentry) => {
      if (!ensureSentryInitialized(Sentry)) return;
      Sentry.captureException(error, {
        extra: scrubValue(context ?? {}) as Record<string, unknown>,
      });
    })
    .catch((loadError) => {
      console.error("[sentry] failed to capture exception", loadError);
    });
}
