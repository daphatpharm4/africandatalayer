import assert from "node:assert/strict";
import test, { afterEach } from "node:test";
import { requireSmsWebhookSecret } from "../api/privacy/index.ts";

const ORIGINAL = process.env.AT_INBOUND_SECRET;

afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.AT_INBOUND_SECRET;
  else process.env.AT_INBOUND_SECRET = ORIGINAL;
});

function req(secretHeader?: string): Request {
  const headers = new Headers();
  if (secretHeader !== undefined) headers.set("x-at-secret", secretHeader);
  return new Request("https://example.test/api/privacy?view=sms-inbound", {
    method: "POST",
    headers,
  });
}

test("fails closed with 503 when AT_INBOUND_SECRET is not configured", async () => {
  delete process.env.AT_INBOUND_SECRET;
  const res = requireSmsWebhookSecret(req("anything"));
  assert.ok(res, "expected a rejection response when secret is unset");
  assert.equal(res!.status, 503);
  const body = (await res!.json()) as { code?: string };
  assert.equal(body.code, "sms_webhook_unconfigured");
});

test("rejects a request whose x-at-secret does not match", () => {
  process.env.AT_INBOUND_SECRET = "s3cret";
  const res = requireSmsWebhookSecret(req("wrong"));
  assert.ok(res);
  assert.equal(res!.status, 403);
});

test("rejects a request with no x-at-secret header when a secret is configured", () => {
  process.env.AT_INBOUND_SECRET = "s3cret";
  const res = requireSmsWebhookSecret(req(undefined));
  assert.ok(res);
  assert.equal(res!.status, 403);
});

test("allows a request with the matching secret", () => {
  process.env.AT_INBOUND_SECRET = "s3cret";
  const res = requireSmsWebhookSecret(req("s3cret"));
  assert.equal(res, null);
});

test("ignores surrounding whitespace in the configured secret", () => {
  process.env.AT_INBOUND_SECRET = "  s3cret  ";
  const res = requireSmsWebhookSecret(req("s3cret"));
  assert.equal(res, null);
});
