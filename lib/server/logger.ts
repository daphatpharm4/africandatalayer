type LogLevel = "info" | "warn" | "error";

function safeSerialize(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return JSON.stringify({ message: "Unable to serialize log payload" });
  }
}

function write(level: LogLevel, event: string, payload?: Record<string, unknown>): void {
  const line = safeSerialize({
    level,
    event,
    ts: new Date().toISOString(),
    ...(payload ?? {}),
  });

  if (level === "error") {
    console.error(line);
    return;
  }
  if (level === "warn") {
    console.warn(line);
    return;
  }
  console.info(line);
}

export function logInfo(event: string, payload?: Record<string, unknown>): void {
  write("info", event, payload);
}

export function logWarn(event: string, payload?: Record<string, unknown>): void {
  write("warn", event, payload);
}

export function logError(event: string, payload?: Record<string, unknown>): void {
  write("error", event, payload);
}
