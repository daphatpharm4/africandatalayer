import type { AdminReviewQueueResponse } from "../../lib/shared/adminReviewQueue";
import type { AdminSubmissionEvent, AssignmentPlannerContext, LeadCandidate } from "../../shared/types";
import { adminFraudCheckByPointId, agentAssignments, PLACEHOLDER_IMAGE_DATA_URL, pointEvents } from "./shared";
import type { MockApiResolver } from "./types";

const adminReviewEvents: AdminSubmissionEvent[] = [
  {
    event: pointEvents[0]!,
    user: {
      id: "agent.bonamoussadi@adl.test",
      name: "Chantal Field Ops",
      email: "agent.bonamoussadi@adl.test",
      avatarPreset: "baobab",
      trustScore: 91,
      trustTier: "trusted",
      suspendedUntil: null,
    },
    fraudCheck: adminFraudCheckByPointId["pt-pharmacy-001"],
  },
];

const reviewQueue: AdminReviewQueueResponse = {
  groups: [
    {
      pointId: "pt-pharmacy-001",
      events: adminReviewEvents,
      category: "pharmacy",
      siteName: "Bonamoussadi Pharmacy Center",
      latestEvent: adminReviewEvents[0]!,
      createdEvent: adminReviewEvents[0]!,
      enrichEvents: [],
      allPhotos: [
        {
          url: PLACEHOLDER_IMAGE_DATA_URL,
          eventType: "CREATE_EVENT",
          createdAt: pointEvents[0]!.createdAt,
          metadata: adminFraudCheckByPointId["pt-pharmacy-001"].primaryPhoto,
        },
      ],
      summary: {
        riskScore: 24,
        reviewStatus: "pending_review",
        riskBucket: "pending",
        contributorCount: 1,
        evidenceCount: 1,
        staleHours: 6,
        submissionDistanceKm: 0.04,
        ipDistanceKm: 0.22,
        hasSubmissionMismatch: false,
        hasIpMismatch: false,
        trustScore: 91,
        trustTier: "trusted",
        isLowEndDevice: true,
      },
    },
  ],
  reviewers: [
    {
      id: "agent.bonamoussadi@adl.test",
      name: "Chantal Field Ops",
    },
  ],
  stats: {
    all: 1,
    flagged: 0,
    pending: 1,
    lowRisk: 0,
    eligible: 1,
  },
  page: 1,
  totalPages: 1,
  totalGroups: 1,
  limit: 24,
};

const assignmentPlannerContext: AssignmentPlannerContext = {
  zones: [
    {
      id: "zone-bonamoussadi-core",
      label: "Bonamoussadi Core North",
      bounds: {
        south: 4.0848,
        west: 9.7362,
        north: 4.0909,
        east: 9.7446,
      },
    },
    {
      id: "zone-bonamoussadi-east",
      label: "Bonamoussadi East",
      bounds: {
        south: 4.0853,
        west: 9.744,
        north: 4.0915,
        east: 9.751,
      },
    },
  ],
  agents: [
    {
      id: "agent.bonamoussadi@adl.test",
      name: "Chantal Field Ops",
      email: "agent.bonamoussadi@adl.test",
    },
    {
      id: "field.reviewer@adl.test",
      name: "Serge Route Mapper",
      email: "field.reviewer@adl.test",
    },
  ],
};

const automationLeads: LeadCandidate[] = [
  {
    id: "lead-pharmacy-001",
    runId: "run-bonamoussadi-sync",
    sourceSystem: "n8n-osm-refresh",
    sourceRecordId: "osm-1234",
    sourceUrl: "https://example.com/osm/1234",
    category: "pharmacy",
    zoneId: "zone-bonamoussadi-core",
    location: { latitude: 4.0892, longitude: 9.7412 },
    normalizedDetails: {
      name: "Candidate Care Pharmacy",
      siteName: "Candidate Care Pharmacy",
      confidenceScore: 78,
      source: "automation",
    },
    rawPayload: {
      amenity: "pharmacy",
      source: "osm",
    },
    evidenceUrls: [PLACEHOLDER_IMAGE_DATA_URL],
    freshnessAt: "2026-04-11T08:00:00.000Z",
    matchPointId: null,
    matchConfidence: null,
    status: "needs_field_verify",
    priority: "high",
    assignmentId: null,
    createdAt: "2026-04-11T08:05:00.000Z",
    updatedAt: "2026-04-11T08:05:00.000Z",
    lastIngestedAt: "2026-04-11T08:00:00.000Z",
  },
];

export const resolveAdminApi: MockApiResolver = (url, method) => {
  if (method !== "GET") return null;

  if (url.pathname === "/api/submissions" && url.searchParams.get("view") === "review_queue") {
    return { body: reviewQueue };
  }

  if (url.pathname === "/api/submissions" && url.searchParams.get("view") === "schema_guard") {
    return {
      body: {
        ok: true,
        expected: ["pharmacy", "fuel_station", "mobile_money"],
        actual: ["pharmacy", "fuel_station", "mobile_money"],
        missing: [],
        extra: [],
      },
    };
  }

  if (url.pathname === "/api/user" && url.searchParams.get("view") === "assignment_planner_context") {
    return {
      body: {
        context: assignmentPlannerContext,
        assignments: agentAssignments,
      },
    };
  }

  if (url.pathname === "/api/intake/leads") {
    return { body: automationLeads };
  }

  return null;
};
