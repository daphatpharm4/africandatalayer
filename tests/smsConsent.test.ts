import assert from "node:assert/strict";
import test from "node:test";
import { SMS_CONSENT_COPY_VERSION } from "../lib/server/sms/consent.js";

test("SMS_CONSENT_COPY_VERSION is a non-empty string", () => {
  assert.equal(typeof SMS_CONSENT_COPY_VERSION, "string");
  assert.ok(SMS_CONSENT_COPY_VERSION.length > 0);
});

test("SMS_CONSENT_COPY_VERSION includes a date prefix", () => {
  assert.match(SMS_CONSENT_COPY_VERSION, /^\d{4}-\d{2}-\d{2}-/);
});
