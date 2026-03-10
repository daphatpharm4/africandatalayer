import { createHash } from "node:crypto";
import { query } from "../db.js";
import type {
  ConsentStatus,
  LegacySubmission,
  MapScope,
  PointEvent,
  PointEventType,
  SubmissionCategory,
  TrustTier,
  UserProfile,
  UserRole,
} from "../../../shared/types.js";
import { isValidCategory } from "../../../shared/verticals.js";
import { normalizeEmail, normalizePhone } from "../../shared/identifier.js";
import { normalizeCreatedAt } from "./createdAt.js";
import type { StorageStore } from "./types.js";

const VALID_MAP_SCOPES: ReadonlySet<MapScope> = new Set(["bonamoussadi", "cameroon", "global"]);
const VALID_ROLES: ReadonlySet<UserRole> = new Set(["agent", "admin", "client"]);
const VALID_TRUST_TIERS: ReadonlySet<TrustTier> = new Set(["new", "standard", "trusted", "restricted"]);
const VALID_CONSENT_STATUSES: ReadonlySet<ConsentStatus> = new Set([
  "obtained",
  "refused_pii_only",
  "not_required",
  "withdrawn",
]);
let phoneColumnState: "unknown" | "present" | "missing" = "unknown";

function normalizeUserId(input: string): string {
  return input.toLowerCase().trim();
}

function normalizeMapScope(input: unknown): MapScope {
  if (typeof input !== "string") return "bonamoussadi";
  const normalized = input.trim().toLowerCase() as MapScope;
  if (!VALID_MAP_SCOPES.has(normalized)) return "bonamoussadi";
  return normalized;
}

function normalizeRole(input: unknown): UserRole {
  if (typeof input !== "string") return "agent";
  const normalized = input.trim().toLowerCase() as UserRole;
  if (!VALID_ROLES.has(normalized)) return "agent";
  return normalized;
}

function parseXp(input: unknown): number {
  const value = typeof input === "number" ? input : Number(input);
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.round(value));
}

