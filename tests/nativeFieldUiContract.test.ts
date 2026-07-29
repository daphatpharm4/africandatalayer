import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const designPath = new URL('../ios/App/App/Native/ADLDesignSystem.swift', import.meta.url);
const viewsPath = new URL('../ios/App/App/Native/ADLViews.swift', import.meta.url);

test('native ADL mirrors semantic status names and map linkage', async () => {
  const [design, views] = await Promise.all([readFile(designPath, 'utf8'), readFile(viewsPath, 'utf8')]);
  for (const state of ['idle', 'loading', 'success', 'warning', 'error', 'offline', 'syncing', 'verified', 'flagged']) {
    assert.match(design, new RegExp(`case ${state}\\b`));
  }
  assert.match(design, /case `default`/);
  assert.match(views, /native-map-selection-state/);
  assert.match(views, /native-map-primary-action/);
});

test('native capture exposes draft, sync, and recovery states', async () => {
  const [services, views] = await Promise.all([
    readFile(new URL('../ios/App/App/Native/ADLServices.swift', import.meta.url), 'utf8'),
    readFile(viewsPath, 'utf8'),
  ]);
  assert.match(services, /NWPathMonitor/);
  assert.match(services, /isOffline/);
  assert.match(views, /native-capture-primary-action/);
  assert.match(views, /native-sync-status/);
  assert.match(views, /native-save-draft/);
});
