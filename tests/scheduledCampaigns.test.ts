import assert from "node:assert/strict";
import test from "node:test";
import { isFutureScheduledAt as isFutureEmail } from "../lib/server/email/campaigns.js";
import { isFutureScheduledAt as isFutureSms } from "../lib/server/sms/campaigns.js";

test("isFutureScheduledAt rejects null / empty / undefined", () => {
  assert.equal(isFutureEmail(null), false);
  assert.equal(isFutureEmail(undefined), false);
  assert.equal(isFutureEmail(""), false);
  assert.equal(isFutureSms(null), false);
});

test("isFutureScheduledAt rejects past timestamps", () => {
  const past = new Date(Date.now() - 60_000).toISOString();
  assert.equal(isFutureEmail(past), false);
  assert.equal(isFutureSms(past), false);
});

test("isFutureScheduledAt accepts future timestamps", () => {
  const future = new Date(Date.now() + 60_000).toISOString();
  assert.equal(isFutureEmail(future), true);
  assert.equal(isFutureSms(future), true);
});

test("isFutureScheduledAt rejects unparseable strings", () => {
  assert.equal(isFutureEmail("not-a-date"), false);
  assert.equal(isFutureSms("2026-13-99T99:99:99Z"), false);
});
