import { apiJson } from "./api.js";
import type {
  AiAnalyticsResponse,
  AiExtractionResponse,
  AiReviewSummaryResponse,
  SubmissionCategory,
  SubmissionDetails,
  SubmissionLocation,
} from "../../shared/types";

export interface AiSearchRequest {
  query: string;
  lat?: number;
  lng?: number;
}

export interface AiSearchResponse {
  text: string;
  grounding: unknown[];
}

export async function searchLocations(payload: AiSearchRequest): Promise<AiSearchResponse> {
  return apiJson<AiSearchResponse>("/api/ai/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}

export interface AiExtractSubmissionPayload {
  category?: SubmissionCategory | string | null;
  imageData?: string;
  photoUrl?: string;
  location: SubmissionLocation;
  language: "en" | "fr";
  draftDetails?: SubmissionDetails | Record<string, unknown>;
}

export async function extractSubmission(payload: AiExtractSubmissionPayload): Promise<AiExtractionResponse> {
  return apiJson<AiExtractionResponse>("/api/ai/search?view=extract-submission", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function getAiReviewSummary(eventId: string): Promise<AiReviewSummaryResponse> {
  return apiJson<AiReviewSummaryResponse>("/api/ai/search?view=review-summary", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ eventId }),
  });
}

export async function askAnalyticsAssistant(payload: {
  question: string;
  vertical?: string;
  zone?: string;
  dateRange?: { from: string; to: string };
}): Promise<AiAnalyticsResponse> {
  return apiJson<AiAnalyticsResponse>("/api/ai/search?view=analytics-query", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}
