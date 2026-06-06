import {
  buildAdminBulkApproveRequestBody,
  buildAdminReviewQueueRequestPath,
  type AdminBulkApprovePlan,
  type AdminRiskFilter,
} from "../shared/adminReviewQueue.js";

export const ADMIN_REVIEW_PAGE_LIMIT = 24;

export function buildAdminQueueReviewRequestPath(page: number, riskFilter: AdminRiskFilter, userFilter: string): string {
  return buildAdminReviewQueueRequestPath({
    page,
    limit: ADMIN_REVIEW_PAGE_LIMIT,
    riskFilter,
    userFilter,
  });
}

export function buildAdminQueueBatchApproveRequest(
  plan: Pick<AdminBulkApprovePlan, "eventIds">,
): { path: string; init: RequestInit } {
  return {
    path: "/api/submissions/batch-review",
    init: {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildAdminBulkApproveRequestBody(plan)),
    },
  };
}
