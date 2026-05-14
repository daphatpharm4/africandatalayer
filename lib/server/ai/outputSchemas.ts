import { z } from "zod";

export const aiFieldSuggestionSchema = z.object({
  field: z.string().min(1),
  value: z.unknown(),
  confidence: z.number().min(0).max(1),
  evidence: z.string().min(1),
});

export const aiQualityWarningSchema = z.object({
  code: z.string().min(1),
  severity: z.enum(["info", "warning", "blocker"]),
  messageEn: z.string().min(1),
  messageFr: z.string().min(1),
});

export const aiExtractionOutputSchema = z.object({
  detectedCategory: z.string().nullable(),
  fieldSuggestions: z.array(aiFieldSuggestionSchema),
  qualityWarnings: z.array(aiQualityWarningSchema),
  confidence: z.number().min(0).max(1),
});

export const aiReviewOutputSchema = z.object({
  summary: z.string().min(1),
  recommendedChecks: z.array(z.string()),
  riskDrivers: z.array(z.string()),
  supportingEvidence: z.array(z.string()),
  caveats: z.array(z.string()),
  agentFeedbackDraft: z.object({ en: z.string(), fr: z.string() }),
  confidence: z.number().min(0).max(1),
});

export const aiAnalyticsOutputSchema = z.object({
  answer: z.string().min(1),
  facts: z.array(z.object({
    label: z.string().min(1),
    value: z.union([z.string(), z.number()]),
    source: z.string().min(1),
  })),
  caveats: z.array(z.string()),
  suggestedNextValidations: z.array(z.string()),
  confidence: z.number().min(0).max(1),
});
