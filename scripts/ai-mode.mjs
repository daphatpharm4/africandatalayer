#!/usr/bin/env node
// Toggle the runtime AI mode without a redeploy.
//
//   node scripts/ai-mode.mjs status         Show the current Edge Config value
//   node scripts/ai-mode.mjs deterministic  Force template fallback (no Gemini calls, no cost)
//   node scripts/ai-mode.mjs gemini         Use Gemini when GEMINI_API_KEY is configured
//
// Requires EDGE_CONFIG (read) and EDGE_CONFIG_ID + VERCEL_API_TOKEN (write)
// in the environment or .env.local. Changes propagate in seconds.
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

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

function getEdgeConfigId() {
  if (process.env.EDGE_CONFIG_ID) return process.env.EDGE_CONFIG_ID;
  const match = (process.env.EDGE_CONFIG ?? "").match(/ecfg_[A-Za-z0-9]+/);
  return match?.[0] ?? null;
}

async function readMode() {
  const connection = process.env.EDGE_CONFIG;
  if (!connection) {
    console.error("EDGE_CONFIG is not set; cannot read remote value.");
    process.exit(1);
  }
  const url = new URL(connection);
  const configId = getEdgeConfigId();
  const token = url.searchParams.get("token");
  const res = await fetch(`https://edge-config.vercel.com/${configId}/item/ai_mode?token=${token}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Edge Config read failed: ${res.status}`);
  return await res.json();
}

async function writeMode(mode) {
  const configId = getEdgeConfigId();
  const token = process.env.VERCEL_API_TOKEN;
  if (!configId || !token) {
    console.error("Writing requires EDGE_CONFIG (or EDGE_CONFIG_ID) and VERCEL_API_TOKEN.");
    process.exit(1);
  }
  const res = await fetch(`https://api.vercel.com/v1/edge-config/${configId}/items`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ items: [{ operation: "upsert", key: "ai_mode", value: mode }] }),
  });
  if (!res.ok) {
    throw new Error(`Edge Config write failed: ${res.status} ${await res.text()}`);
  }
}

async function main() {
  loadEnvFile(resolve(process.cwd(), ".env"));
  loadEnvFile(resolve(process.cwd(), ".env.local"));

  const command = (process.argv[2] ?? "status").toLowerCase();
  if (command === "status") {
    const mode = await readMode();
    console.log(`ai_mode: ${mode ?? "(unset — Gemini used when GEMINI_API_KEY is configured)"}`);
    return;
  }
  if (command !== "deterministic" && command !== "gemini") {
    console.error(`Unknown mode "${command}". Use: status | deterministic | gemini`);
    process.exit(1);
  }
  await writeMode(command);
  console.log(`ai_mode set to "${command}". Propagates to production in seconds — no redeploy needed.`);
}

main().catch((error) => {
  console.error("ai-mode failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
