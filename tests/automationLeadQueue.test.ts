import assert from "node:assert/strict";
import test from "node:test";
import { GET as getAutomationLeads, POST as postAutomationLeads } from "../api/intake/leads/index.js";
import { PATCH as patchAutomationLead } from "../api/intake/leads/[id].js";
import {
  classifyAutomationLead,
  deriveAutomationRunStatus,
  nextAutomationLeadStatusForAction,
  preserveAutomationLeadStatus,
} from "../lib/server/automationLeads.js";
import type { LeadCandidateInput, ProjectedPoint, SubmissionCategory } from "../shared/types.js";

function point(category: SubmissionCategory, pointId: string, latitude: number, longitude: number, name: string): ProjectedPoint {
  return {
    id: pointId,
    pointId,
    category,
    location: { latitude, longitude },
    details: { name, siteName: name },
    createdAt: "2026-03-01T00:00:00.000Z",
    updatedAt: "2026-03-01T00:00:00.000Z",
    gaps: [],
    eventsCount: 1,
    eventIds: [`evt-${pointId}`],
  };
}

function withAutomationSecret<T>(fn: () => Promise<T> | T): Promise<T> {
  const previous = process.env.AUTOMATION_SECRET;
  process.env.AUTOMATION_SECRET = "test-secret";
  return Promise.resolve(fn()).finally(() => {
    if (previous === undefined) delete process.env.AUTOMATION_SECRET;
    else process.env.AUTOMATION_SECRET = previous;
  });
}

test("classifyAutomationLead rejects leads outside Bonamoussadi", () => {
  const lead: LeadCandidateInput = {
    sourceRecordId: "osm:1",
    category: "pharmacy",
    location: { latitude: 3.85, longitude: 11.5 },
    normalizedDetails: { name: "Far pharmacy" },
  };

  const result = classifyAutomationLead(lead, []);
  assert.equal(result.status, "rejected_out_of_zone");
  assert.equal(result.zoneId, null);
});

test("classifyAutomationLead normalizes aliases and marks strong matches as existing", () => {
  const lead: LeadCandidateInput = {
    sourceRecordId: "fuel-1",
    category: "FUEL",
    location: { latitude: 4.08621, longitude: 9.73541 },
    normalizedDetails: { name: "Total Bonamoussadi" },
  };
  const points: ProjectedPoint[] = [
    point("fuel_station", "fuel-s16gdp-001", 4.0862, 9.7354, "Total Bonamoussadi"),
  ];

  const result = classifyAutomationLead(lead, points);
  assert.equal(result.category, "fuel_station");
  assert.equal(result.status, "matched_existing");
  assert.equal(result.matchPointId, "fuel-s16gdp-001");
  assert.ok((result.matchConfidence ?? 0) >= 0.85);
});

test("classifyAutomationLead marks actionable new leads ready for assignment", () => {
  const lead: LeadCandidateInput = {
    sourceRecordId: "billboard-1",
    category: "billboard",
    sourceUrl: "https://example.com/inventory/1",
    location: { latitude: 4.087, longitude: 9.739 },
    normalizedDetails: { name: "Acmar Carrefour 1" },
    evidenceUrls: ["https://example.com/photo.jpg"],
  };

  const result = classifyAutomationLead(lead, []);
  assert.equal(result.status, "ready_for_assignment");
  assert.equal(result.zoneId !== null, true);
});

test("deriveAutomationRunStatus returns partial when some records fail", () => {
  assert.equal(deriveAutomationRunStatus(5, 1, 0), "completed");
  assert.equal(deriveAutomationRunStatus(3, 0, 2), "partial");
  assert.equal(deriveAutomationRunStatus(0, 0, 4), "failed");
});

test("lead action helpers map to terminal statuses and preserve manual states", () => {
  assert.equal(nextAutomationLeadStatusForAction("reject"), "rejected_manual");
  assert.equal(nextAutomationLeadStatusForAction("mark_assigned"), "assignment_created");
  assert.equal(nextAutomationLeadStatusForAction("mark_verified"), "verified");
  assert.equal(nextAutomationLeadStatusForAction("promote_to_import_candidate"), "import_candidate");
  assert.equal(preserveAutomationLeadStatus("assignment_created", "ready_for_assignment"), "assignment_created");
  assert.equal(preserveAutomationLeadStatus(null, "ready_for_assignment"), "ready_for_assignment");
});

test("automation lead POST rejects unauthorized requests", async () => {
  await withAutomationSecret(async () => {
    const request = new Request("http://localhost/api/intake/leads", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });

    const response = await postAutomationLeads(request);
    assert.equal(response.status, 401);
  });
});

test("automation lead POST validates payload before touching storage", async () => {
  await withAutomationSecret(async () => {
    const request = new Request("http://localhost/api/intake/leads", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer test-secret",
      },
      body: JSON.stringify({ runKey: "run-1", workflowName: "osm-refresh", sourceSystem: "osm", leads: [] }),
    });

    const response = await postAutomationLeads(request);
    assert.equal(response.status, 400);
  });
});

test("automation lead GET validates filters before querying", async () => {
  await withAutomationSecret(async () => {
    const request = new Request("http://localhost/api/intake/leads?status=bad-status", {
      method: "GET",
      headers: { authorization: "Bearer test-secret" },
    });

    const response = await getAutomationLeads(request);
    assert.equal(response.status, 400);
  });
});

test("automation lead PATCH validates body before updating", async () => {
  await withAutomationSecret(async () => {
    const request = new Request("http://localhost/api/intake/leads/123", {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer test-secret",
      },
      body: JSON.stringify({ action: "bad-action" }),
    });

    const response = await patchAutomationLead(request);
    assert.equal(response.status, 400);
  });
});
