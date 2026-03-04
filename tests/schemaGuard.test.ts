import test from 'node:test';
import assert from 'node:assert/strict';
import { diffCategorySets, parseConstraintCategories } from '../lib/server/schemaGuard.js';

test('parseConstraintCategories extracts category values from check expression', () => {
  const definition = "CHECK ((category = ANY (ARRAY['pharmacy'::text, 'fuel_station'::text, 'mobile_money'::text])))";
  const parsed = parseConstraintCategories(definition);
  assert.deepEqual(parsed, ['fuel_station', 'mobile_money', 'pharmacy']);
});

test('diffCategorySets returns missing and extra categories', () => {
  const diff = diffCategorySets(
    ['pharmacy', 'fuel_station', 'mobile_money', 'billboard'],
    ['pharmacy', 'mobile_money', 'retail_kiosk'],
  );

  assert.equal(diff.ok, false);
  assert.deepEqual(diff.missing, ['billboard', 'fuel_station']);
  assert.deepEqual(diff.extra, ['retail_kiosk']);
});

test('diffCategorySets is ok when expected and actual categories match', () => {
  const diff = diffCategorySets(['pharmacy', 'fuel_station'], ['fuel_station', 'pharmacy']);
  assert.equal(diff.ok, true);
  assert.deepEqual(diff.missing, []);
  assert.deepEqual(diff.extra, []);
});
