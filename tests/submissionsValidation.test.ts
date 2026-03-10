import test from 'node:test';
import assert from 'node:assert/strict';
import { isWithinBonamoussadi } from '../shared/geofence.js';
import {
  canonicalizeEnrichField,
  filterEnrichDetails,
  isEnrichFieldAllowed,
  listCreateMissingFields,
  listMissingFields,
} from '../lib/server/pointProjection.js';
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

test('enrich field aliases normalize to canonical enrichable fields', () => {
  assert.equal(canonicalizeEnrichField('hours'), 'openingHours');
  assert.equal(canonicalizeEnrichField('merchantId'), 'merchantIdByProvider');
  assert.equal(canonicalizeEnrichField('hasCashAvailable'), 'hasMin50000XafAvailable');
});

test('filterEnrichDetails keeps updates to already filled enrichable fields', () => {
  assert.deepEqual(
    filterEnrichDetails('pharmacy', {
      openingHours: '07:30 - 21:00',
      isOpenNow: false,
      name: 'Should not pass enrich filtering',
    }),
    {
      openingHours: '07:30 - 21:00',
      isOpenNow: false,
    },
  );
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
  assert.equal(VERTICAL_IDS.length, 7, `Expected 7 active verticals, got ${VERTICAL_IDS.length}`);
  assert.ok(isValidCategory('pharmacy'));
  assert.ok(isValidCategory('alcohol_outlet'));
  assert.ok(isValidCategory('transport_road'));
  assert.ok(isValidCategory('census_proxy'));
  assert.ok(!isValidCategory('retail_kiosk'));
  assert.ok(!isValidCategory('invalid_category'));
});

test('getVertical returns config for new verticals', () => {
  const road = getVertical('transport_road');
  assert.equal(road.id, 'transport_road');
  assert.equal(road.labelEn, 'Road Segment');
  assert.ok(road.createRequiredFields.includes('roadName'));
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

test('transport road and census proxy enforce required create fields', () => {
  const roadMissing = listCreateMissingFields('transport_road' as any, { roadName: 'Rue 5' });
  assert.ok(roadMissing.includes('condition'));

  const roadComplete = listCreateMissingFields('transport_road' as any, { roadName: 'Rue 5', condition: 'good' });
  assert.equal(roadComplete.length, 0);

  const censusMissing = listCreateMissingFields('census_proxy' as any, { buildingType: 'residential' });
  assert.ok(censusMissing.includes('occupancyStatus'));

  const censusComplete = listCreateMissingFields('census_proxy' as any, {
    buildingType: 'residential',
    occupancyStatus: 'occupied',
  });
  assert.equal(censusComplete.length, 0);
});
