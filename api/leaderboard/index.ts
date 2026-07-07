import { buildContributionEvents } from "../../lib/server/submissionEvents.js";
import { getUserProfilesBatch, isStorageUnavailableError } from "../../lib/server/storage/index.js";
import { errorResponse, jsonResponse } from "../../lib/server/http.js";
import type { LeaderboardEntry, PointEvent, SubmissionCategory } from "../../shared/types.js";
import { getEffectiveEventXp } from "../../shared/xp.js";
import { inferDefaultDisplayName } from "../../lib/shared/identifier.js";

type AggregateRow = {
  userId: string;
  xp: number;
  contributions: number;
  qualityScoreTotal: number;
  lastContributionAt: string | null;
  lastLocation: string;
  verticalBreakdown: Partial<Record<SubmissionCategory, number>>;
};

const FALLBACK_QUALITY_SCORE = 50;
const LEADERBOARD_CACHE_CONTROL = "public, s-maxage=30, stale-while-revalidate=300";

function getXpAwarded(submission: PointEvent): number {
  return getEffectiveEventXp(submission);
}

function getLastLocationLabel(submission: PointEvent): string {
  const details = submission.details as Record<string, unknown> | undefined;
  const siteName = typeof details?.siteName === "string" ? details.siteName.trim() : "";
  if (siteName) return siteName;
  return `GPS ${submission.location.latitude.toFixed(4)}°, ${submission.location.longitude.toFixed(4)}°`;
}

function getQualityScore(submission: PointEvent): number {
  const details = submission.details as Record<string, unknown> | undefined;
  const rawScore = details?.confidenceScore;
  if (typeof rawScore === "number" && Number.isFinite(rawScore)) {
    return Math.max(0, Math.min(100, Math.round(rawScore)));
  }
  return FALLBACK_QUALITY_SCORE;
}

function redactUserId(userId: string): string {
  if (!userId) return "contributor";
  if (userId.includes("@")) {
    const [name] = userId.split("@");
    const prefix = name.slice(0, 2);
    return `${prefix}***`;
  }
  return `${userId.slice(0, 3)}***`;
}

// A stored profile name that merely echoes the identifier — the email local part
// ("emmatiatep" for emmatiatep@gmail.com) or the phone-derived "Contributor 1234"
// default — is not a user-chosen display name. Emitting the email local part on
// this fully public endpoint reconstructs the full address next to the (already
// masked) userId, so treat identifier-derived names as auto-generated.
function isIdentifierDerivedName(name: string, userId: string): boolean {
  const trimmed = name.trim().toLowerCase();
  if (!trimmed) return true;
  if (trimmed === inferDefaultDisplayName(userId).trim().toLowerCase()) return true;
  const atIndex = userId.indexOf("@");
  if (atIndex > 0 && trimmed === userId.slice(0, atIndex).trim().toLowerCase()) return true;
  return false;
}

// Public-safe display name for the leaderboard. Only genuinely user-chosen names
// are shown verbatim; anything derived from the login identifier is reduced to a
// non-reconstructable label. Email/phone are never used as a fallback here.
export function getPublicDisplayName(userId: string, profileName?: string | null): string {
  const chosen = profileName?.trim();
  if (chosen && !isIdentifierDerivedName(chosen, userId)) return chosen;

  // No user-chosen name: the phone default ("Contributor 1234") is already
  // non-reconstructable and safe to surface; an email identifier is redacted.
  const autoDerived = inferDefaultDisplayName(userId);
  if (autoDerived.startsWith("Contributor")) return autoDerived;
  return redactUserId(userId);
}

export async function GET(): Promise<Response> {
  try {
    const submissions = await buildContributionEvents();
    const rowsByUser = new Map<string, AggregateRow>();

    for (const submission of submissions) {
      const userId = typeof submission.userId === "string" ? submission.userId.toLowerCase().trim() : "";
      if (!userId) continue;

      const previous = rowsByUser.get(userId);
      const xpAwarded = getXpAwarded(submission);
      const qualityScore = getQualityScore(submission);
      const createdAt = typeof submission.createdAt === "string" ? submission.createdAt : null;
      const locationLabel = getLastLocationLabel(submission);

      if (!previous) {
        rowsByUser.set(userId, {
          userId,
          xp: xpAwarded,
          contributions: 1,
          qualityScoreTotal: qualityScore,
          lastContributionAt: createdAt,
          lastLocation: locationLabel,
          verticalBreakdown: {
            [submission.category]: 1,
          },
        });
        continue;
      }

      previous.xp += xpAwarded;
      previous.contributions += 1;
      previous.qualityScoreTotal += qualityScore;
      previous.verticalBreakdown[submission.category] = (previous.verticalBreakdown[submission.category] ?? 0) + 1;

      const nextDate = createdAt ? new Date(createdAt).getTime() : Number.NEGATIVE_INFINITY;
      const prevDate = previous.lastContributionAt ? new Date(previous.lastContributionAt).getTime() : Number.NEGATIVE_INFINITY;
      if (nextDate > prevDate) {
        previous.lastContributionAt = createdAt;
        previous.lastLocation = locationLabel;
      }
    }

    const sorted = [...rowsByUser.values()].sort((a, b) => {
      const bAverageQuality = b.contributions > 0 ? b.qualityScoreTotal / b.contributions : 0;
      const aAverageQuality = a.contributions > 0 ? a.qualityScoreTotal / a.contributions : 0;
      const bRankingScore = Math.round(b.contributions * bAverageQuality);
      const aRankingScore = Math.round(a.contributions * aAverageQuality);
      if (bRankingScore !== aRankingScore) return bRankingScore - aRankingScore;
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
      const averageQualityScore = row.contributions > 0 ? Math.round(row.qualityScoreTotal / row.contributions) : 0;
      const rankingScore = Math.round(row.contributions * averageQualityScore);
      return {
        rank: index + 1,
        userId: redactUserId(row.userId),
        name: getPublicDisplayName(row.userId, profile?.name),
        xp: row.xp,
        contributions: row.contributions,
        lastContributionAt: row.lastContributionAt,
        lastLocation: row.lastLocation,
        averageQualityScore,
        rankingScore,
        verticalBreakdown: row.verticalBreakdown,
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
