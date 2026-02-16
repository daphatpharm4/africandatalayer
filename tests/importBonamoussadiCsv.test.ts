import test from 'node:test';
import assert from 'node:assert/strict';
import { inBounds, normalizePoiType, parseCsv, planImports } from '../scripts/import-bonamoussadi-csv.mjs';

test('CSV parser handles quoted commas in area_query', () => {
  const csv = [
    'source,area_query,poi_type,name,lat,lon,osm_id',
    '"osm_overpass","Bonamoussadi, Douala, Cameroon",pharmacy,Pharmacie A,4.0811,9.7471,1001'
  ].join('\n');
  const rows = parseCsv(csv);
  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.area_query, 'Bonamoussadi, Douala, Cameroon');
});

test('poi_type normalization maps pharmacy/fuel into target categories', () => {
  assert.equal(normalizePoiType('pharmacy'), 'pharmacy');
  assert.equal(normalizePoiType('fuel'), 'fuel_station');
  assert.equal(normalizePoiType('kiosk'), null);
});

test('geofence filter keeps only Bonamoussadi bounds', () => {
  assert.equal(inBounds(4.0864, 9.7346), true);
  assert.equal(inBounds(3.848, 11.5021), false);
});

test('upsert planning uses source+osm_id and emits ENRICH_EVENT for existing external IDs', () => {
  const rows = [
    {
      source: 'osm_overpass',
      poi_type: 'fuel',
      name: 'TOTAL Bonamoussadi 1',
      lat: '4.0864',
      lon: '9.7346',
      osm_id: '2993795424',
      opening_hours: '',
      confidence_score: '75',
      last_seen_at: '2026-02-16'
    }
  ];

  const existingEvents = [
    {
      id: 'evt-existing',
      pointId: 'ext-osm-overpass-2993795424',
      eventType: 'CREATE_EVENT',
      userId: 'seed',
      category: 'fuel_station',
      location: { latitude: 4.0864, longitude: 9.7346 },
      details: {},
      createdAt: '2026-02-15T00:00:00.000Z',
      source: 'osm_overpass',
      externalId: 'osm_overpass:2993795424'
    }
  ];

  const plan = planImports(rows as any[], existingEvents as any[]);
  assert.equal(plan.importedEvents.length, 1);
  assert.equal(plan.importedEvents[0]?.eventType, 'ENRICH_EVENT');
  assert.equal(plan.summary.enriched, 1);
});
