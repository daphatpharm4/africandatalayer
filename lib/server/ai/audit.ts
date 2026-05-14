import type { AiModelMetadata } from "../../../shared/types.js";
import { hashAiInput } from "./redaction.js";

export interface AiAuditMetadata {
  inputHash: string;
  modelProvider: string;
  modelName: string;
  modelVersion: string | null;
  promptVersion: string;
}

export function buildAiAuditMetadata(input: unknown, modelMetadata: AiModelMetadata): AiAuditMetadata {
  return {
    inputHash: hashAiInput(input),
    modelProvider: modelMetadata.provider,
    modelName: modelMetadata.model,
    modelVersion: modelMetadata.modelVersion,
    promptVersion: modelMetadata.promptVersion,
  };
}
