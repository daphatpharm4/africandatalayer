import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@vercel/edge-config";
import { Pool } from "pg";

function loadEnv() {
  const envPath = resolve(process.cwd(), ".env");
  const content = readFileSync(envPath, "utf8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    value = value.replace(/^"(.*)"$/, "$1");
    if (!process.env[key]) process.env[key] = value;
  }
}

function parseArgs(argv) {
  const args = {
    dryRun: true,
    write: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--write") {
      args.write = true;
      args.dryRun = false;
      continue;
    }
    if (token === "--dry-run") {
      args.dryRun = true;
      args.write = false;
    }
  }

  return args;
}

function resolvePostgresUrl() {
  return process.env.POSTGRES_URL ?? process.env.POSTGRES_PRISMA_URL ?? process.env.POSTGRES_URL_NON_POOLING ?? "";
}

function normalizeUserId(input) {
  return String(input ?? "").trim().toLowerCase();
}

function normalizeXp(input) {
  const value = typeof input === "number" ? input : Number(input);
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.round(value));
}

function normalizeMapScope(input) {
  const normalized = String(input ?? "bonamoussadi").trim().toLowerCase();
  if (normalized === "cameroon" || normalized === "global" || normalized === "bonamoussadi") return normalized;
  return "bonamoussadi";
}

function isUuid(input) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(input));
}

function deterministicUuid(seed) {
  const hex = createHash("sha1").update(seed).digest("hex").slice(0, 32).split("");
  hex[12] = "5";
  const variant = parseInt(hex[16], 16);
  hex[16] = ((variant & 0x3) | 0x8).toString(16);
  return `${hex.slice(0, 8).join("")}-${hex.slice(8, 12).join("")}-${hex.slice(12, 16).join("")}-${hex.slice(16, 20).join("")}-${hex.slice(20, 32).join("")}`;
}

function normalizeEventId(input, namespace = "event") {
  const value = String(input ?? "").trim();
  if (isUuid(value)) return value.toLowerCase();
  return deterministicUuid(`${namespace}:${value}`);
}

function normalizeCreatedAt(input) {
  if (typeof input === "string") {
    const parsed = new Date(input);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }
  return new Date().toISOString();
}

