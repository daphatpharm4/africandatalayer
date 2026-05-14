import { createHash } from "node:crypto";
import type { SubmissionDetails } from "../../../shared/types.js";

const DEFAULT_REMOVE_KEYS = new Set([
  "phone",
  "email",
  "merchantId",
  "merchantIdByProvider",
  "clientDevice",
  "fraudCheck",
  "gpsIntegrity",
  "ipHash",
  "ipReputation",
  "reviewedBy",
  "userId",
  "agentUserId",
]);

function stableSort(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableSort);
  if (!value || typeof value !== "object") return value;

  const out: Record<string, unknown> = {};
  for (const [key, next] of Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b))) {
    if (next !== undefined) out[key] = stableSort(next);
  }
  return out;
}

function redactObject(input: Record<string, unknown>, keep: Set<string>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (DEFAULT_REMOVE_KEYS.has(key) && !keep.has(key)) continue;
    if (Array.isArray(value)) {
      out[key] = value.map((item) =>
        item && typeof item === "object" && !Array.isArray(item)
          ? redactObject(item as Record<string, unknown>, keep)
          : item,
      );
      continue;
    }
    if (value && typeof value === "object") {
      out[key] = redactObject(value as Record<string, unknown>, keep);
      continue;
    }
    out[key] = value;
  }
  return out;
}

export function redactDetailsForAi(details: SubmissionDetails = {}, keepKeys: string[] = []): SubmissionDetails {
  return redactObject(details, new Set(keepKeys)) as SubmissionDetails;
}

export function hashAiInput(input: unknown): string {
  return createHash("sha256").update(JSON.stringify(stableSort(input))).digest("hex");
}
