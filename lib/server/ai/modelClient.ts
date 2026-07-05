export type AiTask = "extract_submission" | "review_summary" | "analytics_query" | "report_draft";

export interface AiGenerateInput {
  task: AiTask;
  promptVersion: string;
  payload: Record<string, unknown>;
}

export interface AiGenerateOutput {
  json: unknown;
  metadata: {
    provider: string;
    model: string;
    modelVersion: string | null;
    promptVersion: string;
    confidence: number;
  };
}

export type AiModelClient = (input: AiGenerateInput) => Promise<AiGenerateOutput>;

export class AiModelUpstreamError extends Error {
  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "AiModelUpstreamError";
    if (cause !== undefined) {
      (this as Error & { cause?: unknown }).cause = cause;
    }
  }
}

function clampConfidence(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function asFacts(input: unknown): Array<{ label: string; value: string | number; source: string }> {
  if (!Array.isArray(input)) return [];
  return input.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const record = item as Record<string, unknown>;
    const label = typeof record.label === "string" && record.label.trim() ? record.label.trim() : null;
    const source = typeof record.source === "string" && record.source.trim() ? record.source.trim() : null;
    const value = typeof record.value === "number" || typeof record.value === "string" ? record.value : null;
    return label && source && value !== null ? [{ label, value, source }] : [];
  });
}

function deterministicJson(input: AiGenerateInput): unknown {
  if (input.task === "extract_submission") {
    const draftDetails = input.payload.draftDetails && typeof input.payload.draftDetails === "object"
      ? input.payload.draftDetails as Record<string, unknown>
      : {};
    const fieldSuggestions = typeof draftDetails.name === "string" && draftDetails.name.trim()
      ? [{ field: "name", value: draftDetails.name.trim(), confidence: 0.5, evidence: "Provided draft detail" }]
      : [];
    return {
      detectedCategory: typeof input.payload.category === "string" ? input.payload.category : null,
      fieldSuggestions,
      qualityWarnings: [],
      confidence: fieldSuggestions.length ? 0.5 : 0,
    };
  }

  if (input.task === "review_summary") {
    const riskScore = typeof input.payload.riskScore === "number" ? input.payload.riskScore : 0;
    const flags = Array.isArray(input.payload.reviewFlags)
      ? input.payload.reviewFlags.filter((flag): flag is string => typeof flag === "string")
      : [];
    return {
      summary: riskScore > 0
        ? `Review risk score ${riskScore}. ${flags.length ? `Flags: ${flags.join(", ")}.` : "No flags supplied."}`
        : "No risk signals supplied.",
      recommendedChecks: flags.length ? ["Review flagged risk signals"] : ["Confirm submission evidence"],
      riskDrivers: flags,
      supportingEvidence: [`riskScore=${riskScore}`],
      caveats: ["AI supports reviewer triage and does not make final decisions."],
      agentFeedbackDraft: {
        en: "Please retake or enrich the submission with clearer evidence if requested.",
        fr: "Veuillez reprendre ou enrichir la soumission avec des preuves plus claires si demande.",
      },
      confidence: flags.length || riskScore > 0 ? 0.4 : 0,
    };
  }

  const facts = asFacts(input.payload.facts);
  return {
    answer: facts.length
      ? `Draft answer based on ${facts.length} aggregate fact${facts.length === 1 ? "" : "s"}.`
      : "No aggregate facts are available for this question.",
    facts,
    caveats: ["Answer is based only on aggregate ADL analytics facts available to this request."],
    suggestedNextValidations: ["Validate high-change areas before external reporting."],
    confidence: facts.length ? 0.35 : 0,
  };
}

export const deterministicAiModelClient: AiModelClient = async (input) => {
  const json = deterministicJson(input);
  const confidence = clampConfidence((json as { confidence?: unknown }).confidence);
  return {
    json,
    metadata: {
      provider: "deterministic",
      model: "test-double",
      modelVersion: null,
      promptVersion: input.promptVersion,
      confidence,
    },
  };
};

function extractJsonFromText(text: string): unknown {
  const trimmed = text.trim();
  if (!trimmed) return {};
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const candidate = fenced?.[1]?.trim() ?? trimmed;
  return JSON.parse(candidate);
}

function buildGeminiPrompt(input: AiGenerateInput): string {
  return [
    "You are an African Data Layer assistant.",
    "Return only valid JSON matching the requested output schema.",
    `Task: ${input.task}`,
    `Prompt version: ${input.promptVersion}`,
    `Payload: ${JSON.stringify(input.payload)}`,
  ].join("\n");
}

export function createGeminiAiModelClient(options: {
  apiKey?: string | null;
  model?: string;
} = {}): AiModelClient {
  const apiKey = options.apiKey ?? process.env.GEMINI_API_KEY ?? null;
  const model = options.model ?? process.env.AI_GEMINI_MODEL ?? "gemini-2.5-flash";

  return async (input) => {
    if (!apiKey?.trim()) return deterministicAiModelClient(input);
    const { getAiMode } = await import("../../edgeConfig.js");
    if ((await getAiMode()) === "deterministic") return deterministicAiModelClient(input);

    try {
      const { GoogleGenAI } = await import("@google/genai");
      const ai = new GoogleGenAI({ apiKey: apiKey.trim() });
      const response = await ai.models.generateContent({
        model,
        contents: buildGeminiPrompt(input),
        config: {
          responseMimeType: "application/json",
        },
      });
      const text = typeof response.text === "string" ? response.text : "";
      const json = extractJsonFromText(text);
      const confidence = clampConfidence((json as { confidence?: unknown }).confidence);
      return {
        json,
        metadata: {
          provider: "gemini",
          model,
          modelVersion: null,
          promptVersion: input.promptVersion,
          confidence,
        },
      };
    } catch (error) {
      throw new AiModelUpstreamError("AI model request failed", error);
    }
  };
}

export const defaultAiModelClient: AiModelClient = createGeminiAiModelClient();
