import type { AiReviewSummaryResponse } from "../../../shared/types.js";
import { aiReviewOutputSchema } from "./outputSchemas.js";
import type { AiModelClient } from "./modelClient.js";

export interface BuildReviewSummaryInput {
  eventId: string;
  pointId: string;
  reviewStatus?: string | null;
  riskScore: number;
  reviewFlags: string[];
  riskComponents: Record<string, unknown>;
}

const PROMPT_VERSION = "review-summary-v1";

function normalizeRiskScore(input: number): number {
  if (!Number.isFinite(input)) return 0;
  return Math.max(0, Math.min(100, input));
}

export function buildReviewModelPayload(input: BuildReviewSummaryInput): Record<string, unknown> {
  return {
    eventId: input.eventId,
    pointId: input.pointId,
    reviewStatus: input.reviewStatus ?? null,
    riskScore: normalizeRiskScore(input.riskScore),
    reviewFlags: input.reviewFlags,
    riskComponents: input.riskComponents,
  };
}

export async function buildReviewSummary(
  input: BuildReviewSummaryInput,
  modelClient: AiModelClient,
): Promise<AiReviewSummaryResponse> {
  const model = await modelClient({
    task: "review_summary",
    promptVersion: PROMPT_VERSION,
    payload: buildReviewModelPayload(input),
  });

  const parsed = aiReviewOutputSchema.parse(model.json);
  return {
    ...parsed,
    modelMetadata: model.metadata,
  };
}
