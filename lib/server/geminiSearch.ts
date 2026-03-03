import { GoogleGenAI } from "@google/genai";

const SEARCH_MODEL = "gemini-2.5-flash";

export class GeminiConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GeminiConfigError";
  }
}

export class GeminiUpstreamError extends Error {
  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "GeminiUpstreamError";
    if (cause !== undefined) {
      (this as Error & { cause?: unknown }).cause = cause;
    }
  }
}

export interface GeminiSearchResult {
  text: string;
  grounding: unknown[];
}

let client: GoogleGenAI | null = null;

function getGeminiClient(): GoogleGenAI {
  if (client) return client;
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new GeminiConfigError("GEMINI_API_KEY is not configured");
  }
  client = new GoogleGenAI({ apiKey });
  return client;
}

export async function searchLocationsServer(query: string, lat?: number, lng?: number): Promise<GeminiSearchResult> {
  const ai = getGeminiClient();
  const hasCoordinates = Number.isFinite(lat) && Number.isFinite(lng);

  try {
    const response = await ai.models.generateContent({
      model: SEARCH_MODEL,
      contents: `Find ${query} in Bonamoussadi, Douala, Cameroon. Provide names and exact locations.`,
      config: {
        tools: [{ googleMaps: {} }],
        toolConfig: {
          retrievalConfig: {
            latLng: hasCoordinates ? { latitude: lat as number, longitude: lng as number } : undefined,
          },
        },
      },
    });

    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
    return {
      text: typeof response.text === "string" ? response.text : "",
      grounding: Array.isArray(groundingChunks) ? groundingChunks : [],
    };
  } catch (error) {
    throw new GeminiUpstreamError("Gemini request failed", error);
  }
}
