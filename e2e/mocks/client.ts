import type { SpatialIntelligenceResponse } from "../../shared/types";
import { clientTrendData } from "./shared";
import type { MockApiResolver } from "./types";

const snapshotRows = [
  {
    id: "snapshot-pharmacy-2026-04-11",
    snapshot_date: "2026-04-11",
    vertical_id: "pharmacy",
    total_points: 63,
    completed_points: 54,
    completion_rate: 86,
    new_count: 6,
    removed_count: 1,
    changed_count: 14,
    unchanged_count: 42,
    avg_price: null,
    week_over_week_growth: 9,
    moving_avg_4w: 56,
    anomaly_flags: [{ metric: "changed_count", zScore: 2.6, direction: "increase" }],
  },
  {
    id: "snapshot-fuel-2026-04-11",
    snapshot_date: "2026-04-11",
    vertical_id: "fuel_station",
    total_points: 24,
    completed_points: 21,
    completion_rate: 88,
    new_count: 2,
    removed_count: 0,
    changed_count: 4,
    unchanged_count: 18,
    avg_price: 855,
    week_over_week_growth: 3,
    moving_avg_4w: 22,
    anomaly_flags: [],
  },
  {
    id: "snapshot-pharmacy-2026-04-04",
    snapshot_date: "2026-04-04",
    vertical_id: "pharmacy",
    total_points: 58,
    completed_points: 49,
    completion_rate: 84,
    new_count: 4,
    removed_count: 1,
    changed_count: 10,
    unchanged_count: 43,
    avg_price: null,
    week_over_week_growth: 6,
    moving_avg_4w: 52,
    anomaly_flags: [],
  },
];

const anomalyRows = [
  {
    snapshot_date: "2026-04-11",
    vertical_id: "pharmacy",
    total_points: 63,
    anomaly_flags: [{ metric: "changed_count", zScore: 2.6, direction: "increase" }],
  },
];

const kpiSummary = {
  generatedAt: "2026-04-11T09:00:00.000Z",
  weeklyActiveContributors: 18,
  verification: {
    totalPoints: 87,
    verifiedPoints: 75,
    verificationRatePct: 86,
  },
  freshness: {
    medianAgeDays: 4,
    avgAgeDays: 6,
  },
  fraud: {
    eventsWithFraudCheck: 41,
    mismatchEvents: 2,
    fraudRatePct: 4.9,
  },
  reviewQueue: {
    pendingReview: 6,
    highRiskEvents: 1,
  },
  enrichmentRatePct: 63,
};

const weeklyRows = [
  {
    week_start: "2026-03-02",
    category: "pharmacy",
    total_events: 13,
    total_creates: 4,
    total_enrichments: 9,
    unique_users: 5,
    unique_points: 9,
  },
  {
    week_start: "2026-03-09",
    category: "pharmacy",
    total_events: 16,
    total_creates: 5,
    total_enrichments: 11,
    unique_users: 6,
    unique_points: 11,
  },
  {
    week_start: "2026-03-16",
    category: "pharmacy",
    total_events: 18,
    total_creates: 4,
    total_enrichments: 14,
    unique_users: 6,
    unique_points: 12,
  },
  {
    week_start: "2026-03-23",
    category: "pharmacy",
    total_events: 21,
    total_creates: 6,
    total_enrichments: 15,
    unique_users: 7,
    unique_points: 14,
  },
  {
    week_start: "2026-03-30",
    category: "pharmacy",
    total_events: 24,
    total_creates: 7,
    total_enrichments: 17,
    unique_users: 8,
    unique_points: 16,
  },
  {
    week_start: "2026-04-06",
    category: "pharmacy",
    total_events: 28,
    total_creates: 8,
    total_enrichments: 20,
    unique_users: 9,
    unique_points: 18,
  },
  {
    week_start: "2026-04-06",
    category: "fuel_station",
    total_events: 9,
    total_creates: 2,
    total_enrichments: 7,
    unique_users: 4,
    unique_points: 6,
  },
];

const recentDeltas = {
  deltas: [
    {
      id: "delta-pharmacy-hours",
      snapshot_date: "2026-04-11",
      vertical_id: "pharmacy",
      point_id: "pt-pharmacy-001",
      delta_type: "changed",
      delta_field: "openingHours",
      delta_summary: "Bonamoussadi Pharmacy Center extended to 24/7 service.",
      delta_magnitude: 1,
      delta_direction: "increase",
      significance: "high",
      is_publishable: true,
      is_from_partial_snapshot: false,
    },
    {
      id: "delta-pharmacy-new",
      snapshot_date: "2026-04-11",
      vertical_id: "pharmacy",
      point_id: "pt-pharmacy-008",
      delta_type: "new",
      delta_field: null,
      delta_summary: "New pharmacy signal detected near Carrefour Market.",
      delta_magnitude: null,
      delta_direction: "not_applicable",
      significance: "medium",
      is_publishable: true,
      is_from_partial_snapshot: false,
    },
  ],
};

