import assert from "node:assert/strict";
import test from "node:test";
import { listAdminOrganizationSummaries } from "../lib/server/platform/adminStore.js";

test("admin organization summaries combine company, user, project, and record access data", async () => {
  const calls: string[] = [];
  const results = [
    { rows: [{
      id: "org-1",
      name: "Usiku Research",
      slug: "usiku-research",
      logo_url: null,
      accent_color: "#0f3d5e",
      access_status: "suspended",
      suspension_reason: "Subscription overdue",
      suspended_at: "2026-07-18T00:00:00.000Z",
      suspended_by: "admin@adl.test",
      created_at: "2026-07-17T00:00:00.000Z",
      member_count: 2,
      project_count: 1,
      record_count: 19,
      pending_review_count: 4,
    }] },
    { rows: [{
      organization_id: "org-1",
      user_id: "owner@usiku.co.ke",
      role: "owner",
      created_at: "2026-07-17T00:00:00.000Z",
      name: "Usiku Owner",
      email: "owner@usiku.co.ke",
      phone: null,
      suspended_until: null,
    }] },
    { rows: [{
      id: "project-1",
      organization_id: "org-1",
      name: "Retail Census",
      status: "active",
      coverage_scope: "country",
      coverage_label: "Kenya",
      record_count: 19,
      pending_review_count: 4,
      approved_count: 14,
      rejected_count: 1,
    }] },
  ];
  let index = 0;
  const queryFn = async (text: string) => {
    calls.push(text);
    const result = results[index++] ?? { rows: [] };
    return { ...result, rowCount: result.rows.length };
  };

  const organizations = await listAdminOrganizationSummaries({ queryFn });
  assert.equal(calls.length, 3);
  assert.match(calls[0], /platform_organizations/i);
  assert.match(calls[1], /user_profiles/i);
  assert.match(calls[2], /platform_records/i);
  assert.equal(organizations[0].accessStatus, "suspended");
  assert.equal(organizations[0].recordCount, 19);
  assert.equal(organizations[0].members[0].role, "owner");
  assert.equal(organizations[0].projects[0].approvedCount, 14);
});