function parseTrustScore(input: unknown): number {
  const value = typeof input === "number" ? input : Number(input);
  if (!Number.isFinite(value)) return 50;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function normalizeTrustTier(input: unknown): TrustTier {
  if (typeof input !== "string") return "standard";
  const normalized = input.trim().toLowerCase() as TrustTier;
  if (!VALID_TRUST_TIERS.has(normalized)) return "standard";
  return normalized;
}

function normalizeConsentStatus(input: unknown): ConsentStatus | undefined {
  if (typeof input !== "string") return undefined;
  const normalized = input.trim().toLowerCase() as ConsentStatus;
  if (!VALID_CONSENT_STATUSES.has(normalized)) return undefined;
  return normalized;
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

function parseCategory(input: unknown): SubmissionCategory {
  if (typeof input === "string" && isValidCategory(input)) return input as SubmissionCategory;
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
  const email = typeof row.email === "string" && row.email.trim() ? row.email.toLowerCase().trim() : null;
  const phone = typeof row.phone === "string" && row.phone.trim() ? row.phone.trim() : null;
  return {
    id: String(row.id ?? "").toLowerCase().trim(),
    email,
    phone,
    name: typeof row.name === "string" ? row.name : "",
    image: typeof row.image === "string" ? row.image : "",
    occupation: typeof row.occupation === "string" ? row.occupation : "",
    XP: parseXp(row.xp),
    passwordHash: typeof row.password_hash === "string" ? row.password_hash : undefined,
    isAdmin: Boolean(row.is_admin),
    role: normalizeRole(row.role),
    mapScope: normalizeMapScope(row.map_scope),
    trustScore: parseTrustScore(row.trust_score),
    trustTier: normalizeTrustTier(row.trust_tier),
    suspendedUntil: typeof row.suspended_until === "string" ? normalizeCreatedAt(row.suspended_until) : null,
    wipeRequested: row.wipe_requested === true,
    failedLoginCount:
      typeof row.failed_login_count === "number" && Number.isFinite(row.failed_login_count)
        ? Math.max(0, Math.round(row.failed_login_count))
        : 0,
    lockedUntil: typeof row.locked_until === "string" ? normalizeCreatedAt(row.locked_until) : null,
  };
}

function isMissingPhoneColumnError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const pgError = error as Error & { code?: string };
  const message = error.message.toLowerCase();
  return pgError.code === "42703" && message.includes("phone");
}

async function getUserProfileLegacy(id: string): Promise<UserProfile | null> {
  const result = await query<Record<string, unknown>>(
    `
      select id, email, name, image, occupation, xp, password_hash, is_admin, role, map_scope,
             trust_score, trust_tier, suspended_until, wipe_requested, failed_login_count, locked_until
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

function rowToPointEvent(row: Record<string, unknown>): PointEvent {
  const details = row.details && typeof row.details === "object" ? (row.details as PointEvent["details"]) : {};
  const consentStatus = normalizeConsentStatus(row.consent_status);

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
    consentStatus,
    consentRecordedAt: typeof row.consent_recorded_at === "string" ? normalizeCreatedAt(row.consent_recorded_at) : undefined,
    erasedAt: typeof row.erased_at === "string" ? normalizeCreatedAt(row.erased_at) : null,
    erasedBy: typeof row.erased_by === "string" ? row.erased_by : null,
    erasureReason: typeof row.erasure_reason === "string" ? row.erasure_reason : null,
  };
}

async function getUserProfile(userId: string): Promise<UserProfile | null> {
  const id = normalizeUserId(userId);
  if (phoneColumnState === "missing") {
    return await getUserProfileLegacy(id);
  }

  try {
    const result = await query<Record<string, unknown>>(
      `
        select id, email, phone, name, image, occupation, xp, password_hash, is_admin, role, map_scope
               , trust_score, trust_tier, suspended_until, wipe_requested, failed_login_count, locked_until
        from user_profiles
        where id = $1
        limit 1
      `,
      [id],
    );

    const row = result.rows[0];
    if (!row) return null;
    if (phoneColumnState === "unknown") phoneColumnState = "present";
    return rowToUserProfile(row);
  } catch (error) {
    if (!isMissingPhoneColumnError(error)) throw error;
    phoneColumnState = "missing";
    return await getUserProfileLegacy(id);
  }
}

async function upsertUserProfileLegacy(params: {
  id: string;
  email: string | null;
  name: string;
  image: string;
  occupation: string;
  xp: number;
  passwordHash: string | null;
  isAdmin: boolean;
  role: UserRole;
  mapScope: MapScope;
  trustScore: number;
  trustTier: TrustTier;
  suspendedUntil: string | null;
  wipeRequested: boolean;
  failedLoginCount: number;
  lockedUntil: string | null;
}): Promise<void> {
  const legacyEmail = params.email ?? normalizeEmail(params.id);
  if (!legacyEmail) {
    throw new Error("Database migration required: phone-only identifiers need user_profiles.phone column");
  }

  await query(
    `
      insert into user_profiles (
        id, email, name, image, occupation, xp, password_hash, is_admin, role, map_scope,
        trust_score, trust_tier, suspended_until, wipe_requested, failed_login_count, locked_until, updated_at
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::timestamptz, $14, $15, $16::timestamptz, now())
      on conflict (id) do update
      set
        email = excluded.email,
        name = excluded.name,
        image = excluded.image,
        occupation = excluded.occupation,
        xp = excluded.xp,
        password_hash = coalesce(excluded.password_hash, user_profiles.password_hash),
        is_admin = excluded.is_admin,
        role = excluded.role,
        map_scope = excluded.map_scope,
        trust_score = excluded.trust_score,
        trust_tier = excluded.trust_tier,
        suspended_until = excluded.suspended_until,
        wipe_requested = excluded.wipe_requested,
        failed_login_count = excluded.failed_login_count,
        locked_until = excluded.locked_until,
        updated_at = now()
    `,
    [
      params.id,
      legacyEmail,
      params.name,
      params.image,
      params.occupation,
      params.xp,
      params.passwordHash,
      params.isAdmin,
      params.role,
      params.mapScope,
      params.trustScore,
      params.trustTier,
      params.suspendedUntil,
      params.wipeRequested,
      params.failedLoginCount,
      params.lockedUntil,
    ],
  );
}

async function upsertUserProfile(userId: string, profile: UserProfile): Promise<void> {
  const idCandidate = userId || profile.id || profile.email || profile.phone || "";
  const id = normalizeUserId(idCandidate);
  const email = normalizeEmail(profile.email);
  const phone = normalizePhone(profile.phone);
  const defaultLabel = email ?? phone ?? id;
  const name = typeof profile.name === "string" && profile.name.trim() ? profile.name.trim() : defaultLabel || "Contributor";
  const image = typeof profile.image === "string" ? profile.image : "";
  const occupation = typeof profile.occupation === "string" ? profile.occupation : "";
  const xp = parseXp(profile.XP);
  const passwordHash = typeof profile.passwordHash === "string" && profile.passwordHash.trim() ? profile.passwordHash : null;
  const isAdmin = profile.isAdmin === true;
  const role = normalizeRole(profile.role);
  const mapScope = normalizeMapScope(profile.mapScope);
  const trustScore = parseTrustScore(profile.trustScore);
  const trustTier = normalizeTrustTier(profile.trustTier);
  const suspendedUntil = typeof profile.suspendedUntil === "string" ? normalizeCreatedAt(profile.suspendedUntil) : null;
  const wipeRequested = profile.wipeRequested === true;
  const failedLoginCount =
    typeof profile.failedLoginCount === "number" && Number.isFinite(profile.failedLoginCount)
      ? Math.max(0, Math.round(profile.failedLoginCount))
      : 0;
  const lockedUntil = typeof profile.lockedUntil === "string" ? normalizeCreatedAt(profile.lockedUntil) : null;

  const runWithPhone = async () => {
    await query(
      `
        insert into user_profiles (
          id, email, phone, name, image, occupation, xp, password_hash, is_admin, role, map_scope,
          trust_score, trust_tier, suspended_until, wipe_requested, failed_login_count, locked_until, updated_at
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14::timestamptz, $15, $16, $17::timestamptz, now())
        on conflict (id) do update
        set
          email = excluded.email,
          phone = excluded.phone,
          name = excluded.name,
          image = excluded.image,
          occupation = excluded.occupation,
          xp = excluded.xp,
          password_hash = coalesce(excluded.password_hash, user_profiles.password_hash),
          is_admin = excluded.is_admin,
          role = excluded.role,
          map_scope = excluded.map_scope,
          trust_score = excluded.trust_score,
          trust_tier = excluded.trust_tier,
          suspended_until = excluded.suspended_until,
          wipe_requested = excluded.wipe_requested,
          failed_login_count = excluded.failed_login_count,
          locked_until = excluded.locked_until,
          updated_at = now()
      `,
      [
        id,
        email,
        phone,
        name,
        image,
        occupation,
        xp,
        passwordHash,
        isAdmin,
        role,
        mapScope,
        trustScore,
        trustTier,
        suspendedUntil,
        wipeRequested,
        failedLoginCount,
        lockedUntil,
      ],
    );
  };

  if (phoneColumnState === "missing") {
    await upsertUserProfileLegacy({
      id,
      email,
      name,
      image,
      occupation,
      xp,
      passwordHash,
      isAdmin,
      role,
      mapScope,
      trustScore,
      trustTier,
      suspendedUntil,
      wipeRequested,
      failedLoginCount,
      lockedUntil,
    });
    return;
  }

  try {
    await runWithPhone();
    if (phoneColumnState === "unknown") phoneColumnState = "present";
  } catch (error) {
    if (!isMissingPhoneColumnError(error)) throw error;
    phoneColumnState = "missing";
    await upsertUserProfileLegacy({
      id,
      email,
      name,
      image,
      occupation,
      xp,
      passwordHash,
      isAdmin,
      role,
      mapScope,
      trustScore,
      trustTier,
      suspendedUntil,
      wipeRequested,
      failedLoginCount,
      lockedUntil,
    });
  }
}

async function getUserProfilesBatch(ids: string[]): Promise<Map<string, UserProfile>> {
  if (!ids.length) return new Map();
  const normalizedIds = ids.map(normalizeUserId);

  const fetchRows = async (includePhone: boolean): Promise<UserProfile[]> => {
    const cols = includePhone
      ? "id, email, phone, name, image, occupation, xp, password_hash, is_admin, role, map_scope, trust_score, trust_tier, suspended_until, wipe_requested, failed_login_count, locked_until"
      : "id, email, name, image, occupation, xp, password_hash, is_admin, role, map_scope, trust_score, trust_tier, suspended_until, wipe_requested, failed_login_count, locked_until";
    const result = await query<Record<string, unknown>>(
      `select ${cols} from user_profiles where id = ANY($1::text[])`,
      [normalizedIds],
    );
    return result.rows.map(rowToUserProfile);
  };

  let rows: UserProfile[];
  if (phoneColumnState === "missing") {
    rows = await fetchRows(false);
  } else {
    try {
      rows = await fetchRows(true);
      if (phoneColumnState === "unknown") phoneColumnState = "present";
    } catch (error) {
      if (!isMissingPhoneColumnError(error)) throw error;
      phoneColumnState = "missing";
      rows = await fetchRows(false);
    }
  }

  return new Map(rows.map((profile) => [profile.id, profile]));
}

async function getPointEvents(): Promise<PointEvent[]> {
  const result = await query<Record<string, unknown>>(
    `
      select id, point_id, event_type, user_id, category, latitude, longitude, details, photo_url, created_at, source, external_id
             , consent_status, consent_recorded_at, erased_at, erased_by, erasure_reason
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
  const consentStatus = normalizeConsentStatus(event.consentStatus) ?? null;
  const consentRecordedAt = typeof event.consentRecordedAt === "string" ? normalizeCreatedAt(event.consentRecordedAt) : null;
  const erasedAt = typeof event.erasedAt === "string" ? normalizeCreatedAt(event.erasedAt) : null;
  const erasedBy = typeof event.erasedBy === "string" ? event.erasedBy : null;
  const erasureReason = typeof event.erasureReason === "string" ? event.erasureReason : null;

  await query(
    `
      insert into point_events (
        id, point_id, event_type, user_id, category, latitude, longitude, details, photo_url, created_at, source, external_id,
        consent_status, consent_recorded_at, erased_at, erased_by, erasure_reason
      )
      values ($1::uuid, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10::timestamptz, $11, $12, $13, $14::timestamptz, $15::timestamptz, $16, $17)
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
        external_id = excluded.external_id,
        consent_status = excluded.consent_status,
        consent_recorded_at = excluded.consent_recorded_at,
        erased_at = excluded.erased_at,
        erased_by = excluded.erased_by,
        erasure_reason = excluded.erasure_reason
    `,
    [
      id,
      pointId,
      eventType,
      userId,
      category,
      location.latitude,
      location.longitude,
      JSON.stringify(details),
      photoUrl,
      createdAt,
      source,
      externalId,
      consentStatus,
      consentRecordedAt,
      erasedAt,
      erasedBy,
      erasureReason,
    ],
  );
}

async function deletePointEvent(eventId: string): Promise<boolean> {
  const normalizedId = normalizeEventId(eventId);
  const result = await query(
    `
      delete from point_events
      where id = $1::uuid
    `,
    [normalizedId],
  );
  return result.rowCount > 0;
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
  deletePointEvent,
  bulkUpsertPointEvents,
  getLegacySubmissions,
};

export { getUserProfilesBatch };