function normalizeLocation(location) {
  const latitude = typeof location?.latitude === "number" ? location.latitude : Number(location?.latitude);
  const longitude = typeof location?.longitude === "number" ? location.longitude : Number(location?.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return { latitude, longitude };
}

function normalizeCategory(input) {
  if (input === "pharmacy" || input === "fuel_station" || input === "mobile_money") return input;
  return "mobile_money";
}

function normalizeEventType(input) {
  if (input === "CREATE_EVENT" || input === "ENRICH_EVENT") return input;
  return "CREATE_EVENT";
}

function stripInlinePhotoData(event) {
  if (typeof event?.photoUrl !== "string" || !event.photoUrl.startsWith("data:image/")) return event;
  const details = { ...(event.details ?? {}), hasPhoto: true };
  return { ...event, details, photoUrl: undefined };
}

function normalizeSource(details, explicitSource) {
  const byDetails = typeof details?.source === "string" ? details.source.trim() : "";
  if (byDetails) return byDetails;
  const fromEvent = typeof explicitSource === "string" ? explicitSource.trim() : "";
  return fromEvent || null;
}

function normalizeExternalId(details, explicitExternalId) {
  const byDetails = typeof details?.externalId === "string" ? details.externalId.trim() : "";
  if (byDetails) return byDetails;
  const fromEvent = typeof explicitExternalId === "string" ? explicitExternalId.trim() : "";
  return fromEvent || null;
}

function toUserProfilesFromEdge(items) {
  const profiles = [];
  for (const [key, value] of Object.entries(items)) {
    if (!key.startsWith("user_")) continue;
    if (!value || typeof value !== "object") continue;

    const profile = value;
    const email = normalizeUserId(profile.email ?? profile.id);
    if (!email) continue;

    const id = normalizeUserId(profile.id ?? email);
    profiles.push({
      id,
      email,
      name: typeof profile.name === "string" && profile.name.trim() ? profile.name.trim() : email.split("@")[0] || "Contributor",
      image: typeof profile.image === "string" ? profile.image : "",
      occupation: typeof profile.occupation === "string" ? profile.occupation : "",
      xp: normalizeXp(profile.XP ?? profile.xp),
      passwordHash: typeof profile.passwordHash === "string" ? profile.passwordHash : null,
      isAdmin: profile.isAdmin === true,
      mapScope: normalizeMapScope(profile.mapScope),
    });
  }
  return profiles;
}

function toPointEventsFromEdge(pointEventsRaw, legacySubmissionsRaw) {
  const events = [];
  const skipped = [];

  const rawEvents = Array.isArray(pointEventsRaw) ? pointEventsRaw : [];
  for (const raw of rawEvents) {
    if (!raw || typeof raw !== "object") continue;
    const event = stripInlinePhotoData(raw);
    const location = normalizeLocation(event.location);
    if (!location) {
      skipped.push({ type: "point_event_invalid_location", id: raw.id ?? null });
      continue;
    }

    const details = event.details && typeof event.details === "object" ? event.details : {};
    const id = normalizeEventId(event.id ?? crypto.randomUUID(), "point_event");

    events.push({
      id,
      pointId: typeof event.pointId === "string" && event.pointId.trim() ? event.pointId.trim() : id,
      eventType: normalizeEventType(event.eventType),
      userId: normalizeUserId(event.userId ?? "unknown"),
      category: normalizeCategory(event.category),
      latitude: location.latitude,
      longitude: location.longitude,
      details,
      photoUrl: typeof event.photoUrl === "string" ? event.photoUrl : null,
      createdAt: normalizeCreatedAt(event.createdAt),
      source: normalizeSource(details, event.source),
      externalId: normalizeExternalId(details, event.externalId),
    });
  }

  const legacySubmissions = Array.isArray(legacySubmissionsRaw) ? legacySubmissionsRaw : [];
  for (const submission of legacySubmissions) {
    if (!submission || typeof submission !== "object") continue;
    const location = normalizeLocation(submission.location);
    if (!location) {
      skipped.push({ type: "legacy_submission_invalid_location", id: submission.id ?? null });
      continue;
    }

    const details = submission.details && typeof submission.details === "object" ? submission.details : {};
    const source = normalizeSource(details, "legacy_submission");
    const externalId = normalizeExternalId(details, `legacy:${submission.id}`);
    const id = normalizeEventId(`legacy-event-${submission.id ?? crypto.randomUUID()}`, "legacy_submission");

    events.push({
      id,
      pointId: typeof submission.id === "string" && submission.id.trim() ? submission.id.trim() : id,
      eventType: "CREATE_EVENT",
      userId: normalizeUserId(submission.userId ?? "legacy_user"),
      category: normalizeCategory(submission.category),
      latitude: location.latitude,
      longitude: location.longitude,
      details,
      photoUrl: typeof submission.photoUrl === "string" ? submission.photoUrl : null,
      createdAt: normalizeCreatedAt(submission.createdAt),
      source,
      externalId,
    });
  }

  const deduped = new Map();
  for (const event of events) {
    deduped.set(event.id, event);
  }

  return {
    events: Array.from(deduped.values()),
    skipped,
  };
}

async function upsertUserProfile(pool, profile) {
  await pool.query(
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
    [
      profile.id,
      profile.email,
      profile.name,
      profile.image,
      profile.occupation,
      profile.xp,
      profile.passwordHash,
      profile.isAdmin,
      profile.mapScope,
    ],
  );
}

async function upsertPointEvent(pool, event) {
  await pool.query(
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
    [
      event.id,
      event.pointId,
      event.eventType,
      event.userId,
      event.category,
      event.latitude,
      event.longitude,
      JSON.stringify(event.details ?? {}),
      event.photoUrl,
      event.createdAt,
      event.source,
      event.externalId,
    ],
  );
}

async function main() {
  loadEnv();
  const args = parseArgs(process.argv.slice(2));

  const edgeConfigConnection = process.env.EDGE_CONFIG;
  if (!edgeConfigConnection) {
    throw new Error("Missing EDGE_CONFIG in .env");
  }

  const postgresUrl = resolvePostgresUrl();
  if (!postgresUrl) {
    throw new Error("Missing POSTGRES_URL (or POSTGRES_PRISMA_URL / POSTGRES_URL_NON_POOLING) in .env");
  }

  const edgeClient = createClient(edgeConfigConnection);
  const items = (await edgeClient.getAll()) ?? {};

  const profiles = toUserProfilesFromEdge(items);
  const pointEventsRaw = Array.isArray(items.point_events) ? items.point_events : [];
  const submissionsRaw = Array.isArray(items.submissions) ? items.submissions : [];
  const { events, skipped } = toPointEventsFromEdge(pointEventsRaw, submissionsRaw);

  const summary = {
    dryRun: args.dryRun,
    usersFromEdge: profiles.length,
    pointEventsFromEdge: pointEventsRaw.length,
    submissionsFromEdge: submissionsRaw.length,
    eventsPreparedForPostgres: events.length,
    skippedRecords: skipped.length,
  };

  console.log(JSON.stringify(summary, null, 2));
  if (skipped.length) {
    console.log("-- skipped (first 20) --");
    console.log(JSON.stringify(skipped.slice(0, 20), null, 2));
  }

  if (args.dryRun) return;

  const pool = new Pool({ connectionString: postgresUrl });
  try {
    await pool.query("begin");
    for (const profile of profiles) {
      await upsertUserProfile(pool, profile);
    }
    for (const event of events) {
      await upsertPointEvent(pool, event);
    }
    await pool.query("commit");
  } catch (error) {
    await pool.query("rollback");
    throw error;
  } finally {
    await pool.end();
  }

  console.log(`Migrated ${profiles.length} users and ${events.length} events to Postgres.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
