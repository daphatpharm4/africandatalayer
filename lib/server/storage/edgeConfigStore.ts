import { getPointEvents, getSubmissions, getUserProfile, setPointEvents, setUserProfile } from "../../edgeConfig.js";
import type { PointEvent } from "../../../shared/types.js";
import type { StorageStore } from "./types.js";

const MAX_EDGE_CONFIG_EVENTS_BYTES = Number(process.env.MAX_EDGE_CONFIG_EVENTS_BYTES ?? "1800000") || 1800000;

function estimateJsonBytes(input: unknown): number {
  return Buffer.byteLength(JSON.stringify(input), "utf8");
}

function compactEventsForStorage(events: PointEvent[]): PointEvent[] {
  if (estimateJsonBytes(events) <= MAX_EDGE_CONFIG_EVENTS_BYTES) return events;
  const sorted = [...events].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  while (sorted.length > 0 && estimateJsonBytes(sorted) > MAX_EDGE_CONFIG_EVENTS_BYTES) {
    sorted.pop();
  }
  return sorted;
}

async function upsertUserProfile(userId: string, profile: Parameters<typeof setUserProfile>[1]): Promise<void> {
  await setUserProfile(userId, profile);
}

async function insertPointEvent(event: PointEvent): Promise<void> {
  const existing = await getPointEvents();
  existing.push(event);
  await setPointEvents(compactEventsForStorage(existing));
}

async function deletePointEvent(eventId: string): Promise<boolean> {
  const existing = await getPointEvents();
  const filtered = existing.filter((event) => event.id !== eventId);
  if (filtered.length === existing.length) return false;
  await setPointEvents(compactEventsForStorage(filtered));
  return true;
}

async function bulkUpsertPointEvents(events: PointEvent[]): Promise<void> {
  const deduped = new Map<string, PointEvent>();
  for (const event of events) {
    deduped.set(event.id, event);
  }
  const compacted = compactEventsForStorage(Array.from(deduped.values()));
  await setPointEvents(compacted);
}

export const edgeConfigStore: StorageStore = {
  getUserProfile,
  upsertUserProfile,
  getPointEvents,
  insertPointEvent,
  deletePointEvent,
  bulkUpsertPointEvents,
  getLegacySubmissions: getSubmissions,
};
