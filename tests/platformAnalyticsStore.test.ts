import assert from "node:assert/strict";
import test from "node:test";
import {
  getOrganizationDeltaSnapshot,
  listOrganizationAgentPerformance,
  listOrganizationCategoryBreakdown,
  listOrganizationLeaderboard,
  listOrganizationSpatialCells,
  listOrganizationWeeklyTrends,
} from "../lib/server/platform/analyticsStore.js";

const ORG_ID = "5a2f8f18-0000-4000-8000-000000000001";

test("organization analytics queries always bind organization_id as the first parameter", async () => {
  const calls: Array<{ sql: string; params: unknown[] }> = [];
  const rows = [
    { total_records: 0 },
    { week_start: "2026-07-27", value: 1, moving_avg: 1 },
    { category: "pharmacy", count: 1 },
    { captured_by: "agent@acme.com", submissions: 1, approved: 1, flags: 0 },
    {
      capture_lat: 4.05,
      capture_lng: 9.7,
      evidence: { photos: [] },
      status: "approved",
      created_at: "2026-07-29T00:00:00.000Z",
      captured_by: "agent@acme.com",
    },
    {
      captured_by: "agent@acme.com",
      contributions: 2,
      approved: 1,
      last_contribution_at: "2026-07-29T00:00:00.000Z",
      vertical_breakdown: { pharmacy: 2 },
    },
  ];
  const queryFn = async (sql: string, params: unknown[] = []) => {
    calls.push({ sql, params });
    return { rows: [rows[calls.length - 1]], rowCount: 1 };
  };

  await getOrganizationDeltaSnapshot(ORG_ID, { queryFn });
  await listOrganizationWeeklyTrends({ organizationId: ORG_ID, weeks: 4 }, { queryFn });
  await listOrganizationCategoryBreakdown(ORG_ID, { queryFn });
  await listOrganizationAgentPerformance(ORG_ID, { queryFn });
  await listOrganizationSpatialCells({ organizationId: ORG_ID }, { queryFn });
  await listOrganizationLeaderboard(ORG_ID, { queryFn });

  assert.equal(calls.length, 6);
  for (const call of calls) {
    assert.match(call.sql, /WHERE organization_id = \$1/);
    assert.equal(call.params[0], ORG_ID);
  }
});

test("organization spatial cells render only scoped records with valid GPS", async () => {
  const cells = await listOrganizationSpatialCells({ organizationId: ORG_ID }, {
    queryFn: async (_sql, params) => {
      assert.equal(params?.[0], ORG_ID);
      return {
        rows: [
          {
            capture_lat: 4.05,
            capture_lng: 9.7,
            evidence: { photos: ["https://example.test/photo.jpg"] },
            status: "approved",
            created_at: "2026-07-29T00:00:00.000Z",
            captured_by: "collector@acme.com",
          },
          {
            capture_lat: null,
            capture_lng: null,
            evidence: { photos: [], gps: { latitude: 4.0501, longitude: 9.7001 } },
            status: "pending_review",
            created_at: "2026-07-28T00:00:00.000Z",
            captured_by: "collector-2@acme.com",
          },
        ],
        rowCount: 2,
      };
    },
  });

  assert.equal(cells.length, 1);
  assert.equal(cells[0]?.totalPoints, 2);
  assert.equal(cells[0]?.completedPoints, 1);
  assert.equal(cells[0]?.operatorDiversity, 2);
  assert.match(cells[0]?.cellId ?? "", /^[0-9bcdefghjkmnpqrstuvwxyz]{6}$/);
});

test("organization snapshot derives rates only from the scoped aggregate row", async () => {
  const snapshot = await getOrganizationDeltaSnapshot(ORG_ID, {
    queryFn: async () => ({
      rows: [{
        total_records: 10,
        approved_records: 6,
        weekly_active_contributors: 3,
        median_age_days: 2.25,
        avg_age_days: 3.75,
        events_with_fraud_check: 4,
        mismatch_events: 1,
        pending_review: 2,
        high_risk_events: 1,
        enriched_records: 8,
      }],
      rowCount: 1,
    }),
  });

  assert.equal(snapshot.verification.verificationRatePct, 60);
  assert.equal(snapshot.fraud.fraudRatePct, 25);
  assert.equal(snapshot.enrichmentRatePct, 80);
  assert.equal(snapshot.reviewQueue.pendingReview, 2);
});
