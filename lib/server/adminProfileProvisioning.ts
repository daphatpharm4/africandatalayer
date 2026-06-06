import type { MapScope, UserProfile } from "../../shared/types.js";
import { DEFAULT_AVATAR_PRESET, encodeAvatarPresetImage } from "../../shared/avatarPresets.js";
import { inferDefaultDisplayName } from "../shared/identifier.js";

/** Build a fresh, fully-formed admin profile for a bootstrap ADMIN_EMAIL account
 *  that authenticated (via the env-var bootstrap path) without a stored
 *  user_profiles row. Shares the same display-name inference as every other
 *  identifier-derived name in the app. */
export function buildBootstrapAdminProfile(userId: string): UserProfile {
  const isEmail = userId.includes("@");
  return {
    id: userId,
    name: inferDefaultDisplayName(userId),
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

/** Returns the viewer's profile, provisioning a fresh admin profile when an
 *  admin-token viewer has no stored row (the bootstrap ADMIN_EMAIL case).
 *
 *  This owns exactly one responsibility: provision-when-missing. Upgrading an
 *  existing non-admin row to admin access is the caller's job via
 *  `applyAdminProfileAccess`, so that logic lives in exactly one place. An
 *  existing row is therefore returned unchanged; a non-admin with no row
 *  returns null (preserving the original 404 behavior). */
export async function resolveOrProvisionProfile(
  deps: ProvisionDeps,
  userId: string,
  isAdmin: boolean,
): Promise<UserProfile | null> {
  const existing = await deps.getProfile(userId);
  if (existing) return existing;
  if (!isAdmin) return null;
  const provisioned = buildBootstrapAdminProfile(userId);
  await deps.upsertProfile(userId, provisioned);
  return provisioned;
}
