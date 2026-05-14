import type { AiAnalyticsResponse, SubmissionCategory } from "../../../shared/types.js";
import { aiAnalyticsOutputSchema } from "./outputSchemas.js";
import type { AiModelClient, AiTask } from "./modelClient.js";

export interface AnalyticsFact {
  label: string;
  value: string | number;
  source: string;
}

export interface AnalyticsAssistantInput {
  question: string;
  facts: AnalyticsFact[];
  vertical?: SubmissionCategory;
  zone?: string;
  dateRange?: {
    from: string;
    to: string;
  };
  exportFormat?: "json" | "csv" | "geojson" | "pdf";
}

const PROMPT_VERSION = "analytics-query-v1";

function buildAnalyticsPayload(input: AnalyticsAssistantInput, mode: "analytics_query" | "report_draft"): Record<string, unknown> {
  return {
    mode,
    question: input.question,
    vertical: input.vertical,
    zone: input.zone,
    dateRange: input.dateRange,
    exportFormat: input.exportFormat,
    facts: input.facts,
  };
}

async function runAnalyticsAssistant(
  input: AnalyticsAssistantInput,
  modelClient: AiModelClient,
  task: AiTask,
): Promise<AiAnalyticsResponse> {
  const model = await modelClient({
    task,
    promptVersion: PROMPT_VERSION,
    payload: buildAnalyticsPayload(input, task === "report_draft" ? "report_draft" : "analytics_query"),
  });

  const parsed = aiAnalyticsOutputSchema.parse(model.json);
  return {
    answer: parsed.answer,
    facts: parsed.facts.map((fact) => ({
      label: fact.label,
      value: fact.value ?? "",
      source: fact.source,
    })),
    caveats: parsed.caveats,
    suggestedNextValidations: parsed.suggestedNextValidations,
    confidence: parsed.confidence,
    modelMetadata: model.metadata,
  };
}

export async function answerAnalyticsQuestion(
  input: AnalyticsAssistantInput,
  modelClient: AiModelClient,
): Promise<AiAnalyticsResponse> {
  return runAnalyticsAssistant(input, modelClient, "analytics_query");
}

export async function draftAnalyticsReport(
  input: AnalyticsAssistantInput,
  modelClient: AiModelClient,
): Promise<AiAnalyticsResponse> {
  return runAnalyticsAssistant(input, modelClient, "report_draft");
}
