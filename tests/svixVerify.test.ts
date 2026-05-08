import assert from "node:assert/strict";
import test from "node:test";
import { createHmac, randomBytes } from "node:crypto";
import { verifySvixSignature } from "../lib/server/email/svixVerify.js";

function buildSecret(): { whsecPrefixed: string; secretBytes: Buffer } {
  const secretBytes = randomBytes(32);
  const whsecPrefixed = `whsec_${secretBytes.toString("base64")}`;
  return { whsecPrefixed, secretBytes };
}

function signBody(secretBytes: Buffer, id: string, timestamp: string, body: string): string {
  const signedPayload = `${id}.${timestamp}.${body}`;
  const sig = createHmac("sha256", secretBytes).update(signedPayload).digest("base64");
  return `v1,${sig}`;
}

test("verifySvixSignature accepts a correctly signed body", () => {
  const { whsecPrefixed, secretBytes } = buildSecret();
  const id = "msg_2hY";
  const timestamp = String(Math.floor(Date.now() / 1000));
  const body = JSON.stringify({ type: "email.delivered", data: { email_id: "abc" } });
  const signature = signBody(secretBytes, id, timestamp, body);

  const result = verifySvixSignature({
    rawBody: body,
    signingSecret: whsecPrefixed,
    headers: { id, timestamp, signature },
  });
  assert.equal(result.valid, true);
});

test("verifySvixSignature rejects tampered body", () => {
  const { whsecPrefixed, secretBytes } = buildSecret();
  const id = "msg_2hY";
  const timestamp = String(Math.floor(Date.now() / 1000));
  const body = JSON.stringify({ type: "email.delivered", data: { email_id: "abc" } });
  const signature = signBody(secretBytes, id, timestamp, body);

  const result = verifySvixSignature({
    rawBody: body + "tamper",
    signingSecret: whsecPrefixed,
    headers: { id, timestamp, signature },
  });
  assert.equal(result.valid, false);
  assert.equal(result.reason, "signature_mismatch");
});

test("verifySvixSignature rejects stale timestamps (>5min)", () => {
  const { whsecPrefixed, secretBytes } = buildSecret();
  const id = "msg_old";
  const oldTimestamp = String(Math.floor(Date.now() / 1000) - 600);
  const body = "{}";
  const signature = signBody(secretBytes, id, oldTimestamp, body);

  const result = verifySvixSignature({
    rawBody: body,
    signingSecret: whsecPrefixed,
    headers: { id, timestamp: oldTimestamp, signature },
  });
  assert.equal(result.valid, false);
  assert.equal(result.reason, "stale_timestamp");
});

test("verifySvixSignature rejects missing headers", () => {
  const { whsecPrefixed } = buildSecret();
  const result = verifySvixSignature({
    rawBody: "{}",
    signingSecret: whsecPrefixed,
    headers: { id: null, timestamp: null, signature: null },
  });
  assert.equal(result.valid, false);
  assert.equal(result.reason, "missing_signature_headers");
});

test("verifySvixSignature rejects unrecognized signature versions", () => {
  const { whsecPrefixed, secretBytes } = buildSecret();
  const id = "msg_v2";
  const timestamp = String(Math.floor(Date.now() / 1000));
  const body = "{}";
  const sig = createHmac("sha256", secretBytes).update(`${id}.${timestamp}.${body}`).digest("base64");

  const result = verifySvixSignature({
    rawBody: body,
    signingSecret: whsecPrefixed,
    headers: { id, timestamp, signature: `v2,${sig}` },
  });
  assert.equal(result.valid, false);
  assert.equal(result.reason, "no_v1_signatures");
});

test("verifySvixSignature accepts secret without whsec_ prefix", () => {
  const secretBytes = randomBytes(32);
  const id = "msg_raw";
  const timestamp = String(Math.floor(Date.now() / 1000));
  const body = "{}";
  const signature = signBody(secretBytes, id, timestamp, body);

  const result = verifySvixSignature({
    rawBody: body,
    signingSecret: secretBytes.toString("base64"),
    headers: { id, timestamp, signature },
  });
  assert.equal(result.valid, true);
});

test("verifySvixSignature accepts multiple space-separated signatures", () => {
  const { whsecPrefixed, secretBytes } = buildSecret();
  const id = "msg_multi";
  const timestamp = String(Math.floor(Date.now() / 1000));
  const body = "{}";
  const validSig = signBody(secretBytes, id, timestamp, body);
  const otherSig = `v1,${randomBytes(32).toString("base64")}`;

  const result = verifySvixSignature({
    rawBody: body,
    signingSecret: whsecPrefixed,
    headers: { id, timestamp, signature: `${otherSig} ${validSig}` },
  });
  assert.equal(result.valid, true);
});
