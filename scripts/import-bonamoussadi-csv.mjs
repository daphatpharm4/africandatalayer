import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";

const BONAMOUSSADI_BOUNDS = {
  south: 4.0755,
  west: 9.7185,
  north: 4.0999,
  east: 9.7602,
};

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
    csv: "",
    dryRun: false,
    write: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--csv") {
      args.csv = argv[i + 1] ?? "";
      i += 1;
      continue;
    }
    if (token === "--dry-run") {
      args.dryRun = true;
      continue;
    }
    if (token === "--write") {
      args.write = true;
      continue;
    }
  }
  if (!args.csv) {
    throw new Error("Usage: node scripts/import-bonamoussadi-csv.mjs --csv <path> --dry-run|--write");
  }
  if (!args.dryRun && !args.write) {
    args.dryRun = true;
  }
  return args;
}

function parseCsv(csvText) {
  const rows = [];
  let field = "";
  let row = [];
  let inQuotes = false;

  for (let i = 0; i < csvText.length; i += 1) {
    const char = csvText[i];
    if (char === '"') {
      if (inQuotes && csvText[i + 1] === '"') {
        field += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (char === "," && !inQuotes) {
      row.push(field);
      field = "";
      continue;
    }
    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && csvText[i + 1] === "\n") i += 1;
      row.push(field);
      if (row.length > 1) rows.push(row);
      field = "";
      row = [];
      continue;
    }
    field += char;
  }

  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }

  const header = rows.shift() ?? [];
  return rows.map((values) => {
    const record = {};
    for (let i = 0; i < header.length; i += 1) {
      record[header[i]] = values[i] ?? "";
    }
    return record;
  });
}

function toNumber(input) {
  const parsed = Number(input);
  return Number.isFinite(parsed) ? parsed : null;
}

function inBounds(latitude, longitude) {
  return (
    latitude >= BONAMOUSSADI_BOUNDS.south &&
    latitude <= BONAMOUSSADI_BOUNDS.north &&
    longitude >= BONAMOUSSADI_BOUNDS.west &&
    longitude <= BONAMOUSSADI_BOUNDS.east
  );
}

function normalizePoiType(value) {
  const raw = String(value ?? "").trim().toLowerCase();
  if (raw === "pharmacy") return "pharmacy";
  if (raw === "fuel") return "fuel_station";
  return null;
}

function compact(value) {
  const next = String(value ?? "").trim();
  return next || undefined;
}

function buildPointId(externalId) {
  return `ext-${externalId.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`;
}

function planImports(rows, existingEvents) {
  const byExternalId = new Map();
  for (const event of existingEvents) {
    if (event && typeof event.externalId === "string" && event.externalId.trim()) {
      byExternalId.set(event.externalId.trim(), event);
    }
  }

  const importedEvents = [];
  let skippedOutOfBounds = 0;
  let skippedInvalid = 0;
  let created = 0;
  let enriched = 0;

  for (const row of rows) {
    const category = normalizePoiType(row.poi_type);
    if (!category) {
      skippedInvalid += 1;
      continue;
    }
    const latitude = toNumber(row.lat);
    const longitude = toNumber(row.lon);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      skippedInvalid += 1;
      continue;
    }
    if (!inBounds(latitude, longitude)) {
      skippedOutOfBounds += 1;
      continue;
    }

    const source = compact(row.source) ?? "osm_overpass";
    const osmId = compact(row.osm_id);
    if (!osmId) {
      skippedInvalid += 1;
      continue;
    }
    const externalId = `${source}:${osmId}`;
    const previous = byExternalId.get(externalId);
    const eventType = previous ? "ENRICH_EVENT" : "CREATE_EVENT";
    const pointId = previous?.pointId ?? buildPointId(externalId);

    const details = {
      name: compact(row.name),
      openingHours: compact(row.opening_hours),
      phone: compact(row.phone),
      brand: compact(row.brand),
      operator: compact(row.operator),
      website: compact(row.website),
      confidenceScore: toNumber(row.confidence_score) ?? undefined,
      lastSeenAt: compact(row.last_seen_at),
      source,
      externalId,
      isImported: true,
      ...(category === "pharmacy" ? { isOpenNow: true } : { hasFuelAvailable: true }),
    };

    const event = {
      id: crypto.randomUUID(),
      pointId,
      eventType,
      userId: "csv_importer",
      category,
      location: { latitude, longitude },
      details,
      createdAt: new Date().toISOString(),
      source,
      externalId,
    };

    importedEvents.push(event);
    byExternalId.set(externalId, event);
    if (eventType === "CREATE_EVENT") created += 1;
    else enriched += 1;
  }

  const summary = {
    totalRows: rows.length,
    imported: importedEvents.length,
    created,
    enriched,
    skippedOutOfBounds,
    skippedInvalid,
    existingPointEvents: existingEvents.length,
    resultingPointEvents: existingEvents.length + importedEvents.length,
  };

  return { importedEvents, summary };
}

