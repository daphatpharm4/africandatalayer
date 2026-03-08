import { getUserXpFromEvents } from "../../shared/xp.js";
import type { PointEvent, UserProfile } from "../../shared/types.js";
import { buildContributionEvents } from "./submissionEvents.js";
import { getUserProfile, upsertUserProfile } from "./storage/index.js";

export function computeCanonicalUserXp(events: readonly PointEvent[], userId: string): number {
  return getUserXpFromEvents(events, userId);
}

export async function reconcileUserProfileXp(
  userId: string,
  options: {
    events?: PointEvent[];
    profile?: UserProfile | null;
  } = {},
): Promise<UserProfile | null> {
  const profile = options.profile ?? (await getUserProfile(userId));
  if (!profile) return null;

  const events = options.events ?? (await buildContributionEvents());
  const nextXp = computeCanonicalUserXp(events, userId);
  if ((profile.XP ?? 0) === nextXp) return profile;

  const nextProfile: UserProfile = { ...profile, XP: nextXp };
  await upsertUserProfile(userId, nextProfile);
  return nextProfile;
}