const spatialIntelligence: SpatialIntelligenceResponse = {
  snapshotDate: "2026-04-11",
  verticalId: "pharmacy",
  totalCells: 3,
  totalPoints: 63,
  narrative:
    "Bonamoussadi pharmacies cluster most strongly along the commercial spine where verified point density, repeated weekly change, and high photo evidence reinforce one another. The top-ranked cell is commercially active and well evidenced, while adjacent cells still show meaningful coverage gaps worth field follow-up.",
  cells: [
    {
      cellId: "s0wzm8",
      verticalId: "pharmacy",
      snapshotDate: "2026-04-11",
      center: { latitude: 4.0881, longitude: 9.7397 },
      totalPoints: 17,
      completedPoints: 15,
      completionRate: 88,
      avgConfidenceScore: 92,
      photoCoverageRate: 94,
      recentActivityRate: 81,
      medianFreshnessDays: 3,
      publishableChangeCount: 6,
      newCount: 2,
      removedCount: 0,
      changedCount: 4,
      operatorDiversity: 5,
      marketSignalScore: 89,
      opportunityScore: 91,
      coverageGapScore: 33,
      changeSignalScore: 86,
      drivers: [
        { label: "Density", impact: "positive", score: 0.92, evidence: "Top-decile point concentration in the current snapshot." },
        { label: "Evidence", impact: "positive", score: 0.94, evidence: "Photo coverage is well above the vertical average." },
        { label: "Freshness", impact: "positive", score: 0.81, evidence: "Most updates are less than one week old." },
      ],
      caveats: ["Small remaining phone/contact gaps on two points."],
      summary:
        "This is the strongest pharmacy cell in Bonamoussadi because density, recent publishable changes, and photo-backed evidence are all above average.",
    },
    {
      cellId: "s0wzm9",
      verticalId: "pharmacy",
      snapshotDate: "2026-04-11",
      center: { latitude: 4.0893, longitude: 9.7422 },
      totalPoints: 11,
      completedPoints: 7,
      completionRate: 64,
      avgConfidenceScore: 76,
      photoCoverageRate: 58,
      recentActivityRate: 67,
      medianFreshnessDays: 8,
      publishableChangeCount: 3,
      newCount: 1,
      removedCount: 1,
      changedCount: 2,
      operatorDiversity: 4,
      marketSignalScore: 72,
      opportunityScore: 68,
      coverageGapScore: 79,
      changeSignalScore: 61,
      drivers: [
        { label: "Coverage gap", impact: "positive", score: 0.79, evidence: "Multiple fields remain incomplete relative to nearby cells." },
        { label: "Photos", impact: "negative", score: 0.42, evidence: "Visual evidence coverage is below the vertical average." },
        { label: "Freshness", impact: "neutral", score: 0.5, evidence: "Mixed update recency in the last two weeks." },
      ],
      caveats: ["Client-facing claims should stay conservative until evidence density improves."],
      summary:
        "This adjacent cell matters because signal is emerging, but coverage and evidence quality are still too uneven for strong claims.",
    },
    {
      cellId: "s0wzmb",
      verticalId: "pharmacy",
      snapshotDate: "2026-04-11",
      center: { latitude: 4.0867, longitude: 9.7368 },
      totalPoints: 9,
      completedPoints: 8,
      completionRate: 89,
      avgConfidenceScore: 87,
      photoCoverageRate: 83,
      recentActivityRate: 54,
      medianFreshnessDays: 11,
      publishableChangeCount: 2,
      newCount: 0,
      removedCount: 0,
      changedCount: 2,
      operatorDiversity: 3,
      marketSignalScore: 64,
      opportunityScore: 62,
      coverageGapScore: 41,
      changeSignalScore: 55,
      drivers: [
        { label: "Confidence", impact: "positive", score: 0.87, evidence: "Strong trust and completion indicators." },
        { label: "Change", impact: "neutral", score: 0.55, evidence: "Change signal is present but not accelerating." },
      ],
      caveats: ["Fewer operators than the top-ranked cell."],
      summary:
        "This western cell is credible and fairly complete, but it is less commercially active than the top-ranked cluster.",
    },
  ],
};

export const resolveClientApi: MockApiResolver = (url, method) => {
  if (method !== "GET") return null;

  if (url.pathname === "/api/analytics" && url.searchParams.get("view") === "kpi_summary") {
    return { body: kpiSummary };
  }

  if (url.pathname === "/api/analytics" && url.searchParams.get("view") === "kpi_weekly") {
    return { body: weeklyRows };
  }

  if (url.pathname === "/api/analytics" && url.searchParams.get("view") === "snapshots") {
    return { body: snapshotRows };
  }

  if (url.pathname === "/api/analytics" && url.searchParams.get("view") === "anomalies") {
    return { body: anomalyRows };
  }

  if (
    url.pathname === "/api/analytics"
    && url.searchParams.get("view") === "trends"
    && url.searchParams.get("vertical") === "pharmacy"
  ) {
    return { body: { data: clientTrendData } };
  }

  if (
    url.pathname === "/api/analytics"
    && url.searchParams.get("view") === "deltas"
    && url.searchParams.get("vertical") === "pharmacy"
  ) {
    return { body: recentDeltas };
  }

  if (
    url.pathname === "/api/analytics"
    && url.searchParams.get("view") === "spatial_intelligence"
    && url.searchParams.get("vertical") === "pharmacy"
  ) {
    return { body: spatialIntelligence };
  }

  return null;
};
