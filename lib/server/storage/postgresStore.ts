import { createHash } from "node:crypto";
import { query } from "../db.js";
import type { LegacySubmission, MapScope, PointEvent, PointEventType, SubmissionCategory, UserProfile } from "../../../shared/types.js";
import type { StorageStore } from "./types.js";

const VALID_MAP_SCOPES: ReadonlySet<MapScope> = new Set(["bonamoussadi", "cameroon", "global"]);

function normalizeUserId(input: string): string {
  return input.toLowerCase().trim();
}

function normalizeMapScope(input: unknown): MapScope {
  if (typeof input !== "string") return "bonamoussadi";
  const normalized = input.trim().toLowerCase() as MapScope;
  if (!VALID_MAP_SCOPES.has(normalized)) return "bonamoussadi";
  return normalized;
}

function parseXp(input: unknown): number {
  const value = typeof input === "number" ? input : Number(input);
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.round(value));
}

function isUuid(input: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input);
}

function deterministicUuid(seed: string): string {
  const hex = createHash("sha1").update(seed).digest("hex").slice(0, 32).split("");
  hex[12] = "5";
  const variant = parseInt(hex[16], 16);
  hex[16] = ((variant & 0x3) | 0x8).toString(16);
  return `${hex.slice(0, 8).join("")}-${hex.slice(8, 12).join("")}-${hex.slice(12, 16).join("")}-${hex.slice(16, 20).join("")}-${hex.slice(20, 32).join("")}`;
}

function normalizeEventId(input: string): string {
  const trimmed = input.trim();
  if (isUuid(trimmed)) return trimmed.toLowerCase();
  return deterministicUuid(`event:${trimmed}`);
}

function normalizeCreatedAt(input: unknown): string {
  if (typeof input === "string") {
    const parsed = new Date(input);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }
  return new Date().toISOString();
}

function parseCategory(input: unknown): SubmissionCategory {
  if (input === "pharmacy" || input === "fuel_station" || input === "mobile_money") return input;
  return "mobile_money";
}

function parseEventType(input: unknown): PointEventType {
  if (input === "CREATE_EVENT" || input === "ENRICH_EVENT") return input;
  return "CREATE_EVENT";
}