function resolvePostgresUrl() {
  return process.env.POSTGRES_URL ?? process.env.POSTGRES_PRISMA_URL ?? process.env.POSTGRES_URL_NON_POOLING ?? "";
}

function normalizeCreatedAt(input) {
  if (typeof input === "string") {
    const parsed = new Date(input);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }
  return new Date().toISOString();
}

function rowToEvent(row) {
  return {
    id: row.id,
    pointId: row.point_id,
    eventType: row.event_type,
    userId: row.user_id,
    category: row.category,
    location: {
      latitude: typeof row.latitude === "number" ? row.latitude : Number(row.latitude),
      longitude: typeof row.longitude === "number" ? row.longitude : Number(row.longitude),
    },
    details: row.details && typeof row.details === "object" ? row.details : {},
    photoUrl: row.photo_url ?? undefined,
    createdAt: normalizeCreatedAt(row.created_at),
    source: row.source ?? undefined,
    externalId: row.external_id ?? undefined,
  };
}

async function fetchExistingPointEvents(pool) {
  const result = await pool.query(
    `
      select id, point_id, event_type, user_id, category, latitude, longitude, details, photo_url, created_at, source, external_id
      from point_events
      order by created_at asc
    `,
  );
  return result.rows.map(rowToEvent);
}

async function upsertPointEvent(pool, event) {
  const location = event.location ?? {};
  const latitude = Number(location.latitude);
  const longitude = Number(location.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    throw new Error(`Invalid event location for event ${event.id}`);
  }

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
      latitude,
      longitude,
      JSON.stringify(event.details ?? {}),
      typeof event.photoUrl === "string" ? event.photoUrl : null,
      normalizeCreatedAt(event.createdAt),
      typeof event.source === "string" ? event.source : null,
      typeof event.externalId === "string" ? event.externalId : null,
    ],
  );
}

async function main() {
  loadEnv();
  const args = parseArgs(process.argv.slice(2));
  const csvPath = resolve(process.cwd(), args.csv);
  const csvText = readFileSync(csvPath, "utf8");
  const rows = parseCsv(csvText);

  const postgresUrl = resolvePostgresUrl();
  if (!postgresUrl) {
    throw new Error("Missing POSTGRES_URL (or POSTGRES_PRISMA_URL / POSTGRES_URL_NON_POOLING) in .env");
  }

  const pool = new Pool({ connectionString: postgresUrl });

  try {
    const existingEvents = await fetchExistingPointEvents(pool);
    const { importedEvents, summary: baseSummary } = planImports(rows, existingEvents);
    const summary = {
      csvPath,
      ...baseSummary,
    };

    console.log(JSON.stringify(summary, null, 2));

    if (args.dryRun) return;

    await pool.query("begin");
    for (const event of importedEvents) {
      await upsertPointEvent(pool, event);
    }
    await pool.query("commit");

    console.log(`Wrote ${importedEvents.length} imported events into point_events.`);
  } catch (error) {
    try {
      await pool.query("rollback");
    } catch {
      // ignore rollback failures
    }
    throw error;
  } finally {
    await pool.end();
  }
}

const isDirectRun = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));

if (isDirectRun) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}

export { parseCsv, normalizePoiType, inBounds, planImports };
