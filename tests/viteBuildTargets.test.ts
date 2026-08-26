import assert from "node:assert/strict";
import test from "node:test";

import viteConfigFactory from "../vite.config";

type FactoryResult = {
  build?: { rollupOptions?: { input?: Record<string, string> } };
};

async function resolveInput(
  target: string | undefined,
): Promise<Record<string, string>> {
  const previous = process.env.ADL_BUILD_TARGET;
  if (target === undefined) delete process.env.ADL_BUILD_TARGET;
  else process.env.ADL_BUILD_TARGET = target;
  try {
    const config = (await (viteConfigFactory as unknown as (env: {
      mode: string;
      command: string;
    }) => FactoryResult | Promise<FactoryResult>)({
      mode: "production",
      command: "build",
    })) as FactoryResult;
    return (config.build?.rollupOptions?.input ?? {}) as Record<string, string>;
  } finally {
    if (previous === undefined) delete process.env.ADL_BUILD_TARGET;
    else process.env.ADL_BUILD_TARGET = previous;
  }
}

test("default build emits only the field app entry", async () => {
  const input = await resolveInput(undefined);
  assert.deepEqual(Object.keys(input), ["main"]);
  assert.ok(input.main.endsWith("index.html"));
});

test("console build emits only the console entry", async () => {
  const input = await resolveInput("console");
  assert.deepEqual(Object.keys(input), ["console"]);
  assert.ok(input.console.endsWith("console.html"));
});
