import assert from "node:assert/strict";
import test from "node:test";
import {
  classifyExistingReservation,
  DEFAULT_RESERVATION_TTL_MS,
  type ReservationSnapshot,
} from "../lib/server/idempotencyCore.ts";

const NOW = 1_000_000_000;

function snap(partial: Partial<ReservationSnapshot> & { requestHash: string }): ReservationSnapshot {
  return { hasResponse: false, createdAtMs: NOW, ...partial };
}

test("matching hash with stored response → replay", () => {
  const d = classifyExistingReservation(snap({ requestHash: "h1", hasResponse: true }), "h1", NOW);
  assert.equal(d.kind, "replay");
});

test("matching hash, no response, fresh → in_flight (single-flight: loser must not proceed)", () => {
  const d = classifyExistingReservation(snap({ requestHash: "h1", hasResponse: false }), "h1", NOW);
  assert.equal(d.kind, "in_flight");
});

test("matching hash, no response, older than TTL → reclaim (orphan takeover)", () => {
  const existing = snap({ requestHash: "h1", hasResponse: false, createdAtMs: NOW - DEFAULT_RESERVATION_TTL_MS });
  const d = classifyExistingReservation(existing, "h1", NOW);
  assert.equal(d.kind, "reclaim");
});

test("different hash, fresh reservation → conflict", () => {
  const d = classifyExistingReservation(snap({ requestHash: "h1", hasResponse: false }), "DIFFERENT", NOW);
  assert.equal(d.kind, "conflict");
});

test("different hash but orphaned → reclaim (stale reservation may be taken over)", () => {
  const existing = snap({ requestHash: "h1", hasResponse: false, createdAtMs: NOW - DEFAULT_RESERVATION_TTL_MS - 1 });
  const d = classifyExistingReservation(existing, "DIFFERENT", NOW);
  assert.equal(d.kind, "reclaim");
});

test("completed reservation is never treated as orphaned even if old", () => {
  const existing = snap({ requestHash: "h1", hasResponse: true, createdAtMs: NOW - 10 * DEFAULT_RESERVATION_TTL_MS });
  const d = classifyExistingReservation(existing, "h1", NOW);
  assert.equal(d.kind, "replay");
});

test("custom ttl is honored", () => {
  const existing = snap({ requestHash: "h1", hasResponse: false, createdAtMs: NOW - 5000 });
  assert.equal(classifyExistingReservation(existing, "h1", NOW, 10_000).kind, "in_flight");
  assert.equal(classifyExistingReservation(existing, "h1", NOW, 4000).kind, "reclaim");
});
