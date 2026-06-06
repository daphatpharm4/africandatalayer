import assert from "node:assert/strict";
import test from "node:test";
import {
  buildAdminQueueBatchApproveRequest,
  buildAdminQueueReviewRequestPath,
} from "../lib/client/adminQueueApi.js";
import {
  buildAdminBulkApprovePlan,
  buildAdminBulkApproveRequestBody,
  buildAdminReviewStatsFromPoints,
  buildAdminReviewQueueRequestPath,
  buildAdminSubmissionGroups,
  compareAdminReviewSort,
  getAdminRiskBucket,
  getReviewFinality,
  isAdminSubmissionGroupBulkApprovable,
  parseAdminReviewLimit,
  parseAdminReviewPage,
  pruneAdminBulkSelection,
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
  reviewDecision?: "approved" | "rejected" | "flagged";
  reviewedAt?: string;
  reviewedBy?: string;
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
        reviewDecision: input.reviewDecision,
        reviewedAt: input.reviewedAt,
        reviewedBy: input.reviewedBy,
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

test("buildAdminReviewQueueRequestPath sends exact agent and risk params", () => {
  const path = buildAdminReviewQueueRequestPath({
    page: 2,
    limit: 24,
    riskFilter: "flagged",
    userFilter: " agent-2 ",
  });
  const url = new URL(path, "http://localhost");

  assert.equal(url.pathname, "/api/submissions");
  assert.equal(url.searchParams.get("view"), "review_queue");
  assert.equal(url.searchParams.get("scope"), "global");
  assert.equal(url.searchParams.get("page"), "2");
  assert.equal(url.searchParams.get("limit"), "24");
  assert.equal(url.searchParams.get("risk"), "flagged");
  assert.equal(url.searchParams.get("userId"), "agent-2");
});

test("AdminQueue review request boundary uses filter state in the actual API path", () => {
  // This repo does not have a DOM component test harness; AdminQueue calls this exported boundary before apiJson.
  const path = buildAdminQueueReviewRequestPath(3, "pending", "agent-7");
  const url = new URL(path, "http://localhost");

  assert.equal(url.pathname, "/api/submissions");
  assert.equal(url.searchParams.get("view"), "review_queue");
  assert.equal(url.searchParams.get("scope"), "global");
  assert.equal(url.searchParams.get("page"), "3");
  assert.equal(url.searchParams.get("limit"), "24");
  assert.equal(url.searchParams.get("risk"), "pending");
  assert.equal(url.searchParams.get("userId"), "agent-7");
});

test("buildAdminReviewQueueRequestPath omits cleared filters", () => {
  const path = buildAdminReviewQueueRequestPath({
    page: 1,
    limit: 24,
    riskFilter: "all",
    userFilter: "",
  });
  const url = new URL(path, "http://localhost");

  assert.equal(url.searchParams.has("risk"), false);
  assert.equal(url.searchParams.has("userId"), false);
});

test("getReviewFinality marks pending submissions as not finalized", () => {
  const finality = getReviewFinality({ reviewStatus: "pending_review" });
  assert.equal(finality.state, "pending");
  assert.equal(finality.isFinalized, false);
  assert.equal(finality.decision, null);
});

test("getReviewFinality treats auto_approved and explicit reviewDecision as approved", () => {
  const fromStatus = getReviewFinality({ reviewStatus: "auto_approved" });
  assert.equal(fromStatus.state, "approved");
  assert.equal(fromStatus.isFinalized, true);
  assert.equal(fromStatus.decision, "approved");

  const fromDecision = getReviewFinality({
    reviewStatus: "pending_review",
    reviewDecision: "approved",
    reviewedAt: "2026-05-08T12:00:00.000Z",
    reviewedBy: "reviewer-1",
  });
  assert.equal(fromDecision.state, "approved");
  assert.equal(fromDecision.isFinalized, true);
  assert.equal(fromDecision.reviewedAt, "2026-05-08T12:00:00.000Z");
  assert.equal(fromDecision.reviewedBy, "reviewer-1");
});

test("getReviewFinality recognizes rejection from reviewDecision even when reviewStatus stays pending", () => {
  const finality = getReviewFinality({
    reviewStatus: "pending_review",
    reviewDecision: "rejected",
    reviewedAt: "2026-05-08T13:30:00.000Z",
  });
  assert.equal(finality.state, "rejected");
  assert.equal(finality.isFinalized, true);
  assert.equal(finality.decision, "rejected");
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

test("buildAdminReviewStatsFromPoints excludes finalized pending rows from eligibles", () => {
  const stats = buildAdminReviewStatsFromPoints([
    { riskScore: 20, reviewStatus: "pending_review", details: { reviewStatus: "pending_review" } },
    {
      riskScore: 25,
      reviewStatus: "pending_review",
      details: {
        reviewStatus: "pending_review",
        reviewDecision: "approved",
        reviewedAt: "2026-05-08T12:00:00.000Z",
      },
    },
  ]);

  assert.equal(stats.pending, 2);
  assert.equal(stats.eligible, 1);
});

test("buildAdminBulkApprovePlan posts only eligible selected event IDs and counts skips", () => {
  const groups = buildAdminSubmissionGroups([
    makeEvent({
      id: "event-eligible",
      pointId: "point-eligible",
      createdAt: "2026-04-01T10:00:00.000Z",
      riskScore: 20,
      reviewStatus: "pending_review",
      siteName: "Eligible Pharmacy",
    }),
    makeEvent({
      id: "event-finalized",
      pointId: "point-finalized",
      createdAt: "2026-04-01T11:00:00.000Z",
      riskScore: 25,
      reviewStatus: "pending_review",
      reviewDecision: "approved",
      reviewedAt: "2026-04-01T12:00:00.000Z",
      siteName: "Finalized Pharmacy",
    }),
    makeEvent({
      id: "event-high-risk",
      pointId: "point-high-risk",
      createdAt: "2026-04-01T12:00:00.000Z",
      riskScore: 80,
      reviewStatus: "pending_review",
      siteName: "High Risk Pharmacy",
    }),
  ]);

  const eligible = groups.find((group) => group.pointId === "point-eligible");
  const finalized = groups.find((group) => group.pointId === "point-finalized");
  const highRisk = groups.find((group) => group.pointId === "point-high-risk");
  assert.ok(eligible);
  assert.ok(finalized);
  assert.ok(highRisk);
  assert.equal(isAdminSubmissionGroupBulkApprovable(eligible), true);
  assert.equal(isAdminSubmissionGroupBulkApprovable(finalized), false);
  assert.equal(isAdminSubmissionGroupBulkApprovable(highRisk), false);

  const plan = buildAdminBulkApprovePlan(
    groups,
    new Set(["point-eligible", "point-finalized", "point-high-risk"]),
  );

  assert.deepEqual(plan.eventIds, ["event-eligible"]);
  assert.equal(plan.consideredCount, 3);
  assert.equal(plan.skippedFinalizedCount, 1);
  assert.equal(plan.skippedIneligibleCount, 1);
  assert.equal(plan.skippedCount, 2);
  assert.equal(plan.hasExplicitSelection, true);
  assert.deepEqual(buildAdminBulkApproveRequestBody(plan), {
    eventIds: ["event-eligible"],
    decision: "approved",
  });
});

test("AdminQueue batch approve request boundary posts only selected eligible event IDs", () => {
  const groups = buildAdminSubmissionGroups([
    makeEvent({
      id: "event-eligible",
      pointId: "point-eligible",
      createdAt: "2026-04-01T10:00:00.000Z",
      riskScore: 20,
      reviewStatus: "pending_review",
    }),
    makeEvent({
      id: "event-finalized",
      pointId: "point-finalized",
      createdAt: "2026-04-01T11:00:00.000Z",
      riskScore: 20,
      reviewStatus: "pending_review",
      reviewDecision: "approved",
      reviewedAt: "2026-04-01T12:00:00.000Z",
    }),
  ]);
  const plan = buildAdminBulkApprovePlan(groups, new Set(["point-eligible", "point-finalized"]));
  const request = buildAdminQueueBatchApproveRequest(plan);

  assert.equal(request.path, "/api/submissions/batch-review");
  assert.equal(request.init.method, "POST");
  assert.deepEqual(request.init.headers, { "Content-Type": "application/json" });
  assert.equal(request.init.body, JSON.stringify({ eventIds: ["event-eligible"], decision: "approved" }));
});

test("buildAdminBulkApprovePlan does not approve anything when selection is empty", () => {
  const groups = buildAdminSubmissionGroups([
    makeEvent({
      id: "event-eligible",
      pointId: "point-eligible",
      createdAt: "2026-04-01T10:00:00.000Z",
      riskScore: 20,
      reviewStatus: "pending_review",
    }),
    makeEvent({
      id: "event-finalized",
      pointId: "point-finalized",
      createdAt: "2026-04-01T11:00:00.000Z",
      riskScore: 20,
      reviewStatus: "pending_review",
      reviewDecision: "approved",
      reviewedAt: "2026-04-01T12:00:00.000Z",
    }),
  ]);

  const plan = buildAdminBulkApprovePlan(groups, new Set());

  assert.deepEqual(plan.eventIds, []);
  assert.equal(plan.targetGroups.length, 0);
  assert.equal(plan.consideredCount, 0);
  assert.equal(plan.skippedCount, 0);
  assert.equal(plan.hasExplicitSelection, false);
});

test("pruneAdminBulkSelection removes selected rows that became ineligible", () => {
  const groups = buildAdminSubmissionGroups([
    makeEvent({
      id: "event-eligible",
      pointId: "point-eligible",
      createdAt: "2026-04-01T10:00:00.000Z",
      riskScore: 20,
      reviewStatus: "pending_review",
    }),
    makeEvent({
      id: "event-finalized",
      pointId: "point-finalized",
      createdAt: "2026-04-01T11:00:00.000Z",
      riskScore: 20,
      reviewStatus: "pending_review",
      reviewDecision: "approved",
      reviewedAt: "2026-04-01T12:00:00.000Z",
    }),
    makeEvent({
      id: "event-high-risk",
      pointId: "point-high-risk",
      createdAt: "2026-04-01T12:00:00.000Z",
      riskScore: 80,
      reviewStatus: "pending_review",
    }),
  ]);

  assert.deepEqual(
    [...pruneAdminBulkSelection(groups, new Set(["point-eligible", "point-finalized", "point-high-risk", "missing"]))],
    ["point-eligible"],
  );
});
