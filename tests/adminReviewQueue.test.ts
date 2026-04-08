import assert from "node:assert/strict";
import test from "node:test";
import {
  buildAdminReviewStatsFromPoints,
  buildAdminSubmissionGroups,
  compareAdminReviewSort,
  getAdminRiskBucket,
  parseAdminReviewLimit,
  parseAdminReviewPage,
} from "../lib/shared/adminReviewQueue.js";
import type { AdminSubmissionEvent } from "../shared/types.js";

function makeEvent(input: {
  id: string;
  pointId: string;
  createdAt: string;
  riskScore: number;
  reviewStatus: string;
  eventType?: "CREATE_EVENT" | "ENRICH_EVENT";
  siteName?: string;
  photoUrl?: string;
  secondPhotoUrl?: string;
  submissionDistanceKm?: number | null;
  submissionGpsMatch?: boolean | null;
  ipDistanceKm?: number | null;
  ipGpsMatch?: boolean | null;
  isLowEnd?: boolean;
  userId?: string;
  userName?: string;
  trustTier?: AdminSubmissionEvent["user"]["trustTier"];
}): AdminSubmissionEvent {
  return {
    event: {
      id: input.id,
      pointId: input.pointId,
      eventType: input.eventType ?? "CREATE_EVENT",
      userId: input.userId ?? "agent-1",
      category: "pharmacy",
      location: { latitude: 4.0864, longitude: 9.7402 },
      details: {
        siteName: input.siteName,
        reviewStatus: input.reviewStatus,
        riskScore: input.riskScore,
        secondPhotoUrl: input.secondPhotoUrl,
        clientDevice: {
          deviceId: "device-1",
          isLowEnd: input.isLowEnd === true,
        },
      },
      photoUrl: input.photoUrl,
      createdAt: input.createdAt,
    },
    user: {
      id: input.userId ?? "agent-1",
      name: input.userName ?? "Agent One",
      email: "agent@example.com",
      trustScore: 72,
      trustTier: input.trustTier ?? "trusted",
    },
    fraudCheck: {
      submissionLocation: { latitude: 4.0864, longitude: 9.7402 },
      effectiveLocation: { latitude: 4.0864, longitude: 9.7402 },
      ipLocation: { latitude: 4.1001, longitude: 9.7501 },
      primaryPhoto: input.photoUrl
        ? {
            gps: { latitude: 4.0864, longitude: 9.7402 },
            capturedAt: input.createdAt,
            deviceMake: "Samsung",
            deviceModel: "A15",
            submissionDistanceKm: input.submissionDistanceKm ?? null,
            submissionGpsMatch: input.submissionGpsMatch ?? null,
            ipDistanceKm: input.ipDistanceKm ?? null,
            ipGpsMatch: input.ipGpsMatch ?? null,
            exifStatus: "ok",
            exifReason: null,
            exifSource: "upload_buffer",
          }
        : null,
      secondaryPhoto: input.secondPhotoUrl
        ? {
            gps: { latitude: 4.0864, longitude: 9.7402 },
            capturedAt: input.createdAt,
            deviceMake: "Samsung",
            deviceModel: "A15",
            submissionDistanceKm: 1.7,
            submissionGpsMatch: false,
            ipDistanceKm: 6.2,
            ipGpsMatch: false,
            exifStatus: "ok",
            exifReason: null,
            exifSource: "upload_buffer",
          }
        : null,
      submissionMatchThresholdKm: 1,
      ipMatchThresholdKm: 5,
    },
  };
}

test("buildAdminSubmissionGroups summarizes evidence, contributors, and mismatch signals", () => {
  const groups = buildAdminSubmissionGroups([
    makeEvent({
      id: "event-1",
      pointId: "point-a",
      createdAt: "2026-04-01T10:00:00.000Z",
      riskScore: 35,
      reviewStatus: "pending_review",
      siteName: "Alpha Pharmacy",
      photoUrl: "https://example.com/photo-1.jpg",
      userId: "agent-1",
      userName: "Alice",
      submissionDistanceKm: 0.4,
      submissionGpsMatch: true,
      ipDistanceKm: 2.2,
      ipGpsMatch: true,
    }),
    makeEvent({
      id: "event-2",
      pointId: "point-a",
      createdAt: "2026-04-02T10:00:00.000Z",
      riskScore: 82,
      reviewStatus: "pending_review",
      eventType: "ENRICH_EVENT",
      photoUrl: "https://example.com/photo-2.jpg",
      secondPhotoUrl: "https://example.com/photo-2b.jpg",
      userId: "agent-2",
      userName: "Bob",
      trustTier: "restricted",
      submissionDistanceKm: 3.8,
      submissionGpsMatch: false,
      ipDistanceKm: 9.4,
      ipGpsMatch: false,
      isLowEnd: true,
    }),
  ]);

  assert.equal(groups.length, 1);
  const [group] = groups;
  assert.ok(group);
  assert.equal(group.siteName, "Alpha Pharmacy");
  assert.equal(group.summary.riskScore, 82);
  assert.equal(group.summary.riskBucket, "flagged");
  assert.equal(group.summary.contributorCount, 2);
  assert.equal(group.summary.evidenceCount, 3);
  assert.equal(group.summary.hasSubmissionMismatch, true);
  assert.equal(group.summary.hasIpMismatch, true);
  assert.equal(group.summary.isLowEndDevice, true);
  assert.equal(group.summary.trustTier, "restricted");
  assert.equal(group.summary.submissionDistanceKm, 3.8);
  assert.equal(group.summary.ipDistanceKm, 9.4);
});

test("compareAdminReviewSort keeps higher risk and newer rows first", () => {
  const compare = compareAdminReviewSort(
    {
      pointId: "point-a",
      latestCreatedAt: "2026-04-01T10:00:00.000Z",
      reviewStatus: "pending_review",
      riskScore: 40,
    },
    {
      pointId: "point-b",
      latestCreatedAt: "2026-04-02T10:00:00.000Z",
      reviewStatus: "auto_approved",
      riskScore: 80,
    },
  );

  assert.equal(compare > 0, true);
});

test("review queue helpers bucket risk and clamp paging inputs", () => {
  assert.equal(getAdminRiskBucket(70, "pending_review"), "flagged");
  assert.equal(getAdminRiskBucket(20, "pending_review"), "pending");
  assert.equal(getAdminRiskBucket(20, "auto_approved"), "low_risk");
  assert.equal(parseAdminReviewPage("0"), 1);
  assert.equal(parseAdminReviewPage("3"), 3);
  assert.equal(parseAdminReviewLimit("200"), 48);
  assert.equal(parseAdminReviewLimit("12"), 12);
});

test("buildAdminReviewStatsFromPoints counts queue segments and eligibles", () => {
  const stats = buildAdminReviewStatsFromPoints([
    { riskScore: 85, reviewStatus: "pending_review" },
    { riskScore: 20, reviewStatus: "pending_review" },
    { riskScore: 10, reviewStatus: "auto_approved" },
  ]);

  assert.deepEqual(stats, {
    all: 3,
    flagged: 1,
    pending: 1,
    lowRisk: 1,
    eligible: 1,
  });
});
