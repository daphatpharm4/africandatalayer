import assert from "node:assert/strict";
import test from "node:test";
import { hashAiInput, redactDetailsForAi } from "../lib/server/ai/redaction.js";

test("redactDetailsForAi removes direct contact fields by default", () => {
  const result = redactDetailsForAi({
    name: "Pharmacie Lumiere",
    phone: "+237699000000",
    email: "owner@example.com",
    website: "https://example.com",
    brand: "Known Brand",
  });

  assert.equal(result.name, "Pharmacie Lumiere");
  assert.equal("phone" in result, false);
  assert.equal("email" in result, false);
  assert.equal(result.website, "https://example.com");
});

test("hashAiInput is stable for object key order", () => {
  const a = hashAiInput({ b: 2, a: 1 });
  const b = hashAiInput({ a: 1, b: 2 });
  assert.equal(a, b);
  assert.match(a, /^[a-f0-9]{64}$/);
});
