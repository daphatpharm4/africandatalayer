import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const appPath = new URL("../App.tsx", import.meta.url);
const flowPath = new URL("../components/Screens/PlatformCollectionFlow.tsx", import.meta.url);
const profilePath = new URL("../components/Screens/Profile.tsx", import.meta.url);

test("authenticated company collectors are routed to company collection before generic ADL verticals", async () => {
  const source = await readFile(appPath, "utf8");
  assert.match(source, /loadPlatformFieldContext/);
  assert.match(source, /<PlatformCollectionFlow/);
  assert.match(source, /Boolean\(platformFieldContext\?\.organizations\.length\)/);
  assert.doesNotMatch(source, /onUseGeneric/);
});

test("company collection renders published record types and all supported dynamic field controls", async () => {
  const source = await readFile(flowPath, "utf8");
  for (const fieldType of ["boolean", "select", "multi_select", "photo", "gps", "number", "date"]) {
    assert.ok(source.includes(`field.type === '${fieldType}'`) || source.includes(`field.type === '${fieldType}' ?`), fieldType);
  }
  assert.match(source, /: 'text'\}/);
  assert.match(source, /createPlatformRecordRequest/);
  assert.match(source, /Company submissions need a connection for now/);
  assert.match(source, /min-h-12/);
  assert.doesNotMatch(source, /Use ADL public collection/);
});

test("profile exposes organization branding, role, projects, and refresh state", async () => {
  const source = await readFile(profilePath, "utf8");
  assert.match(source, /profile-company-workspace/);
  assert.match(source, /organization\.logoUrl/);
  assert.match(source, /\.role/);
  assert.match(source, /entry\.projects\.length/);
  assert.match(source, /onRefreshPlatformFieldContext/);
});
