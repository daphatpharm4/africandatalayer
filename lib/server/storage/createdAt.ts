export function normalizeCreatedAt(input: unknown): string {
  if (input instanceof Date) {
    if (!Number.isNaN(input.getTime())) return input.toISOString();
    return new Date().toISOString();
  }

  if (typeof input === "string") {
    const parsed = new Date(input);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }

  return new Date().toISOString();
}
