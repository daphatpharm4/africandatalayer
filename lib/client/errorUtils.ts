export function looksLikeHtml(input: string): boolean {
  const value = input.trim().toLowerCase();
  return value.startsWith('<!doctype') || value.startsWith('<html') || value.includes('<body');
}

export function sanitizeErrorMessage(input: unknown, fallback: string, maxLen = 280): string {
  if (typeof input !== 'string') return fallback;
  const trimmed = input.trim();
  if (!trimmed || looksLikeHtml(trimmed) || trimmed.length > maxLen) return fallback;
  return trimmed;
}
