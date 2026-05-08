import assert from "node:assert/strict";
import test from "node:test";
import {
  estimateSegments,
  smsCampaignCreateSchema,
  SMS_SEGMENT_GSM7_LIMIT,
  SMS_SEGMENT_UNICODE_LIMIT,
} from "../lib/server/sms/campaigns.js";
import { normalizePhone } from "../lib/server/sms/provider.js";

test("normalizePhone keeps E.164 plus prefix", () => {
  assert.equal(normalizePhone("+237699000000"), "+237699000000");
  assert.equal(normalizePhone(" +237 699 000 000 "), "+237699000000");
});

test("normalizePhone rejects local-format and short numbers", () => {
  assert.equal(normalizePhone("699000000"), null);
  assert.equal(normalizePhone("+1234"), null);
  assert.equal(normalizePhone(""), null);
});

test("estimateSegments uses GSM-7 160-char window for ASCII", () => {
  const message = "A".repeat(SMS_SEGMENT_GSM7_LIMIT);
  assert.equal(estimateSegments(message), 1);
  assert.equal(estimateSegments(message + "B"), 2);
});

test("estimateSegments uses 70-char window for unicode", () => {
  const message = "é".repeat(SMS_SEGMENT_UNICODE_LIMIT);
  assert.equal(estimateSegments(message), 1);
  assert.equal(estimateSegments(message + "ñ"), 2);
});

test("smsCampaignCreateSchema requires non-empty message", () => {
  const bad = smsCampaignCreateSchema.safeParse({ message: "" });
  assert.equal(bad.success, false);
});

test("smsCampaignCreateSchema caps message at 459 chars (3 unicode segments)", () => {
  const tooLong = smsCampaignCreateSchema.safeParse({ message: "a".repeat(460) });
  assert.equal(tooLong.success, false);
  const ok = smsCampaignCreateSchema.safeParse({ message: "a".repeat(459) });
  assert.equal(ok.success, true);
});

test("smsCampaignCreateSchema defaults language en, audience {}", () => {
  const result = smsCampaignCreateSchema.parse({ message: "hi" });
  assert.equal(result.language, "en");
  assert.deepEqual(result.audience, {});
});

test("smsCampaignCreateSchema accepts acknowledgeCost flag", () => {
  const result = smsCampaignCreateSchema.parse({ message: "hi", acknowledgeCost: true });
  assert.equal(result.acknowledgeCost, true);
});
