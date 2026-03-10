import { spawn } from "node:child_process";
import { openAsBlob, mkdtempSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { put } from "@vercel/blob";

function log(event, details = {}) {
  console.log(
    JSON.stringify({
      ts: new Date().toISOString(),
      event,
      ...details,
    }),
  );
}

function resolveDatabaseUrl() {
  return (
    process.env.POSTGRES_BACKUP_URL ||
    process.env.ADL_POSTGRES_URL ||
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.POSTGRES_URL ||
    null
  );
}

function resolveBlobPath() {
  const prefix = (process.env.POSTGRES_BACKUP_PREFIX || "postgres").trim().replace(/^\/+|\/+$/g, "");
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `${prefix}/weekly/${stamp}.dump`;
}

async function runPgDump(databaseUrl, outputPath) {
  const pgDumpBin = process.env.PG_DUMP_BIN || "pg_dump";
  const args = [
    "--dbname",
    databaseUrl,
    "--format=custom",
    "--compress=9",
    "--no-owner",
    "--no-privileges",
    "--file",
    outputPath,
  ];

  await new Promise((resolve, reject) => {
    const child = spawn(pgDumpBin, args, {
      stdio: ["ignore", "pipe", "pipe"],
      env: process.env,
    });

    let stderr = "";

    child.stdout.on("data", (chunk) => {
      const message = chunk.toString().trim();
      if (message) log("pg_dump.stdout", { message });
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", (error) => reject(error));
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(stderr.trim() || `pg_dump exited with code ${code}`));
    });
  });
}

async function main() {
  const databaseUrl = resolveDatabaseUrl();
  const blobToken = process.env.BLOB_READ_WRITE_TOKEN;

  if (!databaseUrl) {
    throw new Error("Missing POSTGRES_BACKUP_URL or fallback Postgres URL environment variable");
  }
  if (!blobToken) {
    throw new Error("Missing BLOB_READ_WRITE_TOKEN");
  }

  const workdir = mkdtempSync(join(tmpdir(), "adl-postgres-backup-"));
  const dumpPath = join(workdir, "pilot.dump");
  const blobPath = resolveBlobPath();

  try {
    log("backup.start", { blobPath });
    await runPgDump(databaseUrl, dumpPath);

    const sizeBytes = statSync(dumpPath).size;
    const blob = await openAsBlob(dumpPath);
    const result = await put(blobPath, blob, {
      access: "private",
      addRandomSuffix: false,
      token: blobToken,
      contentType: "application/octet-stream",
    });

    log("backup.complete", {
      blobPath,
      sizeBytes,
      url: result.url,
      downloadedUrl: result.downloadUrl,
    });
  } finally {
    rmSync(workdir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  log("backup.failed", {
    message: error instanceof Error ? error.message : String(error),
  });
  process.exit(1);
});
