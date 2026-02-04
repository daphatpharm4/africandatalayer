import { getSubmissions, getUserProfile } from "../../lib/edgeConfig.js";
import { jsonResponse } from "../../lib/server/http.js";
import type { LeaderboardEntry, Submission } from "../../shared/types.js";

type AggregateRow = {
  userId: string;
  xp: number;
  contributions: number;
  lastContributionAt: string | null;
  lastLocation: string;
};

const FALLBACK_XP = 5;

function getXpAwarded(submission: Submission): number {
  const details = submission.details as Record<string, unknown> | undefined;
  const rawXp = details?.xpAwarded;
  return typeof rawXp === "number" && Number.isFinite(rawXp) ? rawXp : FALLBACK_XP;
}

function getLastLocationLabel(submission: Submission): string {
  const details = submission.details as Record<string, unknown> | undefined;
  const siteName = typeof details?.siteName === "string" ? details.siteName.trim() : "";
  if (siteName) return siteName;
  return `GPS ${submission.location.latitude.toFixed(4)}°, ${submission.location.longitude.toFixed(4)}°`;
}

function getDisplayName(userId: string, profileName?: string, profileEmail?: string): string {
  if (profileName && profileName.trim()) return profileName.trim();
  const source = profileEmail && profileEmail.trim() ? profileEmail.trim() : userId.trim();
  const atIndex = source.indexOf("@");
  if (atIndex > 0) return source.slice(0, atIndex);
  return source || "Contributor";
}

export async function GET(): Promise<Response> {
  const submissions = await getSubmissions();
  const rowsByUser = new Map<string, AggregateRow>();

  for (const submission of submissions) {
    const userId = typeof submission.userId === "string" ? submission.userId.toLowerCase().trim() : "";
    if (!userId) continue;

    const previous = rowsByUser.get(userId);
    const xpAwarded = getXpAwarded(submission);
    const createdAt = typeof submission.createdAt === "string" ? submission.createdAt : null;
    const locationLabel = getLastLocationLabel(submission);

    if (!previous) {
      rowsByUser.set(userId, {
        userId,
        xp: xpAwarded,
        contributions: 1,
        lastContributionAt: createdAt,
        lastLocation: locationLabel,
      });
      continue;
    }

    previous.xp += xpAwarded;
    previous.contributions += 1;

    const nextDate = createdAt ? new Date(createdAt).getTime() : Number.NEGATIVE_INFINITY;
    const prevDate = previous.lastContributionAt ? new Date(previous.lastContributionAt).getTime() : Number.NEGATIVE_INFINITY;
    if (nextDate > prevDate) {
      previous.lastContributionAt = createdAt;
      previous.lastLocation = locationLabel;
    }
  }

  const sorted = [...rowsByUser.values()].sort((a, b) => {
    if (b.xp !== a.xp) return b.xp - a.xp;
    if (b.contributions !== a.contributions) return b.contributions - a.contributions;
    const bTime = b.lastContributionAt ? new Date(b.lastContributionAt).getTime() : 0;
    const aTime = a.lastContributionAt ? new Date(a.lastContributionAt).getTime() : 0;
    return bTime - aTime;
  });

  const topRows = sorted.slice(0, 20);
  const profiles = await Promise.all(topRows.map((row) => getUserProfile(row.userId)));

  const leaderboard: LeaderboardEntry[] = topRows.map((row, index) => {
    const profile = profiles[index];
    return {
      rank: index + 1,
      userId: row.userId,
      name: getDisplayName(row.userId, profile?.name, profile?.email),
      xp: row.xp,
      contributions: row.contributions,
      lastContributionAt: row.lastContributionAt,
      lastLocation: row.lastLocation,
    };
  });

  return jsonResponse(leaderboard, { status: 200 });
}
