import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const SCRIPT = resolve(process.cwd(), "scripts/check-vercel-function-budget.mjs");

function run(env: Record<string, string> = {}): { code: number | null; stdout: string; stderr: string } {
  const result = spawnSync("node", [SCRIPT], {
    cwd: process.cwd(),
    env: { ...process.env, ...env },
    encoding: "utf8",
  });
  return { code: result.status, stdout: result.stdout, stderr: result.stderr };
}

test("budget script passes with current routes + crons", () => {
  const result = run();
  assert.equal(result.code, 0, `stdout: ${result.stdout}\nstderr: ${result.stderr}`);
  assert.match(result.stdout, /not covered by existing routes/);
});

test("budget script fails when limit lowered below current count", () => {
  const result = run({ VERCEL_FUNCTION_BUDGET_LIMIT: "1" });
  assert.equal(result.code, 1);
  assert.match(result.stderr, /budget exceeded/);
});
