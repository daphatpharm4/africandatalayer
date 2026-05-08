import assert from "node:assert/strict";
import test from "node:test";
import { buildUnsubscribeUrl } from "../lib/server/email/unsubscribe.js";

test("buildUnsubscribeUrl strips trailing slash from base URL", () => {
  assert.equal(
    buildUnsubscribeUrl("https://adl.example.com/", "abc123"),
    "https://adl.example.com/api/comms/unsubscribe?token=abc123",
  );
  assert.equal(
    buildUnsubscribeUrl("https://adl.example.com", "abc123"),
    "https://adl.example.com/api/comms/unsubscribe?token=abc123",
  );
});

test("buildUnsubscribeUrl URL-encodes the token", () => {
  const token = "abc/def+ghi=jkl";
  const url = buildUnsubscribeUrl("https://adl.example.com", token);
  assert.equal(url, "https://adl.example.com/api/comms/unsubscribe?token=abc%2Fdef%2Bghi%3Djkl");
});

test("buildUnsubscribeUrl preserves base URL path prefix when present", () => {
  assert.equal(
    buildUnsubscribeUrl("https://adl.example.com/staging", "tok"),
    "https://adl.example.com/staging/api/comms/unsubscribe?token=tok",
  );
});
