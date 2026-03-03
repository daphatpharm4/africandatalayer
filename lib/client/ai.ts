import { apiJson } from "./api.js";

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
