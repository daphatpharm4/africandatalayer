import type { PointEvent, UserProfile } from "../../../shared/types.js";
import { isStorageUnavailableError } from "../db.js";
import { edgeConfigStore } from "./edgeConfigStore.js";
import { edgeFallbackStore } from "./edgeFallbackStore.js";
import { postgresStore } from "./postgresStore.js";
import type { StorageStore } from "./types.js";

type StorageDriver = "postgres" | "edge";

function resolveDriver(): StorageDriver {
  const configured = process.env.DATA_STORE_DRIVER?.trim().toLowerCase();
  if (configured === "edge") return "edge";
  if (configured === "postgres") return "postgres";
  if (process.env.POSTGRES_URL || process.env.POSTGRES_PRISMA_URL || process.env.POSTGRES_URL_NON_POOLING) {
    return "postgres";
  }
  return "edge";
}

function fallbackEnabled(): boolean {
  return process.env.DATA_READ_FALLBACK_EDGE === "true";
}

function getPrimaryStore(): StorageStore {
  return resolveDriver() === "postgres" ? postgresStore : edgeConfigStore;
}

function shouldUseFallback(): boolean {
  return resolveDriver() === "postgres" && fallbackEnabled();
}

function mergeEvents(primaryEvents: PointEvent[], fallbackEvents: PointEvent[]): PointEvent[] {
  if (!fallbackEvents.length) return primaryEvents;
  if (!primaryEvents.length) return fallbackEvents;

  const deduped = new Map<string, PointEvent>();
  for (const event of primaryEvents) deduped.set(event.id, event);
  for (const event of fallbackEvents) {
    if (!deduped.has(event.id)) deduped.set(event.id, event);
  }

  return Array.from(deduped.values()).sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}

export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  const primary = getPrimaryStore();
  const primaryProfile = await primary.getUserProfile(userId);
  if (primaryProfile || !shouldUseFallback()) return primaryProfile;
  return await edgeFallbackStore.getUserProfile(userId);
}

export async function upsertUserProfile(userId: string, profile: UserProfile): Promise<void> {
  const primary = getPrimaryStore();
  await primary.upsertUserProfile(userId, profile);
}

export async function getPointEvents(): Promise<PointEvent[]> {
  const primary = getPrimaryStore();
  const primaryEvents = await primary.getPointEvents();
  if (!shouldUseFallback()) return primaryEvents;
  const fallbackEvents = await edgeFallbackStore.getPointEvents();
  return mergeEvents(primaryEvents, fallbackEvents);
}

export async function insertPointEvent(event: PointEvent): Promise<void> {
  const primary = getPrimaryStore();
  await primary.insertPointEvent(event);
}

export async function deletePointEvent(eventId: string): Promise<boolean> {
  const primary = getPrimaryStore();
  return await primary.deletePointEvent(eventId);
}

export async function bulkUpsertPointEvents(events: PointEvent[]): Promise<void> {
  const primary = getPrimaryStore();
  await primary.bulkUpsertPointEvents(events);
}

export async function getLegacySubmissions() {
  if (resolveDriver() === "edge") {
    return await edgeConfigStore.getLegacySubmissions();
  }
  if (shouldUseFallback()) {
    return await edgeFallbackStore.getLegacySubmissions();
  }
  return [];
}

export { isStorageUnavailableError };
