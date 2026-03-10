import type { SubmissionDetails } from "../../shared/types.js";

const PII_DETAIL_KEYS = new Set([
  "name",
  "siteName",
  "phone",
  "merchantId",
  "merchantIdByProvider",
  "website",
  "secondPhotoUrl",
]);

export function stripPiiDetails(details: SubmissionDetails): SubmissionDetails {
  const output: SubmissionDetails = {};
  for (const [key, value] of Object.entries(details ?? {})) {
    if (PII_DETAIL_KEYS.has(key)) continue;
    output[key] = value;
  }
  return output;
}
