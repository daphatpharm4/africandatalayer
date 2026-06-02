#!/usr/bin/env node
/**
 * One-shot baseline for a database whose schema already exists but whose
 * _migrations table is empty (e.g. prod was provisioned outside this tool).
 *
 * Records every migration file as already-applied EXCEPT the ones named on the
 * command line, WITHOUT executing any SQL. After baselining, `npm run migrate`
 * will skip the historical set and apply only the genuinely-new migrations.
 *
 * Usage:
 *   node scripts/baseline-migrations.mjs --except 20260601_api_idempotency_keys.sql 20260602_point_events_spatial_index.sql
 *   node scripts/baseline-migrations.mjs --except <files...> --apply   # actually write (default is dry-run)
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import pg from "pg";

const { Pool } = pg;

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) return;
  for (const rawLine of readFileSync(filePath, "utf8").split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const idx = line.indexOf("=");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim().replace(/^"(.*)"$/, "$1");
    if (!(key in process.env)) process.env[key] = value;
  }
}

function resolveDatabaseUrl() {
  return (
    process.env.ADL_POSTGRES_URL ??
    process.env.POSTGRES_URL ??
    process.env.POSTGRES_PRISMA_URL ??
    process.env.POSTGRES_URL_NON_POOLING ??
    null
  );
}

function applyNoVerifySslMode(connectionString) {
  try {
    const parsed = new URL(connectionString);
    parsed.searchParams.set("sslmode", "no-verify");
    parsed.searchParams.delete("sslrootcert");
    return parsed.toString();
  } catch {
    return connectionString;
  }
}

async function main() {
  loadEnvFile(resolve(process.cwd(), ".env"));
  loadEnvFile(resolve(process.cwd(), ".env.local"));

  const argv = process.argv.slice(2);
  const apply = argv.includes("--apply");
  const exceptIdx = argv.indexOf("--except");
  const except = new Set(exceptIdx === -1 ? [] : argv.slice(exceptIdx + 1).filter((a) => !a.startsWith("--")));
  if (except.size === 0) {
    console.error("Refusing to baseline with an empty --except set (that would mark ALL migrations applied, including new ones). Pass the new migration filenames after --except.");
    process.exit(1);
  }

  const connectionString = resolveDatabaseUrl();
  if (!connectionString) {
    console.error("Missing database URL.");
    process.exit(1);
  }

  const migrationsDir = resolve(process.cwd(), "supabase", "migrations");
  const files = readdirSync(migrationsDir).filter((n) => n.endsWith(".sql")).sort((a, b) => a.localeCompare(b));
  const toBaseline = files.filter((f) => !except.has(f));
  const toLeavePending = files.filter((f) => except.has(f));

  console.log(`Will mark ${toBaseline.length} migration(s) as applied (no SQL run):`);
  for (const f of toBaseline) console.log(`  BASELINE  ${f}`);
  console.log(`\nWill LEAVE pending (apply later via npm run migrate): ${toLeavePending.length}`);
  for (const f of toLeavePending) console.log(`  PENDING   ${f}`);

  if (!apply) {
    console.log("\nDry run (no writes). Re-run with --apply to write _migrations rows.");
    return;
  }

  const pool = new Pool({ connectionString: applyNoVerifySslMode(connectionString), ssl: { rejectUnauthorized: false } });
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        id SERIAL PRIMARY KEY,
        filename TEXT NOT NULL UNIQUE,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    let inserted = 0;
    for (const f of toBaseline) {
      const res = await pool.query("INSERT INTO _migrations (filename) VALUES ($1) ON CONFLICT (filename) DO NOTHING", [f]);
      inserted += res.rowCount ?? 0;
    }
    console.log(`\nDone. Recorded ${inserted} baseline row(s) (existing rows left untouched).`);
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error("Baseline failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
