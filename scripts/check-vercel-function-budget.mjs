import { readdirSync, readFileSync } from "node:fs";
import { resolve, extname } from "node:path";

const DEFAULT_LIMIT = 12;
const ALLOWED_ROUTE_EXTENSIONS = new Set([".ts", ".js", ".mjs", ".cjs"]);

function parseLimit(value) {
  if (typeof value !== "string") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.floor(parsed);
}

function countApiRoutes(dirPath) {
  let total = 0;
  const stack = [dirPath];

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) continue;
    const entries = readdirSync(current, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = resolve(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
        continue;
      }
      if (!entry.isFile()) continue;
      if (ALLOWED_ROUTE_EXTENSIONS.has(extname(entry.name))) {
        total += 1;
      }
    }
  }

  return total;
}

function countCrons(vercelConfig) {
  if (!vercelConfig || typeof vercelConfig !== "object") return 0;
  if (!Array.isArray(vercelConfig.crons)) return 0;
  return vercelConfig.crons.length;
}

function main() {
  const rootDir = process.cwd();
  const vercelConfigPath = resolve(rootDir, "vercel.json");
  const apiDirPath = resolve(rootDir, "api");
  const limit = parseLimit(process.env.VERCEL_FUNCTION_BUDGET_LIMIT) ?? DEFAULT_LIMIT;

  let vercelConfig;
  try {
    vercelConfig = JSON.parse(readFileSync(vercelConfigPath, "utf8"));
  } catch (error) {
    console.error(`Unable to parse ${vercelConfigPath}:`, error instanceof Error ? error.message : String(error));
    process.exit(1);
  }

  const routeCount = countApiRoutes(apiDirPath);
  const cronCount = countCrons(vercelConfig);
  const projectedTotal = routeCount + cronCount;

  console.log(`[function-budget] route files: ${routeCount}`);
  console.log(`[function-budget] cron entries: ${cronCount}`);
  console.log(`[function-budget] projected deployment functions: ${projectedTotal}`);
  console.log(`[function-budget] budget limit: ${limit}`);

  if (projectedTotal > limit) {
    console.error(
      `[function-budget] budget exceeded: ${projectedTotal} > ${limit}. Reduce API routes or cron entries before deploy.`,
    );
    process.exit(1);
  }
}

main();
