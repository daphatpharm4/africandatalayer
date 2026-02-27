import { getLegacySubmissions, getPointEvents, getUserProfilesBatch, isStorageUnavailableError } from "../../lib/server/storage/index.js";
import { mergePointEventsWithLegacy } from "../../lib/server/pointProjection.js";
import { errorResponse, jsonResponse } from "../../lib/server/http.js";
import type { LeaderboardEntry, PointEvent } from "../../shared/types.js";

type AggregateRow = {
  userId: string;
  xp: number;
  contributions: number;
  lastContributionAt: string | null;
  lastLocation: string;
};

const FALLBACK_XP = 5;
const LEADERBOARD_CACHE_CONTROL = "public, s-maxage=30, stale-while-revalidate=300";

function getXpAwarded(submission: PointEvent): number {
  const details = submission.details as Record<string, unknown> | undefined;
  const rawXp = details?.xpAwarded;
  return typeof rawXp === "number" && Number.isFinite(rawXp) ? rawXp : FALLBACK_XP;
}

function getLastLocationLabel(submission: PointEvent): string {
  const details = submission.details as Record<string, unknown> | undefined;
  const siteName = typeof details?.siteName === "string" ? details.siteName.trim() : "";
  if (siteName) return siteName;
  return `GPS ${submission.location.latitude.toFixed(4)}°, ${submission.location.longitude.toFixed(4)}°`;
}

function getDisplayName(userId: string, profileName?: string, profileEmail?: string | null, profilePhone?: string | null): string {
  if (profileName && profileName.trim()) return profileName.trim();
  const source =
    profileEmail && profileEmail.trim() ? profileEmail.trim() : profilePhone && profilePhone.trim() ? profilePhone.trim() : userId.trim();
  const atIndex = source.indexOf("@");
  if (atIndex > 0) return source.slice(0, atIndex);
  return source || "Contributor";
}

export async function GET(): Promise<Response> {
  try {
    const pointEvents = await getPointEvents();
    const legacySubmissions = await getLegacySubmissions();
    const submissions = mergePointEventsWithLegacy(pointEvents, legacySubmissions);
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

    const topRows = sorted.slice(0, 100);
    const profileMap = await getUserProfilesBatch(topRows.map((row) => row.userId));

    const leaderboard: LeaderboardEntry[] = topRows.map((row, index) => {
      const profile = profileMap.get(row.userId);
      return {
        rank: index + 1,
        userId: row.userId,
        name: getDisplayName(row.userId, profile?.name, profile?.email, profile?.phone),
        xp: row.xp,
        contributions: row.contributions,
        lastContributionAt: row.lastContributionAt,
        lastLocation: row.lastLocation,
      };
    });

    return jsonResponse(leaderboard, {
      status: 200,
      headers: {
        "cache-control": LEADERBOARD_CACHE_CONTROL,
      },
    });
  } catch (error) {
    if (isStorageUnavailableError(error)) {
      return errorResponse("Storage service temporarily unavailable", 503, { code: "storage_unavailable" });
    }
    throw error;
  }
}
