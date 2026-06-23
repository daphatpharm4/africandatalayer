import { createHash } from "node:crypto";
import { query } from "../db.js";
import { buildPointEventsQuery, type PointEventFilter } from "./pointEventsQuery.js";
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
import { decodeAvatarPreset, encodeAvatarPresetImage } from "../../../shared/avatarPresets.js";
import { isValidCategory } from "../../../shared/verticals.js";
import { normalizeEmail, normalizePhone } from "../../shared/identifier.js";
import { normalizeCreatedAt } from "./createdAt.js";
import type { StorageStore } from "./types.js";

const VALID_MAP_SCOPES: ReadonlySet<MapScope> = new Set(["bonamoussadi", "cameroon", "global"]);
const VALID_ROLES: ReadonlySet<UserRole> = new Set(["agent", "admin", "client", "point_operator"]);
const VALID_TRUST_TIERS: ReadonlySet<TrustTier> = new Set(["new", "standard", "trusted", "restricted"]);
const VALID_CONSENT_STATUSES: ReadonlySet<ConsentStatus> = new Set([
  "obtained",
  "refused_pii_only",
  "not_required",
  "withdrawn",
]);

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
    avatarPreset: decodeAvatarPreset(row.image),
    occupation: typeof row.occupation === "string" ? row.occupation : "",
    XP: parseXp(row.xp),
    passwordHash: typeof row.password_hash === "string" ? row.password_hash : undefined,
    isAdmin: Boolean(row.is_admin),
    role: normalizeRole(row.role),
    mapScope: normalizeMapScope(row.map_scope),
    mustChangePassword: row.must_change_password === true,
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

type ProfileColumnState = "unknown" | "present" | "missing";
type ProfileQueryResult = { rows: Record<string, unknown>[] };
type ProfileQuery = (text: string, values?: unknown[]) => Promise<ProfileQueryResult>;

interface NormalizedProfileParams {
  id: string;
  email: string | null;
  phone: string | null;
  name: string;
  image: string;
  occupation: string;
  xp: number;
  passwordHash: string | null;
  isAdmin: boolean;
  role: UserRole;
  mapScope: MapScope;
  mustChangePassword: boolean;
  trustScore: number;
  trustTier: TrustTier;
  suspendedUntil: string | null;
  wipeRequested: boolean;
  failedLoginCount: number;
  lockedUntil: string | null;
}

interface ProfileColumnOptions {
  includePhone: boolean;
  includeMustChangePassword: boolean;
}

export interface PostgresProfilePersistence {
  getUserProfile(userId: string): Promise<UserProfile | null>;
  upsertUserProfile(userId: string, profile: UserProfile): Promise<void>;
  getUserProfilesBatch(ids: string[]): Promise<Map<string, UserProfile>>;
}

