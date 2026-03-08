import test from "node:test";
import assert from "node:assert/strict";
import type { PointEvent } from "../shared/types.ts";
import { BASE_EVENT_XP, getEffectiveEventXp, getUserXpFromEvents } from "../shared/xp.ts";

function makeEvent(id: string, userId: string, details: PointEvent["details"] = {}): PointEvent {
  return {
    id,
    pointId: `point-${id}`,
    eventType: "CREATE_EVENT",
    userId,
    category: "pharmacy",
    location: { latitude: 4.0864, longitude: 9.7402 },
    details,
    createdAt: "2026-03-08T10:00:00.000Z",
  };
}

test("legacy events without xpAwarded fall back to the base event XP", () => {
  const event = makeEvent("legacy-1", "alice@example.com", { name: "Legacy event" });
  assert.equal(getEffectiveEventXp(event), BASE_EVENT_XP);
});

test("pending review events without xpAwarded do not grant XP", () => {
  const event = makeEvent("pending-1", "alice@example.com", { reviewStatus: "pending_review" });
  assert.equal(getEffectiveEventXp(event), 0);
});

test("rejected events never contribute XP even if xpAwarded is present", () => {
  const event = makeEvent("rejected-1", "alice@example.com", {
    xpAwarded: 5,
    reviewDecision: "rejected",
    reviewFlags: ["rejected_by_admin"],
  });
  assert.equal(getEffectiveEventXp(event), 0);
});

test("user XP totals are computed from effective event XP, not ranking score or stored profile XP", () => {
  const events: PointEvent[] = [
    makeEvent("event-1", "alice@example.com", { xpAwarded: 5, confidenceScore: 62 }),
    makeEvent("event-2", "alice@example.com", { name: "Legacy event" }),
    makeEvent("event-3", "alice@example.com", { reviewStatus: "pending_review", xpAwarded: 0 }),
    makeEvent("event-4", "alice@example.com", { xpAwarded: 5, reviewDecision: "rejected" }),
    makeEvent("event-5", "bob@example.com", { xpAwarded: 50 }),
  ];

  assert.equal(getUserXpFromEvents(events, "alice@example.com"), 10);
  assert.equal(getUserXpFromEvents(events, "bob@example.com"), 50);
});
