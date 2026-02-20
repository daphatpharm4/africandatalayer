import type { LegacySubmission, PointEvent, UserProfile } from "../../../shared/types.js";

export interface StorageStore {
  getUserProfile(userId: string): Promise<UserProfile | null>;
  upsertUserProfile(userId: string, profile: UserProfile): Promise<void>;
  getPointEvents(): Promise<PointEvent[]>;
  insertPointEvent(event: PointEvent): Promise<void>;
  deletePointEvent(eventId: string): Promise<boolean>;
  bulkUpsertPointEvents(events: PointEvent[]): Promise<void>;
  getLegacySubmissions(): Promise<LegacySubmission[]>;
}

export interface StorageReadFallback {
  getUserProfile(userId: string): Promise<UserProfile | null>;
  getPointEvents(): Promise<PointEvent[]>;
  getLegacySubmissions(): Promise<LegacySubmission[]>;
}