function parseLocation(input: unknown): { latitude: number; longitude: number } | null {
  const raw = input as { latitude?: unknown; longitude?: unknown };
  const latitude = typeof raw?.latitude === "number" ? raw.latitude : Number(raw?.latitude);
  const longitude = typeof raw?.longitude === "number" ? raw.longitude : Number(raw?.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return { latitude, longitude };
}

function rowToUserProfile(row: Record<string, unknown>): UserProfile {
  return {
    id: String(row.id ?? "").toLowerCase().trim(),
    email: String(row.email ?? "").toLowerCase().trim(),
    name: typeof row.name === "string" ? row.name : "",
    image: typeof row.image === "string" ? row.image : "",
    occupation: typeof row.occupation === "string" ? row.occupation : "",
    XP: parseXp(row.xp),
    passwordHash: typeof row.password_hash === "string" ? row.password_hash : undefined,
    isAdmin: Boolean(row.is_admin),
    mapScope: normalizeMapScope(row.map_scope),
  };
}

function rowToPointEvent(row: Record<string, unknown>): PointEvent {
  const details = row.details && typeof row.details === "object" ? (row.details as PointEvent["details"]) : {};

  return {
    id: String(row.id),
    pointId: String(row.point_id ?? ""),
    eventType: parseEventType(row.event_type),
    userId: String(row.user_id ?? "").toLowerCase().trim(),
    category: parseCategory(row.category),
    location: {
      latitude: typeof row.latitude === "number" ? row.latitude : Number(row.latitude),
      longitude: typeof row.longitude === "number" ? row.longitude : Number(row.longitude),
    },
    details,
    photoUrl: typeof row.photo_url === "string" ? row.photo_url : undefined,
    createdAt: normalizeCreatedAt(row.created_at),
    source: typeof row.source === "string" ? row.source : undefined,
    externalId: typeof row.external_id === "string" ? row.external_id : undefined,
  };
}

async function getUserProfile(userId: string): Promise<UserProfile | null> {
  const id = normalizeUserId(userId);
  const result = await query<Record<string, unknown>>(
    `
      select id, email, name, image, occupation, xp, password_hash, is_admin, map_scope
      from user_profiles
      where id = $1
      limit 1
    `,
    [id],
  );

  const row = result.rows[0];
  if (!row) return null;
  return rowToUserProfile(row);
}

async function upsertUserProfile(userId: string, profile: UserProfile): Promise<void> {
  const id = normalizeUserId(userId || profile.id || profile.email);
  const email = normalizeUserId(profile.email || id);
  const name = typeof profile.name === "string" && profile.name.trim() ? profile.name.trim() : email.split("@")[0] || "Contributor";
  const image = typeof profile.image === "string" ? profile.image : "";
  const occupation = typeof profile.occupation === "string" ? profile.occupation : "";
  const xp = parseXp(profile.XP);
  const passwordHash = typeof profile.passwordHash === "string" && profile.passwordHash.trim() ? profile.passwordHash : null;
  const isAdmin = profile.isAdmin === true;
  const mapScope = normalizeMapScope(profile.mapScope);

  await query(
    `
      insert into user_profiles (id, email, name, image, occupation, xp, password_hash, is_admin, map_scope, updated_at)
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9, now())
      on conflict (id) do update
      set
        email = excluded.email,
        name = excluded.name,
        image = excluded.image,
        occupation = excluded.occupation,
        xp = excluded.xp,
        password_hash = coalesce(excluded.password_hash, user_profiles.password_hash),
        is_admin = excluded.is_admin,
        map_scope = excluded.map_scope,
        updated_at = now()
    `,
    [id, email, name, image, occupation, xp, passwordHash, isAdmin, mapScope],
  );
}

async function getPointEvents(): Promise<PointEvent[]> {
  const result = await query<Record<string, unknown>>(
    `
      select id, point_id, event_type, user_id, category, latitude, longitude, details, photo_url, created_at, source, external_id
      from point_events
      order by created_at asc
    `,
  );

  return result.rows.map(rowToPointEvent);
}

async function insertPointEvent(event: PointEvent): Promise<void> {
  const id = normalizeEventId(event.id);
  const pointId = typeof event.pointId === "string" && event.pointId.trim() ? event.pointId.trim() : id;
  const eventType = parseEventType(event.eventType);
  const userId = normalizeUserId(event.userId || "unknown");
  const category = parseCategory(event.category);
  const location = parseLocation(event.location);
  if (!location) throw new Error("Invalid point event location");
  const details = event.details && typeof event.details === "object" ? event.details : {};
  const photoUrl = typeof event.photoUrl === "string" ? event.photoUrl : null;
  const createdAt = normalizeCreatedAt(event.createdAt);
  const source = typeof event.source === "string" ? event.source : null;
  const externalId = typeof event.externalId === "string" ? event.externalId : null;

  await query(
    `
      insert into point_events (id, point_id, event_type, user_id, category, latitude, longitude, details, photo_url, created_at, source, external_id)
      values ($1::uuid, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10::timestamptz, $11, $12)
      on conflict (id) do update
      set
        point_id = excluded.point_id,
        event_type = excluded.event_type,
        user_id = excluded.user_id,
        category = excluded.category,
        latitude = excluded.latitude,
        longitude = excluded.longitude,
        details = excluded.details,
        photo_url = excluded.photo_url,
        created_at = excluded.created_at,
        source = excluded.source,
        external_id = excluded.external_id
    `,
    [id, pointId, eventType, userId, category, location.latitude, location.longitude, JSON.stringify(details), photoUrl, createdAt, source, externalId],
  );
}

async function bulkUpsertPointEvents(events: PointEvent[]): Promise<void> {
  if (!events.length) return;

  await query("begin");
  try {
    for (const event of events) {
      await insertPointEvent(event);
    }
    await query("commit");
  } catch (error) {
    await query("rollback");
    throw error;
  }
}

async function getLegacySubmissions(): Promise<LegacySubmission[]> {
  return [];
}

export const postgresStore: StorageStore = {
  getUserProfile,
  upsertUserProfile,
  getPointEvents,
  insertPointEvent,
  bulkUpsertPointEvents,
  getLegacySubmissions,
};
