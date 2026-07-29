import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  MAP_ANNOTATION_STATES, OPERATIONAL_STATUSES, TYPOGRAPHY_ROLES,
  UI_FOUNDATION, getStatusPresentation, getToneClasses,
} from '../lib/shared/ui/semanticTokens.js';

test('every operational status has a complete presentation', () => {
  assert.equal(OPERATIONAL_STATUSES.length, 9);
  for (const status of OPERATIONAL_STATUSES) {
    const presentation = getStatusPresentation(status);
    const classes = getToneClasses(presentation.tone);
    assert.ok(presentation.icon);
    assert.match(classes.badge, /bg-/);
    assert.match(classes.badge, /text-/);
    assert.match(classes.panel, /border-/);
  }
});

test('foundation values and vocabulary remain stable', () => {
  assert.deepEqual(UI_FOUNDATION.spacing, [4, 8, 12, 16, 24, 32]);
  assert.deepEqual(UI_FOUNDATION.minimumTarget, { field: 48, console: 44 });
  assert.equal(TYPOGRAPHY_ROLES.length, 8);
  assert.deepEqual(MAP_ANNOTATION_STATES, ['default', 'selected', 'verified', 'flagged', 'cluster', 'uncertainty', 'route']);
  assert.notEqual(getStatusPresentation('verified').icon, getStatusPresentation('success').icon);
});

test('native shells mirror shared vocabulary', async () => {
  const nativeField = await readFile(new URL('../ios/App/App/Native/ADLDesignSystem.swift', import.meta.url), 'utf8');
  const nativeConsole = await readFile(new URL('../ios-console/ADLConsole/DesignSystem/ADLConsoleComponents.swift', import.meta.url), 'utf8');
  for (const status of OPERATIONAL_STATUSES) assert.match(nativeField, new RegExp(`case ${status}\\b`));
  for (const tone of ['neutral', 'primary', 'success', 'warning', 'danger', 'info']) {
    assert.match(nativeConsole, new RegExp(`case ${tone}\\b`));
  }
});
