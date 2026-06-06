import type { MapScope, UserProfile } from "../../shared/types.ts";
import { DEFAULT_AVATAR_PRESET, encodeAvatarPresetImage } from "../../shared/avatarPresets.ts";

function inferName(userId: string): string {
  const handle = userId.includes("@") ? userId.split("@")[0] : userId;
  const cleaned = handle.replace(/[._-]+/g, " ").trim();
  if (!cleaned) return "Admin";
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

export function buildBootstrapAdminProfile(userId: string): UserProfile {
  const isEmail = userId.includes("@");
  return {
    id: userId,
    name: inferName(userId),
    email: isEmail ? userId : null,
    phone: isEmail ? null : userId,
    image: encodeAvatarPresetImage(DEFAULT_AVATAR_PRESET),
    avatarPreset: DEFAULT_AVATAR_PRESET,
    occupation: "",
    XP: 0,
    isAdmin: true,
    role: "admin",
    mapScope: "global" as MapScope,
    trustScore: 50,
    trustTier: "standard",
    failedLoginCount: 0,
    lockedUntil: null,
    wipeRequested: false,
    suspendedUntil: null,
  };
}

export interface ProvisionDeps {
  getProfile: (id: string) => Promise<UserProfile | null>;
  upsertProfile: (id: string, profile: UserProfile) => Promise<void>;
}

export async function resolveOrProvisionProfile(
  deps: ProvisionDeps,
  userId: string,
  isAdmin: boolean,
): Promise<UserProfile | null> {
  const existing = await deps.getProfile(userId);
  if (existing) {
    if (isAdmin) {
      let changed = false;
      if (existing.role !== "admin") { existing.role = "admin"; changed = true; }
      if (existing.isAdmin !== true) { existing.isAdmin = true; changed = true; }
      if (existing.mapScope !== "global") { existing.mapScope = "global" as MapScope; changed = true; }
      if (changed) await deps.upsertProfile(userId, existing);
    }
    return existing;
  }
  if (!isAdmin) return null;
  const provisioned = buildBootstrapAdminProfile(userId);
  await deps.upsertProfile(userId, provisioned);
  return provisioned;
}
