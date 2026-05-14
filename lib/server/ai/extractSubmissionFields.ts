import type {
  AiExtractionResponse,
  DedupCandidate,
  SubmissionCategory,
  SubmissionDetails,
  SubmissionLocation,
} from "../../../shared/types.js";
import { aiExtractionOutputSchema } from "./outputSchemas.js";
import type { AiModelClient } from "./modelClient.js";
import { redactDetailsForAi } from "./redaction.js";

export interface ExtractSubmissionFieldsInput {
  category?: SubmissionCategory | null;
  imageData?: string;
  photoUrl?: string;
  location: SubmissionLocation;
  language: "en" | "fr";
  draftDetails?: SubmissionDetails;
}

const PROMPT_VERSION = "extract-submission-v1";
const SUBMISSION_CATEGORIES = new Set<SubmissionCategory>([
  "pharmacy",
  "fuel_station",
  "mobile_money",
  "alcohol_outlet",
  "billboard",
  "transport_road",
  "census_proxy",
]);

function normalizeDetectedCategory(input: string | null, fallback: SubmissionCategory | null | undefined): SubmissionCategory | null {
  if (input && SUBMISSION_CATEGORIES.has(input as SubmissionCategory)) return input as SubmissionCategory;
  return fallback ?? null;
}

export function buildExtractionModelPayload(input: ExtractSubmissionFieldsInput): Record<string, unknown> {
  return {
    category: input.category ?? null,
    imageData: input.imageData,
    photoUrl: input.photoUrl,
    location: input.location,
    language: input.language,
    draftDetails: redactDetailsForAi(input.draftDetails ?? {}),
  };
}

export async function extractSubmissionFields(
  input: ExtractSubmissionFieldsInput,
  modelClient: AiModelClient,
  duplicateCandidates: DedupCandidate[] = [],
): Promise<AiExtractionResponse> {
  const model = await modelClient({
    task: "extract_submission",
    promptVersion: PROMPT_VERSION,
    payload: buildExtractionModelPayload(input),
  });

  const parsed = aiExtractionOutputSchema.parse(model.json);
  return {
    detectedCategory: normalizeDetectedCategory(parsed.detectedCategory, input.category),
    fieldSuggestions: parsed.fieldSuggestions,
    qualityWarnings: parsed.qualityWarnings,
    duplicateCandidates,
    confidence: parsed.confidence,
    modelMetadata: model.metadata,
  };
}
