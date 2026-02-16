import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@vercel/edge-config";

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

async function main() {
  loadEnv();
  const args = parseArgs(process.argv.slice(2));
  const csvPath = resolve(process.cwd(), args.csv);
  const csvText = readFileSync(csvPath, "utf8");
  const rows = parseCsv(csvText);

  const edgeConfigConnection = process.env.EDGE_CONFIG;
  if (!edgeConfigConnection) {
    throw new Error("Missing EDGE_CONFIG in .env");
  }

  const edgeConfigId = process.env.EDGE_CONFIG_ID;
  const token = process.env.VERCEL_API_TOKEN;
  if (args.write && (!edgeConfigId || !token)) {
    throw new Error("Writing requires EDGE_CONFIG_ID and VERCEL_API_TOKEN in .env");
  }

  const client = createClient(edgeConfigConnection);
  const existingEventsRaw = await client.get("point_events");
  const existingEvents = Array.isArray(existingEventsRaw) ? existingEventsRaw : [];
  const { importedEvents, summary: baseSummary } = planImports(rows, existingEvents);
  const summary = {
    csvPath,
    ...baseSummary,
  };

  console.log(JSON.stringify(summary, null, 2));

  if (args.dryRun) return;

  const mergedEvents = [...existingEvents, ...importedEvents];
  const response = await fetch(`https://api.vercel.com/v1/edge-config/${edgeConfigId}/items`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      items: [{ operation: "upsert", key: "point_events", value: mergedEvents }],
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to write point_events: ${response.status} ${text}`);
  }

  console.log(`Wrote ${importedEvents.length} imported events into point_events.`);
}

const isDirectRun = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));

if (isDirectRun) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}

export { parseCsv, normalizePoiType, inBounds, planImports };
