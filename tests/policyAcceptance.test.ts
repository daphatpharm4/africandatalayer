import assert from "node:assert/strict";
import test from "node:test";
import { policyAcceptanceSchema } from "../lib/server/validation.js";
import { POLICY_KINDS, POLICY_VERSIONS, type PolicyKind } from "../shared/legalPolicies.js";

test("policyAcceptanceSchema accepts both privacy and terms", () => {
  const result = policyAcceptanceSchema.safeParse({ accept: ["privacy", "terms"] });
  assert.equal(result.success, true);
});

test("policyAcceptanceSchema accepts a single kind", () => {
  const result = policyAcceptanceSchema.safeParse({ accept: ["privacy"] });
  assert.equal(result.success, true);
});

test("policyAcceptanceSchema rejects empty acceptance", () => {
  const result = policyAcceptanceSchema.safeParse({ accept: [] });
  assert.equal(result.success, false);
});

test("policyAcceptanceSchema rejects unknown kind", () => {
  const result = policyAcceptanceSchema.safeParse({ accept: ["cookies"] });
  assert.equal(result.success, false);
});

test("policyAcceptanceSchema rejects extra props (strict)", () => {
  const result = policyAcceptanceSchema.safeParse({ accept: ["privacy"], extra: 1 });
  assert.equal(result.success, false);
});

// Mirrors the GET /api/privacy?view=acceptance outstanding calculation.
function computeOutstanding(
  accepted: Array<{ policy_kind: PolicyKind; version: string }>,
): PolicyKind[] {
  const acceptedMap = new Map<PolicyKind, Set<string>>();
  for (const row of accepted) {
    const set = acceptedMap.get(row.policy_kind) ?? new Set<string>();
    set.add(row.version);
    acceptedMap.set(row.policy_kind, set);
  }
  return POLICY_KINDS.filter((kind) => !acceptedMap.get(kind)?.has(POLICY_VERSIONS[kind]));
}

test("outstanding calc returns all kinds when nothing accepted", () => {
  const outstanding = computeOutstanding([]);
  assert.deepEqual(outstanding, [...POLICY_KINDS]);
});

test("outstanding calc returns empty when current versions accepted", () => {
  const outstanding = computeOutstanding(
    POLICY_KINDS.map((kind) => ({ policy_kind: kind, version: POLICY_VERSIONS[kind] })),
  );
  assert.deepEqual(outstanding, []);
});

test("outstanding calc ignores stale versions", () => {
  const outstanding = computeOutstanding([
    { policy_kind: "privacy", version: "0.0.1" },
    { policy_kind: "terms", version: POLICY_VERSIONS.terms },
  ]);
  assert.deepEqual(outstanding, ["privacy"]);
});

test("outstanding calc treats duplicate accepts as idempotent", () => {
  const outstanding = computeOutstanding([
    { policy_kind: "privacy", version: POLICY_VERSIONS.privacy },
    { policy_kind: "privacy", version: POLICY_VERSIONS.privacy },
    { policy_kind: "terms", version: POLICY_VERSIONS.terms },
  ]);
  assert.deepEqual(outstanding, []);
});
