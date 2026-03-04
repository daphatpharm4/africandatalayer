#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import pg from "pg";

const { Pool } = pg;

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) return;
  const content = readFileSync(filePath, "utf8");
  for (const rawLine of content.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const idx = line.indexOf("=");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();
    value = value.replace(/^"(.*)"$/, "$1");
    if (!(key in process.env)) {
      process.env[key] = value;
    }
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

function parseArgs(argv) {
  const args = {
    dryRun: false,
  };
  for (const token of argv) {
    if (token === "--dry-run") args.dryRun = true;
    if (token === "--apply") args.dryRun = false;
  }
  return args;
}

async function ensureMigrationsTable(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id SERIAL PRIMARY KEY,
      filename TEXT NOT NULL UNIQUE,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

async function getAppliedMigrations(pool) {
  const result = await pool.query("SELECT filename FROM _migrations ORDER BY filename");
  return new Set(result.rows.map((row) => row.filename));
}

function listMigrationFiles(migrationsDir) {
  return readdirSync(migrationsDir)
    .filter((name) => name.endsWith(".sql"))
    .sort((a, b) => a.localeCompare(b));
}

async function applyMigration(pool, filename, sql) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(sql);
    await client.query("INSERT INTO _migrations (filename) VALUES ($1)", [filename]);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function main() {
  loadEnvFile(resolve(process.cwd(), ".env"));
  loadEnvFile(resolve(process.cwd(), ".env.local"));

  const args = parseArgs(process.argv.slice(2));
  const connectionString = resolveDatabaseUrl();
  if (!connectionString) {
    console.error("Missing database URL. Set ADL_POSTGRES_URL (or POSTGRES_URL).");
    process.exit(1);
  }

  const migrationsDir = resolve(process.cwd(), "supabase", "migrations");
  if (!existsSync(migrationsDir)) {
    console.error(`Migrations directory not found: ${migrationsDir}`);
    process.exit(1);
  }

  const pool = new Pool({ connectionString, ssl: { rejectUnauthorized: false } });
  try {
    await ensureMigrationsTable(pool);
    const applied = await getAppliedMigrations(pool);
    const files = listMigrationFiles(migrationsDir);

    let appliedCount = 0;
    for (const file of files) {
      if (applied.has(file)) {
        console.log(`SKIP  ${file}`);
        continue;
      }

      const fullPath = resolve(migrationsDir, file);
      const sql = readFileSync(fullPath, "utf8");

      if (args.dryRun) {
        console.log(`WOULD APPLY  ${file}`);
        continue;
      }

      console.log(`APPLY  ${file}`);
      await applyMigration(pool, file, sql);
      appliedCount += 1;
    }

    if (args.dryRun) {
      console.log("\nDry run complete.");
    } else {
      console.log(`\nDone. Applied ${appliedCount} migration(s).`);
    }
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error("Migration failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
