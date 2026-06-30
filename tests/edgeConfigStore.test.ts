import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";
import { getPointEvents, setPointEvents } from "../lib/edgeConfig.js";
import { edgeConfigStore } from "../lib/server/storage/edgeConfigStore.js";
import type { PointEvent } from "../shared/types.js";

function event(id: string, details: Record<string, unknown> = {}): PointEvent {
  return {
    id,
    pointId: `point-${id}`,
    eventType: "ENRICH_EVENT",
    userId: "operator@example.com",
    category: "mobile_money",
    location: { latitude: 4.0864, longitude: 9.7402 },
    details,
    createdAt: "2026-06-30T12:00:00.000Z",
    source: "point_operator",
  };
}

beforeEach(() => {
  process.env.EDGE_CONFIG_FORCE = "false";
  const globalAny = globalThis as typeof globalThis & { __edgeConfigStore?: Map<string, unknown> };
  globalAny.__edgeConfigStore = new Map<string, unknown>();
});

test("edge point event bulk upsert merges reviewed events instead of replacing the queue", async () => {
  await setPointEvents([event("00000000-0000-4000-8000-000000000001"), event("00000000-0000-4000-8000-000000000002")]);

  await edgeConfigStore.bulkUpsertPointEvents([
    event("00000000-0000-4000-8000-000000000002", { reviewStatus: "auto_approved" }),
  ]);

  const events = await getPointEvents();
  assert.equal(events.length, 2);
  assert.equal(events.find((item) => item.id.endsWith("0001"))?.details.reviewStatus, undefined);
  assert.equal(events.find((item) => item.id.endsWith("0002"))?.details.reviewStatus, "auto_approved");
});
