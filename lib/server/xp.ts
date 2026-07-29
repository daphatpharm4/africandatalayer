import { getUserXpFromEvents } from "../../shared/xp.js";
import type { PointEvent, UserProfile } from "../../shared/types.js";
import { buildContributionEvents } from "./submissionEvents.js";
import { getUserProfile, upsertUserProfile } from "./storage/index.js";
import { getMissionRewardXpTotalForUser } from "./platform/missionStore.js";

export function computeCanonicalUserXp(events: readonly PointEvent[], userId: string): number {
  return getUserXpFromEvents(events, userId);
}

export async function reconcileUserProfileXp(
  userId: string,
  options: {
    events?: PointEvent[];
    profile?: UserProfile | null;
    // Injectable for tests; defaults to the real mission-reward XP ledger
    // total (lib/server/platform/missionStore.ts's getMissionRewardXpTotalForUser).
    missionRewardXpFn?: (userId: string) => Promise<number>;
  } = {},
): Promise<UserProfile | null> {
  const profile = options.profile ?? (await getUserProfile(userId));
  if (!profile) return null;

  const events = options.events ?? (await buildContributionEvents());
  const missionRewardXpFn = options.missionRewardXpFn ?? ((id: string) => getMissionRewardXpTotalForUser(id));

  // Canonical XP = submission-derived XP (getUserXpFromEvents) + the mission
  // reward XP ledger total. The ledger (`mission_assignments.xp_awarded`) is a
  // sticky one-way flag set exactly once per completed mission assignment
  // (see missionStore.updateAssignmentProgress), so summing it here on every
  // reconcile is idempotent and never double-counts a mission reward — a
  // mission reward is a DISTINCT xpAction ("mission_reward") from submission
  // XP, added on top, not derived from getEffectiveEventXp.
  const [submissionXp, missionRewardXp] = await Promise.all([
    Promise.resolve(computeCanonicalUserXp(events, userId)),
    missionRewardXpFn(userId),
  ]);
  const nextXp = submissionXp + missionRewardXp;
  if ((profile.XP ?? 0) === nextXp) return profile;

  const nextProfile: UserProfile = { ...profile, XP: nextXp };
  await upsertUserProfile(userId, nextProfile);
  return nextProfile;
}
