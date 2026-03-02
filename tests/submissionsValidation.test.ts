import test from 'node:test';
import assert from 'node:assert/strict';
import { isWithinBonamoussadi } from '../shared/geofence.js';
import { isEnrichFieldAllowed, listCreateMissingFields, listMissingFields } from '../lib/server/pointProjection.js';
import { isValidCategory, getVertical, categoryLabel, VERTICAL_IDS } from '../shared/verticals.js';

test('strict Bonamoussadi geofence rejects out-of-bounds points', () => {
  assert.equal(isWithinBonamoussadi({ latitude: 4.086, longitude: 9.74 }), true);
  assert.equal(isWithinBonamoussadi({ latitude: 3.848, longitude: 11.5021 }), false);
});

test('create validation catches required fuel fields', () => {
  const missing = listCreateMissingFields('fuel_station', { name: 'TOTAL Bonamoussadi 1' });
  assert.ok(missing.includes('hasFuelAvailable'));
});

test('enrich rules only allow defined enrichable fields', () => {
  assert.equal(isEnrichFieldAllowed('mobile_money', 'providers'), true);
  assert.equal(isEnrichFieldAllowed('mobile_money', 'name'), false);
});

test('gap computation for pharmacy marks missing opening hours by default', () => {
  const gaps = listMissingFields('pharmacy', { name: 'Pharmacie Makepe', isOpenNow: true });
  assert.ok(gaps.includes('openingHours'));
  assert.ok(gaps.includes('isOnDuty'));
});

test('mobile money create validation only requires providers', () => {
  const missingWithoutProviders = listCreateMissingFields('mobile_money', {});
  const missingWithProviders = listCreateMissingFields('mobile_money', { providers: ['MTN'] });
  assert.ok(missingWithoutProviders.includes('providers'));
  assert.equal(missingWithProviders.length, 0);
});

test('vertical registry contains all expected verticals', () => {
  assert.ok(VERTICAL_IDS.length >= 14, `Expected at least 14 verticals, got ${VERTICAL_IDS.length}`);
  assert.ok(isValidCategory('pharmacy'));
  assert.ok(isValidCategory('alcohol_outlet'));
  assert.ok(isValidCategory('water_point'));
  assert.ok(!isValidCategory('invalid_category'));
});

test('getVertical returns config for new verticals', () => {
  const v = getVertical('alcohol_outlet');
  assert.equal(v.id, 'alcohol_outlet');
  assert.equal(v.labelEn, 'Alcohol Outlet');
  assert.ok(v.createRequiredFields.includes('name'));
});

test('categoryLabel returns localized labels', () => {
  assert.equal(categoryLabel('pharmacy', 'en'), 'Pharmacy');
  assert.equal(categoryLabel('pharmacy', 'fr'), 'Pharmacie');
  assert.equal(categoryLabel('billboard', 'fr'), 'Panneau publicitaire');
});

test('new vertical create validation requires name', () => {
  const missing = listCreateMissingFields('alcohol_outlet' as any, {});
  assert.ok(missing.includes('name'));
  const complete = listCreateMissingFields('alcohol_outlet' as any, { name: 'Bar Central' });
  assert.equal(complete.length, 0);
});
