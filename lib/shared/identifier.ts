export type IdentifierType = "email" | "phone";

export interface NormalizedIdentifier {
  type: IdentifierType;
  value: string;
}

const DEFAULT_COUNTRY_CODE = "+237";
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function trimToNull(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const trimmed = input.trim();
  return trimmed || null;
}

function toDigits(input: string): string {
  return input.replace(/\D/g, "");
}

export function normalizeEmail(input: unknown): string | null {
  const raw = trimToNull(input);
  if (!raw) return null;
  const normalized = raw.toLowerCase();
  if (!EMAIL_REGEX.test(normalized)) return null;
  return normalized;
}

export function normalizePhone(input: unknown, defaultCountryCode = DEFAULT_COUNTRY_CODE): string | null {
  const raw = trimToNull(input);
  if (!raw) return null;

  const compact = raw.replace(/[().\s-]/g, "");
  if (!compact) return null;

  if (compact.startsWith("+")) {
    const digits = toDigits(compact);
    if (digits.length < 8 || digits.length > 15) return null;
    return `+${digits}`;
  }

  if (compact.startsWith("00")) {
    const digits = toDigits(compact.slice(2));
    if (digits.length < 8 || digits.length > 15) return null;
    return `+${digits}`;
  }

  const digits = toDigits(compact);
  if (!digits) return null;

  if (digits.length === 12 && digits.startsWith("237")) {
    return `+${digits}`;
  }

  if (digits.length === 9) {
    const prefix = defaultCountryCode.startsWith("+") ? defaultCountryCode : `+${defaultCountryCode}`;
    return `${prefix}${digits}`;
  }

  if (digits.length >= 8 && digits.length <= 15) {
    return `+${digits}`;
  }

  return null;
}

export function normalizeIdentifier(input: unknown, defaultCountryCode = DEFAULT_COUNTRY_CODE): NormalizedIdentifier | null {
  const raw = trimToNull(input);
  if (!raw) return null;

  const email = normalizeEmail(raw);
  if (email) {
    return { type: "email", value: email };
  }

  const phone = normalizePhone(raw, defaultCountryCode);
  if (!phone) return null;
  return { type: "phone", value: phone };
}

export function inferDefaultDisplayName(identifier: string): string {
  const email = normalizeEmail(identifier);
  if (email) {
    const at = email.indexOf("@");
    if (at > 0) return email.slice(0, at);
    return email;
  }

  const phone = normalizePhone(identifier);
  if (!phone) return "Contributor";
  const digits = toDigits(phone);
  const suffix = digits.slice(-4);
  return suffix ? `Contributor ${suffix}` : "Contributor";
}
