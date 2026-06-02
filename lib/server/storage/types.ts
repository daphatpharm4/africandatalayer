import type { LegacySubmission, PointEvent, UserProfile } from "../../../shared/types.js";
import type { PointEventFilter } from "./pointEventsQuery.js";

export interface StorageStore {
  getUserProfile(userId: string): Promise<UserProfile | null>;
  upsertUserProfile(userId: string, profile: UserProfile): Promise<void>;
  getPointEvents(filter?: PointEventFilter): Promise<PointEvent[]>;
  insertPointEvent(event: PointEvent): Promise<void>;
  deletePointEvent(eventId: string): Promise<boolean>;
  bulkUpsertPointEvents(events: PointEvent[]): Promise<void>;
  getLegacySubmissions(): Promise<LegacySubmission[]>;
}

export interface StorageReadFallback {
  getUserProfile(userId: string): Promise<UserProfile | null>;
  getPointEvents(filter?: PointEventFilter): Promise<PointEvent[]>;
  getLegacySubmissions(): Promise<LegacySubmission[]>;
}
