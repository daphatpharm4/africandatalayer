import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const runnerPath = new URL('../scripts/migrate.mjs', import.meta.url);

test('migration runner excludes conflict copies and ad-hoc SQL files', async () => {
  const source = await readFile(runnerPath, 'utf8');

  assert.match(source, /\^\\d\{8\}_\[a-z0-9_\]\+\\\.sql\$/);
  assert.doesNotMatch(source, /\.filter\(\(name\) => name\.endsWith\("\.sql"\)\)/);
});