function isMissingProfileColumnError(error: unknown, column: "phone" | "must_change_password"): boolean {
  if (!(error instanceof Error)) return false;
  const pgError = error as Error & { code?: string };
  if (pgError.code !== "42703") return false;
  const message = error.message.toLowerCase().replace(/["']/g, "");
  const escapedColumn = column.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(
    `\\bcolumn\\s+(?:[a-z_][a-z0-9_]*\\.)?${escapedColumn}` +
      `(?:\\s+of relation\\s+[a-z_][a-z0-9_.]*)?\\s+does not exist\\b`,
  ).test(message);
}

function normalizeProfileParams(userId: string, profile: UserProfile): NormalizedProfileParams {
  const idCandidate = userId || profile.id || profile.email || profile.phone || "";
  const id = normalizeUserId(idCandidate);
  const email = normalizeEmail(profile.email);
  const phone = normalizePhone(profile.phone);
  const defaultLabel = email ?? phone ?? id;
  const name = typeof profile.name === "string" && profile.name.trim() ? profile.name.trim() : defaultLabel || "Contributor";
  const avatarPreset = decodeAvatarPreset(profile.avatarPreset ?? profile.image);
  const image = avatarPreset ? encodeAvatarPresetImage(avatarPreset) : typeof profile.image === "string" ? profile.image : "";
  const occupation = typeof profile.occupation === "string" ? profile.occupation : "";
  const xp = parseXp(profile.XP);
  const passwordHash = typeof profile.passwordHash === "string" && profile.passwordHash.trim() ? profile.passwordHash : null;
  const isAdmin = profile.isAdmin === true;
  const role = normalizeRole(profile.role);
  const mapScope = normalizeMapScope(profile.mapScope);
  const mustChangePassword = profile.mustChangePassword === true;
  const trustScore = parseTrustScore(profile.trustScore);
  const trustTier = normalizeTrustTier(profile.trustTier);
  const suspendedUntil = typeof profile.suspendedUntil === "string" ? normalizeCreatedAt(profile.suspendedUntil) : null;
  const wipeRequested = profile.wipeRequested === true;
  const failedLoginCount =
    typeof profile.failedLoginCount === "number" && Number.isFinite(profile.failedLoginCount)
      ? Math.max(0, Math.round(profile.failedLoginCount))
      : 0;
  const lockedUntil = typeof profile.lockedUntil === "string" ? normalizeCreatedAt(profile.lockedUntil) : null;

  return {
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
    mustChangePassword,
    trustScore,
    trustTier,
    suspendedUntil,
    wipeRequested,
    failedLoginCount,
    lockedUntil,
  };
}

function profileSelectColumns(options: ProfileColumnOptions): string {
  const columns = ["id", "email"];
  if (options.includePhone) columns.push("phone");
  columns.push(
    "name",
    "image",
    "occupation",
    "xp",
    "password_hash",
    "is_admin",
    "role",
    "map_scope",
  );
  if (options.includeMustChangePassword) columns.push("must_change_password");
  columns.push(
    "trust_score",
    "trust_tier",
    "suspended_until",
    "wipe_requested",
    "failed_login_count",
    "locked_until",
  );
  return columns.join(", ");
}

function buildProfileUpsert(
  params: NormalizedProfileParams,
  options: ProfileColumnOptions,
): { text: string; values: unknown[] } {
  const persistedEmail = options.includePhone ? params.email : params.email ?? normalizeEmail(params.id);
  if (!options.includePhone && !persistedEmail) {
    throw new Error("Database migration required: phone-only identifiers need user_profiles.phone column");
  }

  const entries: Array<[column: string, value: unknown, cast?: string]> = [
    ["id", params.id],
    ["email", persistedEmail],
  ];
  if (options.includePhone) entries.push(["phone", params.phone]);
  entries.push(
    ["name", params.name],
    ["image", params.image],
    ["occupation", params.occupation],
    ["xp", params.xp],
    ["password_hash", params.passwordHash],
    ["is_admin", params.isAdmin],
    ["role", params.role],
    ["map_scope", params.mapScope],
  );
  if (options.includeMustChangePassword) {
    entries.push(["must_change_password", params.mustChangePassword]);
  }
  entries.push(
    ["trust_score", params.trustScore],
    ["trust_tier", params.trustTier],
    ["suspended_until", params.suspendedUntil, "timestamptz"],
    ["wipe_requested", params.wipeRequested],
    ["failed_login_count", params.failedLoginCount],
    ["locked_until", params.lockedUntil, "timestamptz"],
  );

  const columns = entries.map(([column]) => column);
  const values = entries.map(([, value]) => value);
  const placeholders = entries.map(([, , cast], index) => `$${index + 1}${cast ? `::${cast}` : ""}`);
  const updateColumns = columns.filter((column) => column !== "id" && column !== "password_hash");
  const updates = [
    ...updateColumns.map((column) => `${column} = excluded.${column}`),
    "password_hash = coalesce(excluded.password_hash, user_profiles.password_hash)",
    "updated_at = now()",
  ];

  return {
    text: `
      insert into user_profiles (${columns.join(", ")}, updated_at)
      values (${placeholders.join(", ")}, now())
      on conflict (id) do update
      set ${updates.join(", ")}
    `,
    values,
  };
}

export function createPostgresProfilePersistence(queryProfile: ProfileQuery): PostgresProfilePersistence {
  let phoneColumnState: ProfileColumnState = "unknown";
  let mustChangePasswordColumnState: ProfileColumnState = "unknown";

  const runWithColumnFallback = async <T>(
    operation: (options: ProfileColumnOptions) => Promise<T>,
  ): Promise<T> => {
    while (true) {
      const options = {
        includePhone: phoneColumnState !== "missing",
        includeMustChangePassword: mustChangePasswordColumnState !== "missing",
      };

      try {
        const result = await operation(options);
        if (options.includePhone && phoneColumnState === "unknown") phoneColumnState = "present";
        if (options.includeMustChangePassword && mustChangePasswordColumnState === "unknown") {
          mustChangePasswordColumnState = "present";
        }
        return result;
      } catch (error) {
        if (options.includePhone && isMissingProfileColumnError(error, "phone")) {
          phoneColumnState = "missing";
          continue;
        }
        if (
          options.includeMustChangePassword &&
          isMissingProfileColumnError(error, "must_change_password")
        ) {
          mustChangePasswordColumnState = "missing";
          continue;
        }
        throw error;
      }
    }
  };

  const getUserProfile = async (userId: string): Promise<UserProfile | null> => {
    const id = normalizeUserId(userId);
    return await runWithColumnFallback(async (options) => {
      const result = await queryProfile(
        `
          select ${profileSelectColumns(options)}
          from user_profiles
          where id = $1
          limit 1
        `,
        [id],
      );
      const row = result.rows[0];
      return row ? rowToUserProfile(row) : null;
    });
  };

  const upsertUserProfile = async (userId: string, profile: UserProfile): Promise<void> => {
    const params = normalizeProfileParams(userId, profile);
    await runWithColumnFallback(async (options) => {
      const statement = buildProfileUpsert(params, options);
      await queryProfile(statement.text, statement.values);
    });
  };

  const getUserProfilesBatch = async (ids: string[]): Promise<Map<string, UserProfile>> => {
    if (!ids.length) return new Map();
    const normalizedIds = ids.map(normalizeUserId);
    const rows = await runWithColumnFallback(async (options) => {
      const result = await queryProfile(
        `select ${profileSelectColumns(options)} from user_profiles where id = ANY($1::text[])`,
        [normalizedIds],
      );
      return result.rows.map(rowToUserProfile);
    });
    return new Map(rows.map((profile) => [profile.id, profile]));
  };

  return { getUserProfile, upsertUserProfile, getUserProfilesBatch };
}

const profilePersistence = createPostgresProfilePersistence(
  async (text, values = []) => await query<Record<string, unknown>>(text, values),
);
const { getUserProfile, upsertUserProfile, getUserProfilesBatch } = profilePersistence;

async function getPointEvents(filter?: PointEventFilter): Promise<PointEvent[]> {
  const { text, values } = buildPointEventsQuery(filter);
  const result = await query<Record<string, unknown>>(text, values);
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
