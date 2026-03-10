export const AVATAR_PRESETS = ["baobab", "sunrise", "lagoon"] as const;

export type AvatarPreset = (typeof AVATAR_PRESETS)[number];

export const DEFAULT_AVATAR_PRESET: AvatarPreset = "baobab";

const AVATAR_PRESET_SET = new Set<string>(AVATAR_PRESETS);
const AVATAR_IMAGE_PREFIX = "preset:";

export function isAvatarPreset(value: unknown): value is AvatarPreset {
  return typeof value === "string" && AVATAR_PRESET_SET.has(value);
}

export function decodeAvatarPreset(value: unknown): AvatarPreset | undefined {
  if (typeof value !== "string") return undefined;

  const normalized = value.trim().toLowerCase();
  if (isAvatarPreset(normalized)) return normalized;
  if (!normalized.startsWith(AVATAR_IMAGE_PREFIX)) return undefined;

  const candidate = normalized.slice(AVATAR_IMAGE_PREFIX.length);
  if (isAvatarPreset(candidate)) return candidate;
  return undefined;
}

export function coerceAvatarPreset(value: unknown): AvatarPreset {
  return decodeAvatarPreset(value) ?? DEFAULT_AVATAR_PRESET;
}

export function encodeAvatarPresetImage(preset: AvatarPreset): string {
  return `${AVATAR_IMAGE_PREFIX}${preset}`;
}
